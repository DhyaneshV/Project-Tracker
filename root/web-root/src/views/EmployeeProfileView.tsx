import React from 'react';
import { useQuery, gql } from '@apollo/client';
import { GET_MY_TEAM_MEMBERS, GET_PROJECT_TASKS } from './users/queries';
import { ProfileSkeleton } from '../components/Skeleton';

const GET_ME_FULL = gql`
  query GetMeProfile {
    me {
      id
      fullName
      email
      role
      department
      category
      hierarchyLevel
      teamId
      projectId
      status
      twoFactorEnabled
      twoFactorMethod
      lastLoginAt
    }
  }
`;

/**
 * EmployeeProfileView - Requirement 6 implementation
 * For hierarchy level 6-7 (Senior IC, Junior IC)
 * 
 * Shows:
 * - Personal profile information
 * - Colleagues panel (same team/project)
 * - Assigned tasks panel (filtered to own tasks)
 * 
 * Does NOT show:
 * - Action dropdowns, bulk operations, or management mutations
 */
export function EmployeeProfileView() {
  const { data: meData, loading: meLoading, error: meError, refetch: refetchMe } = useQuery(GET_ME_FULL, {
    fetchPolicy: 'cache-and-network',
  });

  const { data: teamData, loading: teamLoading, error: teamError, refetch: refetchTeam } = useQuery(GET_MY_TEAM_MEMBERS, {
    fetchPolicy: 'cache-and-network',
  });

  const me = meData?.me;

  const { data: tasksData, loading: tasksLoading } = useQuery(GET_PROJECT_TASKS, {
    variables: { projectId: me?.projectId },
    skip: !me?.projectId,
    fetchPolicy: 'cache-and-network',
  });

  if (meLoading) {
    return <ProfileSkeleton />;
  }

  if (meError || teamError) {
    const errorMsg = meError?.message || teamError?.message || 'Failed to load data';
    return (
      <div style={{ padding: '2rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, textAlign: 'center' }}>
        <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 8 }}>Failed to Load Data</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: 16 }}>{errorMsg}</p>
        <button
          onClick={() => { refetchMe(); refetchTeam(); }}
          style={{ padding: '8px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!me) return null;

  const colleagues = teamData?.getMyTeamMembers || [];
  const allTasks = tasksData?.getProjectTasks || [];
  const myTasks = allTasks.filter((t: any) => t.assignedTo?.id === me.id);

  return (
    <div className="animate-fade-in">
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 6px', color: 'var(--text-primary)' }}>My Profile</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.82rem' }}>Your account details and workspace</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Profile Card */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 16 }}>Profile Information</div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <ProfileField label="Full Name" value={me.fullName} />
            <ProfileField label="Email" value={me.email} />
            <ProfileField label="Functional Role" value={me.role?.replace(/_/g, ' ')} />
            <ProfileField label="Department" value={me.department?.replace(/_/g, ' ') || '—'} />
            <ProfileField label="Category" value={me.category?.replace(/_/g, ' ')} />
            <ProfileField label="Hierarchy Level" value={`Level ${me.hierarchyLevel}`} />
            <ProfileField label="Status" value={me.status?.replace(/_/g, ' ')} highlight={me.status === 'ACTIVE' ? '#10b981' : undefined} />
            <ProfileField label="2FA" value={me.twoFactorEnabled ? `Enabled (${me.twoFactorMethod || 'OTP'})` : 'Not Enabled'} highlight={me.twoFactorEnabled ? '#10b981' : '#f59e0b'} />
            <ProfileField label="Team ID" value={me.teamId || '—'} />
            <ProfileField label="Project ID" value={me.projectId || 'Unassigned'} />
            <ProfileField label="Last Login" value={me.lastLoginAt ? new Date(me.lastLoginAt).toLocaleString() : 'Never'} />
          </div>
        </div>

        {/* Colleagues Panel */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Colleagues {!teamLoading && `(${colleagues.length})`}
            </span>
          </div>
          <div style={{ maxHeight: 340, overflowY: 'auto' }}>
            {teamLoading && <div style={{ padding: 20, color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>Loading colleagues...</div>}
            {!teamLoading && colleagues.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>No colleagues found</div>
            )}
            {!teamLoading && colleagues.map((c: any) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: '1px solid var(--border)' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)',
                }}>
                  {(c.fullName || '?').charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: '0.82rem', color: 'var(--text-primary)' }}>{c.fullName}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{c.email}</div>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{c.role?.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Assigned Tasks Panel */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            My Assigned Tasks {!tasksLoading && `(${myTasks.length})`}
          </span>
        </div>
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {!me.projectId && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>
              No project is currently assigned to you.
            </div>
          )}
          {me.projectId && tasksLoading && (
            <div style={{ padding: 20, color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>Loading tasks...</div>
          )}
          {me.projectId && !tasksLoading && myTasks.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>
              No tasks assigned to you in this project.
            </div>
          )}
          {myTasks.map((task: any) => (
            <div key={task.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{task.title}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                  Priority: {task.priority || 'Normal'} · Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No date'}
                </div>
              </div>
              <span style={{
                padding: '3px 10px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 700,
                background: getTaskColor(task.status) + '18', color: getTaskColor(task.status),
              }}>
                {task.status?.replace(/_/g, ' ')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProfileField({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div>
      <div style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: '0.82rem', fontWeight: 500, color: highlight || 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}

function getTaskColor(status: string): string {
  switch (status) {
    case 'DONE': case 'COMPLETED': return '#10b981';
    case 'IN_PROGRESS': return '#6366f1';
    case 'TODO': case 'BACKLOG': return '#94a3b8';
    case 'BLOCKED': return '#ef4444';
    default: return '#94a3b8';
  }
}
