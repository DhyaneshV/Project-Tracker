import { v4 as uuidv4 } from 'uuid';
import { generateToken } from '@project-tracker/auth-library';
import {
  OrgRole, UserCategory, FunctionalRole, UserStatus, Department,
  ActionType, TwoFactorMethod, getHierarchyLevel,
} from '@project-tracker/shared-types';
import dotenv from 'dotenv';
import { GraphQLScalarType, Kind } from 'graphql';
import { SecurityService } from '../services/security.js';
import { AuditLogService } from '../services/audit.js';
import { EmailService } from '../services/email.js';
import { ddbDocClient, TABLE_NAME } from '../db.js';
import {
  PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  canAccessUser, canSeeData, redactSensitiveData,
  filterByHierarchy, validateReportingHierarchy, DataType,
} from '../rbac-engine.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';

// ─── DynamoDB key helpers ────────────────────────────────────────────────────

const userPK   = (userId: string)  => ({ PK: `USER#${userId}`,      SK: 'PROFILE' });
const emailIdx = (email:  string)  => `EMAIL#${email.toLowerCase()}`;
const otpPK    = (userId: string)  => ({ PK: `OTP#${userId}`,       SK: 'TOKEN'   });
const emailRoleKey = (orgId: string, email: string, role: string) =>
  ({ PK: `ORG#${orgId}`, SK: `EMAIL_ROLE#${email.toLowerCase()}#${role}` });

/** Fetch a user record by userId */
async function getUserById(userId: string): Promise<any | null> {
  const { Item } = await ddbDocClient.send(new GetCommand({ TableName: TABLE_NAME, Key: userPK(userId) }));
  return Item || null;
}

/** Fetch a user by email using GSI1 (GSI1PK = EMAIL#<email>) */
async function getUserByEmail(email: string): Promise<any | null> {
  const { Items } = await ddbDocClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :e',
    ExpressionAttributeValues: { ':e': emailIdx(email) },
    Limit: 1,
  }));
  return Items?.[0] || null;
}

/** Fetch all users in an org using GSI2 (GSI2PK = ORG#<orgId>) */
async function getUsersByOrg(orgId: string): Promise<any[]> {
  const { Items } = await ddbDocClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'GSI2',
    KeyConditionExpression: 'GSI2PK = :o',
    ExpressionAttributeValues: { ':o': `ORG#${orgId}` },
  }));
  return Items || [];
}

/** Save (create or overwrite) a user item */
async function putUser(user: Record<string, any>): Promise<void> {
  await ddbDocClient.send(new PutCommand({ TableName: TABLE_NAME, Item: user }));
}

// ─── OTP helpers ─────────────────────────────────────────────────────────────

const OTP_TTL_SECONDS = 300; // 5 minutes

/** Store an OTP in DynamoDB with TTL */
async function storeOtp(userId: string, email: string, otp: string): Promise<void> {
  const ttl = Math.floor(Date.now() / 1000) + OTP_TTL_SECONDS;
  await ddbDocClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      ...otpPK(userId),
      userId,
      email: email.toLowerCase(),
      otp,
      attempts: 0,
      ttl,
      createdAt: new Date().toISOString(),
    },
  }));
}

/** Verify and consume an OTP. Returns true on match, throws on too many attempts */
async function verifyAndConsumeOtp(userId: string, inputOtp: string): Promise<boolean> {
  const { Item } = await ddbDocClient.send(new GetCommand({
    TableName: TABLE_NAME, Key: otpPK(userId),
  }));

  if (!Item) throw new Error('Verification code not found or expired. Please log in again.');

  // Check TTL manually (DynamoDB TTL deletion can lag up to 48h)
  const nowSec = Math.floor(Date.now() / 1000);
  if (Item.ttl && nowSec > Item.ttl) {
    await ddbDocClient.send(new DeleteCommand({ TableName: TABLE_NAME, Key: otpPK(userId) }));
    throw new Error('Verification code has expired. Please log in again.');
  }

  if (Item.attempts >= 3) {
    throw new Error('Too many failed attempts. Account temporarily locked.');
  }

  if (Item.otp !== inputOtp) {
    // Increment attempts
    await ddbDocClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: otpPK(userId),
      UpdateExpression: 'ADD attempts :inc',
      ExpressionAttributeValues: { ':inc': 1 },
    }));
    throw new Error('Invalid verification code.');
  }

  // Valid — delete the OTP
  await ddbDocClient.send(new DeleteCommand({ TableName: TABLE_NAME, Key: otpPK(userId) }));
  return true;
}

// ─── DateTime scalar ─────────────────────────────────────────────────────────

const DateTimeScalar = new GraphQLScalarType({
  name: 'DateTime',
  serialize(value: any) {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return new Date(value).toISOString();
    return value;
  },
  parseValue(value: any) {
    if (!value) throw new Error('DateTime cannot be empty');
    const d = new Date(value);
    if (isNaN(d.getTime())) throw new Error(`Invalid DateTime: ${value}`);
    return d;
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      const d = new Date(ast.value);
      if (isNaN(d.getTime())) throw new Error(`Invalid DateTime literal: ${ast.value}`);
      return d;
    }
    return null;
  },
});

// ─── Resolvers ────────────────────────────────────────────────────────────────

export const resolvers = {
  DateTime: DateTimeScalar,

  Query: {
    me: (_: any, __: any, ctx: any) => {
      if (!ctx.user) return null;
      return { ...ctx.user, id: ctx.user.userId };
    },

    getAuditLogs: async (_: any, __: any, ctx: any) => {
      if (!ctx.user) throw new Error('Not authenticated');
      return AuditLogService.getOrgLogs(ctx.user.organizationId);
    },

    getAllUsers: async (_: any, { roleFilter, statusFilter }: any, ctx: any) => {
      if (!ctx.user) throw new Error('Not authenticated');
      let users = await getUsersByOrg(ctx.user.organizationId);
      if (roleFilter?.length)   users = users.filter(u => roleFilter.includes(u.role));
      if (statusFilter?.length) users = users.filter(u => statusFilter.includes(u.status));
      const accessible = filterByHierarchy(users as any, ctx.user);
      return accessible.map(u => redactSensitiveData(u, ctx.user));
    },

    getMyTeamMembers: async (_: any, __: any, ctx: any) => {
      if (!ctx.user) throw new Error('Not authenticated');
      const all = await getUsersByOrg(ctx.user.organizationId);
      const reports = all.filter(u => u.reportingManagerId === ctx.user.userId);
      return reports.map(u => redactSensitiveData(u, ctx.user));
    },

    getDepartmentEmployees: async (_: any, { department }: any, ctx: any) => {
      if (!ctx.user) throw new Error('Not authenticated');
      if (ctx.user.hierarchyLevel > 3 && ctx.user.department !== 'HR')
        throw new Error('Access Denied: Department-wide visibility requires VP+ clearance.');
      const all = await getUsersByOrg(ctx.user.organizationId);
      const dept = department || ctx.user.department;
      const filtered = all.filter(u => u.department === dept);
      return filterByHierarchy(filtered as any, ctx.user).map(u => redactSensitiveData(u, ctx.user));
    },

    getEmployeeById: async (_: any, { userId }: any, ctx: any) => {
      if (!ctx.user) throw new Error('Not authenticated');
      const target = await getUserById(userId);
      if (!target) throw new Error('User not found');
      if (!canAccessUser(ctx.user, target)) throw new Error('Access Denied');
      return redactSensitiveData(target, ctx.user);
    },

    getSalaryData: async (_: any, { userId }: any, ctx: any) => {
      if (!ctx.user) throw new Error('Not authenticated');
      const target = await getUserById(userId);
      if (!target) throw new Error('User not found');
      if (!canSeeData(ctx.user, DataType.SALARY, target))
        throw new Error('Access Denied: Compensation data is restricted.');
      return { amount: target.salary || 0, currency: target.currency || 'USD', lastUpdated: target.updatedAt };
    },

    // Stub queries — implemented in svc-projects; required here for schema completeness
    getProjects:        () => [],
    getProject:         () => null,
    getProjectTasks:    () => [],
    getProjectUpdates:  () => [],
    getProjectAnalytics: () => { throw new Error('Handled by svc-projects'); },
    getSRSDocuments:    () => [],
    listProjectDocuments: () => [],
    projectTeamMembers:          () => [],
    availableEmployeesForProject: () => [],
    getOrgAnalytics:    () => { throw new Error('Handled by svc-projects'); },
    getOrgRiskAlerts:   () => { throw new Error('Handled by svc-projects'); },
    getBudgetOverview:  () => { throw new Error('Handled by svc-projects'); },
    getMyTasks:         () => { throw new Error('Handled by svc-projects'); },
    getActivityFeed:    () => { throw new Error('Handled by svc-projects'); },
    getUpcomingDeadlines: () => { throw new Error('Handled by svc-projects'); },
    getPendingAllocations: () => { throw new Error('Handled by svc-projects'); },
    getProjectAllocations: () => { throw new Error('Handled by svc-projects'); },

    // ── Internal Messaging Queries ──────────────────────────────────────────
    getConversations: async (_: any, __: any, ctx: any) => {
      if (!ctx.user) throw new Error('Not authenticated.');
      // Get all messages in user's inbox
      const { Items: inboxItems } = await ddbDocClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :inbox',
        ExpressionAttributeValues: { ':inbox': `INBOX#${ctx.user.userId}` },
        ScanIndexForward: false,
      }));
      // Get all sent messages
      const { Items: sentItems } = await ddbDocClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'begins_with(PK, :prefix)',
        ExpressionAttributeValues: { ':prefix': `MSG#${ctx.user.userId}#` },
        ScanIndexForward: false,
      })).catch(() => ({ Items: [] }));

      // Combine to build conversations
      const allMsgs = [...(inboxItems || []), ...(sentItems || [])];
      const convMap = new Map<string, { recipientId: string; recipientName: string; recipientRole: string; lastMessage: string; lastMessageAt: string; unreadCount: number }>();

      for (const msg of allMsgs) {
        const otherId = msg.senderId === ctx.user.userId ? msg.recipientId : msg.senderId;
        const otherName = msg.senderId === ctx.user.userId ? msg.recipientName : msg.senderName;
        const otherRole = msg.senderId === ctx.user.userId ? msg.recipientRole : msg.senderRole;
        const existing = convMap.get(otherId);
        if (!existing || msg.createdAt > existing.lastMessageAt) {
          convMap.set(otherId, {
            recipientId: otherId,
            recipientName: otherName,
            recipientRole: otherRole,
            lastMessage: msg.content?.substring(0, 100) || msg.subject,
            lastMessageAt: msg.createdAt,
            unreadCount: (existing?.unreadCount || 0) + (msg.senderId !== ctx.user.userId && !msg.read ? 1 : 0),
          });
        } else if (msg.senderId !== ctx.user.userId && !msg.read) {
          existing.unreadCount++;
        }
      }
      return Array.from(convMap.values()).sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
    },

    getDirectMessages: async (_: any, { recipientId, limit, before }: any, ctx: any) => {
      if (!ctx.user) throw new Error('Not authenticated.');
      const myId = ctx.user.userId;
      // Get messages between these two users (both directions)
      const sentKey = `MSG#${myId}#${recipientId}`;
      const recvKey = `MSG#${recipientId}#${myId}`;

      const [sentResult, recvResult] = await Promise.all([
        ddbDocClient.send(new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: before ? 'PK = :pk AND SK < :before' : 'PK = :pk',
          ExpressionAttributeValues: { ':pk': sentKey, ...(before ? { ':before': `TS#${before}` } : {}) },
          ScanIndexForward: false,
          Limit: limit || 50,
        })),
        ddbDocClient.send(new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: before ? 'PK = :pk AND SK < :before' : 'PK = :pk',
          ExpressionAttributeValues: { ':pk': recvKey, ...(before ? { ':before': `TS#${before}` } : {}) },
          ScanIndexForward: false,
          Limit: limit || 50,
        })),
      ]);

      const allMsgs = [...(sentResult.Items || []), ...(recvResult.Items || [])];
      return allMsgs
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .slice(-(limit || 50))
        .map(m => ({ id: m.id, senderId: m.senderId, senderName: m.senderName, senderRole: m.senderRole, recipientId: m.recipientId, recipientName: m.recipientName, recipientRole: m.recipientRole, subject: m.subject, content: m.content, priority: m.priority, read: m.read, createdAt: m.createdAt, parentMessageId: m.parentMessageId }));
    },

    getUnreadCount: async (_: any, __: any, ctx: any) => {
      if (!ctx.user) throw new Error('Not authenticated.');
      const { Items } = await ddbDocClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :inbox',
        FilterExpression: '#r = :false',
        ExpressionAttributeNames: { '#r': 'read' },
        ExpressionAttributeValues: { ':inbox': `INBOX#${ctx.user.userId}`, ':false': false },
      }));
      return (Items || []).length;
    },

    // ── Payroll Queries ───────────────────────────────────────────────────
    getSalaryStructure: async (_: any, { userId }: any, ctx: any) => {
      if (!ctx.user) throw new Error('Not authenticated.');
      const payroll = await import('../payroll.js');
      return payroll.getSalaryStructure(userId);
    },
    getAllSalaryStructures: async (_: any, __: any, ctx: any) => {
      if (!ctx.user) throw new Error('Not authenticated.');
      if (!['C_SUITE', 'SVP', 'VP'].includes(ctx.user.category)) throw new Error('Access denied');
      const payroll = await import('../payroll.js');
      return payroll.getAllSalaryStructures(ctx.user.organizationId);
    },
    getPayrollRun: async (_: any, { runId }: any, ctx: any) => {
      if (!ctx.user) throw new Error('Not authenticated.');
      if (!['C_SUITE', 'SVP', 'VP'].includes(ctx.user.category)) throw new Error('Access denied');
      const payroll = await import('../payroll.js');
      return payroll.getPayrollRun(runId);
    },
    getPayrollHistory: async (_: any, __: any, ctx: any) => {
      if (!ctx.user) throw new Error('Not authenticated.');
      if (!['C_SUITE', 'SVP', 'VP'].includes(ctx.user.category)) throw new Error('Access denied');
      const payroll = await import('../payroll.js');
      return payroll.getPayrollHistory(ctx.user.organizationId);
    },
    getPayslip: async (_: any, { userId, month }: any, ctx: any) => {
      if (!ctx.user) throw new Error('Not authenticated.');
      // Users can view their own; managers can view anyone's
      if (userId !== ctx.user.userId && !['C_SUITE', 'SVP', 'VP'].includes(ctx.user.category)) throw new Error('Access denied');
      const payroll = await import('../payroll.js');
      return payroll.getPayslip(userId, month);
    },
    getMyPayslips: async (_: any, __: any, ctx: any) => {
      if (!ctx.user) throw new Error('Not authenticated.');
      const payroll = await import('../payroll.js');
      return payroll.getPayslipsForUser(ctx.user.userId);
    },
  },

  Mutation: {
    // ── signup ──────────────────────────────────────────────────────────────
    signup: async (_: any, { email, fullName, password, organizationName = 'Organization' }: any) => {
      const normalEmail = email.trim().toLowerCase();
      const existing = await getUserByEmail(normalEmail);
      if (existing) throw new Error('Email already registered.');

      const userId       = uuidv4();
      const organizationId = uuidv4();
      const hashedPwd    = await SecurityService.hashPassword(password);
      const now          = new Date().toISOString();

      const userItem = {
        PK: `USER#${userId}`,
        SK: 'PROFILE',
        GSI1PK: emailIdx(normalEmail),
        GSI1SK: 'PROFILE',
        GSI2PK: `ORG#${organizationId}`,
        GSI2SK: `USER#${userId}`,
        userId,
        email: normalEmail,
        fullName,
        password: hashedPwd,
        orgRole: OrgRole.ADMIN,
        category: UserCategory.C_SUITE,
        role: FunctionalRole.CEO,
        department: Department.EXECUTIVE,
        hierarchyLevel: 1,
        status: UserStatus.ONBOARDING,
        organizationId,
        twoFactorEnabled: false,
        twoFactorMethod: TwoFactorMethod.NONE,
        loginAttempts: 0,
        directReportCount: 0,
        createdAt: now,
        updatedAt: now,
      };

      await putUser(userItem);

      await AuditLogService.log({
        orgId: organizationId,
        userId,
        actionType: ActionType.USER_REGISTERED,
        newValue: { email: normalEmail, fullName, organizationName },
      });

      const token = generateToken(
        { id: userId, email: normalEmail, orgRole: OrgRole.ADMIN, category: UserCategory.C_SUITE, role: FunctionalRole.CEO, organizationId },
        JWT_SECRET!
      );

      return { token, isNewUser: true, requiredActions: ['CHANGE_PASSWORD'], user: { ...userItem, id: userId } };
    },

    // ── login (step 1 — verify password, send OTP) ──────────────────────────
    login: async (_: any, { email, password }: any) => {
      const normalEmail = email.trim().toLowerCase();
      let user = await getUserByEmail(normalEmail);

      // If no user found, check if this is the VERY FIRST login (empty system → auto-create CEO)
      if (!user) {
        const { Items } = await ddbDocClient.send(new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: 'GSI2',
          // Check if ANY user exists by scanning GSI2 with a limit of 1
          Limit: 1,
          KeyConditionExpression: 'GSI2PK = :any',
          ExpressionAttributeValues: { ':any': 'ORG#default' },
        })).catch(() => ({ Items: [] as any[] }));

        // Also scan in case no org is 'default' - just check if table has any user at all
        const { Items: allUsers } = await ddbDocClient.send(new (await import('@aws-sdk/lib-dynamodb')).ScanCommand({
          TableName: TABLE_NAME,
          FilterExpression: 'SK = :sk',
          ExpressionAttributeValues: { ':sk': 'PROFILE' },
          Limit: 1,
        }));

        if ((!Items || Items.length === 0) && (!allUsers || allUsers.length === 0)) {
          // First ever login — create CEO account
          const userId       = uuidv4();
          const organizationId = 'org_default';
          const hashedPwd    = await SecurityService.hashPassword(password);
          const now          = new Date().toISOString();
          const fullName     = normalEmail.split('@')[0]; // Use email prefix as name

          const userItem = {
            PK: `USER#${userId}`, SK: 'PROFILE',
            GSI1PK: emailIdx(normalEmail), GSI1SK: 'PROFILE',
            GSI2PK: `ORG#${organizationId}`, GSI2SK: `USER#${userId}`,
            userId, email: normalEmail, fullName,
            password: hashedPwd,
            orgRole: OrgRole.ADMIN,
            category: UserCategory.C_SUITE,
            role: FunctionalRole.CEO,
            department: Department.EXECUTIVE,
            hierarchyLevel: 1,
            status: UserStatus.ACTIVE,
            organizationId,
            twoFactorEnabled: false,
            twoFactorMethod: TwoFactorMethod.NONE,
            loginAttempts: 0,
            directReportCount: 0,
            assignedProjectIds: [],
            managedTeamIds: [],
            createdAt: now, updatedAt: now,
          };
          await putUser(userItem);
          user = userItem;
        } else {
          throw new Error('Invalid email or password.');
        }
      }

      if (user.status === UserStatus.SUSPENDED) throw new Error('Account suspended.');

      // Account lockout check
      if (user.accountLockedUntil && new Date(user.accountLockedUntil) > new Date()) {
        throw new Error('Account is temporarily locked. Please try again later.');
      }

      const valid = await SecurityService.verifyPassword(password, user.password);
      if (!valid) {
        const attempts = (user.loginAttempts || 0) + 1;
        const lockUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
        await ddbDocClient.send(new UpdateCommand({
          TableName: TABLE_NAME,
          Key: userPK(user.userId),
          UpdateExpression: 'SET loginAttempts = :a' + (lockUntil ? ', accountLockedUntil = :l' : ''),
          ExpressionAttributeValues: { ':a': attempts, ...(lockUntil ? { ':l': lockUntil } : {}) },
        }));
        throw new Error('Invalid email or password.');
      }

      // Generate and email a real OTP
      const otp = SecurityService.generateOTP();
      await storeOtp(user.userId, user.email, otp);
      await EmailService.send2FAOTP(user.email, otp);

      const otpExpiry = new Date(Date.now() + OTP_TTL_SECONDS * 1000);
      return { requiresOTP: true, otpExpiry, message: 'Verification code sent to your registered email.' };
    },

    // ── verifyLoginOTP (step 2 — verify OTP, issue JWT) ─────────────────────
    verifyLoginOTP: async (_: any, { email, otp }: any) => {
      const normalEmail = email.trim().toLowerCase();
      const user = await getUserByEmail(normalEmail);
      if (!user) throw new Error('Identity not found.');

      await verifyAndConsumeOtp(user.userId, otp);

      // Reset login attempts + update lastLoginAt
      await ddbDocClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: userPK(user.userId),
        UpdateExpression: 'SET loginAttempts = :z, lastLoginAt = :t, accountLockedUntil = :n',
        ExpressionAttributeValues: { ':z': 0, ':t': new Date().toISOString(), ':n': null },
      }));

      await AuditLogService.log({ orgId: user.organizationId, userId: user.userId, actionType: ActionType.LOGIN });

      const token = generateToken(
        {
          id: user.userId,
          email: user.email,
          orgRole: user.orgRole,
          category: user.category,
          role: user.role,
          organizationId: user.organizationId,
          department: user.department,
          specialty: user.specialty || null,
          assignedProjectIds: user.assignedProjectIds || [],
          managedTeamIds: user.managedTeamIds || user.managedEmployees || [],
        },
        JWT_SECRET!
      );

      const isNewUser = user.status === UserStatus.ONBOARDING || user.status === UserStatus.PENDING_VERIFICATION;
      return {
        token,
        isNewUser,
        requiredActions: isNewUser ? ['CHANGE_PASSWORD'] : [],
        user: { ...user, id: user.userId },
      };
    },

    // ── changePassword ───────────────────────────────────────────────────────
    changePassword: async (_: any, { newPassword }: any, ctx: any) => {
      if (!ctx.user) throw new Error('Not authenticated.');
      const hashed = await SecurityService.hashPassword(newPassword);
      await ddbDocClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: userPK(ctx.user.userId),
        UpdateExpression: 'SET #pw = :p, #st = :s, passwordHashedAt = :t, updatedAt = :t',
        ExpressionAttributeNames: { '#pw': 'password', '#st': 'status' },
        ExpressionAttributeValues: { ':p': hashed, ':s': UserStatus.ACTIVE, ':t': new Date().toISOString() },
      }));
      await AuditLogService.log({ orgId: ctx.user.organizationId, userId: ctx.user.userId, actionType: ActionType.USER_UPDATED, newValue: 'password changed' });
      return true;
    },

    // ── inviteUser ───────────────────────────────────────────────────────────
    inviteUser: async (_: any, args: any, ctx: any) => {
      if (!ctx.user) throw new Error('Not authenticated.');

      const caller = ctx.user;
      const isAuthorized = caller.hierarchyLevel <= 3 || (caller.department === 'HR' && caller.hierarchyLevel <= 5);
      if (!isAuthorized) throw new Error('Access Denied: Insufficient clearance to invite personnel.');

      let { email, fullName, category, role, department, reportingManagerId, organizationId, specialty, assignedProjectIds, managedTeamIds } = args;
      const normalEmail = email.trim().toLowerCase();
      const orgId = organizationId || caller.organizationId;
      const targetLevel = getHierarchyLevel(category);

      // Email-to-role uniqueness check
      const { Item: existingMapping } = await ddbDocClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: emailRoleKey(orgId, normalEmail, role),
      }));
      if (existingMapping?.isActive) throw new Error(`Email ${normalEmail} is already assigned to role ${role} in this organisation.`);

      // Duplicate user check
      const existing = await getUserByEmail(normalEmail);
      if (existing && existing.organizationId === orgId) throw new Error('Email already registered in this organisation.');

      // Reporting hierarchy validation
      if (reportingManagerId) {
        const manager = await getUserById(reportingManagerId);
        if (!manager) throw new Error('Reporting manager not found.');
        if (!validateReportingHierarchy(targetLevel, manager.hierarchyLevel))
          throw new Error('Invalid Hierarchy: Manager must be at a higher level than the invitee.');
      } else if (targetLevel > 1) {
        // Default: report to the person inviting them
        reportingManagerId = caller.userId;
      }

      const userId       = uuidv4();
      const tempPassword = SecurityService.generateSecurePassword();
      const hashedPwd    = await SecurityService.hashPassword(tempPassword);
      const invToken     = SecurityService.generateInvitationToken();
      const now          = new Date().toISOString();
      const invExpiry    = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const credExpiry   = invExpiry;

      const userItem: Record<string, any> = {
        PK: `USER#${userId}`, SK: 'PROFILE',
        GSI1PK: emailIdx(normalEmail), GSI1SK: 'PROFILE',
        GSI2PK: `ORG#${orgId}`,        GSI2SK: `USER#${userId}`,
        userId, email: normalEmail, fullName,
        password: hashedPwd,
        orgRole: OrgRole.MEMBER,
        category, role, department,
        specialty: specialty || null,
        assignedProjectIds: assignedProjectIds || [],
        managedTeamIds: managedTeamIds || [],
        hierarchyLevel: targetLevel,
        organizationId: orgId,
        status: UserStatus.PENDING_VERIFICATION,
        reportingManagerId: reportingManagerId || null,
        twoFactorEnabled: false,
        twoFactorMethod: TwoFactorMethod.NONE,
        invitationToken: invToken,
        invitationTokenExpiresAt: invExpiry,
        credentialsExpiryDate: credExpiry,
        loginAttempts: 0,
        directReportCount: 0,
        createdBy: caller.userId,
        createdAt: now, updatedAt: now,
      };

      await putUser(userItem);

      // Email-role mapping
      await ddbDocClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: { ...emailRoleKey(orgId, normalEmail, role), email: normalEmail, role, orgId, assignedUserId: userId, isActive: true, createdAt: now },
      }));

      await AuditLogService.log({ orgId: caller.organizationId, userId: caller.userId, actionType: ActionType.INVITE, targetUserId: userId, newValue: { email: normalEmail, role, category, department } });

      // Send invitation email
      await EmailService.sendInvitationEmail({ to: normalEmail, template: 'invitation', data: { email: normalEmail, fullName, password: tempPassword, role, organizationName: orgId, expiresAt: invExpiry } });

      return { userId, email: normalEmail, invitationExpiry: invExpiry, temporaryPassword: tempPassword, status: UserStatus.PENDING_VERIFICATION };
    },

    // ── resendInvitation ─────────────────────────────────────────────────────
    resendInvitation: async (_: any, { userId }: any, ctx: any) => {
      if (!ctx.user) throw new Error('Not authenticated.');
      const target = await getUserById(userId);
      if (!target) throw new Error('User not found.');
      if (target.status !== UserStatus.PENDING_VERIFICATION) throw new Error('User is not in pending state.');

      const tempPassword = SecurityService.generateSecurePassword();
      const hashed       = await SecurityService.hashPassword(tempPassword);
      const newToken     = SecurityService.generateInvitationToken();
      const expiry       = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const now          = new Date().toISOString();

      await ddbDocClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: userPK(userId),
        UpdateExpression: 'SET #pw = :p, invitationToken = :t, invitationTokenExpiresAt = :e, credentialsExpiryDate = :e, updatedAt = :n',
        ExpressionAttributeNames: { '#pw': 'password' },
        ExpressionAttributeValues: { ':p': hashed, ':t': newToken, ':e': expiry, ':n': now },
      }));

      await EmailService.sendInvitationEmail({ to: target.email, template: 'invitation', data: { email: target.email, fullName: target.fullName, password: tempPassword, role: target.role, expiresAt: expiry } });
      await AuditLogService.log({ orgId: ctx.user.organizationId, userId: ctx.user.userId, actionType: ActionType.RESEND_INVITE, targetUserId: userId });

      return true;
    },

    // ── dropUser ─────────────────────────────────────────────────────────────
    dropUser: async (_: any, { userId, otp }: any, ctx: any) => {
      if (!ctx.user) throw new Error('Not authenticated.');

      // Verify the security OTP before allowing drop
      await verifyAndConsumeOtp(ctx.user.userId, otp);

      const caller = ctx.user;
      const target = await getUserById(userId);
      if (!target) throw new Error('User not found.');

      const canDrop = (caller.department === 'HR' && caller.hierarchyLevel <= 5) || caller.hierarchyLevel <= 3;
      if (!canDrop) throw new Error('Access Denied: Account termination requires senior administrative clearance.');
      if (target.hierarchyLevel === 1) throw new Error('Security Violation: C-Suite accounts cannot be dropped.');

      const now = new Date().toISOString();
      await ddbDocClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: userPK(userId),
        UpdateExpression: 'SET #st = :s, updatedAt = :t',
        ExpressionAttributeNames: { '#st': 'status' },
        ExpressionAttributeValues: { ':s': UserStatus.INACTIVE, ':t': now },
      }));

      // Soft-delete email-role mapping
      await ddbDocClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: emailRoleKey(target.organizationId, target.email, target.role),
        UpdateExpression: 'SET isActive = :f',
        ExpressionAttributeValues: { ':f': false },
      }));

      const auditId = await AuditLogService.log({ orgId: caller.organizationId, userId: caller.userId, actionType: ActionType.DROP, targetUserId: userId, oldValue: { status: target.status }, newValue: { status: UserStatus.INACTIVE } });

      return { success: true, auditId };
    },

    // ── requestSecurityOTP ───────────────────────────────────────────────────
    requestSecurityOTP: async (_: any, __: any, ctx: any) => {
      if (!ctx.user) throw new Error('Not authenticated.');
      const otp = SecurityService.generateOTP();
      await storeOtp(ctx.user.userId, ctx.user.email, otp);
      await EmailService.send2FAOTP(ctx.user.email, otp);
      return true;
    },

    // ── updateUserStatus ─────────────────────────────────────────────────────
    updateUserStatus: async (_: any, { userId, status }: any, ctx: any) => {
      if (!ctx.user) throw new Error('Not authenticated.');
      const caller = ctx.user;
      const canUpdate = (caller.department === 'HR' && caller.hierarchyLevel <= 5) || caller.hierarchyLevel <= 3;
      if (!canUpdate) throw new Error('Unauthorized.');
      const target = await getUserById(userId);
      if (!target) throw new Error('User not found.');
      const now = new Date().toISOString();
      await ddbDocClient.send(new UpdateCommand({
        TableName: TABLE_NAME, Key: userPK(userId),
        UpdateExpression: 'SET #st = :s, updatedAt = :t',
        ExpressionAttributeNames: { '#st': 'status' },
        ExpressionAttributeValues: { ':s': status, ':t': now },
      }));
      await AuditLogService.log({ orgId: caller.organizationId, userId: caller.userId, actionType: ActionType.STATUS_UPDATE, targetUserId: userId, oldValue: { status: target.status }, newValue: { status } });
      return { ...target, status, id: target.userId };
    },

    // ── updateUserRole ───────────────────────────────────────────────────────
    updateUserRole: async (_: any, { userId, newRole }: any, ctx: any) => {
      if (!ctx.user) throw new Error('Not authenticated.');
      const caller = ctx.user;
      if (caller.hierarchyLevel > 2 && caller.role !== FunctionalRole.VP_HR)
        throw new Error('Access Denied: Role modification requires executive clearance.');
      const target = await getUserById(userId);
      if (!target) throw new Error('User not found.');
      const now = new Date().toISOString();
      await ddbDocClient.send(new UpdateCommand({
        TableName: TABLE_NAME, Key: userPK(userId),
        UpdateExpression: 'SET #r = :r, updatedAt = :t',
        ExpressionAttributeNames: { '#r': 'role' },
        ExpressionAttributeValues: { ':r': newRole, ':t': now },
      }));
      await AuditLogService.log({ orgId: caller.organizationId, userId: caller.userId, actionType: ActionType.ROLE_UPDATE, targetUserId: userId, oldValue: { role: target.role }, newValue: { role: newRole } });
      return { ...target, role: newRole, id: target.userId };
    },

    // ── updateUserOrgRole ────────────────────────────────────────────────────
    updateUserOrgRole: async (_: any, { userId, orgRole, role }: any, ctx: any) => {
      if (!ctx.user) throw new Error('Not authenticated.');
      if (ctx.user.hierarchyLevel > 2 && ctx.user.orgRole !== OrgRole.ADMIN) throw new Error('Unauthorized.');
      const target = await getUserById(userId);
      if (!target) throw new Error('User not found.');
      const updates: string[] = ['updatedAt = :t'];
      const vals: any = { ':t': new Date().toISOString() };
      if (orgRole) { updates.push('orgRole = :o'); vals[':o'] = orgRole; }
      if (role)    { updates.push('#r = :r'); vals[':r'] = role; }
      await ddbDocClient.send(new UpdateCommand({
        TableName: TABLE_NAME, Key: userPK(userId),
        UpdateExpression: `SET ${updates.join(', ')}`,
        ExpressionAttributeNames: role ? { '#r': 'role' } : undefined,
        ExpressionAttributeValues: vals,
      }));
      await AuditLogService.log({ orgId: ctx.user.organizationId, userId: ctx.user.userId, actionType: ActionType.ROLE_UPDATE, targetUserId: userId, oldValue: { orgRole: target.orgRole, role: target.role }, newValue: { orgRole, role } });
      return { ...target, orgRole: orgRole || target.orgRole, role: role || target.role, id: target.userId };
    },

    // ── promoteUser ──────────────────────────────────────────────────────────
    promoteUser: async (_: any, { userId, newRole, newLevel }: any, ctx: any) => {
      if (!ctx.user) throw new Error('Not authenticated.');
      const caller = ctx.user;
      if (caller.hierarchyLevel > 3 || caller.hierarchyLevel >= (await getUserById(userId))?.hierarchyLevel)
        throw new Error('Access Denied: Promotions require department head clearance.');
      const target = await getUserById(userId);
      if (!target) throw new Error('User not found.');
      if (newLevel && newLevel >= target.hierarchyLevel) throw new Error('New level must be numerically lower (higher rank).');
      const updates: string[] = ['updatedAt = :t'];
      const vals: any = { ':t': new Date().toISOString() };
      const names: any = {};
      if (newLevel) { updates.push('hierarchyLevel = :l'); vals[':l'] = newLevel; }
      if (newRole)  { updates.push('#r = :r'); vals[':r'] = newRole; names['#r'] = 'role'; }
      await ddbDocClient.send(new UpdateCommand({
        TableName: TABLE_NAME, Key: userPK(userId),
        UpdateExpression: `SET ${updates.join(', ')}`,
        ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
        ExpressionAttributeValues: vals,
      }));
      await AuditLogService.log({ orgId: caller.organizationId, userId: caller.userId, actionType: ActionType.ROLE_UPDATE, targetUserId: userId, oldValue: { hierarchyLevel: target.hierarchyLevel, role: target.role }, newValue: { hierarchyLevel: newLevel, role: newRole } });
      return { ...target, hierarchyLevel: newLevel || target.hierarchyLevel, role: newRole || target.role, id: target.userId };
    },

    // ── suspendUser ──────────────────────────────────────────────────────────
    suspendUser: async (_: any, { userId, reason }: any, ctx: any) => {
      if (!ctx.user) throw new Error('Not authenticated.');
      const caller = ctx.user;
      if (!((caller.department === 'HR' && caller.hierarchyLevel <= 5) || caller.hierarchyLevel <= 2))
        throw new Error('Access Denied: Suspension requires HR or Executive clearance.');
      const target = await getUserById(userId);
      if (!target) throw new Error('User not found.');
      if (target.hierarchyLevel === 1) throw new Error('C-Suite accounts cannot be suspended via standard protocol.');
      const now = new Date().toISOString();
      await ddbDocClient.send(new UpdateCommand({
        TableName: TABLE_NAME, Key: userPK(userId),
        UpdateExpression: 'SET #st = :s, updatedAt = :t',
        ExpressionAttributeNames: { '#st': 'status' },
        ExpressionAttributeValues: { ':s': UserStatus.SUSPENDED, ':t': now },
      }));
      await AuditLogService.log({ orgId: caller.organizationId, userId: caller.userId, actionType: ActionType.STATUS_UPDATE, targetUserId: userId, oldValue: { status: target.status }, newValue: { status: UserStatus.SUSPENDED, reason } });
      return { ...target, status: UserStatus.SUSPENDED, id: target.userId };
    },

    // ── changeReportingManager ───────────────────────────────────────────────
    changeReportingManager: async (_: any, { userId, newManagerId }: any, ctx: any) => {
      if (!ctx.user) throw new Error('Not authenticated.');
      const caller = ctx.user;
      if (!((caller.department === 'HR' && caller.hierarchyLevel <= 5) || caller.hierarchyLevel <= 3))
        throw new Error('Access Denied: Hierarchy modification requires administrative clearance.');
      const [target, newMgr] = await Promise.all([getUserById(userId), getUserById(newManagerId)]);
      if (!target || !newMgr) throw new Error('User or Manager not found.');
      if (newMgr.hierarchyLevel >= target.hierarchyLevel) throw new Error('Hierarchy Violation: Manager must be at a higher level.');
      if (newMgr.userId === target.userId) throw new Error('Hierarchy Violation: User cannot report to themselves.');
      const now = new Date().toISOString();
      await ddbDocClient.send(new UpdateCommand({
        TableName: TABLE_NAME, Key: userPK(userId),
        UpdateExpression: 'SET reportingManagerId = :m, updatedAt = :t',
        ExpressionAttributeValues: { ':m': newManagerId, ':t': now },
      }));
      await AuditLogService.log({ orgId: caller.organizationId, userId: caller.userId, actionType: ActionType.ROLE_UPDATE, targetUserId: userId, oldValue: { reportingManagerId: target.reportingManagerId }, newValue: { reportingManagerId: newManagerId } });
      return { ...target, reportingManagerId: newManagerId, id: target.userId };
    },

    // ── adminUpdate2FA ───────────────────────────────────────────────────────
    adminUpdate2FA: async (_: any, { userId, enabled, method }: any, ctx: any) => {
      if (!ctx.user) throw new Error('Not authenticated.');
      if (ctx.user.hierarchyLevel > 3) throw new Error('Access Denied: 2FA admin requires VP+ clearance.');
      const target = await getUserById(userId);
      if (!target) throw new Error('User not found.');
      const now = new Date().toISOString();
      await ddbDocClient.send(new UpdateCommand({
        TableName: TABLE_NAME, Key: userPK(userId),
        UpdateExpression: 'SET twoFactorEnabled = :e, twoFactorMethod = :m, updatedAt = :t',
        ExpressionAttributeValues: { ':e': enabled, ':m': method || TwoFactorMethod.EMAIL_OTP, ':t': now },
      }));
      await AuditLogService.log({ orgId: ctx.user.organizationId, userId: ctx.user.userId, actionType: enabled ? ActionType.ENABLE_2FA : ActionType.DISABLE_2FA, targetUserId: userId });
      return { ...target, twoFactorEnabled: enabled, twoFactorMethod: method || TwoFactorMethod.EMAIL_OTP, id: target.userId };
    },

    // ── enable2FA ────────────────────────────────────────────────────────────
    enable2FA: async (_: any, { method }: any, ctx: any) => {
      if (!ctx.user) throw new Error('Not authenticated.');
      if (method === TwoFactorMethod.TOTP) {
        const { otpauthUrl, base32 } = SecurityService.generateTOTPSecret(ctx.user.email);
        const qrCodeSVG = await SecurityService.generateQRCode(otpauthUrl!);
        // Store unverified secret temporarily
        await ddbDocClient.send(new UpdateCommand({
          TableName: TABLE_NAME, Key: userPK(ctx.user.userId),
          UpdateExpression: 'SET twoFactorSecretPending = :s',
          ExpressionAttributeValues: { ':s': ENCRYPTION_KEY ? SecurityService.encryptSecret(base32, ENCRYPTION_KEY) : base32 },
        }));
        return { method: TwoFactorMethod.TOTP, qrCodeSVG, secret: base32, instructions: 'Scan the QR code with Google Authenticator, then verify with a code.' };
      }
      // EMAIL_OTP: just return instructions
      return { method: TwoFactorMethod.EMAIL_OTP, qrCodeSVG: null, secret: null, instructions: 'A verification code will be sent to your email on each login.' };
    },

    // ── verify2FASetup ───────────────────────────────────────────────────────
    verify2FASetup: async (_: any, { method, code }: any, ctx: any) => {
      if (!ctx.user) throw new Error('Not authenticated.');
      const user = await getUserById(ctx.user.userId);
      if (!user) throw new Error('User not found.');
      if (method === TwoFactorMethod.TOTP) {
        if (!user.twoFactorSecretPending) throw new Error('No pending TOTP setup found.');
        const secret = ENCRYPTION_KEY ? SecurityService.decryptSecret(user.twoFactorSecretPending, ENCRYPTION_KEY) : user.twoFactorSecretPending;
        const valid = SecurityService.verifyTOTP(code, secret);
        if (!valid) throw new Error('Invalid TOTP code.');
        await ddbDocClient.send(new UpdateCommand({
          TableName: TABLE_NAME, Key: userPK(user.userId),
          UpdateExpression: 'SET twoFactorEnabled = :t, twoFactorMethod = :m, twoFactorSecret = :s, twoFactorSecretPending = :n',
          ExpressionAttributeValues: { ':t': true, ':m': TwoFactorMethod.TOTP, ':s': user.twoFactorSecretPending, ':n': null },
        }));
      } else {
        // EMAIL_OTP — just mark enabled
        await ddbDocClient.send(new UpdateCommand({
          TableName: TABLE_NAME, Key: userPK(user.userId),
          UpdateExpression: 'SET twoFactorEnabled = :t, twoFactorMethod = :m',
          ExpressionAttributeValues: { ':t': true, ':m': TwoFactorMethod.EMAIL_OTP },
        }));
      }
      await AuditLogService.log({ orgId: user.organizationId, userId: user.userId, actionType: ActionType.ENABLE_2FA, newValue: { method } });
      return true;
    },

    logout: () => true,

    // ── Internal Messaging ──────────────────────────────────────────────────
    sendDirectMessage: async (_: any, { recipientId, subject, content, priority, parentMessageId }: any, ctx: any) => {
      if (!ctx.user) throw new Error('Not authenticated.');
      const recipient = await getUserById(recipientId);
      if (!recipient) throw new Error('Recipient not found.');
      
      const msgId = uuidv4();
      const now = new Date().toISOString();
      const msg = {
        PK: `MSG#${ctx.user.userId}#${recipientId}`,
        SK: `TS#${now}#${msgId}`,
        GSI1PK: `INBOX#${recipientId}`,
        GSI1SK: `TS#${now}#${msgId}`,
        id: msgId,
        senderId: ctx.user.userId,
        senderName: ctx.user.fullName,
        senderRole: ctx.user.role,
        recipientId,
        recipientName: recipient.fullName,
        recipientRole: recipient.role,
        subject,
        content,
        priority: priority || 'NORMAL',
        read: false,
        createdAt: now,
        parentMessageId: parentMessageId || null,
        entityType: 'DIRECT_MESSAGE',
      };
      await ddbDocClient.send(new PutCommand({ TableName: TABLE_NAME, Item: msg }));
      return { id: msgId, senderId: ctx.user.userId, senderName: ctx.user.fullName, senderRole: ctx.user.role, recipientId, recipientName: recipient.fullName, recipientRole: recipient.role, subject, content, priority: priority || 'NORMAL', read: false, createdAt: now, parentMessageId };
    },

    markMessagesRead: async (_: any, { senderId }: any, ctx: any) => {
      if (!ctx.user) throw new Error('Not authenticated.');
      // Get unread messages from this sender to current user
      const { Items } = await ddbDocClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :inbox',
        FilterExpression: 'senderId = :s AND #r = :false',
        ExpressionAttributeNames: { '#r': 'read' },
        ExpressionAttributeValues: { ':inbox': `INBOX#${ctx.user.userId}`, ':s': senderId, ':false': false },
      }));
      // Mark each as read
      for (const item of (Items || [])) {
        await ddbDocClient.send(new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { PK: item.PK, SK: item.SK },
          UpdateExpression: 'SET #r = :true',
          ExpressionAttributeNames: { '#r': 'read' },
          ExpressionAttributeValues: { ':true': true },
        }));
      }
      return true;
    },

    // Stub mutations handled by svc-projects
    createProject: () => { throw new Error('Handled by svc-projects'); },
    updateProjectDetails: () => { throw new Error('Handled by svc-projects'); },
    updateProjectProgress: () => { throw new Error('Handled by svc-projects'); },
    addProjectUpdate: () => { throw new Error('Handled by svc-projects'); },
    createTask: () => { throw new Error('Handled by svc-projects'); },
    updateTaskStatus: () => { throw new Error('Handled by svc-projects'); },
    uploadSRSDocument: () => { throw new Error('Handled by svc-projects'); },
    addMemberToProject: () => { throw new Error('Handled by svc-projects'); },
    removeTeamMemberFromProject: () => { throw new Error('Handled by svc-projects'); },
    addTaskAttachment: () => { throw new Error('Handled by svc-projects'); },
    removeTaskAttachment: () => { throw new Error('Handled by svc-projects'); },
    confirmProjectDoc: () => { throw new Error('Handled by svc-projects'); },
    deleteProjectDoc: () => { throw new Error('Handled by svc-projects'); },
    createAllocationRequest: () => { throw new Error('Handled by svc-projects'); },
    approveAllocation: () => { throw new Error('Handled by svc-projects'); },
    rejectAllocation: () => { throw new Error('Handled by svc-projects'); },

    // ── Payroll Mutations ─────────────────────────────────────────────────
    setSalaryStructure: async (_: any, { userId, basicPay, hraPercentage, conveyanceAllowance, medicalAllowance, specialAllowance, pfEnabled, esiEnabled, ptEnabled, tdsPercentage }: any, ctx: any) => {
      if (!ctx.user) throw new Error('Not authenticated.');
      if (!['C_SUITE', 'SVP', 'VP'].includes(ctx.user.category)) throw new Error('Only C-Suite/VP can set salary structures');
      const payroll = await import('../payroll.js');
      return payroll.setSalaryStructure(userId, {
        orgId: ctx.user.organizationId,
        basicPay,
        hraPercentage: hraPercentage ?? 40,
        conveyanceAllowance: conveyanceAllowance ?? 1600,
        medicalAllowance: medicalAllowance ?? 1250,
        specialAllowance: specialAllowance ?? 0,
        pfEnabled: pfEnabled ?? true,
        esiEnabled: esiEnabled ?? false,
        ptEnabled: ptEnabled ?? true,
        tdsPercentage: tdsPercentage ?? 0,
      });
    },
    runPayroll: async (_: any, { month, totalWorkingDays }: any, ctx: any) => {
      if (!ctx.user) throw new Error('Not authenticated.');
      if (!['C_SUITE', 'SVP'].includes(ctx.user.category)) throw new Error('Only C-Suite can run payroll');
      const payroll = await import('../payroll.js');
      // Get all salary structures for the org, create overrides assuming full attendance
      const structures = await payroll.getAllSalaryStructures(ctx.user.organizationId);
      if (!structures || structures.length === 0) throw new Error('No salary structures configured. Set up employee salaries first.');
      const overrides = structures.map((s: any) => ({
        userId: s.userId,
        attendanceDays: totalWorkingDays,
        totalWorkingDays,
        employeeName: s.userId, // will be resolved from user data if available
        designation: '',
        department: '',
      }));
      return payroll.runMonthlyPayroll(ctx.user.organizationId, month, ctx.user.userId, overrides);
    },
    approvePayroll: async (_: any, { runId }: any, ctx: any) => {
      if (!ctx.user) throw new Error('Not authenticated.');
      if (ctx.user.category !== 'C_SUITE') throw new Error('Only C-Suite can approve payroll');
      const payroll = await import('../payroll.js');
      return payroll.approvePayrollRun(runId, ctx.user.userId);
    },
  },

  // ── Field resolvers ─────────────────────────────────────────────────────────
  User: {
    id:               (u: any) => u.userId || u.id,
    organizationId:   (u: any) => u.organizationId,
    organization:     (u: any) => u.organizationId ? { id: u.organizationId, name: u.organizationName || u.organizationId, createdAt: u.createdAt } : null,
    directReportCount:(u: any) => u.directReportCount || 0,
    managedTeams:     (u: any) => u.managedTeams || [],
    managedEmployees: (u: any) => u.managedEmployees || [],
    specialty:        (u: any) => u.specialty || null,
    assignedProjectIds:(u: any) => u.assignedProjectIds || [],
    managedTeamIds:   (u: any) => u.managedTeamIds || u.managedEmployees || [],
    twoFactorEnabled: (u: any) => u.twoFactorEnabled ?? false,
    twoFactorMethod:  (u: any) => u.twoFactorMethod || TwoFactorMethod.NONE,
  },
};
