import { v4 as uuidv4 } from 'uuid';
import * as db from '../db.js';

interface Context {
  userId?: string;
  user?: {
    id: string;
    category: string;
    role: string;
    organizationId: string;
    department?: string;
    specialty?: string;
    assignedProjectIds?: string[];  // TEAM_LEAD: their project(s); ENGINEER: all assigned
    managedTeamIds?: string[];      // MANAGER: their direct report userIds
    managedEmployees?: string[];
  };
}

// ─── RBAC helpers ─────────────────────────────────────────────────────────────

function isElevated(category: string): boolean {
  return ['C_SUITE', 'SVP', 'VP', 'SENIOR_MANAGER'].includes(category);
}

function isManagerOrAbove(category: string): boolean {
  return isElevated(category) || category === 'MANAGER';
}

// ─── Resolvers ────────────────────────────────────────────────────────────────

export const resolvers = {
  Query: {
    /**
     * Project visibility per role:
     *  C_SUITE / SVP / VP / SENIOR_MANAGER  → all projects
     *  MANAGER                              → projects in managedByIds OR where a direct report is a member
     *  TEAM_LEAD                            → only projects in assignedProjectIds
     *  JUNIOR_IC / SENIOR_IC (ENGINEER)     → only projects they are a teamMember on
     */
    getProjects: async (_: any, { status }: { status?: string }, context: Context) => {
      if (!context.userId) throw new Error('Unauthorized');
      const user = context.user!;

      if (isElevated(user.category)) {
        return db.getAllProjects(status);
      }

      if (user.category === 'MANAGER') {
        const managedTeamIds = user.managedTeamIds || user.managedEmployees || [];
        const projects = await db.getProjectsForManager(user.id, managedTeamIds);
        return status ? projects.filter(p => p.status === status) : projects;
      }

      if (user.category === 'TEAM_LEAD') {
        // Only their assigned project(s)
        const assignedIds = user.assignedProjectIds || [];
        if (!assignedIds.length) return [];
        const results = await Promise.all(assignedIds.map(id => db.getProjectById(id)));
        const valid = results.filter(Boolean) as db.Project[];
        return status ? valid.filter(p => p.status === status) : valid;
      }

      // ENGINEER / IC roles: projects where they are a team member
      const all = await db.getAllProjects(status);
      return all.filter(p => p.teamMembers.some(m => m.userId === user.id));
    },

    getProject: async (_: any, { id }: { id: string }, context: Context) => {
      if (!context.userId) throw new Error('Unauthorized');
      const project = await db.getProjectById(id);
      if (!project) return null;

      const user = context.user!;

      if (isElevated(user.category)) return project;

      if (user.category === 'MANAGER') {
        const managedTeamIds = user.managedTeamIds || user.managedEmployees || [];
        const inManaged = project.managedByIds?.includes(user.id);
        const hasReport = project.teamMembers.some(m => managedTeamIds.includes(m.userId));
        if (!inManaged && !hasReport) throw new Error('Access denied');
        return project;
      }

      if (user.category === 'TEAM_LEAD') {
        const assignedIds = user.assignedProjectIds || [];
        if (!assignedIds.includes(id)) throw new Error('Access denied');
        return project;
      }

      // IC: must be a team member
      if (!project.teamMembers.some(m => m.userId === user.id)) throw new Error('Access denied');
      return project;
    },

    /**
     * Task visibility per role:
     *  Elevated / MANAGER → all tasks in project
     *  TEAM_LEAD          → only tasks matching their specialty
     *  ENGINEER           → all tasks in their assigned project
     */
    getProjectTasks: async (
      _: any,
      { projectId, status }: { projectId: string; status?: string },
      context: Context
    ) => {
      if (!context.userId) throw new Error('Unauthorized');

      const project = await db.getProjectById(projectId);
      if (!project) throw new Error('Project not found');

      const user = context.user!;

      // Access gate
      if (!isElevated(user.category)) {
        if (user.category === 'MANAGER') {
          const managedTeamIds = user.managedTeamIds || user.managedEmployees || [];
          const inManaged = project.managedByIds?.includes(user.id);
          const hasReport = project.teamMembers.some(m => managedTeamIds.includes(m.userId));
          if (!inManaged && !hasReport) throw new Error('Access denied');
        } else if (user.category === 'TEAM_LEAD') {
          const assignedIds = user.assignedProjectIds || [];
          if (!assignedIds.includes(projectId)) throw new Error('Access denied');
        } else {
          if (!project.teamMembers.some(m => m.userId === user.id)) throw new Error('Access denied');
        }
      }

      const tasks = await db.getTasksByProject(projectId, status);

      // TEAM_LEAD sees only tasks matching their specialty
      if (user.category === 'TEAM_LEAD' && user.specialty) {
        return tasks.filter(t => !t.specialty || t.specialty === user.specialty);
      }

      return tasks;
    },

    getProjectUpdates: async (_: any, { projectId }: { projectId: string }, context: Context) => {
      if (!context.userId) throw new Error('Unauthorized');
      const project = await db.getProjectById(projectId);
      if (!project) throw new Error('Project not found');

      const user = context.user!;
      const isMember = project.teamMembers.some(m => m.userId === user.id);
      if (!isManagerOrAbove(user.category) && !isMember) throw new Error('Access denied');

      return db.getProjectUpdates(projectId);
    },

    getProjectAnalytics: async (_: any, { projectId }: { projectId: string }, context: Context) => {
      if (!context.userId) throw new Error('Unauthorized');
      const project = await db.getProjectById(projectId);
      if (!project) throw new Error('Project not found');

      const user = context.user!;
      const isLead = project.teamLeaderId === user.id;
      if (!isManagerOrAbove(user.category) && !isLead) throw new Error('Access denied');

      return db.getProjectAnalytics(projectId);
    },

    getSRSDocuments: async (_: any, { projectId }: { projectId: string }, context: Context) => {
      if (!context.userId) throw new Error('Unauthorized');
      const project = await db.getProjectById(projectId);
      if (!project) throw new Error('Project not found');

      const user = context.user!;
      const isMember = project.teamMembers.some(m => m.userId === user.id);
      if (!isManagerOrAbove(user.category) && !isMember) throw new Error('Access denied');

      return db.getSRSDocuments(projectId);
    },

    listProjectDocuments: async (_: any, { projectId, type }: { projectId: string; type?: db.DocumentType }, context: Context) => {
      if (!context.userId) throw new Error('Unauthorized');
      let docs = await db.listProjectDocuments(projectId, type);
      // Filter restricted for non-managers
      if (!isManagerOrAbove(context.user!.category)) {
        docs = docs.filter(d => !d.restricted);
      }
      return docs;
    },

    projectTeamMembers: async (_: any, { projectId }: { projectId: string }, context: Context) => {
      if (!context.userId) throw new Error('Unauthorized');
      const project = await db.getProjectById(projectId);
      if (!project) throw new Error('Project not found');

      const user = context.user!;

      // TEAM_LEAD sees only members matching their specialty
      if (user.category === 'TEAM_LEAD' && user.specialty) {
        const assignedIds = user.assignedProjectIds || [];
        if (!assignedIds.includes(projectId)) throw new Error('Access denied');
        return project.teamMembers.filter(m => m.specialty === user.specialty);
      }

      return project.teamMembers;
    },

    availableEmployeesForProject: async (
      _: any,
      { projectId }: { projectId: string },
      context: Context
    ) => {
      if (!context.userId) throw new Error('Unauthorized');
      if (!isManagerOrAbove(context.user!.category)) {
        throw new Error('Only managers and above can view available employees');
      }
      return [];
    },

    // ── Org-Wide Analytics (Executive only) ────────────────────────────────
    getOrgAnalytics: async (_: any, __: any, context: Context) => {
      if (!context.userId) throw new Error('Unauthorized');
      if (!isElevated(context.user!.category)) throw new Error('Executive access required');
      return db.getOrgAnalytics();
    },

    getOrgRiskAlerts: async (_: any, __: any, context: Context) => {
      if (!context.userId) throw new Error('Unauthorized');
      if (!isElevated(context.user!.category)) throw new Error('Executive access required');
      return db.getOrgRiskAlerts();
    },

    getBudgetOverview: async (_: any, __: any, context: Context) => {
      if (!context.userId) throw new Error('Unauthorized');
      if (!isElevated(context.user!.category)) throw new Error('Executive access required');
      return db.getBudgetOverview();
    },

    getMyTasks: async (_: any, __: any, context: Context) => {
      if (!context.userId) throw new Error('Unauthorized');
      return db.getMyTasks(context.userId);
    },

    getActivityFeed: async (_: any, { limit }: { limit?: number }, context: Context) => {
      if (!context.userId) throw new Error('Unauthorized');
      return db.getActivityFeed(limit || 30);
    },

    getUpcomingDeadlines: async (_: any, __: any, context: Context) => {
      if (!context.userId) throw new Error('Unauthorized');
      return db.getUpcomingDeadlines();
    },

    getPendingAllocations: async (_: any, __: any, context: Context) => {
      if (!context.userId) throw new Error('Unauthorized');
      if (!isManagerOrAbove(context.user!.category)) throw new Error('Manager access required');
      return db.getPendingAllocations();
    },

    getProjectAllocations: async (_: any, { projectId }: { projectId: string }, context: Context) => {
      if (!context.userId) throw new Error('Unauthorized');
      return db.getProjectAllocations(projectId);
    },

    // ── Notifications ─────────────────────────────────────────────────────
    getMyNotifications: async (_: any, { limit }: { limit?: number }, context: Context) => {
      if (!context.userId) throw new Error('Unauthorized');
      return db.getNotificationsForUser(context.userId, limit || 50);
    },

    getUnreadNotificationCount: async (_: any, __: any, context: Context) => {
      if (!context.userId) throw new Error('Unauthorized');
      return db.getUnreadNotificationCount(context.userId);
    },
  },

  Mutation: {
    /**
     * createProject: C_SUITE, VP, SVP, SENIOR_MANAGER, MANAGER only.
     * TEAM_LEAD and ENGINEER cannot create projects.
     */
    createProject: async (
      _: any,
      {
        name,
        description,
        category,
        startDate,
        targetEndDate,
        releaseDate,
        estimatedDays,
        maxTeamSize,
        projectLeadId,
        viceTeamLeaderId,
        budgetUSD,
        specialtiesNeeded,
      }: {
        name: string;
        description: string;
        category: string;
        startDate: string;
        targetEndDate: string;
        releaseDate?: string;
        estimatedDays?: number;
        maxTeamSize: number;
        projectLeadId: string;
        viceTeamLeaderId?: string;
        budgetUSD?: number;
        specialtiesNeeded?: string[];
      },
      context: Context
    ) => {
      if (!context.userId) throw new Error('Unauthorized');
      if (!isManagerOrAbove(context.user!.category)) {
        throw new Error('Only managers and above can create projects');
      }

      const id = uuidv4();
      const project: db.Project = {
        id,
        name,
        description,
        category: category as any,
        status: 'PLANNING',
        completionPercentage: 0,
        startDate,
        targetEndDate,
        releaseDate,
        estimatedDays,
        budgetUSD,
        maxTeamSize,
        currentTeamSize: 0,
        specialtiesNeeded,
        teamLeaderId: projectLeadId || context.userId,
        projectLeadId: projectLeadId || context.userId,
        viceTeamLeaderId,
        managedByIds: [context.userId],
        teamMembers: [],
        createdBy: context.userId,
        createdAt: new Date().toISOString(),
      };

      return db.createProject(project);
    },

    /**
     * addMemberToProject: C_SUITE and MANAGER only.
     * TEAM_LEAD cannot add members.
     */
    addMemberToProject: async (
      _: any,
      {
        projectId,
        userId,
        projectRole,
        specialty,
        allocation,
        startDate,
      }: {
        projectId: string;
        userId: string;
        projectRole: string;
        specialty: string;
        allocation: number;
        startDate: string;
      },
      context: Context
    ) => {
      if (!context.userId) throw new Error('Unauthorized');

      const user = context.user!;
      if (!isManagerOrAbove(user.category)) {
        throw new Error('Only managers and above can add members to projects');
      }

      const project = await db.getProjectById(projectId);
      if (!project) throw new Error('Project not found');

      if (project.currentTeamSize >= project.maxTeamSize) {
        throw new Error('Project has reached maximum team size');
      }

      const member: db.ProjectMember = {
        userId,
        projectRole: projectRole as any,
        specialty: specialty as any,
        contribution: 0,
        allocation,
        startDate,
        joinedAt: new Date().toISOString(),
        status: 'ACTIVE',
      };

      await db.addTeamMemberToProject(projectId, member);
      return member;
    },

    removeTeamMemberFromProject: async (
      _: any,
      { projectId, userId }: { projectId: string; userId: string },
      context: Context
    ) => {
      if (!context.userId) throw new Error('Unauthorized');
      if (!isManagerOrAbove(context.user!.category)) {
        throw new Error('Only managers and above can remove members');
      }

      const project = await db.getProjectById(projectId);
      if (!project) throw new Error('Project not found');

      await db.removeTeamMemberFromProject(projectId, userId);
      return true;
    },

    // ── Allocation Requests (Team Lead → Manager approval flow) ───────────
    createAllocationRequest: async (
      _: any,
      { projectId, requestedUserId, specialty, allocation, projectRole, reason }: {
        projectId: string; requestedUserId: string; specialty: string; allocation: number; projectRole: string; reason?: string;
      },
      context: Context
    ) => {
      if (!context.userId) throw new Error('Unauthorized');
      const user = context.user!;

      // Must be at least a Team Lead on this project or a Manager
      const project = await db.getProjectById(projectId);
      if (!project) throw new Error('Project not found');

      const isLead = project.teamLeaderId === user.id || project.viceTeamLeaderId === user.id;
      if (!isLead && !isManagerOrAbove(user.category)) {
        throw new Error('Only project leads and managers can request allocations');
      }

      const req: db.AllocationRequest = {
        id: uuidv4(),
        projectId,
        projectName: project.name,
        requestedBy: user.id,
        requestedByName: (user as any).fullName || 'Unknown',
        requestedUserId,
        requestedUserName: '', // Will be filled by frontend context
        specialty,
        allocation,
        projectRole,
        reason,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      };

      return db.createAllocationRequest(req);
    },

    approveAllocation: async (_: any, { requestId }: { requestId: string }, context: Context) => {
      if (!context.userId) throw new Error('Unauthorized');
      if (!isManagerOrAbove(context.user!.category)) {
        throw new Error('Only managers can approve allocations');
      }

      const req = await db.getAllocationRequestById(requestId);
      if (!req) throw new Error('Allocation request not found');
      if (req.status !== 'PENDING') throw new Error('Request already resolved');

      // Auto-add the member to the project
      const project = await db.getProjectById(req.projectId);
      if (!project) throw new Error('Project not found');

      const member: db.ProjectMember = {
        userId: req.requestedUserId,
        name: req.requestedUserName,
        projectRole: req.projectRole as any,
        specialty: req.specialty as any,
        contribution: 0,
        allocation: req.allocation,
        startDate: new Date().toISOString(),
        joinedAt: new Date().toISOString(),
        status: 'ACTIVE',
      };

      await db.addTeamMemberToProject(req.projectId, member);

      return db.updateAllocationRequest(requestId, {
        status: 'APPROVED',
        approvedBy: context.userId,
        approvedByName: (context.user as any).fullName || 'Manager',
        resolvedAt: new Date().toISOString(),
      });
    },

    rejectAllocation: async (_: any, { requestId, reason }: { requestId: string; reason: string }, context: Context) => {
      if (!context.userId) throw new Error('Unauthorized');
      if (!isManagerOrAbove(context.user!.category)) {
        throw new Error('Only managers can reject allocations');
      }

      const req = await db.getAllocationRequestById(requestId);
      if (!req) throw new Error('Allocation request not found');
      if (req.status !== 'PENDING') throw new Error('Request already resolved');

      return db.updateAllocationRequest(requestId, {
        status: 'REJECTED',
        approvedBy: context.userId,
        approvedByName: (context.user as any).fullName || 'Manager',
        rejectionReason: reason,
        resolvedAt: new Date().toISOString(),
      });
    },

    updateProjectDetails: async (
      _: any,
      {
        projectId,
        name,
        description,
        status,
        targetEndDate,
        budgetUSD,
      }: {
        projectId: string;
        name?: string;
        description?: string;
        status?: string;
        targetEndDate?: string;
        budgetUSD?: number;
      },
      context: Context
    ) => {
      if (!context.userId) throw new Error('Unauthorized');
      const project = await db.getProjectById(projectId);
      if (!project) throw new Error('Project not found');

      const user = context.user!;
      const isLead = project.teamLeaderId === user.id;
      if (!isManagerOrAbove(user.category) && !isLead) throw new Error('Access denied');

      const updates: Partial<db.Project> = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (status !== undefined) updates.status = status as any;
      if (targetEndDate !== undefined) updates.targetEndDate = targetEndDate;
      if (budgetUSD !== undefined) updates.budgetUSD = budgetUSD;

      return db.updateProjectDetails(projectId, updates);
    },

    updateProjectProgress: async (
      _: any,
      { projectId, completionPercentage, status }: { projectId: string; completionPercentage: number; status: string },
      context: Context
    ) => {
      if (!context.userId) throw new Error('Unauthorized');
      const project = await db.getProjectById(projectId);
      if (!project) throw new Error('Project not found');

      const user = context.user!;
      const isLead = project.teamLeaderId === user.id;
      if (!isManagerOrAbove(user.category) && !isLead) {
        throw new Error('Only team leads and managers can update project progress');
      }

      return db.updateProjectDetails(projectId, { completionPercentage, status: status as any });
    },

    addProjectUpdate: async (
      _: any,
      { projectId, type, title, description, severity }: {
        projectId: string; type: string; title: string; description?: string; severity: string;
      },
      context: Context
    ) => {
      if (!context.userId) throw new Error('Unauthorized');
      const project = await db.getProjectById(projectId);
      if (!project) throw new Error('Project not found');

      const user = context.user!;
      const isMember = project.teamMembers.some(m => m.userId === user.id);
      if (!isMember) throw new Error('Only team members can add project updates');

      const update: db.ProjectUpdate = {
        id: uuidv4(),
        projectId,
        type,
        title,
        description,
        severity: severity as any,
        createdBy: context.userId,
        createdAt: new Date().toISOString(),
      };

      const created = await db.createProjectUpdate(update);

      // Notify all other team members about this update
      const recipientIds = project.teamMembers
        .map((m: any) => m.userId)
        .filter((uid: string) => uid !== context.userId);
      if (recipientIds.length > 0) {
        await db.createNotificationsForUsers(recipientIds, {
          type: 'PROJECT_UPDATE',
          title: `Update: ${title}`,
          message: description || `New update in ${project.name}`,
          projectId,
          projectName: project.name,
          actorName: context.userId,
        });
      }

      return created;
    },

    createTask: async (
      _: any,
      { projectId, title, priority, specialty, assignedToId, dependsOn }: {
        projectId: string; title: string; priority: string; specialty?: string; assignedToId?: string; dependsOn?: string[];
      },
      context: Context
    ) => {
      if (!context.userId) throw new Error('Unauthorized');
      const project = await db.getProjectById(projectId);
      if (!project) throw new Error('Project not found');

      const user = context.user!;

      // TEAM_LEAD can create tasks only within their assigned project + specialty
      if (user.category === 'TEAM_LEAD') {
        const assignedIds = user.assignedProjectIds || [];
        if (!assignedIds.includes(projectId)) throw new Error('Access denied');
        // They can only create tasks for their specialty
        if (specialty && user.specialty && specialty !== user.specialty) {
          throw new Error('Team leads can only create tasks for their specialty');
        }
      } else if (!isManagerOrAbove(user.category)) {
        throw new Error('Access denied');
      }

      const task: db.Task = {
        id: uuidv4(),
        projectId,
        title,
        status: 'TODO',
        priority: priority as any,
        specialty: specialty as any,
        assignedTo: assignedToId,
        dependsOn: dependsOn && dependsOn.length > 0 ? dependsOn : undefined,
        createdAt: new Date().toISOString(),
      };

      const created = await db.createTask(task);

      // Notify the assigned user
      if (assignedToId && assignedToId !== context.userId) {
        await db.createNotification({
          id: uuidv4(),
          userId: assignedToId,
          type: 'TASK_ASSIGNED',
          title: `New task assigned: ${title}`,
          message: `You've been assigned "${title}" in project ${project.name}`,
          projectId,
          projectName: project.name,
          taskId: task.id,
          actorName: user.id,
          read: false,
          createdAt: new Date().toISOString(),
        });
      }

      return created;
    },

    updateTaskStatus: async (
      _: any,
      { taskId, status, blockerReason, completionNote }: { taskId: string; status: string; blockerReason?: string; completionNote?: string },
      context: Context
    ) => {
      if (!context.userId) throw new Error('Unauthorized');
      const task = await db.getTaskById(taskId);
      if (!task) throw new Error('Task not found');

      const user = context.user!;

      // Assigned user, team lead of the project, or manager can update
      const isAssigned = task.assignedTo === user.id;
      if (!isAssigned && !isManagerOrAbove(user.category) && user.category !== 'TEAM_LEAD') {
        throw new Error('Only the assigned user or team lead can update task status');
      }

      // Dependency check: can't start or complete if dependencies aren't done
      if ((status === 'IN_PROGRESS' || status === 'COMPLETED') && task.dependsOn && task.dependsOn.length > 0) {
        const depTasks = await Promise.all(task.dependsOn.map((depId: string) => db.getTaskById(depId)));
        const incomplete = depTasks.filter(t => t && t.status !== 'COMPLETED');
        if (incomplete.length > 0) {
          const names = incomplete.map(t => `"${t!.title}"`).join(', ');
          throw new Error(`Cannot ${status === 'IN_PROGRESS' ? 'start' : 'complete'} this task. Depends on unfinished: ${names}`);
        }
      }

      const updatedTask = await db.updateTaskStatus(taskId, status as any, blockerReason);

      // On COMPLETED: auto-recalculate project progress + create update
      if (status === 'COMPLETED' && updatedTask) {
        const allTasks = await db.getTasksByProject(task.projectId);
        const total = allTasks.length;
        const completed = allTasks.filter(t => t.status === 'COMPLETED').length;
        const newPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;

        await db.updateProjectDetails(task.projectId, { completionPercentage: newPercentage });

        // Auto-create project update
        await db.createProjectUpdate({
          id: uuidv4(),
          projectId: task.projectId,
          type: 'TASK_COMPLETED',
          title: `Task completed: ${task.title}`,
          description: completionNote || undefined,
          severity: 'INFO',
          createdBy: context.userId,
          createdAt: new Date().toISOString(),
        });

        // Notify project team members about task completion
        const project = await db.getProjectById(task.projectId);
        if (project && project.teamMembers) {
          const recipientIds = project.teamMembers
            .map((m: any) => m.userId)
            .filter((uid: string) => uid !== context.userId);
          if (recipientIds.length > 0) {
            await db.createNotificationsForUsers(recipientIds, {
              type: 'TASK_COMPLETED',
              title: `Task completed: ${task.title}`,
              message: completionNote || `"${task.title}" has been marked as done`,
              projectId: task.projectId,
              projectName: project.name,
              taskId: task.id,
              actorName: context.userId,
            });
          }
        }
      }

      // On status change away from COMPLETED: recalculate too
      if (status !== 'COMPLETED' && task.status === 'COMPLETED' && updatedTask) {
        const allTasks = await db.getTasksByProject(task.projectId);
        const total = allTasks.length;
        const completed = allTasks.filter(t => t.status === 'COMPLETED').length;
        const newPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;
        await db.updateProjectDetails(task.projectId, { completionPercentage: newPercentage });
      }

      return updatedTask;
    },

    uploadSRSDocument: async (
      _: any,
      { projectId, url, version }: { projectId: string; url: string; version: number },
      context: Context
    ) => {
      if (!context.userId) throw new Error('Unauthorized');
      const project = await db.getProjectById(projectId);
      if (!project) throw new Error('Project not found');

      const user = context.user!;
      const isLead = project.teamLeaderId === user.id;
      if (!isManagerOrAbove(user.category) && !isLead) {
        throw new Error('Only team leads and managers can upload SRS documents');
      }

      const doc: db.SRSDocument = {
        id: uuidv4(),
        projectId,
        version,
        url,
        status: 'ACTIVE',
        uploadedBy: context.userId,
        createdAt: new Date().toISOString(),
      };

      await db.updateProjectDetails(projectId, { srsDocumentUrl: url, srsDocumentVersion: version });
      return db.createSRSDocument(doc);
    },

    confirmProjectDoc: async (
      _: any,
      { projectId, docId, fileKey, title, description, type, tags, fileName, mimeType, fileSize, version }: any,
      context: Context
    ) => {
      if (!context.userId) throw new Error('Unauthorized');
      const RESTRICTED = ['API_KEYS', 'CREDENTIALS'];
      if (RESTRICTED.includes(type) && !isManagerOrAbove(context.user!.category)) throw new Error('Access denied');

      const now = new Date().toISOString();
      const doc: db.ProjectDocument = {
        projectId, docId, createdAt: now, title, description, type,
        tags: tags || [], fileKey, fileName, mimeType,
        fileSize: fileSize || 0, version: version || 1,
        uploadedBy: context.userId, updatedAt: now,
        restricted: RESTRICTED.includes(type),
      };
      return db.createProjectDocument(doc);
    },

    deleteProjectDoc: async (
      _: any,
      { projectId, docId }: { projectId: string; docId: string },
      context: Context
    ) => {
      if (!context.userId) throw new Error('Unauthorized');
      const doc = await db.getProjectDocument(projectId, docId);
      if (!doc) throw new Error('Not found');
      if (doc.uploadedBy !== context.userId && !isManagerOrAbove(context.user!.category)) throw new Error('Access denied');
      return db.deleteProjectDocument(projectId, docId);
    },

    // Called by client after uploading file to S3 via presigned URL
    addTaskAttachment: async (
      _: any,
      { taskId, fileKey, fileName, mimeType, fileSize }: {
        taskId: string; fileKey: string; fileName: string; mimeType: string; fileSize: number;
      },
      context: Context
    ) => {
      if (!context.userId) throw new Error('Unauthorized');
      const task = await db.getTaskById(taskId);
      if (!task) throw new Error('Task not found');

      const attachment: db.TaskAttachment = {
        fileKey,
        fileName,
        mimeType,
        fileSize,
        uploadedBy: context.userId,
        uploadedAt: new Date().toISOString(),
      };

      return db.addAttachmentToTask(taskId, attachment);
    },

    removeTaskAttachment: async (
      _: any,
      { taskId, fileKey }: { taskId: string; fileKey: string },
      context: Context
    ) => {
      if (!context.userId) throw new Error('Unauthorized');
      const task = await db.getTaskById(taskId);
      if (!task) throw new Error('Task not found');

      // Only the uploader, task assignee, or manager can remove
      const user = context.user!;
      const attachment = task.attachments?.find(a => a.fileKey === fileKey);
      if (!attachment) throw new Error('Attachment not found');
      if (attachment.uploadedBy !== user.id && task.assignedTo !== user.id && !isManagerOrAbove(user.category)) {
        throw new Error('Access denied');
      }

      return db.removeAttachmentFromTask(taskId, fileKey);
    },

    // ── Notification Mutations ────────────────────────────────────────────
    markNotificationRead: async (_: any, { notificationId, createdAt }: { notificationId: string; createdAt: string }, context: Context) => {
      if (!context.userId) throw new Error('Unauthorized');
      return db.markNotificationRead(context.userId, createdAt);
    },

    markAllNotificationsRead: async (_: any, __: any, context: Context) => {
      if (!context.userId) throw new Error('Unauthorized');
      return db.markAllNotificationsRead(context.userId);
    },
  },

  Project: {
    teamLeader: async (project: db.Project) => ({ id: project.teamLeaderId }),
    viceTeamLeader: async (project: db.Project) => {
      if (!project.viceTeamLeaderId) return null;
      return { id: project.viceTeamLeaderId };
    },
    createdBy: async (project: db.Project) => ({ id: project.createdBy }),
  },

  ProjectMember: {
    user: async (member: db.ProjectMember) => ({ id: member.userId }),
    userId: (member: db.ProjectMember) => member.userId,
  },

  ProjectTask: {
    assignedTo: async (task: db.Task) => {
      if (!task.assignedTo) return null;
      return { id: task.assignedTo };
    },
  },

  ProjectUpdate: {
    createdBy: async (update: db.ProjectUpdate) => ({ id: update.createdBy }),
  },

  SRSDocument: {
    uploadedBy: async (doc: db.SRSDocument) => ({ id: doc.uploadedBy }),
  },

  TeamContribution: {
    user: async (contribution: db.TeamContribution) => ({ id: contribution.userId }),
  },
};
