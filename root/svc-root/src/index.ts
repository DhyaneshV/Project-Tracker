import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import express from 'express';
import cors from 'cors';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { verifyToken, generateAccessToken, generateRefreshToken, getRefreshCookieOptions, REFRESH_TOKEN_EXPIRY_SECONDS, getGoogleAuthUrl, getGitHubAuthUrl } from '@project-tracker/auth-library';
import { checkRateLimit, getClientIp, extractOperationName } from './rate-limiter.js';
import { validateMutationInput, sanitizeVariables } from './input-validator.js';
import dotenv from 'dotenv';
import serverlessExpress from '@vendia/serverless-express';
import cookieParser from 'cookie-parser';
import { GraphQLScalarType, Kind } from 'graphql';

dotenv.config();

const getEnv = (name: string, defaultValue?: string): string => {
  const value = process.env[name] || defaultValue;
  if (!value) {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USERS_SERVICE_URL = getEnv('USERS_SERVICE_URL', 'http://localhost:4001');
const PROJECTS_SERVICE_URL = getEnv('PROJECTS_SERVICE_URL', 'http://localhost:4002');
const CHAT_SERVICE_URL = getEnv('CHAT_SERVICE_URL', 'http://localhost:4003');
const JWT_SECRET = getEnv('JWT_SECRET'); // NO FALLBACK
const FRONTEND_URL = getEnv('FRONTEND_URL', 'http://localhost:3000');
const GOOGLE_CALLBACK_URL = getEnv('GOOGLE_CALLBACK_URL', 'http://localhost:4000/auth/google/callback');
const GITHUB_CALLBACK_URL = getEnv('GITHUB_CALLBACK_URL', 'http://localhost:4000/auth/github/callback');

// Helper to proxy requests to microservices
async function proxyToService(url: string, body: any, user: any = null) {
  const headers: any = { 'Content-Type': 'application/json' };
  if (user) {
    // Downstream services must derive identity from a signed token, never from
    // client-controllable x-user-* headers.
    headers.authorization = `Bearer ${generateAccessToken(user, JWT_SECRET)}`;
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const result = await response.json();
  
  if (result.errors) {
      console.error(`[DEBUG] Microservice Error from ${url}:`, result.errors[0].message);
      throw new Error(result.errors[0].message);
  }
  
  return result;
}

const typeDefs = readFileSync(path.resolve(__dirname, '../../../packages/graphql-schema/schema.graphql'), { encoding: 'utf-8' });

const resolvers = {
  DateTime: new GraphQLScalarType({
    name: 'DateTime',
    description: 'DateTime custom scalar type',
    serialize(value: any) {
      if (value instanceof Date) return value.toISOString();
      if (typeof value === 'string') return new Date(value).toISOString();
      return value;
    },
    parseValue(value: any) {
      if (!value) throw new Error('DateTime value cannot be empty');
      const date = new Date(value);
      if (isNaN(date.getTime())) throw new Error(`Invalid DateTime format: ${value}`);
      return date;
    },
    parseLiteral(ast) {
      if (ast.kind === Kind.STRING) {
        const date = new Date(ast.value);
        if (isNaN(date.getTime())) throw new Error(`Invalid DateTime literal: ${ast.value}`);
        return date;
      }
      return null;
    },
  }),
  Query: {
    me: async (_: any, __: any, context: any) => {
      const result = await proxyToService(USERS_SERVICE_URL, { query: 'query { me { id email fullName orgRole category role department hierarchyLevel status twoFactorEnabled twoFactorMethod organizationId createdAt } }' }, context.user);
      return result.data?.me;
    },
    getAllUsers: async (_: any, __: any, context: any) => {
      const result = await proxyToService(USERS_SERVICE_URL, { query: 'query { getAllUsers { id email fullName orgRole category role department hierarchyLevel status twoFactorEnabled twoFactorMethod lastLoginAt createdAt organizationId reportingManagerId directReportCount } }' }, context.user);
      return result.data?.getAllUsers;
    },
    getAuditLogs: async (_: any, variables: any, context: any) => {
      const result = await proxyToService(USERS_SERVICE_URL, { query: 'query GetAuditLogs($limit: Int, $cursor: String) { getAuditLogs(limit: $limit, cursor: $cursor) { items { auditId userId actionType targetUserId oldValue newValue ipAddress timestamp } nextCursor totalCount } }', variables }, context.user);
      return result.data?.getAuditLogs || { items: [], nextCursor: null, totalCount: 0 };
    },
    getProjects: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(PROJECTS_SERVICE_URL, { 
            query: 'query GetProjects($status: ProjectStatus) { getProjects(status: $status) { id name description category status completionPercentage startDate targetEndDate estimatedDays budgetUSD maxTeamSize currentTeamSize createdAt } }',
            variables
        }, context.user);
        return result.data?.getProjects;
    },
    getProject: async (_: any, { id }: { id: string }, context: any) => {
        const result = await proxyToService(PROJECTS_SERVICE_URL, { 
            query: `query GetProject($id: ID!) { getProject(id: $id) { id name description category status completionPercentage startDate targetEndDate estimatedDays budgetUSD maxTeamSize currentTeamSize srsDocumentUrl srsDocumentVersion teamMembers { userId projectRole specialty contribution allocation joinedAt status } createdAt } }`,
            variables: { id }
        }, context.user);
        return result.data?.getProject;
    },
    getProjectTasks: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(PROJECTS_SERVICE_URL, {
            query: `query GetProjectTasks($projectId: ID!, $status: TaskStatus) { getProjectTasks(projectId: $projectId, status: $status) { id projectId title description status priority assignedTo { id fullName } component startDate dueDate completedAt blockerReason createdAt } }`,
            variables
        }, context.user);
        return result.data?.getProjectTasks;
    },
    getProjectUpdates: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(PROJECTS_SERVICE_URL, {
            query: `query GetProjectUpdates($projectId: ID!) { getProjectUpdates(projectId: $projectId) { id projectId type title description severity createdAt } }`,
            variables
        }, context.user);
        return result.data?.getProjectUpdates;
    },
    getProjectAnalytics: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(PROJECTS_SERVICE_URL, {
            query: `query GetProjectAnalytics($projectId: ID!) { getProjectAnalytics(projectId: $projectId) { projectId totalTasks completedTasks blockedTasks velocity teamContribution { user { id fullName } contributionPercentage tasksCompleted } timelineHealth } }`,
            variables
        }, context.user);
        return result.data?.getProjectAnalytics;
    },
    getSRSDocuments: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(PROJECTS_SERVICE_URL, {
            query: `query GetSRSDocuments($projectId: ID!) { getSRSDocuments(projectId: $projectId) { id projectId version url status uploadedBy { fullName } createdAt } }`,
            variables
        }, context.user);
        return result.data?.getSRSDocuments;
    },
    // ── Executive Dashboard Queries ────────────────────────────────────────
    getOrgAnalytics: async (_: any, __: any, context: any) => {
        const result = await proxyToService(PROJECTS_SERVICE_URL, {
            query: `query { getOrgAnalytics { totalProjects activeProjects completedProjects onHoldProjects totalTasks completedTasks blockedTasks inProgressTasks totalBudget spentBudget totalHeadcount avgProjectHealth avgCompletionRate projectsByCategory { category count } departmentUtilization { department memberCount activeTaskCount } } }`
        }, context.user);
        return result.data?.getOrgAnalytics;
    },
    getOrgRiskAlerts: async (_: any, __: any, context: any) => {
        const result = await proxyToService(PROJECTS_SERVICE_URL, {
            query: `query { getOrgRiskAlerts { id projectId projectName type severity message createdAt } }`
        }, context.user);
        return result.data?.getOrgRiskAlerts;
    },
    getBudgetOverview: async (_: any, __: any, context: any) => {
        const result = await proxyToService(PROJECTS_SERVICE_URL, {
            query: `query { getBudgetOverview { projectId projectName budgetUSD completionPercentage status burnRate estimatedOverrun } }`
        }, context.user);
        return result.data?.getBudgetOverview;
    },
    getMyTasks: async (_: any, __: any, context: any) => {
        const result = await proxyToService(PROJECTS_SERVICE_URL, {
            query: `query { getMyTasks { id projectId title description status priority assignedTo { id fullName } component startDate dueDate completedAt blockerReason createdAt } }`
        }, context.user);
        return result.data?.getMyTasks;
    },
    getActivityFeed: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(PROJECTS_SERVICE_URL, {
            query: `query GetActivityFeed($limit: Int) { getActivityFeed(limit: $limit) { id type title description projectName projectId actorName severity createdAt } }`,
            variables
        }, context.user);
        return result.data?.getActivityFeed;
    },
    getUpcomingDeadlines: async (_: any, __: any, context: any) => {
        const result = await proxyToService(PROJECTS_SERVICE_URL, {
            query: `query { getUpcomingDeadlines { id projectId projectName type title dueDate daysLeft status priority } }`
        }, context.user);
        return result.data?.getUpcomingDeadlines;
    },
    getPendingAllocations: async (_: any, __: any, context: any) => {
        const result = await proxyToService(PROJECTS_SERVICE_URL, {
            query: `query { getPendingAllocations { id projectId projectName requestedBy requestedByName requestedUserId requestedUserName requestedUserRole specialty allocation projectRole reason status createdAt } }`
        }, context.user);
        return result.data?.getPendingAllocations;
    },
    getProjectAllocations: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(PROJECTS_SERVICE_URL, {
            query: `query GetProjectAllocations($projectId: ID!) { getProjectAllocations(projectId: $projectId) { id projectId projectName requestedBy requestedByName requestedUserId requestedUserName specialty allocation projectRole reason status approvedByName rejectionReason createdAt resolvedAt } }`,
            variables
        }, context.user);
        return result.data?.getProjectAllocations;
    },
    // ── Payroll Queries ─────────────────────────────────────────────────────
    getSalaryStructure: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(USERS_SERVICE_URL, { query: `query GetSalaryStructure($userId: ID!) { getSalaryStructure(userId: $userId) { userId orgId basicPay hraPercentage conveyanceAllowance medicalAllowance specialAllowance pfEnabled esiEnabled ptEnabled tdsPercentage effectiveFrom updatedAt } }`, variables }, context.user);
        return result.data?.getSalaryStructure;
    },
    getAllSalaryStructures: async (_: any, __: any, context: any) => {
        const result = await proxyToService(USERS_SERVICE_URL, { query: `query { getAllSalaryStructures { userId orgId basicPay hraPercentage conveyanceAllowance medicalAllowance specialAllowance pfEnabled esiEnabled ptEnabled tdsPercentage effectiveFrom updatedAt } }` }, context.user);
        return result.data?.getAllSalaryStructures;
    },
    getPayrollRun: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(USERS_SERVICE_URL, { query: `query GetPayrollRun($runId: ID!) { getPayrollRun(runId: $runId) { runId orgId month status totalEmployees totalGross totalDeductions totalNet createdBy approvedBy createdAt approvedAt } }`, variables }, context.user);
        return result.data?.getPayrollRun;
    },
    getPayrollHistory: async (_: any, __: any, context: any) => {
        const result = await proxyToService(USERS_SERVICE_URL, { query: `query { getPayrollHistory { runId orgId month status totalEmployees totalGross totalDeductions totalNet createdBy approvedBy createdAt approvedAt } }` }, context.user);
        return result.data?.getPayrollHistory;
    },
    getPayslip: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(USERS_SERVICE_URL, { query: `query GetPayslip($userId: ID!, $month: String!) { getPayslip(userId: $userId, month: $month) { userId month runId employeeName designation department earnings { label amount } deductions { label amount } grossPay totalDeductions netPay workingDays attendanceDays status createdAt } }`, variables }, context.user);
        return result.data?.getPayslip;
    },
    getMyPayslips: async (_: any, __: any, context: any) => {
        const result = await proxyToService(USERS_SERVICE_URL, { query: `query { getMyPayslips { userId month runId employeeName designation department earnings { label amount } deductions { label amount } grossPay totalDeductions netPay workingDays attendanceDays status createdAt } }` }, context.user);
        return result.data?.getMyPayslips;
    },
    // ── Notification Queries ───────────────────────────────────────────────
    getMyNotifications: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(PROJECTS_SERVICE_URL, {
            query: `query GetMyNotifications($limit: Int) { getMyNotifications(limit: $limit) { id userId type title message projectId projectName taskId actorName read createdAt } }`,
            variables
        }, context.user);
        return result.data?.getMyNotifications;
    },
    getUnreadNotificationCount: async (_: any, __: any, context: any) => {
        const result = await proxyToService(PROJECTS_SERVICE_URL, {
            query: `query { getUnreadNotificationCount }`
        }, context.user);
        return result.data?.getUnreadNotificationCount;
    },
    getNotificationPreferences: async (_: any, __: any, context: any) => {
        const result = await proxyToService(PROJECTS_SERVICE_URL, {
            query: `query { getNotificationPreferences { emailEnabled inAppEnabled taskAssigned taskStatusChanged projectUpdates teamChanges payrollUpdates securityAlerts messageNotifications } }`
        }, context.user);
        return result.data?.getNotificationPreferences || {
            emailEnabled: true, inAppEnabled: true, taskAssigned: true, taskStatusChanged: true,
            projectUpdates: true, teamChanges: true, payrollUpdates: true, securityAlerts: true, messageNotifications: true,
        };
    },
    // ── Internal Messaging Queries ─────────────────────────────────────────
    getConversations: async (_: any, __: any, context: any) => {
        const result = await proxyToService(USERS_SERVICE_URL, {
            query: `query { getConversations { recipientId recipientName recipientRole lastMessage lastMessageAt unreadCount } }`
        }, context.user);
        return result.data?.getConversations;
    },
    getDirectMessages: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(USERS_SERVICE_URL, {
            query: `query GetDirectMessages($recipientId: ID!, $limit: Int, $before: DateTime) { getDirectMessages(recipientId: $recipientId, limit: $limit, before: $before) { id senderId senderName senderRole recipientId recipientName recipientRole subject content priority read createdAt parentMessageId } }`,
            variables
        }, context.user);
        return result.data?.getDirectMessages;
    },
    getUnreadCount: async (_: any, __: any, context: any) => {
        const result = await proxyToService(USERS_SERVICE_URL, {
            query: `query { getUnreadCount }`
        }, context.user);
        return result.data?.getUnreadCount;
    }
  },
  Mutation: {
    signup: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(USERS_SERVICE_URL, {
            query: `mutation Signup($email: String!, $fullName: String!, $password: String!, $organizationName: String) { signup(email: $email, fullName: $fullName, password: $password, organizationName: $organizationName) { token isNewUser requiredActions user { id fullName email orgRole category role status organizationId } } }`,
            variables
        }, context.user);
        const data = result.data?.signup;
        
        // Issue refresh token as httpOnly cookie
        if (data?.token && data?.user && context.res) {
          const refreshToken = generateRefreshToken();
          const payload = {
            id: data.user.id,
            email: data.user.email,
            orgRole: data.user.orgRole,
            category: data.user.category,
            role: data.user.role,
            organizationId: data.user.organizationId,
          };
          context.refreshTokenStore.set(refreshToken, {
            payload,
            expiresAt: Date.now() + REFRESH_TOKEN_EXPIRY_SECONDS * 1000,
          });
          const isProduction = process.env.NODE_ENV === 'production';
          context.res.cookie('refreshToken', refreshToken, getRefreshCookieOptions(isProduction));
        }
        
        return data;
    },
    login: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(USERS_SERVICE_URL, {
            query: `mutation Login($email: String!, $password: String!) { login(email: $email, password: $password) { requiresOTP otpExpiry message } }`,
            variables
        }, context.user);
        return result.data?.login;
    },
    verifyLoginOTP: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(USERS_SERVICE_URL, {
            query: `mutation VerifyLoginOTP($email: String!, $otp: String!) { verifyLoginOTP(email: $email, otp: $otp) { token isNewUser requiredActions user { id fullName email orgRole category role department hierarchyLevel status organizationId twoFactorEnabled twoFactorMethod } } }`,
            variables
        }, context.user);
        const data = result.data?.verifyLoginOTP;
        
        // Issue refresh token as httpOnly cookie
        if (data?.token && data?.user && context.res) {
          const refreshToken = generateRefreshToken();
          const payload = {
            id: data.user.id,
            email: data.user.email,
            orgRole: data.user.orgRole,
            category: data.user.category,
            role: data.user.role,
            department: data.user.department,
            hierarchyLevel: data.user.hierarchyLevel,
            organizationId: data.user.organizationId,
          };
          context.refreshTokenStore.set(refreshToken, {
            payload,
            expiresAt: Date.now() + REFRESH_TOKEN_EXPIRY_SECONDS * 1000,
          });
          const isProduction = process.env.NODE_ENV === 'production';
          context.res.cookie('refreshToken', refreshToken, getRefreshCookieOptions(isProduction));
        }
        
        return data;
    },
    changePassword: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(USERS_SERVICE_URL, {
            query: `mutation ChangePassword($newPassword: String!) { changePassword(newPassword: $newPassword) }`,
            variables
        }, context.user);
        return result.data?.changePassword;
    },
    requestPasswordReset: async (_: any, variables: any) => {
        const result = await proxyToService(USERS_SERVICE_URL, {
            query: `mutation RequestPasswordReset($email: String!) { requestPasswordReset(email: $email) }`,
            variables
        }, null);
        return result.data?.requestPasswordReset;
    },
    resetPassword: async (_: any, variables: any) => {
        const result = await proxyToService(USERS_SERVICE_URL, {
            query: `mutation ResetPassword($token: String!, $newPassword: String!) { resetPassword(token: $token, newPassword: $newPassword) }`,
            variables
        }, null);
        return result.data?.resetPassword;
    },
    createProject: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(PROJECTS_SERVICE_URL, {
            query: `mutation CreateProject($name: String!, $description: String!, $category: ProjectCategory!, $startDate: DateTime!, $targetEndDate: DateTime!, $releaseDate: DateTime, $estimatedDays: Int, $maxTeamSize: Int!, $projectLeadId: ID, $viceTeamLeaderId: ID, $budgetUSD: Float, $specialtiesNeeded: [MemberSpecialty!]) { createProject(name: $name, description: $description, category: $category, startDate: $startDate, targetEndDate: $targetEndDate, releaseDate: $releaseDate, estimatedDays: $estimatedDays, maxTeamSize: $maxTeamSize, projectLeadId: $projectLeadId, viceTeamLeaderId: $viceTeamLeaderId, budgetUSD: $budgetUSD, specialtiesNeeded: $specialtiesNeeded) { id name status completionPercentage } }`,
            variables
        }, context.user);
        return result.data?.createProject;
    },
    updateProjectDetails: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(PROJECTS_SERVICE_URL, {
            query: `mutation UpdateProjectDetails($projectId: ID!, $name: String, $description: String, $status: ProjectStatus, $targetEndDate: DateTime, $budgetUSD: Float) { updateProjectDetails(projectId: $projectId, name: $name, description: $description, status: $status, targetEndDate: $targetEndDate, budgetUSD: $budgetUSD) { id name status } }`,
            variables
        }, context.user);
        return result.data?.updateProjectDetails;
    },
    updateProjectProgress: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(PROJECTS_SERVICE_URL, {
            query: `mutation UpdateProjectProgress($projectId: ID!, $completionPercentage: Float!, $status: ProjectStatus) { updateProjectProgress(projectId: $projectId, completionPercentage: $completionPercentage, status: $status) { id completionPercentage status } }`,
            variables
        }, context.user);
        return result.data?.updateProjectProgress;
    },
    addMemberToProject: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(PROJECTS_SERVICE_URL, {
            query: `mutation AddMemberToProject($projectId: ID!, $userId: ID!, $projectRole: ProjectRole!, $specialty: MemberSpecialty!, $allocation: Int!, $startDate: DateTime!) { addMemberToProject(projectId: $projectId, userId: $userId, projectRole: $projectRole, specialty: $specialty, allocation: $allocation, startDate: $startDate) { userId name projectRole specialty allocation startDate joinedAt status } }`,
            variables
        }, context.user);
        return result.data?.addMemberToProject;
    },
    removeTeamMemberFromProject: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(PROJECTS_SERVICE_URL, {
            query: `mutation RemoveTeamMemberFromProject($projectId: ID!, $userId: ID!) { removeTeamMemberFromProject(projectId: $projectId, userId: $userId) }`,
            variables
        }, context.user);
        return result.data?.removeTeamMemberFromProject;
    },
    createAllocationRequest: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(PROJECTS_SERVICE_URL, {
            query: `mutation CreateAllocationRequest($projectId: ID!, $requestedUserId: ID!, $specialty: MemberSpecialty!, $allocation: Int!, $projectRole: ProjectRole!, $reason: String) { createAllocationRequest(projectId: $projectId, requestedUserId: $requestedUserId, specialty: $specialty, allocation: $allocation, projectRole: $projectRole, reason: $reason) { id projectId projectName requestedByName requestedUserName specialty allocation projectRole reason status createdAt } }`,
            variables
        }, context.user);
        return result.data?.createAllocationRequest;
    },
    approveAllocation: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(PROJECTS_SERVICE_URL, {
            query: `mutation ApproveAllocation($requestId: ID!) { approveAllocation(requestId: $requestId) { id status approvedByName resolvedAt } }`,
            variables
        }, context.user);
        return result.data?.approveAllocation;
    },
    rejectAllocation: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(PROJECTS_SERVICE_URL, {
            query: `mutation RejectAllocation($requestId: ID!, $reason: String!) { rejectAllocation(requestId: $requestId, reason: $reason) { id status rejectionReason resolvedAt } }`,
            variables
        }, context.user);
        return result.data?.rejectAllocation;
    },
    addProjectUpdate: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(PROJECTS_SERVICE_URL, {
            query: `mutation AddProjectUpdate($projectId: ID!, $type: UpdateType!, $title: String!, $description: String, $severity: Severity!) { addProjectUpdate(projectId: $projectId, type: $type, title: $title, description: $description, severity: $severity) { id title type } }`,
            variables
        }, context.user);
        return result.data?.addProjectUpdate;
    },
    createTask: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(PROJECTS_SERVICE_URL, {
            query: `mutation CreateTask($projectId: ID!, $title: String!, $priority: TaskPriority!, $specialty: MemberSpecialty, $assignedToId: ID, $dependsOn: [ID!]) { createTask(projectId: $projectId, title: $title, priority: $priority, specialty: $specialty, assignedToId: $assignedToId, dependsOn: $dependsOn) { id title status } }`,
            variables
        }, context.user);
        return result.data?.createTask;
    },
    updateTaskStatus: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(PROJECTS_SERVICE_URL, {
            query: `mutation UpdateTaskStatus($taskId: ID!, $status: TaskStatus!, $blockerReason: String, $completionNote: String) { updateTaskStatus(taskId: $taskId, status: $status, blockerReason: $blockerReason, completionNote: $completionNote) { id status } }`,
            variables
        }, context.user);
        return result.data?.updateTaskStatus;
    },
    addTaskAttachment: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(PROJECTS_SERVICE_URL, {
            query: `mutation AddTaskAttachment($taskId: ID!, $fileKey: String!, $fileName: String!, $mimeType: String!, $fileSize: Int!) { addTaskAttachment(taskId: $taskId, fileKey: $fileKey, fileName: $fileName, mimeType: $mimeType, fileSize: $fileSize) { id attachments { fileKey fileName mimeType fileSize uploadedBy uploadedAt } } }`,
            variables
        }, context.user);
        return result.data?.addTaskAttachment;
    },
    removeTaskAttachment: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(PROJECTS_SERVICE_URL, {
            query: `mutation RemoveTaskAttachment($taskId: ID!, $fileKey: String!) { removeTaskAttachment(taskId: $taskId, fileKey: $fileKey) { id attachments { fileKey fileName } } }`,
            variables
        }, context.user);
        return result.data?.removeTaskAttachment;
    },
    uploadSRSDocument: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(PROJECTS_SERVICE_URL, {
            query: `mutation UploadSRSDocument($projectId: ID!, $url: String!, $version: Int!) { uploadSRSDocument(projectId: $projectId, url: $url, version: $version) { id version url } }`,
            variables
        }, context.user);
        return result.data?.uploadSRSDocument;
    },
    updateUserOrgRole: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(USERS_SERVICE_URL, {
            query: `mutation UpdateUserOrgRole($userId: ID!, $orgRole: OrgRole!, $role: FunctionalRole) { updateUserOrgRole(userId: $userId, orgRole: $orgRole, role: $role) { id fullName orgRole role category } }`,
            variables
        }, context.user);
        return result.data?.updateUserOrgRole;
    },
    inviteUser: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(USERS_SERVICE_URL, {
            query: `mutation InviteUser($email: String!, $fullName: String!, $category: UserCategory!, $role: FunctionalRole!, $department: Department!, $specialty: MemberSpecialty, $assignedProjectIds: [ID!], $managedTeamIds: [ID!], $reportingManagerId: ID, $twoFactorRequired: Boolean) { inviteUser(email: $email, fullName: $fullName, category: $category, role: $role, department: $department, specialty: $specialty, assignedProjectIds: $assignedProjectIds, managedTeamIds: $managedTeamIds, reportingManagerId: $reportingManagerId, twoFactorRequired: $twoFactorRequired) { userId email invitationExpiry temporaryPassword status } }`,
            variables
        }, context.user);
        return result.data?.inviteUser;
    },
    resendInvitation: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(USERS_SERVICE_URL, {
            query: `mutation ResendInvitation($userId: ID!) { resendInvitation(userId: $userId) }`,
            variables
        }, context.user);
        return result.data?.resendInvitation;
    },
    dropUser: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(USERS_SERVICE_URL, {
            query: `mutation DropUser($userId: ID!, $otp: String!) { dropUser(userId: $userId, otp: $otp) { success auditId } }`,
            variables
        }, context.user);
        return result.data?.dropUser;
    },
    requestSecurityOTP: async (_: any, __: any, context: any) => {
        const result = await proxyToService(USERS_SERVICE_URL, {
            query: `mutation RequestSecurityOTP { requestSecurityOTP }`
        }, context.user);
        return result.data?.requestSecurityOTP;
    },
    adminUpdate2FA: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(USERS_SERVICE_URL, {
            query: `mutation AdminUpdate2FA($userId: ID!, $enabled: Boolean!, $method: TwoFactorMethod) { adminUpdate2FA(userId: $userId, enabled: $enabled, method: $method) { id fullName twoFactorEnabled twoFactorMethod } }`,
            variables
        }, context.user);
        return result.data?.adminUpdate2FA;
    },
    verify2FASetup: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(USERS_SERVICE_URL, {
            query: `mutation Verify2FASetup($method: TwoFactorMethod!, $code: String!) { verify2FASetup(method: $method, code: $code) }`,
            variables
        }, context.user);
        return result.data?.verify2FASetup;
    },
    // ── Internal Messaging Mutations ──────────────────────────────────────
    sendDirectMessage: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(USERS_SERVICE_URL, {
            query: `mutation SendDirectMessage($recipientId: ID!, $subject: String!, $content: String!, $priority: MessagePriority, $parentMessageId: ID) { sendDirectMessage(recipientId: $recipientId, subject: $subject, content: $content, priority: $priority, parentMessageId: $parentMessageId) { id senderId senderName senderRole recipientId recipientName recipientRole subject content priority read createdAt parentMessageId } }`,
            variables
        }, context.user);
        return result.data?.sendDirectMessage;
    },
    markMessagesRead: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(USERS_SERVICE_URL, {
            query: `mutation MarkMessagesRead($senderId: ID!) { markMessagesRead(senderId: $senderId) }`,
            variables
        }, context.user);
        return result.data?.markMessagesRead;
    },
    updateUserRole: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(USERS_SERVICE_URL, {
            query: `mutation UpdateUserRole($userId: ID!, $newRole: FunctionalRole!) { updateUserRole(userId: $userId, newRole: $newRole) { id fullName role category } }`,
            variables
        }, context.user);
        return result.data?.updateUserRole;
    },
    promoteUser: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(USERS_SERVICE_URL, {
            query: `mutation PromoteUser($userId: ID!, $newRole: FunctionalRole, $newLevel: Int) { promoteUser(userId: $userId, newRole: $newRole, newLevel: $newLevel) { id fullName role hierarchyLevel } }`,
            variables
        }, context.user);
        return result.data?.promoteUser;
    },
    suspendUser: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(USERS_SERVICE_URL, {
            query: `mutation SuspendUser($userId: ID!, $reason: String!) { suspendUser(userId: $userId, reason: $reason) { id fullName status } }`,
            variables
        }, context.user);
        return result.data?.suspendUser;
    },
    changeReportingManager: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(USERS_SERVICE_URL, {
            query: `mutation ChangeReportingManager($userId: ID!, $newManagerId: ID!) { changeReportingManager(userId: $userId, newManagerId: $newManagerId) { id fullName reportingManagerId } }`,
            variables
        }, context.user);
        return result.data?.changeReportingManager;
    },
    // ── Payroll Mutations ────────────────────────────────────────────────────
    setSalaryStructure: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(USERS_SERVICE_URL, { query: `mutation SetSalaryStructure($userId: ID!, $basicPay: Float!, $hraPercentage: Float, $conveyanceAllowance: Float, $medicalAllowance: Float, $specialAllowance: Float, $pfEnabled: Boolean, $esiEnabled: Boolean, $ptEnabled: Boolean, $tdsPercentage: Float) { setSalaryStructure(userId: $userId, basicPay: $basicPay, hraPercentage: $hraPercentage, conveyanceAllowance: $conveyanceAllowance, medicalAllowance: $medicalAllowance, specialAllowance: $specialAllowance, pfEnabled: $pfEnabled, esiEnabled: $esiEnabled, ptEnabled: $ptEnabled, tdsPercentage: $tdsPercentage) { userId basicPay hraPercentage conveyanceAllowance medicalAllowance specialAllowance pfEnabled esiEnabled ptEnabled tdsPercentage effectiveFrom } }`, variables }, context.user);
        return result.data?.setSalaryStructure;
    },
    runPayroll: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(USERS_SERVICE_URL, { query: `mutation RunPayroll($month: String!, $totalWorkingDays: Int!) { runPayroll(month: $month, totalWorkingDays: $totalWorkingDays) { runId orgId month status totalEmployees totalGross totalDeductions totalNet createdBy createdAt } }`, variables }, context.user);
        return result.data?.runPayroll;
    },
    approvePayroll: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(USERS_SERVICE_URL, { query: `mutation ApprovePayroll($runId: ID!) { approvePayroll(runId: $runId) { runId status approvedBy approvedAt } }`, variables }, context.user);
        return result.data?.approvePayroll;
    },
    // ── Notification Mutations ──────────────────────────────────────────────
    markNotificationRead: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(PROJECTS_SERVICE_URL, {
            query: `mutation MarkNotificationRead($notificationId: ID!, $createdAt: DateTime!) { markNotificationRead(notificationId: $notificationId, createdAt: $createdAt) }`,
            variables
        }, context.user);
        return result.data?.markNotificationRead;
    },
    updateNotificationPreferences: async (_: any, variables: any, context: any) => {
        const result = await proxyToService(PROJECTS_SERVICE_URL, {
            query: `mutation UpdateNotificationPreferences($preferences: NotificationPreferencesInput!) { updateNotificationPreferences(preferences: $preferences) { emailEnabled inAppEnabled taskAssigned taskStatusChanged projectUpdates teamChanges payrollUpdates securityAlerts messageNotifications } }`,
            variables
        }, context.user);
        return result.data?.updateNotificationPreferences;
    },
    markAllNotificationsRead: async (_: any, __: any, context: any) => {
        const result = await proxyToService(PROJECTS_SERVICE_URL, {
            query: `mutation { markAllNotificationsRead }`
        }, context.user);
        return result.data?.markAllNotificationsRead;
    },
    logout: () => true
  }
};

const app = express();
const server = new ApolloServer({
  typeDefs,
  resolvers,
});

async function setupServer() {
    await server.start();

    // CORS: Lock to frontend URL in production, permissive in dev
    const isProduction = process.env.NODE_ENV === 'production';
    const corsOptions: cors.CorsOptions = {
      origin: isProduction
        ? (origin, callback) => {
            const allowed = [FRONTEND_URL];
            // Allow requests with no origin (server-to-server, mobile apps)
            if (!origin || allowed.includes(origin)) {
              callback(null, true);
            } else {
              console.warn(`[CORS] Blocked request from origin: ${origin}`);
              callback(new Error('Not allowed by CORS'));
            }
          }
        : true, // Allow all origins in development
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 86400, // Cache preflight for 24 hours
    };

    app.use(cors(corsOptions));
    app.use(cookieParser());
    app.use(express.json({ limit: '1mb' })); // Limit body size to prevent abuse

    // ── Refresh Token Store (in-memory, replace with DynamoDB for multi-Lambda) ──
    // Maps refreshToken -> { userId, orgRole, category, role, department, hierarchyLevel, organizationId, expiresAt }
    const refreshTokenStore = new Map<string, { payload: any; expiresAt: number }>();

    // Cleanup expired refresh tokens every 10 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [token, entry] of refreshTokenStore) {
        if (entry.expiresAt < now) refreshTokenStore.delete(token);
      }
    }, 600_000);

    // ── POST /auth/refresh - Exchange refresh token for new access token ──
    app.post('/auth/refresh', (req: any, res: any) => {
      const refreshToken = req.cookies?.refreshToken;
      
      if (!refreshToken) {
        return res.status(401).json({ error: 'No refresh token provided' });
      }

      const entry = refreshTokenStore.get(refreshToken);
      if (!entry) {
        return res.status(401).json({ error: 'Invalid refresh token' });
      }

      if (entry.expiresAt < Date.now()) {
        refreshTokenStore.delete(refreshToken);
        return res.status(401).json({ error: 'Refresh token expired' });
      }

      // Issue new access token
      const newAccessToken = generateAccessToken(entry.payload, JWT_SECRET);

      // Rotate refresh token (one-time use for security)
      refreshTokenStore.delete(refreshToken);
      const newRefreshToken = generateRefreshToken();
      refreshTokenStore.set(newRefreshToken, {
        payload: entry.payload,
        expiresAt: Date.now() + REFRESH_TOKEN_EXPIRY_SECONDS * 1000,
      });

      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie('refreshToken', newRefreshToken, getRefreshCookieOptions(isProduction));
      res.json({ token: newAccessToken });
    });

    // ── POST /auth/logout - Clear refresh token ──
    app.post('/auth/logout', (req: any, res: any) => {
      const refreshToken = req.cookies?.refreshToken;
      if (refreshToken) {
        refreshTokenStore.delete(refreshToken);
      }
      res.clearCookie('refreshToken', { path: '/auth/refresh' });
      res.json({ success: true });
    });

    // Rate limiting + input validation middleware for GraphQL mutations
    app.use('/graphql', (req: any, res: any, next: any) => {
      if (req.method !== 'POST') return next();
      
      const operationName = extractOperationName(req.body);
      if (!operationName) return next();
      
      // Rate limiting
      const clientIp = getClientIp(req);
      const rateLimitError = checkRateLimit(operationName, clientIp);
      
      if (rateLimitError) {
        console.warn(`[RATE_LIMIT] Blocked ${operationName} from ${clientIp}`);
        res.status(429).json({
          errors: [{ message: rateLimitError, extensions: { code: 'RATE_LIMITED' } }],
        });
        return;
      }

      // Input sanitization (strip HTML, trim strings)
      if (req.body?.variables) {
        sanitizeVariables(req.body.variables);
      }

      // Input validation (enum values, string lengths, email format)
      const validationError = validateMutationInput(operationName, req.body?.variables);
      if (validationError) {
        console.warn(`[VALIDATION] Rejected ${operationName}: ${validationError}`);
        res.status(400).json({
          errors: [{ message: validationError, extensions: { code: 'VALIDATION_ERROR' } }],
        });
        return;
      }
      
      next();
    });

    app.use('/graphql', expressMiddleware(server, {
      context: async ({ req, res }) => {
        const token = req.headers.authorization?.split(' ')[1] || '';
        const user = token ? verifyToken(token, JWT_SECRET) : null;
        return { user, res, refreshTokenStore };
      },
    }));

    // ── Chat REST proxy ─────────────────────────────────────────────────────
    // Forward /chat/* and /tasks/*/upload-url to their respective services
    // The JWT is forwarded as-is; each service verifies it independently.
    app.use('/chat', async (req, res) => {
      try {
        const url = `${CHAT_SERVICE_URL}${req.originalUrl}`;
        const resp = await fetch(url, {
          method: req.method,
          headers: { ...req.headers, host: undefined } as any,
          body: ['POST', 'PUT', 'PATCH'].includes(req.method) ? JSON.stringify(req.body) : undefined,
        });
        const text = await resp.text();
        res.status(resp.status).set('Content-Type', 'application/json').send(text);
      } catch (e: any) {
        res.status(502).json({ error: e.message });
      }
    });

    app.post('/tasks/:taskId/upload-url', async (req, res) => {
      try {
        const url = `${PROJECTS_SERVICE_URL}/tasks/${req.params.taskId}/upload-url`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: { ...req.headers, host: undefined } as any,
          body: JSON.stringify(req.body),
        });
        const text = await resp.text();
        res.status(resp.status).set('Content-Type', 'application/json').send(text);
      } catch (e: any) {
        res.status(502).json({ error: e.message });
      }
    });

    // ── Project Documents REST endpoints (implemented here since svc-projects is GraphQL-only) ──
    app.post('/projects/:projectId/docs/upload-url', async (req, res) => {
      try {
        const token = (req.headers.authorization || '').replace('Bearer ', '');
        const user = token ? verifyToken(token, JWT_SECRET) : null;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { projectId } = req.params;
        const { fileName, mimeType, fileSize, title, type, tags, description, version } = req.body;
        if (!fileName || !mimeType || !title || !type) return res.status(400).json({ error: 'Missing fields' });

        const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
        const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
        const { v4: uuidv4 } = await import('uuid');

        const s3 = new S3Client({ region: 'ap-south-1' });
        const BUCKET = 'project-tracker-project-docs-dev';
        const docId = uuidv4();
        const fileKey = `projects/${projectId}/docs/${type}/${docId}/${fileName}`;

        const uploadUrl = await getSignedUrl(
          s3,
          new PutObjectCommand({ Bucket: BUCKET, Key: fileKey, ContentType: mimeType }),
          { expiresIn: 300 }
        );

        res.json({ uploadUrl, fileKey, docId });
      } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.post('/projects/:projectId/docs/confirm', async (req, res) => {
      try {
        const token = (req.headers.authorization || '').replace('Bearer ', '');
        const user = token ? verifyToken(token, JWT_SECRET) : null;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { projectId } = req.params;
        const { docId, fileKey, title, description, type, tags, fileName, mimeType, fileSize, version, docPassword } = req.body;

        const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
        const { DynamoDBDocumentClient, PutCommand } = await import('@aws-sdk/lib-dynamodb');
        const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'ap-south-1' }));
        const now = new Date().toISOString();

        await ddb.send(new PutCommand({
          TableName: 'ProjectDocuments',
          Item: { projectId, docId, createdAt: now, title, description, type, tags: tags || [], fileKey, fileName, mimeType, fileSize: fileSize || 0, version: version || 1, uploadedBy: user.id, updatedAt: now, restricted: ['API_KEYS','CREDENTIALS'].includes(type), ...(docPassword ? { docPassword } : {}) }
        }));

        res.status(201).json({ success: true, docId });
      } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.get('/projects/:projectId/docs', async (req, res) => {
      try {
        const token = (req.headers.authorization || '').replace('Bearer ', '');
        const user = token ? verifyToken(token, JWT_SECRET) : null;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
        const { DynamoDBDocumentClient, QueryCommand } = await import('@aws-sdk/lib-dynamodb');
        const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'ap-south-1' }));

        const { Items } = await ddb.send(new QueryCommand({
          TableName: 'ProjectDocuments',
          KeyConditionExpression: 'projectId = :p',
          ExpressionAttributeValues: { ':p': req.params.projectId }
        }));

        res.json(Items || []);
      } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.delete('/projects/:projectId/docs/:docId', async (req, res) => {
      try {
        const token = (req.headers.authorization || '').replace('Bearer ', '');
        const user = token ? verifyToken(token, JWT_SECRET) : null;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
        const { DynamoDBDocumentClient, DeleteCommand } = await import('@aws-sdk/lib-dynamodb');
        const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'ap-south-1' }));

        await ddb.send(new DeleteCommand({
          TableName: 'ProjectDocuments',
          Key: { projectId: req.params.projectId, docId: req.params.docId }
        }));

        res.json({ success: true });
      } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // ── Password Vault REST endpoints ──────────────────────────────────────
    app.get('/projects/:projectId/vault', async (req, res) => {
      try {
        const token = (req.headers.authorization || '').replace('Bearer ', '');
        const user = token ? verifyToken(token, JWT_SECRET) : null;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });
        if (!['C_SUITE', 'SVP', 'VP', 'SENIOR_MANAGER', 'MANAGER'].includes(user.category)) return res.status(403).json({ error: 'Only managers can access the vault' });

        const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
        const { DynamoDBDocumentClient, QueryCommand } = await import('@aws-sdk/lib-dynamodb');
        const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'ap-south-1' }));
        const { Items } = await ddb.send(new QueryCommand({ TableName: 'ProjectDocuments', KeyConditionExpression: 'projectId = :p', ExpressionAttributeValues: { ':p': `VAULT#${req.params.projectId}` } }));
        res.json(Items || []);
      } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.post('/projects/:projectId/vault', async (req, res) => {
      try {
        const token = (req.headers.authorization || '').replace('Bearer ', '');
        const user = token ? verifyToken(token, JWT_SECRET) : null;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });
        if (!['C_SUITE', 'SVP', 'VP', 'SENIOR_MANAGER', 'MANAGER'].includes(user.category)) return res.status(403).json({ error: 'Only managers can manage the vault' });

        const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
        const { DynamoDBDocumentClient, PutCommand } = await import('@aws-sdk/lib-dynamodb');
        const { v4: uuidv4 } = await import('uuid');
        const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'ap-south-1' }));
        const { label, username, password, url, notes } = req.body;
        const id = uuidv4();
        const now = new Date().toISOString();
        await ddb.send(new PutCommand({ TableName: 'ProjectDocuments', Item: { projectId: `VAULT#${req.params.projectId}`, docId: id, label, username, password, url, notes, createdBy: user.id, createdAt: now } }));
        res.status(201).json({ id, label, username, password, url, notes, createdAt: now });
      } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.delete('/projects/:projectId/vault/:id', async (req, res) => {
      try {
        const token = (req.headers.authorization || '').replace('Bearer ', '');
        const user = token ? verifyToken(token, JWT_SECRET) : null;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });
        if (!['C_SUITE', 'SVP', 'VP', 'SENIOR_MANAGER', 'MANAGER'].includes(user.category)) return res.status(403).json({ error: 'Access denied' });

        const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
        const { DynamoDBDocumentClient, DeleteCommand } = await import('@aws-sdk/lib-dynamodb');
        const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'ap-south-1' }));
        await ddb.send(new DeleteCommand({ TableName: 'ProjectDocuments', Key: { projectId: `VAULT#${req.params.projectId}`, docId: req.params.id } }));
        res.json({ success: true });
      } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    if (process.env.NODE_ENV !== 'production') {
      const port = process.env.PORT || 4000;
      app.listen(port, () => {
        console.log(`🚀 Gateway ready at http://localhost:${port}/graphql`);
      });
    }
}

setupServer();

export const handler = (serverlessExpress as any)({ app });
