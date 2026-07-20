import React, { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { usePermissions } from '../components/RBACContext';
import { ProjectListManager } from './ProjectListManager';
import { CreateProjectWizard } from './CreateProjectWizard';
import { InviteTeamMemberModal } from './InviteTeamMemberModal';
import { ProjectTaskBoard } from './ProjectTaskBoard';
import { ProjectChat } from './ProjectChat';
import { ProjectDocuments } from './ProjectDocuments';
import { ProjectStatus, ProjectCategory, ProjectRole, MemberSpecialty, TaskStatus, TaskPriority, UpdateType, Severity } from '@project-tracker/shared-types';

const GET_PROJECTS = gql`
  query GetProjects($status: ProjectStatus) {
    getProjects(status: $status) {
      id
      name
      description
      category
      status
      completionPercentage
      startDate
      targetEndDate
      estimatedDays
      budgetUSD
      maxTeamSize
      currentTeamSize
      createdAt
    }
  }
`;

const GET_PROJECT_DETAILS = gql`
  query GetProjectDetails($id: ID!) {
    getProject(id: $id) {
      id
      name
      description
      category
      status
      completionPercentage
      startDate
      targetEndDate
      srsDocumentUrl
      srsDocumentVersion
      teamLeader { id }
      viceTeamLeader { id }
      teamMembers {
        userId
        projectRole
        specialty
        contribution
        allocation
        joinedAt
        status
      }
      createdAt
    }
  }
`;

const GET_PROJECT_TASKS = gql`
  query GetProjectTasks($projectId: ID!) {
    getProjectTasks(projectId: $projectId) {
        id
        title
        status
        priority
        specialty
        assignedTo { id fullName }
        blockerReason
        component
        dependsOn
        dueDate
    }
  }
`;

const GET_PROJECT_UPDATES = gql`
  query GetProjectUpdates($projectId: ID!) {
    getProjectUpdates(projectId: $projectId) {
        id
        type
        title
        description
        severity
        createdAt
    }
  }
`;

const GET_ALL_USERS = gql`
  query GetAllUsers {
    getAllUsers { id fullName email role }
  }
`;

const GET_LATEST_UPDATES = gql`
  query GetActivityFeed { getActivityFeed(limit: 20) { id type title projectName projectId createdAt } }
`;

const CREATE_PROJECT = gql`
  mutation CreateProject($name: String!, $description: String!, $category: ProjectCategory!, $startDate: DateTime!, $targetEndDate: DateTime!, $releaseDate: DateTime, $estimatedDays: Int, $maxTeamSize: Int!, $projectLeadId: ID, $viceTeamLeaderId: ID, $budgetUSD: Float, $specialtiesNeeded: [MemberSpecialty!]) {
    createProject(name: $name, description: $description, category: $category, startDate: $startDate, targetEndDate: $targetEndDate, releaseDate: $releaseDate, estimatedDays: $estimatedDays, maxTeamSize: $maxTeamSize, projectLeadId: $projectLeadId, viceTeamLeaderId: $viceTeamLeaderId, budgetUSD: $budgetUSD, specialtiesNeeded: $specialtiesNeeded) {
      id name status
    }
  }
`;

const ADD_MEMBER = gql`
  mutation AddMember($projectId: ID!, $userId: ID!, $projectRole: ProjectRole!, $specialty: MemberSpecialty!, $allocation: Int!, $startDate: DateTime!) {
    addMemberToProject(projectId: $projectId, userId: $userId, projectRole: $projectRole, specialty: $specialty, allocation: $allocation, startDate: $startDate) {
        userId name projectRole specialty allocation startDate status
    }
  }
`;

const REMOVE_MEMBER = gql`
  mutation RemoveMember($projectId: ID!, $userId: ID!) {
    removeTeamMemberFromProject(projectId: $projectId, userId: $userId)
  }
`;

const UPDATE_PROJECT_PROGRESS = gql`
  mutation UpdateProjectProgress($projectId: ID!, $completionPercentage: Float!, $status: ProjectStatus) {
    updateProjectProgress(projectId: $projectId, completionPercentage: $completionPercentage, status: $status) {
      id
      completionPercentage
      status
    }
  }
`;

const ADD_PROJECT_UPDATE = gql`
  mutation AddProjectUpdate($projectId: ID!, $type: UpdateType!, $title: String!, $description: String, $severity: Severity!) {
    addProjectUpdate(projectId: $projectId, type: $type, title: $title, description: $description, severity: $severity) {
      id
      title
    }
  }
`;

const UPDATE_TASK_STATUS = gql`
    mutation UpdateTaskStatus($taskId: ID!, $status: TaskStatus!, $blockerReason: String, $completionNote: String) {
        updateTaskStatus(taskId: $taskId, status: $status, blockerReason: $blockerReason, completionNote: $completionNote) { id status }
    }
`;

const CREATE_TASK = gql`
    mutation CreateTask($projectId: ID!, $title: String!, $priority: TaskPriority!, $specialty: MemberSpecialty, $assignedToId: ID, $dependsOn: [ID!]) {
        createTask(projectId: $projectId, title: $title, priority: $priority, specialty: $specialty, assignedToId: $assignedToId, dependsOn: $dependsOn) { id title }
    }
`;

const CREATE_ALLOCATION_REQUEST = gql`
    mutation CreateAllocationRequest($projectId: ID!, $requestedUserId: ID!, $specialty: MemberSpecialty!, $allocation: Int!, $projectRole: ProjectRole!, $reason: String) {
        createAllocationRequest(projectId: $projectId, requestedUserId: $requestedUserId, specialty: $specialty, allocation: $allocation, projectRole: $projectRole, reason: $reason) { id status }
    }
`;

interface Props {
  user: any;
  token: string;
}

export function ProjectListView({ user, token }: Props) {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'TASKS' | 'UPDATES' | 'CHAT' | 'DOCS'>('OVERVIEW');
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', priority: 'MEDIUM' as string, specialty: '' as string, assignedToId: '' as string, dependsOn: [] as string[] });
  // Modal states for replacing window.prompt/confirm
  const [removeMemberTarget, setRemoveMemberTarget] = useState<string | null>(null);
  const [updateForm, setUpdateForm] = useState({ title: '', description: '' });

  const context = { headers: { Authorization: `Bearer ${token}` } };
  
  const { data, loading, error, refetch } = useQuery(GET_PROJECTS, { context });
  const { data: usersData } = useQuery(GET_ALL_USERS, { context });
  const { data: updatesListData } = useQuery(GET_LATEST_UPDATES, { context, pollInterval: 60000 });

  const { data: detailsData, refetch: refetchDetails } = useQuery(GET_PROJECT_DETAILS, {
      variables: { id: selectedProjectId },
      skip: !selectedProjectId,
      context
  });

  const { data: tasksData, refetch: refetchTasks } = useQuery(GET_PROJECT_TASKS, {
      variables: { projectId: selectedProjectId },
      skip: !selectedProjectId || activeTab !== 'TASKS',
      context,
      pollInterval: 30000 
  });

  const { data: updatesData, refetch: refetchUpdates } = useQuery(GET_PROJECT_UPDATES, {
      variables: { projectId: selectedProjectId },
      skip: !selectedProjectId || activeTab !== 'UPDATES',
      context
  });

  const [createProject] = useMutation(CREATE_PROJECT, { context, onCompleted: () => { setIsWizardOpen(false); refetch(); } });
  const [inviteMember] = useMutation(ADD_MEMBER, { context, onCompleted: () => { refetch(); refetchDetails(); } });
  const [removeMember] = useMutation(REMOVE_MEMBER, { context, onCompleted: () => { refetch(); refetchDetails(); } });
  const [updateProgress] = useMutation(UPDATE_PROJECT_PROGRESS, { context, onCompleted: () => { refetch(); refetchDetails(); } });
  const [addUpdate] = useMutation(ADD_PROJECT_UPDATE, { context, onCompleted: () => refetchUpdates() });
  const [updateTaskStatus] = useMutation(UPDATE_TASK_STATUS, { context, onCompleted: () => refetchTasks() });
  const [createTask] = useMutation(CREATE_TASK, { context, onCompleted: () => refetchTasks() });
  const [createAllocationRequest] = useMutation(CREATE_ALLOCATION_REQUEST, { context });

  if (error) return <div style={{ padding: '40px', color: '#ef4444' }}>Network Error: {error.message}</div>;

  const currentProject = detailsData?.getProject;
  // Access control: who can manage THIS specific project
  const isExecutive = ['C_SUITE', 'SVP'].includes(user.category); // Executives oversee all projects
  const isProjectLeader = currentProject?.teamLeader?.id === user.id || currentProject?.viceTeamLeader?.id === user.id;
  const isProjectMember = (currentProject?.teamMembers || []).some((m: any) => m.userId === user.id);
  const isManager = isExecutive || isProjectLeader; // Only executives + actual project leaders get full control
  const isLeader = isExecutive || isProjectLeader; // Can change status, manage members, create tasks

  const handleRemoveMember = (userId: string) => {
    setRemoveMemberTarget(userId);
  };
  const confirmRemoveMember = () => {
    if (removeMemberTarget) {
      removeMember({ variables: { projectId: selectedProjectId, userId: removeMemberTarget } });
      setRemoveMemberTarget(null);
    }
  };

  const handleAddUpdate = () => {
    setIsUpdateModalOpen(true);
    setUpdateForm({ title: '', description: '' });
  };
  const confirmAddUpdate = () => {
    if (!updateForm.title.trim()) return;
    addUpdate({ variables: { 
      projectId: selectedProjectId, 
      type: UpdateType.STATUS_CHANGE, 
      title: updateForm.title, 
      description: updateForm.description, 
      severity: Severity.INFO 
    } });
    setIsUpdateModalOpen(false);
    setUpdateForm({ title: '', description: '' });
  };

  return (
    <div style={{ position: 'relative', minHeight: '80vh' }}>
      
      {!selectedProjectId ? (
        <div className="animate-fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: '800', color: 'var(--text-main)' }}>Projects</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '6px' }}>{(data?.getProjects || []).filter((p: any) => p.status !== 'COMPLETED' && p.status !== 'CANCELLED').length} active projects</p>
            </div>
            {['C_SUITE', 'SVP', 'VP', 'SENIOR_MANAGER', 'MANAGER'].includes(user.category) && (
              <button onClick={() => setIsWizardOpen(true)} className="btn-primary">+ New Project</button>
            )}
          </div>
          <ProjectListManager projects={data?.getProjects || []} updates={updatesListData?.getActivityFeed || []} onProjectClick={(p) => { setSelectedProjectId(p.id); setActiveTab('OVERVIEW'); }} loading={loading} />
        </div>
      ) : (
        currentProject && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Project Header */}
              <div style={{ marginBottom: '2rem' }}>
                  <button onClick={() => setSelectedProjectId(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginBottom: '1rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', padding: 0, fontSize: '0.85rem' }}>
                      ← Back to Projects
                  </button>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#6366f1', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>{currentProject.category}</div>
                        <h2 style={{ fontSize: '1.8rem', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>{currentProject.name}</h2>
                    </div>
                    <div style={{ display: 'flex', gap: 4, background: 'var(--bg-surface)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                        {(['OVERVIEW', 'TASKS', 'UPDATES', 'DOCS', 'CHAT'] as const).map(tab => (
                            <button 
                                key={tab} 
                                onClick={() => setActiveTab(tab)} 
                                style={{ 
                                    padding: '8px 14px', 
                                    borderRadius: '7px', 
                                    border: 'none', 
                                    backgroundColor: activeTab === tab ? '#6366f1' : 'transparent', 
                                    color: activeTab === tab ? 'white' : '#64748b', 
                                    fontWeight: '700', 
                                    cursor: 'pointer', 
                                    fontSize: '0.78rem',
                                    transition: 'all 0.15s'
                                }}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                  </div>
              </div>

              {/* Operational Workspace */}
              <div style={{ flex: 1 }}>
                  {activeTab === 'OVERVIEW' && (
                      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                          {/* Progress driven by tasks */}
                          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                              <div>
                                <div style={{ fontSize: '0.65rem', fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>Progress (auto-calculated from tasks)</div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 600, color: (currentProject.status === 'COMPLETED' || currentProject.completionPercentage === 100) ? '#10b981' : 'var(--text-primary)' }}>{currentProject.status === 'COMPLETED' ? 100 : currentProject.completionPercentage}%</div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.65rem', fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>Status</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)' }}>{currentProject.status.replace('_', ' ')}</span>
                                  {isLeader && (
                                    <select value={currentProject.status} onChange={(e) => {
                                      const newStatus = e.target.value;
                                      const oldStatus = currentProject.status;
                                      if (newStatus === oldStatus) return;
                                      
                                      const statusLabels: Record<string, string> = {
                                        PLANNING: 'Planning', IN_PROGRESS: 'In Progress', ACTIVE: 'Active',
                                        ON_HOLD: 'On Hold', COMPLETED: 'Completed', CANCELLED: 'Cancelled',
                                      };
                                      
                                      const confirmed = window.confirm(
                                        `Change project status from "${statusLabels[oldStatus] || oldStatus}" to "${statusLabels[newStatus] || newStatus}"?\n\n` +
                                        (newStatus === 'COMPLETED' ? 'This will mark the project as finished. C-Suite will be notified for approval.\n\n' : '') +
                                        (newStatus === 'CANCELLED' ? 'WARNING: This will cancel the project. This action requires executive approval.\n\n' : '') +
                                        'This change will be logged in the audit trail and stakeholders will be notified.'
                                      );
                                      
                                      if (!confirmed) {
                                        e.target.value = oldStatus;
                                        return;
                                      }
                                      
                                      updateProgress({ variables: { projectId: selectedProjectId, completionPercentage: newStatus === 'COMPLETED' ? 100 : currentProject.completionPercentage, status: newStatus } });
                                    }} style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.72rem', padding: '4px 8px' }}>
                                      {Object.values(ProjectStatus).map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                                    </select>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ width: `${currentProject.status === 'COMPLETED' ? 100 : currentProject.completionPercentage}%`, height: '100%', background: (currentProject.status === 'COMPLETED' || currentProject.completionPercentage === 100) ? '#10b981' : '#5a5af0', borderRadius: 3, transition: 'width 0.5s' }} />
                            </div>
                          </div>

                          {/* Description */}
                          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
                            <div style={{ fontSize: '0.65rem', fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 8 }}>Description</div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6, margin: 0 }}>{currentProject.description || 'No description.'}</p>
                          </div>
                          
                          {/* Team */}
                          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                                <div style={{ fontSize: '0.65rem', fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Team ({(currentProject.teamMembers || []).length})</div>
                                {isLeader && <button onClick={() => setIsInviteModalOpen(true)} style={{ padding: '5px 12px', background: 'var(--accent-dim)', border: '1px solid rgba(90,90,240,0.2)', borderRadius: 6, color: 'var(--accent)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 500 }}>{isManager ? '+ Add' : '+ Request'}</button>}
                              </div>
                              {(currentProject.teamMembers || []).length === 0 ? (
                                <div style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>No team members yet.</div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  {(currentProject.teamMembers || []).map((m: any) => (
                                    <div key={m.userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-raised)', borderRadius: 8 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{(m.userId || '?').charAt(0).toUpperCase()}</div>
                                        <div>
                                          <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-primary)' }}>{m.projectRole}</div>
                                          <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>{m.specialty}</div>
                                        </div>
                                      </div>
                                      {isLeader && m.userId !== user.id && (
                                        <button onClick={() => handleRemoveMember(m.userId)} style={{ background: 'none', border: 'none', color: '#e05252', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 500 }}>Remove</button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                          </div>
                      </div>
                  )}

                  {activeTab === 'TASKS' && (
                      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                          {/* Task summary */}
                          {(tasksData?.getProjectTasks || []).length > 0 && (() => {
                            const t = tasksData?.getProjectTasks || [];
                            const done = t.filter((x: any) => x.status === 'COMPLETED').length;
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{done}/{t.length} tasks completed</span>
                                <div style={{ flex: 1, height: 4, background: 'var(--bg-elevated)', borderRadius: 2, overflow: 'hidden' }}>
                                  <div style={{ width: `${t.length > 0 ? (done / t.length) * 100 : 0}%`, height: '100%', background: done === t.length ? '#10b981' : '#5a5af0', borderRadius: 2, transition: 'width 0.5s' }} />
                                </div>
                                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: done === t.length && t.length > 0 ? '#10b981' : 'var(--text-primary)' }}>{t.length > 0 ? Math.round((done / t.length) * 100) : 0}%</span>
                              </div>
                            );
                          })()}

                          {/* Create task form */}
                          {isLeader && !showCreateTask && (
                            <button onClick={() => setShowCreateTask(true)} style={{ padding: '12px 16px', color: 'var(--text-tertiary)', background: 'var(--bg-surface)', border: '1px dashed var(--border)', borderRadius: 10, fontWeight: 500, cursor: 'pointer', width: '100%', fontSize: '0.82rem', textAlign: 'left' }}>+ Add task</button>
                          )}
                          {isLeader && showCreateTask && (
                            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                              <input value={newTask.title} onChange={e => setNewTask(f => ({ ...f, title: e.target.value }))} placeholder="Task title" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none', width: '100%' }} />
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                <select value={newTask.priority} onChange={e => setNewTask(f => ({ ...f, priority: e.target.value }))} style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--text-primary)', fontSize: '0.78rem' }}>
                                  <option value="LOW">Low Priority</option>
                                  <option value="MEDIUM">Medium Priority</option>
                                  <option value="HIGH">High Priority</option>
                                  <option value="CRITICAL">Critical</option>
                                </select>
                                <select value={newTask.specialty} onChange={e => setNewTask(f => ({ ...f, specialty: e.target.value }))} style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--text-primary)', fontSize: '0.78rem' }}>
                                  <option value="">No segment</option>
                                  <option value="FRONTEND">Frontend</option>
                                  <option value="BACKEND">Backend</option>
                                  <option value="ML">ML</option>
                                  <option value="DEPLOYER">DevOps</option>
                                  <option value="TESTER">Testing</option>
                                  <option value="DESIGNER">Design</option>
                                  <option value="QA">QA</option>
                                  <option value="GENERAL">General</option>
                                </select>
                                <select value={newTask.assignedToId} onChange={e => setNewTask(f => ({ ...f, assignedToId: e.target.value }))} style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--text-primary)', fontSize: '0.78rem' }}>
                                  <option value="">Unassigned</option>
                                  {(usersData?.getAllUsers || []).map((u: any) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                                </select>
                              </div>
                              {/* Dependencies */}
                              {(tasksData?.getProjectTasks || []).length > 0 && (
                                <div>
                                  <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginBottom: 4 }}>Depends on (optional)</div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {(tasksData?.getProjectTasks || []).filter((t: any) => t.status !== 'COMPLETED').map((t: any) => (
                                      <button key={t.id} type="button" onClick={() => setNewTask(f => ({ ...f, dependsOn: f.dependsOn.includes(t.id) ? f.dependsOn.filter(x => x !== t.id) : [...f.dependsOn, t.id] }))} style={{ padding: '3px 8px', borderRadius: 5, border: `1px solid ${newTask.dependsOn.includes(t.id) ? '#5a5af0' : 'var(--border)'}`, background: newTask.dependsOn.includes(t.id) ? 'rgba(90,90,240,0.1)' : 'var(--bg-elevated)', color: newTask.dependsOn.includes(t.id) ? '#5a5af0' : 'var(--text-tertiary)', fontSize: '0.68rem', cursor: 'pointer' }}>{t.title}</button>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                <button onClick={() => { setShowCreateTask(false); setNewTask({ title: '', priority: 'MEDIUM', specialty: '', assignedToId: '', dependsOn: [] }); }} style={{ padding: '6px 14px', background: 'none', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.78rem' }}>Cancel</button>
                                <button onClick={() => { if (!newTask.title.trim()) return; createTask({ variables: { projectId: currentProject.id, title: newTask.title, priority: newTask.priority, specialty: newTask.specialty || undefined, assignedToId: newTask.assignedToId || undefined, dependsOn: newTask.dependsOn.length > 0 ? newTask.dependsOn : undefined } }); setShowCreateTask(false); setNewTask({ title: '', priority: 'MEDIUM', specialty: '', assignedToId: '', dependsOn: [] }); }} style={{ padding: '6px 14px', background: 'var(--accent)', border: 'none', borderRadius: 7, color: '#fff', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>Create Task</button>
                              </div>
                            </div>
                          )}

                          <ProjectTaskBoard 
                            tasks={tasksData?.getProjectTasks || []} 
                            canManageAllTasks={isLeader}
                            currentUserId={user.id}
                            onUpdateStatus={(taskId, status, blockerReason, completionNote) => updateTaskStatus({ variables: { taskId, status, blockerReason, completionNote } })} 
                          />
                      </div>
                  )}

                  {activeTab === 'UPDATES' && (
                      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{(updatesData?.getProjectUpdates || []).length} updates</div>
                            {isLeader && <button onClick={handleAddUpdate} style={{ padding: '6px 14px', background: 'var(--accent)', border: 'none', borderRadius: 7, color: '#fff', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500 }}>+ Add Update</button>}
                          </div>
                          {(updatesData?.getProjectUpdates || []).length === 0 && (
                            <div style={{ padding: '3rem', textAlign: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>No updates yet. Complete tasks or add manual updates.</div>
                          )}
                          {(updatesData?.getProjectUpdates || []).map((u: any) => (
                            <div key={u.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <span style={{ fontSize: '0.62rem', fontWeight: 500, color: u.type === 'TASK_COMPLETED' ? '#10b981' : '#5a5af0', background: u.type === 'TASK_COMPLETED' ? 'rgba(16,185,129,0.08)' : 'rgba(90,90,240,0.08)', padding: '2px 6px', borderRadius: 4 }}>{u.type.replace(/_/g, ' ')}</span>
                                <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>{new Date(u.createdAt).toLocaleString()}</span>
                              </div>
                              <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '0.88rem', marginBottom: u.description ? 4 : 0 }}>{u.title}</div>
                              {u.description && <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{u.description}</div>}
                            </div>
                          ))}
                      </div>
                  )}

                  {activeTab === 'CHAT' && selectedProjectId && (
                      <div className="animate-fade-in" style={{ height: 'calc(100vh - 320px)', minHeight: 500 }}>
                          <ProjectChat
                              projectId={selectedProjectId}
                              user={{ id: user.id, fullName: user.fullName, category: user.category }}
                              token={token}
                              teamMembers={(currentProject?.teamMembers || []).map((m: any) => ({ userId: m.userId, name: m.userId }))}
                          />
                      </div>
                  )}

                  {activeTab === 'DOCS' && selectedProjectId && (
                      <div className="animate-fade-in">
                          <ProjectDocuments
                              projectId={selectedProjectId}
                              token={token}
                              userCategory={user.category}
                              userId={user.id}
                          />
                      </div>
                  )}
              </div>
          </div>
        )
      )}

      {isWizardOpen && <CreateProjectWizard users={usersData?.getAllUsers || []} onInvite={(vars) => createProject({ variables: { ...vars, projectLeadId: vars.projectLeadId || user.id } })} onClose={() => setIsWizardOpen(false)} />}
      {isInviteModalOpen && currentProject && (
          <InviteTeamMemberModal 
            users={(usersData?.getAllUsers || []).filter((u: any) => !(currentProject.teamMembers || []).find((m: any) => m.userId === u.id))}
            projectId={currentProject.id} projectName={currentProject.name}
            isManager={isManager}
            onDirectAdd={(userId, projectRole, specialty, allocation) => inviteMember({ variables: { projectId: currentProject.id, userId, projectRole, specialty, allocation, startDate: new Date().toISOString() } }).then(() => {})}
            onRequestAllocation={(userId, projectRole, specialty, allocation, reason) => createAllocationRequest({ variables: { projectId: currentProject.id, requestedUserId: userId, projectRole, specialty, allocation, reason } }).then(() => {})}
            onClose={() => setIsInviteModalOpen(false)}
          />
      )}

      {/* Remove Member Confirmation Modal */}
      {removeMemberTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '32px', maxWidth: 400, width: '100%' }}>
            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>Remove Member</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.5, marginBottom: 24 }}>
              Are you sure you want to remove this member from the project? They will lose access to project tasks and channels.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setRemoveMemberTarget(null)} style={{ padding: '8px 18px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmRemoveMember} style={{ padding: '8px 18px', background: '#ef4444', border: 'none', borderRadius: 8, color: '#fff', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Update Modal */}
      {isUpdateModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '32px', maxWidth: 460, width: '100%' }}>
            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>Add Project Update</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>Title</label>
                <input value={updateForm.title} onChange={e => setUpdateForm(f => ({ ...f, title: e.target.value }))} placeholder="What happened?" style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.85rem' }} autoFocus />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>Description (optional)</label>
                <textarea value={updateForm.description} onChange={e => setUpdateForm(f => ({ ...f, description: e.target.value }))} placeholder="Add more context..." rows={3} style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.85rem', resize: 'none' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setIsUpdateModalOpen(false)} style={{ padding: '8px 18px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmAddUpdate} disabled={!updateForm.title.trim()} style={{ padding: '8px 18px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', opacity: updateForm.title.trim() ? 1 : 0.5 }}>Post Update</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


