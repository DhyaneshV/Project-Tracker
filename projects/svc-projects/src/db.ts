import dotenv from 'dotenv';
dotenv.config();

import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  QueryCommand,
  UpdateItemCommand,
  ScanCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  ...(process.env.DYNAMODB_ENDPOINT && {
    endpoint: process.env.DYNAMODB_ENDPOINT,
  }),
});

const PROJECTS_TABLE = process.env.PROJECTS_TABLE || 'Projects';
const TASKS_TABLE = process.env.TASKS_TABLE || 'Tasks';
const UPDATES_TABLE = process.env.PROJECT_UPDATES_TABLE || 'ProjectUpdates';
const SRS_TABLE = process.env.SRS_DOCUMENTS_TABLE || 'SRSDocuments';
const DOCS_TABLE = process.env.PROJECT_DOCUMENTS_TABLE || 'ProjectDocuments';
const NOTIFICATIONS_TABLE = process.env.NOTIFICATIONS_TABLE || 'Notifications';

// ─── DOCUMENT TYPES ────────────────────────────────────────────────────────

export type DocumentType =
  | 'SRS'
  | 'API_KEYS'
  | 'DESIGN'
  | 'CONTRACT'
  | 'ARCHITECTURE'
  | 'MEETING_NOTES'
  | 'ROADMAP'
  | 'CREDENTIALS'
  | 'DEPLOYMENT'
  | 'OTHER';

export interface ProjectDocument {
  projectId: string;
  docId: string;
  createdAt: string; // SK
  title: string;
  description?: string;
  type: DocumentType;
  tags: string[];
  fileKey: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  version: number;
  uploadedBy: string;
  updatedAt: string;
  // Visibility: MANAGER+ always see all; TEAM_LEAD only sees non-restricted docs unless it's their specialty
  restricted: boolean; // true = MANAGER+ only (e.g. API_KEYS, CREDENTIALS)
}

// ─── PROJECT OPERATIONS ──────────────────────────────────────────────────────

export interface ProjectMember {
  userId: string;
  name?: string;
  projectRole: 'TEAM_LEAD' | 'VICE_TEAM_LEAD' | 'ENGINEER' | 'QA_ENGINEER' | 'MEMBER';
  specialty: 'FRONTEND' | 'BACKEND' | 'ML' | 'DEPLOYER' | 'TESTER' | 'DESIGNER' | 'QA' | 'DEVOPS' | 'GENERAL';
  contribution: number;
  allocation: number;   // percentage 1-100
  startDate: string;    // ISO date
  joinedAt: string;
  status: 'ACTIVE' | 'ON_LEAVE' | 'REMOVED';
}

export interface Project {
  id: string;
  name: string;
  description: string;
  category: 'INTERNAL' | 'CLIENT' | 'PRODUCT' | 'MAINTENANCE';
  status: 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED';
  completionPercentage: number;
  startDate: string;
  targetEndDate: string;
  releaseDate?: string;
  estimatedDays?: number;
  budgetUSD?: number;
  maxTeamSize: number;
  currentTeamSize: number;
  specialtiesNeeded?: string[];
  srsDocumentUrl?: string;
  srsDocumentVersion?: number;
  teamLeaderId: string;       // primary TEAM_LEAD (projectLeadId)
  projectLeadId?: string;     // alias kept for backward compat
  viceTeamLeaderId?: string;
  managedByIds?: string[];    // MANAGERs overseeing this project
  teamMembers: ProjectMember[];
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

export async function createProject(project: Project): Promise<Project> {
  await client.send(
    new PutItemCommand({
      TableName: PROJECTS_TABLE,
      Item: marshall(project, { removeUndefinedValues: true }),
    })
  );
  return project;
}

export async function getProjectById(id: string): Promise<Project | null> {
  const result = await client.send(
    new GetItemCommand({
      TableName: PROJECTS_TABLE,
      Key: marshall({ id }),
    })
  );
  return result.Item ? (unmarshall(result.Item) as Project) : null;
}

export async function getAllProjects(statusFilter?: string): Promise<Project[]> {
  if (statusFilter) {
    const result = await client.send(
      new QueryCommand({
        TableName: PROJECTS_TABLE,
        IndexName: 'StatusIndex',
        KeyConditionExpression: '#status = :status',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: marshall({ ':status': statusFilter }),
      })
    );
    return result.Items ? result.Items.map((item) => unmarshall(item) as Project) : [];
  }

  const result = await client.send(
    new ScanCommand({
      TableName: PROJECTS_TABLE,
    })
  );
  return result.Items ? result.Items.map((item) => unmarshall(item) as Project) : [];
}

export async function getProjectsByTeamLeader(teamLeaderId: string): Promise<Project[]> {
  const result = await client.send(
    new QueryCommand({
      TableName: PROJECTS_TABLE,
      IndexName: 'TeamLeaderIndex',
      KeyConditionExpression: 'teamLeaderId = :tlId',
      ExpressionAttributeValues: marshall({ ':tlId': teamLeaderId }),
    })
  );
  return result.Items ? result.Items.map((item) => unmarshall(item) as Project) : [];
}

export async function getProjectsByTeamMember(userId: string): Promise<Project[]> {
  const allProjects = await getAllProjects();
  return allProjects.filter((p) =>
    p.teamMembers.some((m) => m.userId === userId)
  );
}

/**
 * For MANAGER role: returns projects where the manager is in managedByIds
 * OR where any of their direct reports (managedTeamIds) is a team member.
 */
export async function getProjectsForManager(
  managerId: string,
  managedTeamIds: string[]
): Promise<Project[]> {
  const allProjects = await getAllProjects();
  return allProjects.filter((p) => {
    const isManager = p.managedByIds?.includes(managerId);
    const hasDirectReport = p.teamMembers.some((m) => managedTeamIds.includes(m.userId));
    return isManager || hasDirectReport;
  });
}

export async function updateProjectDetails(
  id: string,
  updates: Partial<Project>
): Promise<Project | null> {
  const existing = await getProjectById(id);
  if (!existing) return null;

  const updated = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await client.send(
    new PutItemCommand({
      TableName: PROJECTS_TABLE,
      Item: marshall(updated, { removeUndefinedValues: true }),
    })
  );

  return updated;
}

export async function addTeamMemberToProject(
  projectId: string,
  member: ProjectMember
): Promise<Project | null> {
  const project = await getProjectById(projectId);
  if (!project) return null;

  if (project.teamMembers.some((m) => m.userId === member.userId)) {
    throw new Error('User is already a team member');
  }

  project.teamMembers.push(member);
  project.currentTeamSize = project.teamMembers.length;
  project.updatedAt = new Date().toISOString();

  await client.send(
    new PutItemCommand({
      TableName: PROJECTS_TABLE,
      Item: marshall(project, { removeUndefinedValues: true }),
    })
  );

  return project;
}

export async function removeTeamMemberFromProject(
  projectId: string,
  userId: string
): Promise<Project | null> {
  const project = await getProjectById(projectId);
  if (!project) return null;

  project.teamMembers = project.teamMembers.filter((m) => m.userId !== userId);
  project.currentTeamSize = project.teamMembers.length;
  project.updatedAt = new Date().toISOString();

  await client.send(
    new PutItemCommand({
      TableName: PROJECTS_TABLE,
      Item: marshall(project, { removeUndefinedValues: true }),
    })
  );

  return project;
}

// ─── TASK OPERATIONS ──────────────────────────────────────────────────────────

export interface TaskAttachment {
  fileKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  uploadedAt: string;
  url?: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'ON_HOLD';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  specialty?: 'FRONTEND' | 'BACKEND' | 'ML' | 'DEPLOYER' | 'TESTER' | 'DESIGNER' | 'QA' | 'DEVOPS' | 'GENERAL';
  assignedTo?: string;
  component?: string;
  dependsOn?: string[];  // task IDs this task depends on
  startDate?: string;
  dueDate?: string;
  completedAt?: string;
  blockerReason?: string;
  attachments?: TaskAttachment[];
  createdAt: string;
}

export async function createTask(task: Task): Promise<Task> {
  await client.send(
    new PutItemCommand({
      TableName: TASKS_TABLE,
      Item: marshall(task, { removeUndefinedValues: true }),
    })
  );
  return task;
}

export async function getTasksByProject(projectId: string, statusFilter?: string): Promise<Task[]> {
  const result = await client.send(
    new QueryCommand({
      TableName: TASKS_TABLE,
      IndexName: 'ProjectIdIndex',
      KeyConditionExpression: 'projectId = :pid',
      FilterExpression: statusFilter ? '#status = :status' : undefined,
      ExpressionAttributeNames: statusFilter ? { '#status': 'status' } : undefined,
      ExpressionAttributeValues: marshall(
        statusFilter ? { ':pid': projectId, ':status': statusFilter } : { ':pid': projectId }
      ),
    })
  );
  return result.Items ? result.Items.map((item) => unmarshall(item) as Task) : [];
}

export async function getTaskById(id: string): Promise<Task | null> {
  const result = await client.send(
    new GetItemCommand({
      TableName: TASKS_TABLE,
      Key: marshall({ id }),
    })
  );
  return result.Item ? (unmarshall(result.Item) as Task) : null;
}

export async function updateTaskStatus(
  id: string,
  status: Task['status'],
  blockerReason?: string
): Promise<Task | null> {
  const task = await getTaskById(id);
  if (!task) return null;

  task.status = status;
  if (status === 'BLOCKED') task.blockerReason = blockerReason;
  if (status === 'COMPLETED') task.completedAt = new Date().toISOString();

  await client.send(new PutItemCommand({ TableName: TASKS_TABLE, Item: marshall(task, { removeUndefinedValues: true }) }));
  return task;
}

export async function addAttachmentToTask(taskId: string, attachment: TaskAttachment): Promise<Task | null> {
  const task = await getTaskById(taskId);
  if (!task) return null;
  task.attachments = [...(task.attachments || []), attachment];
  await client.send(new PutItemCommand({ TableName: TASKS_TABLE, Item: marshall(task, { removeUndefinedValues: true }) }));
  return task;
}

export async function removeAttachmentFromTask(taskId: string, fileKey: string): Promise<Task | null> {
  const task = await getTaskById(taskId);
  if (!task) return null;
  task.attachments = (task.attachments || []).filter(a => a.fileKey !== fileKey);
  await client.send(new PutItemCommand({ TableName: TASKS_TABLE, Item: marshall(task, { removeUndefinedValues: true }) }));
  return task;
}

// ─── PROJECT UPDATES ──────────────────────────────────────────────────────────

export interface ProjectUpdate {
  id: string;
  projectId: string;
  type: string;
  title: string;
  description?: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  createdBy: string;
  createdAt: string;
}

export async function createProjectUpdate(update: ProjectUpdate): Promise<ProjectUpdate> {
  await client.send(
    new PutItemCommand({
      TableName: UPDATES_TABLE,
      Item: marshall(update, { removeUndefinedValues: true }),
    })
  );
  return update;
}

export async function getProjectUpdates(projectId: string): Promise<ProjectUpdate[]> {
  const result = await client.send(
    new QueryCommand({
      TableName: UPDATES_TABLE,
      IndexName: 'ProjectIdIndex',
      KeyConditionExpression: 'projectId = :pid',
      ExpressionAttributeValues: marshall({ ':pid': projectId }),
      ScanIndexForward: false,
    })
  );
  return result.Items ? result.Items.map((item) => unmarshall(item) as ProjectUpdate) : [];
}

// ─── SRS DOCUMENTS ────────────────────────────────────────────────────────────

export interface SRSDocument {
  id: string;
  projectId: string;
  version: number;
  url: string;
  status: string;
  uploadedBy: string;
  createdAt: string;
}

export async function createSRSDocument(doc: SRSDocument): Promise<SRSDocument> {
  await client.send(
    new PutItemCommand({
      TableName: SRS_TABLE,
      Item: marshall(doc, { removeUndefinedValues: true }),
    })
  );
  return doc;
}

export async function getSRSDocuments(projectId: string): Promise<SRSDocument[]> {
  const result = await client.send(
    new QueryCommand({
      TableName: SRS_TABLE,
      IndexName: 'ProjectIdIndex',
      KeyConditionExpression: 'projectId = :pid',
      ExpressionAttributeValues: marshall({ ':pid': projectId }),
      ScanIndexForward: false,
    })
  );
  return result.Items ? result.Items.map((item) => unmarshall(item) as SRSDocument) : [];
}

// ─── ANALYTICS ────────────────────────────────────────────────────────────────

export interface TeamContribution {
  userId: string;
  contributionPercentage: number;
  tasksCompleted: number;
}

export interface ProjectAnalytics {
  projectId: string;
  totalTasks: number;
  completedTasks: number;
  blockedTasks: number;
  velocity: number;
  teamContribution: TeamContribution[];
  timelineHealth: number;
}

export async function getProjectAnalytics(projectId: string): Promise<ProjectAnalytics> {
  const tasks = await getTasksByProject(projectId);
  const project = await getProjectById(projectId);

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'COMPLETED').length;
  const blockedTasks = tasks.filter((t) => t.status === 'BLOCKED').length;

  const velocity = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  const contributionMap = new Map<string, { completed: number; total: number }>();
  tasks.forEach((task) => {
    if (task.assignedTo) {
      const existing = contributionMap.get(task.assignedTo) || { completed: 0, total: 0 };
      existing.total += 1;
      if (task.status === 'COMPLETED') {
        existing.completed += 1;
      }
      contributionMap.set(task.assignedTo, existing);
    }
  });

  const teamContribution: TeamContribution[] = Array.from(contributionMap.entries()).map(
    ([userId, stats]) => ({
      userId,
      contributionPercentage: stats.total > 0 ? (stats.completed / stats.total) * 100 : 0,
      tasksCompleted: stats.completed,
    })
  );

  let timelineHealth = 100;
  if (project) {
    const now = new Date();
    const targetEnd = new Date(project.targetEndDate);
    const start = new Date(project.startDate);
    const totalDuration = targetEnd.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    const expectedCompletion = totalDuration > 0 ? (elapsed / totalDuration) * 100 : 0;
    const actualCompletion = project.completionPercentage;
    timelineHealth = Math.max(0, Math.min(100, 100 - (expectedCompletion - actualCompletion)));
  }

  return {
    projectId,
    totalTasks,
    completedTasks,
    blockedTasks,
    velocity,
    teamContribution,
    timelineHealth,
  };
}

// ─── ORG-WIDE ANALYTICS ───────────────────────────────────────────────────────

export interface OrgAnalytics {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  onHoldProjects: number;
  totalTasks: number;
  completedTasks: number;
  blockedTasks: number;
  inProgressTasks: number;
  totalBudget: number;
  spentBudget: number;
  totalHeadcount: number;
  avgProjectHealth: number;
  avgCompletionRate: number;
  projectsByCategory: { category: string; count: number }[];
  departmentUtilization: { department: string; memberCount: number; activeTaskCount: number }[];
}

export async function getOrgAnalytics(): Promise<OrgAnalytics> {
  const projects = await getAllProjects();
  const allTasks: Task[] = [];
  for (const p of projects) {
    const tasks = await getTasksByProject(p.id);
    allTasks.push(...tasks);
  }

  const activeProjects = projects.filter(p => p.status === 'ACTIVE').length;
  const completedProjects = projects.filter(p => p.status === 'COMPLETED').length;
  const onHoldProjects = projects.filter(p => p.status === 'ON_HOLD').length;
  const totalBudget = projects.reduce((s, p) => s + (p.budgetUSD || 0), 0);
  const spentBudget = projects.reduce((s, p) => s + (p.budgetUSD || 0) * (p.completionPercentage / 100), 0);
  const totalHeadcount = new Set(projects.flatMap(p => p.teamMembers.map(m => m.userId))).size;

  const healthArr = await Promise.all(projects.filter(p => p.status === 'ACTIVE').map(p => getProjectAnalytics(p.id)));
  const avgProjectHealth = healthArr.length > 0 ? healthArr.reduce((s, a) => s + a.timelineHealth, 0) / healthArr.length : 100;
  const avgCompletionRate = projects.length > 0 ? projects.reduce((s, p) => s + p.completionPercentage, 0) / projects.length : 0;

  const catMap = new Map<string, number>();
  projects.forEach(p => catMap.set(p.category, (catMap.get(p.category) || 0) + 1));
  const projectsByCategory = Array.from(catMap.entries()).map(([category, count]) => ({ category, count }));

  // Department utilization from team member specialties
  const deptMap = new Map<string, { members: Set<string>; tasks: number }>();
  projects.forEach(p => {
    p.teamMembers.forEach(m => {
      const dept = m.specialty || 'GENERAL';
      if (!deptMap.has(dept)) deptMap.set(dept, { members: new Set(), tasks: 0 });
      deptMap.get(dept)!.members.add(m.userId);
    });
  });
  allTasks.filter(t => t.status === 'IN_PROGRESS' || t.status === 'TODO').forEach(t => {
    const dept = t.specialty || 'GENERAL';
    if (!deptMap.has(dept)) deptMap.set(dept, { members: new Set(), tasks: 0 });
    deptMap.get(dept)!.tasks++;
  });
  const departmentUtilization = Array.from(deptMap.entries()).map(([department, d]) => ({
    department,
    memberCount: d.members.size,
    activeTaskCount: d.tasks,
  }));

  return {
    totalProjects: projects.length,
    activeProjects,
    completedProjects,
    onHoldProjects,
    totalTasks: allTasks.length,
    completedTasks: allTasks.filter(t => t.status === 'COMPLETED').length,
    blockedTasks: allTasks.filter(t => t.status === 'BLOCKED').length,
    inProgressTasks: allTasks.filter(t => t.status === 'IN_PROGRESS').length,
    totalBudget,
    spentBudget,
    totalHeadcount,
    avgProjectHealth,
    avgCompletionRate,
    projectsByCategory,
    departmentUtilization,
  };
}

export interface RiskAlert {
  id: string;
  projectId: string;
  projectName: string;
  type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  createdAt: string;
}

export async function getOrgRiskAlerts(): Promise<RiskAlert[]> {
  const projects = await getAllProjects();
  const alerts: RiskAlert[] = [];
  const now = new Date();

  for (const p of projects) {
    if (p.status === 'COMPLETED' || p.status === 'ARCHIVED') continue;

    // Deadline risk
    const targetEnd = new Date(p.targetEndDate);
    const daysLeft = (targetEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (daysLeft < 7 && daysLeft > 0 && p.completionPercentage < 80) {
      alerts.push({ id: `risk-${p.id}-deadline`, projectId: p.id, projectName: p.name, type: 'DEADLINE_RISK', severity: 'CRITICAL', message: `Only ${Math.ceil(daysLeft)} days remaining but only ${p.completionPercentage.toFixed(0)}% complete`, createdAt: now.toISOString() });
    } else if (daysLeft < 14 && daysLeft > 0 && p.completionPercentage < 60) {
      alerts.push({ id: `risk-${p.id}-deadline-warn`, projectId: p.id, projectName: p.name, type: 'DEADLINE_RISK', severity: 'WARNING', message: `${Math.ceil(daysLeft)} days remaining, ${p.completionPercentage.toFixed(0)}% complete`, createdAt: now.toISOString() });
    }

    // Overdue
    if (daysLeft < 0) {
      alerts.push({ id: `risk-${p.id}-overdue`, projectId: p.id, projectName: p.name, type: 'OVERDUE', severity: 'CRITICAL', message: `Project is ${Math.abs(Math.ceil(daysLeft))} days overdue`, createdAt: now.toISOString() });
    }

    // Blocked tasks
    const tasks = await getTasksByProject(p.id);
    const blocked = tasks.filter(t => t.status === 'BLOCKED');
    if (blocked.length >= 3) {
      alerts.push({ id: `risk-${p.id}-blocked`, projectId: p.id, projectName: p.name, type: 'BLOCKED_TASKS', severity: 'WARNING', message: `${blocked.length} tasks blocked`, createdAt: now.toISOString() });
    }

    // Budget overrun risk
    if (p.budgetUSD && p.completionPercentage > 0) {
      const burnRate = (p.budgetUSD * (p.completionPercentage / 100));
      const projectedTotal = burnRate / (p.completionPercentage / 100);
      if (projectedTotal > p.budgetUSD * 1.2) {
        alerts.push({ id: `risk-${p.id}-budget`, projectId: p.id, projectName: p.name, type: 'BUDGET_OVERRUN', severity: 'WARNING', message: `Projected spend exceeds budget by ${((projectedTotal / p.budgetUSD - 1) * 100).toFixed(0)}%`, createdAt: now.toISOString() });
      }
    }

    // Understaffed
    if (p.currentTeamSize < p.maxTeamSize * 0.5 && p.status === 'ACTIVE') {
      alerts.push({ id: `risk-${p.id}-staff`, projectId: p.id, projectName: p.name, type: 'UNDERSTAFFED', severity: 'INFO', message: `Team is at ${p.currentTeamSize}/${p.maxTeamSize} capacity`, createdAt: now.toISOString() });
    }
  }

  return alerts.sort((a, b) => {
    const sev = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    return (sev[a.severity] || 2) - (sev[b.severity] || 2);
  });
}

export interface BudgetSummary {
  projectId: string;
  projectName: string;
  budgetUSD: number;
  completionPercentage: number;
  status: string;
  burnRate: number;
  estimatedOverrun: number;
}

export async function getBudgetOverview(): Promise<BudgetSummary[]> {
  const projects = await getAllProjects();
  return projects
    .filter(p => p.budgetUSD && p.budgetUSD > 0)
    .map(p => {
      const spent = (p.budgetUSD || 0) * (p.completionPercentage / 100);
      const start = new Date(p.startDate);
      const now = new Date();
      const elapsed = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      const burnRate = elapsed > 0 ? spent / elapsed : 0;
      const remaining = (p.budgetUSD || 0) - spent;
      const daysLeft = (new Date(p.targetEndDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      const projectedRemaining = burnRate * Math.max(daysLeft, 0);
      const estimatedOverrun = Math.max(0, projectedRemaining - remaining);
      return {
        projectId: p.id,
        projectName: p.name,
        budgetUSD: p.budgetUSD || 0,
        completionPercentage: p.completionPercentage,
        status: p.status,
        burnRate,
        estimatedOverrun,
      };
    });
}

// ─── MY TASKS (Cross-project) ─────────────────────────────────────────────────

export async function getMyTasks(userId: string): Promise<Task[]> {
  // Scan tasks table for assigned user — fine at scale we operate at
  const result = await client.send(
    new ScanCommand({
      TableName: TASKS_TABLE,
      FilterExpression: 'assignedTo = :uid',
      ExpressionAttributeValues: marshall({ ':uid': userId }),
    })
  );
  return result.Items ? result.Items.map(item => unmarshall(item) as Task) : [];
}

// ─── ACTIVITY FEED ────────────────────────────────────────────────────────────

export interface ActivityEvent {
  id: string;
  type: string;
  title: string;
  description?: string;
  projectName?: string;
  projectId?: string;
  actorName?: string;
  severity?: string;
  createdAt: string;
}

export async function getActivityFeed(limit: number = 30): Promise<ActivityEvent[]> {
  const projects = await getAllProjects();
  const events: ActivityEvent[] = [];

  // Get recent project updates from all projects
  for (const p of projects) {
    const updates = await getProjectUpdates(p.id);
    for (const u of updates.slice(0, 5)) {
      events.push({
        id: u.id,
        type: u.type,
        title: u.title,
        description: u.description,
        projectName: p.name,
        projectId: p.id,
        severity: u.severity,
        createdAt: u.createdAt,
      });
    }
  }

  return events.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

// ─── UPCOMING DEADLINES ───────────────────────────────────────────────────────

export interface DeadlineItem {
  id: string;
  projectId: string;
  projectName: string;
  type: string;
  title: string;
  dueDate: string;
  daysLeft: number;
  status: string;
  priority?: string;
}

export async function getUpcomingDeadlines(): Promise<DeadlineItem[]> {
  const projects = await getAllProjects();
  const now = new Date();
  const deadlines: DeadlineItem[] = [];

  for (const p of projects) {
    if (p.status === 'COMPLETED' || p.status === 'ARCHIVED') continue;

    // Project deadline
    const targetEnd = new Date(p.targetEndDate);
    const daysLeft = Math.ceil((targetEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 30) {
      deadlines.push({
        id: `proj-${p.id}`,
        projectId: p.id,
        projectName: p.name,
        type: 'PROJECT_DEADLINE',
        title: `${p.name} — Target End Date`,
        dueDate: p.targetEndDate,
        daysLeft,
        status: p.status,
      });
    }

    // Task deadlines
    const tasks = await getTasksByProject(p.id);
    for (const t of tasks) {
      if (t.dueDate && t.status !== 'COMPLETED') {
        const taskDaysLeft = Math.ceil((new Date(t.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (taskDaysLeft <= 14) {
          deadlines.push({
            id: `task-${t.id}`,
            projectId: p.id,
            projectName: p.name,
            type: 'TASK_DEADLINE',
            title: t.title,
            dueDate: t.dueDate,
            daysLeft: taskDaysLeft,
            status: t.status,
            priority: t.priority,
          });
        }
      }
    }
  }

  return deadlines.sort((a, b) => a.daysLeft - b.daysLeft);
}

// ─── ALLOCATION REQUESTS ──────────────────────────────────────────────────────

const ALLOCATION_REQUESTS_TABLE = process.env.ALLOCATION_REQUESTS_TABLE || 'AllocationRequests';

export interface AllocationRequest {
  id: string;
  projectId: string;
  projectName: string;
  requestedBy: string;
  requestedByName: string;
  requestedUserId: string;
  requestedUserName: string;
  requestedUserRole?: string;
  specialty: string;
  allocation: number;
  projectRole: string;
  reason?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  approvedByName?: string;
  rejectionReason?: string;
  createdAt: string;
  resolvedAt?: string;
}

export async function createAllocationRequest(req: AllocationRequest): Promise<AllocationRequest> {
  await client.send(new PutItemCommand({
    TableName: ALLOCATION_REQUESTS_TABLE,
    Item: marshall(req, { removeUndefinedValues: true }),
  }));
  return req;
}

export async function getAllocationRequestById(id: string): Promise<AllocationRequest | null> {
  const result = await client.send(new GetItemCommand({
    TableName: ALLOCATION_REQUESTS_TABLE,
    Key: marshall({ id }),
  }));
  return result.Item ? (unmarshall(result.Item) as AllocationRequest) : null;
}

export async function getPendingAllocations(): Promise<AllocationRequest[]> {
  const result = await client.send(new ScanCommand({
    TableName: ALLOCATION_REQUESTS_TABLE,
    FilterExpression: '#s = :pending',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: marshall({ ':pending': 'PENDING' }),
  }));
  return result.Items ? result.Items.map(i => unmarshall(i) as AllocationRequest) : [];
}

export async function getProjectAllocations(projectId: string): Promise<AllocationRequest[]> {
  const result = await client.send(new ScanCommand({
    TableName: ALLOCATION_REQUESTS_TABLE,
    FilterExpression: 'projectId = :pid',
    ExpressionAttributeValues: marshall({ ':pid': projectId }),
  }));
  return result.Items ? result.Items.map(i => unmarshall(i) as AllocationRequest) : [];
}

export async function updateAllocationRequest(id: string, updates: Partial<AllocationRequest>): Promise<AllocationRequest | null> {
  const existing = await getAllocationRequestById(id);
  if (!existing) return null;
  const updated = { ...existing, ...updates };
  await client.send(new PutItemCommand({
    TableName: ALLOCATION_REQUESTS_TABLE,
    Item: marshall(updated, { removeUndefinedValues: true }),
  }));
  return updated;
}

// ─── PROJECT DOCUMENTS ────────────────────────────────────────────────────────

export async function createProjectDocument(doc: ProjectDocument): Promise<ProjectDocument> {
  await client.send(new PutItemCommand({
    TableName: DOCS_TABLE,
    Item: marshall(doc, { removeUndefinedValues: true }),
  }));
  return doc;
}

export async function listProjectDocuments(projectId: string, type?: DocumentType): Promise<ProjectDocument[]> {
  const params: any = {
    TableName: DOCS_TABLE,
    IndexName: 'ProjectIdIndex',
    KeyConditionExpression: 'projectId = :p',
    ExpressionAttributeValues: marshall({ ':p': projectId }),
    ScanIndexForward: false,
  };
  if (type) {
    params.FilterExpression = '#t = :type';
    params.ExpressionAttributeNames = { '#t': 'type' };
    params.ExpressionAttributeValues = marshall({ ':p': projectId, ':type': type });
  }
  const result = await client.send(new QueryCommand(params));
  return result.Items ? result.Items.map(i => unmarshall(i) as ProjectDocument) : [];
}

export async function getProjectDocument(projectId: string, docId: string): Promise<ProjectDocument | null> {
  // docId is not the PK — scan with filter (table is project-scoped so small)
  const docs = await listProjectDocuments(projectId);
  return docs.find(d => d.docId === docId) || null;
}

export async function deleteProjectDocument(projectId: string, docId: string): Promise<boolean> {
  const doc = await getProjectDocument(projectId, docId);
  if (!doc) return false;
  // PK=projectId SK=createdAt
  await client.send(new (await import('@aws-sdk/client-dynamodb')).DeleteItemCommand({
    TableName: DOCS_TABLE,
    Key: marshall({ projectId, createdAt: doc.createdAt }),
  }));
  return true;
}


// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  userId: string;          // recipient
  type: 'TASK_ASSIGNED' | 'TASK_COMPLETED' | 'PROJECT_UPDATE' | 'MENTION' | 'MEMBER_ADDED' | 'BLOCKER';
  title: string;
  message?: string;
  projectId?: string;
  projectName?: string;
  taskId?: string;
  actorName?: string;      // who triggered it
  read: boolean;
  createdAt: string;
}

export async function createNotification(notif: Notification): Promise<Notification> {
  await client.send(new PutItemCommand({
    TableName: NOTIFICATIONS_TABLE,
    Item: marshall(notif, { removeUndefinedValues: true }),
  }));
  return notif;
}

export async function createNotificationsForUsers(userIds: string[], baseNotif: Omit<Notification, 'userId' | 'id' | 'createdAt' | 'read'>): Promise<void> {
  const now = new Date().toISOString();
  for (const userId of userIds) {
    const notif: Notification = {
      ...baseNotif,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId,
      read: false,
      createdAt: now,
    };
    await client.send(new PutItemCommand({
      TableName: NOTIFICATIONS_TABLE,
      Item: marshall(notif, { removeUndefinedValues: true }),
    }));
  }
}

export async function getNotificationsForUser(userId: string, limit = 50): Promise<Notification[]> {
  const result = await client.send(new QueryCommand({
    TableName: NOTIFICATIONS_TABLE,
    KeyConditionExpression: 'userId = :uid',
    ExpressionAttributeValues: marshall({ ':uid': userId }),
    ScanIndexForward: false, // newest first
    Limit: limit,
  }));
  return result.Items ? result.Items.map(i => unmarshall(i) as Notification) : [];
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const result = await client.send(new QueryCommand({
    TableName: NOTIFICATIONS_TABLE,
    KeyConditionExpression: 'userId = :uid',
    FilterExpression: '#r = :false',
    ExpressionAttributeNames: { '#r': 'read' },
    ExpressionAttributeValues: marshall({ ':uid': userId, ':false': false }),
    Select: 'COUNT',
  }));
  return result.Count || 0;
}

export async function markNotificationRead(userId: string, createdAt: string): Promise<boolean> {
  await client.send(new UpdateItemCommand({
    TableName: NOTIFICATIONS_TABLE,
    Key: marshall({ userId, createdAt }),
    UpdateExpression: 'SET #r = :true',
    ExpressionAttributeNames: { '#r': 'read' },
    ExpressionAttributeValues: marshall({ ':true': true }),
  }));
  return true;
}

export async function markAllNotificationsRead(userId: string): Promise<boolean> {
  const notifs = await getNotificationsForUser(userId, 100);
  const unread = notifs.filter(n => !n.read);
  for (const n of unread) {
    await markNotificationRead(userId, n.createdAt);
  }
  return true;
}
