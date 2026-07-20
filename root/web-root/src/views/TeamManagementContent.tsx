import React, { useState } from 'react';
import { useQuery, gql } from '@apollo/client';
import { GET_MY_TEAM_MEMBERS, GET_PROJECT_TASKS, GET_MY_PROJECTS } from './users/queries';
import { usePermissions } from '../components/RBACContext';
import { TeamSkeleton } from '../components/Skeleton';

/**
 * TeamManagementContent - Requirement 5 implementation
 * For hierarchy level 4-5 (Senior Manager / Team Manager)
 * 
 * Shows:
 * - Direct reports list with expandable details
 * - Indirect reports (level 4 only) as nested collapsible
 * - Project summary panel
 * - Task board on project selection
 */
export function TeamManagementContent() {
  const { hierarchyLevel } = usePermissions();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const { data: teamData, loading: teamLoading, error: teamError, refetch: refetchTeam } = useQuery(GET_MY_TEAM_MEMBERS, {
    fetchPolicy: 'cache-and-network',
  });

  const { data: projectsData } = useQuery(GET_MY_PROJECTS, { fetchPolicy: 'cache-first' });

  const { data: tasksData, loading: tasksLoading } = useQuery(GET_PROJECT_TASKS, {
    variables: { projectId: selectedProjectId },
    skip: !selectedProjectId,
    fetchPolicy: 'cache-and-network',
  });

  if (teamLoading) {
    return <TeamSkeleton />;
  }

  if (teamError) {
    return (
      <div style={{ padding: '2rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, textAlign: 'center' }}>
        <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 8 }}>Failed to Load Team Data</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: 16 }}>{teamError.message}</p>
        <button onClick={() => refetchTeam()} style={{ padding: '8px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>Retry</button>
      </div>
    );
  }

  const directReports = teamData?.getMyTeamMembers || [];
  const projects = projectsData?.getProjects || [];
  const tasks = tasksData?.getProjectTasks || [];

  if (directReports.length === 0) {
    return (
      <div style={{ padding: '3rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, textAlign: 'center' }}>
        <div style={{ fontSize: '1.5rem', marginBottom: 12, opacity: 0.4 }}>◇</div>
        <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 8 }}>No Direct Reports</h3>
        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>No direct reports are currently assigned to you.</p>
      </div>
    );
  }

  // Determine relevant projects (where caller has a direct report assigned)
  const directReportProjectIds = new Set(directReports.map((r: any) => r.projectId).filter(Boolean));
  const relevantProjects = projects.filter((p: any) => {
    if (directReportProjectIds.has(p.id)) return true;
    if (p.teamMembers?.some((m: any) => m.role === 'TEAM_LEAD')) return true;
    return false;
  });

  return (
    <div className="animate-fade-in">
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 6px', color: 'var(--text-primary)' }}>My Team</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.82rem' }}>
        {directReports.length} direct report{directReports.length !== 1 ? 's' : ''}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: selectedProjectId ? '1fr 1fr' : '1fr', gap: 20 }}>
        {/* Left: Team Members */}
        <div>
          {/* Direct Reports */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Direct Reports</span>
            </div>
            {directReports.map((member: any) => (
              <DirectReportRow
                key={member.id}
                member={member}
                expanded={expandedId === member.id}
                onToggle={() => setExpandedId(expandedId === member.id ? null : member.id)}
                showIndirectReports={hierarchyLevel === 4}
                projects={projects}
              />
            ))}
          </div>

          {/* Project Summary */}
          {relevantProjects.length > 0 && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Project Summary</span>
              </div>
              {relevantProjects.map((project: any) => (
                <button
                  key={project.id}
                  onClick={() => setSelectedProjectId(selectedProjectId === project.id ? null : project.id)}
                  style={{
                    display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', border: 'none', borderBottom: '1px solid var(--border)',
                    background: selectedProjectId === project.id ? 'var(--bg-elevated)' : 'transparent',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{project.name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                      {project.status?.replace(/_/g, ' ') || 'Active'} · {project.teamSize || 0} members
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent)' }}>{project.completionPercentage ?? 0}%</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>complete</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Task Board (when project selected) */}
        {selectedProjectId && (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tasks</span>
              <button onClick={() => setSelectedProjectId(null)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '0.78rem' }}>Close</button>
            </div>
            <div style={{ padding: 16, maxHeight: 500, overflowY: 'auto' }}>
              {tasksLoading && <div style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>Loading tasks...</div>}
              {!tasksLoading && tasks.length === 0 && <div style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem', textAlign: 'center', padding: 20 }}>No tasks found</div>}
              {!tasksLoading && tasks.map((task: any) => (
                <div key={task.id} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '0.82rem', color: 'var(--text-primary)' }}>{task.title}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                      {task.priority} · {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date'}
                    </div>
                  </div>
                  <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.65rem', fontWeight: 600, background: getTaskStatusColor(task.status) + '18', color: getTaskStatusColor(task.status) }}>
                    {task.status?.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DirectReportRow({ member, expanded, onToggle, showIndirectReports, projects }: {
  member: any;
  expanded: boolean;
  onToggle: () => void;
  showIndirectReports: boolean;
  projects: any[];
}) {
  const [indirectExpanded, setIndirectExpanded] = useState(false);
  const projectName = member.projectId
    ? projects.find((p: any) => p.id === member.projectId)?.name || 'Assigned'
    : 'Unassigned';

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      {/* Main row */}
      <button
        onClick={onToggle}
        style={{
          display: 'flex', width: '100%', alignItems: 'center', gap: 12,
          padding: '12px 16px', border: 'none', background: expanded ? 'var(--bg-elevated)' : 'transparent',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{member.fullName}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{member.email}</div>
        </div>
        <div style={{ textAlign: 'right', minWidth: 100 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{member.role?.replace(/_/g, ' ')}</div>
        </div>
        <span style={{
          padding: '2px 8px', borderRadius: 6, fontSize: '0.65rem', fontWeight: 700,
          background: getStatusBg(member.status), color: getStatusFg(member.status),
        }}>
          {member.status?.replace(/_/g, ' ')}
        </span>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', minWidth: 80, textAlign: 'right' }}>
          {projectName}
        </div>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>▶</span>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div style={{ padding: '12px 16px 16px 28px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
            <DetailItem label="2FA Status" value={member.twoFactorEnabled ? 'Enabled' : 'Disabled'} />
            <DetailItem label="2FA Method" value={member.twoFactorMethod || '—'} />
            <DetailItem label="Last Login" value={member.lastLoginAt ? new Date(member.lastLoginAt).toLocaleString() : 'Never'} />
            <DetailItem label="Credentials Expiry" value={member.credentialsExpiryDate ? new Date(member.credentialsExpiryDate).toLocaleDateString() : '—'} />
          </div>

          {/* Indirect Reports (Level 4 only) */}
          {showIndirectReports && member.directReports && member.directReports.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <button
                onClick={(e) => { e.stopPropagation(); setIndirectExpanded(!indirectExpanded); }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '0.72rem', fontWeight: 600, color: 'var(--accent)',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <span style={{ transform: indirectExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>▶</span>
                Indirect Reports ({member.directReports.length})
              </button>
              {indirectExpanded && (
                <div style={{ marginTop: 8, paddingLeft: 12 }}>
                  {member.directReports.map((indirect: any) => (
                    <div key={indirect.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-primary)' }}>{indirect.fullName}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{indirect.role?.replace(/_/g, ' ')}</span>
                      <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: 4, background: getStatusBg(indirect.status), color: getStatusFg(indirect.status) }}>{indirect.status?.replace(/_/g, ' ')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function getStatusBg(status: string): string {
  switch (status) {
    case 'ACTIVE': return 'rgba(16,185,129,0.12)';
    case 'PENDING_VERIFICATION': return 'rgba(245,158,11,0.12)';
    case 'SUSPENDED': return 'rgba(239,68,68,0.12)';
    default: return 'rgba(148,163,184,0.12)';
  }
}

function getStatusFg(status: string): string {
  switch (status) {
    case 'ACTIVE': return '#10b981';
    case 'PENDING_VERIFICATION': return '#f59e0b';
    case 'SUSPENDED': return '#ef4444';
    default: return '#94a3b8';
  }
}

function getTaskStatusColor(status: string): string {
  switch (status) {
    case 'DONE': case 'COMPLETED': return '#10b981';
    case 'IN_PROGRESS': return '#6366f1';
    case 'TODO': case 'BACKLOG': return '#94a3b8';
    case 'BLOCKED': return '#ef4444';
    default: return '#94a3b8';
  }
}
