import React from 'react';
import { Project, ProjectStatus } from '@project-tracker/shared-types';

interface Update { id: string; type: string; title: string; projectName: string; projectId: string; createdAt: string; }

interface Props {
  projects: Project[];
  updates: Update[];
  onProjectClick: (project: Project) => void;
  loading: boolean;
}

export function ProjectListManager({ projects, updates, onProjectClick, loading }: Props) {
  const formatDate = (dateInput: any) => {
    if (!dateInput || (typeof dateInput === 'object' && Object.keys(dateInput).length === 0)) return 'TBD';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return 'TBD';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
    [ProjectStatus.ACTIVE]: { color: '#10b981', bg: 'rgba(16,185,129,0.08)', label: 'Active' },
    [ProjectStatus.PLANNING]: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', label: 'Planning' },
    [ProjectStatus.ON_HOLD]: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', label: 'On Hold' },
    [ProjectStatus.COMPLETED]: { color: '#64748b', bg: 'rgba(100,116,139,0.06)', label: 'Completed' },
    [ProjectStatus.ARCHIVED]: { color: '#94a3b8', bg: 'rgba(148,163,184,0.06)', label: 'Archived' },
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: 100, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, animation: 'pulse 1.5s infinite' }} />
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div style={{ padding: '60px 40px', textAlign: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
        <div style={{ fontSize: '1.5rem', marginBottom: 12, opacity: 0.3 }}>▦</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No projects yet. Create one to get started.</div>
      </div>
    );
  }

  // Sort: active first, then planning/on-hold, then completed/archived at bottom
  const sortOrder: Record<string, number> = {
    [ProjectStatus.ACTIVE]: 0,
    [ProjectStatus.PLANNING]: 1, [ProjectStatus.ON_HOLD]: 2,
    [ProjectStatus.COMPLETED]: 3, [ProjectStatus.ARCHIVED]: 4,
  };
  const sorted = [...projects].sort((a, b) => (sortOrder[a.status] ?? 5) - (sortOrder[b.status] ?? 5));

  // Count active (exclude completed/archived)
  const activeCount = projects.filter(p => p.status !== ProjectStatus.COMPLETED && p.status !== ProjectStatus.ARCHIVED).length;
  const completedCount = projects.filter(p => p.status === ProjectStatus.COMPLETED).length;

  return (
    <div>
      {/* Summary */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--text-primary)' }}>{activeCount}</strong> active
        </span>
        {completedCount > 0 && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
            <strong>{completedCount}</strong> completed
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sorted.map(project => {
          const isCompleted = project.status === ProjectStatus.COMPLETED || project.status === ProjectStatus.ARCHIVED;
          const projectUpdates = updates.filter(u => u.projectId === project.id).slice(0, 5);
          const pct = isCompleted ? 100 : (project.completionPercentage || 0);
          const config = statusConfig[project.status] || statusConfig[ProjectStatus.ACTIVE];

          return (
            <div
              key={project.id}
              onClick={() => onProjectClick(project)}
              style={{
                background: isCompleted ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                border: `1px solid ${isCompleted ? 'var(--border)' : 'var(--border)'}`,
                borderRadius: 14,
                padding: '20px 24px',
                cursor: 'pointer',
                transition: 'border-color 0.2s, box-shadow 0.2s, opacity 0.2s',
                opacity: isCompleted ? 0.55 : 1,
                borderLeft: `3px solid ${config.color}`,
              }}
              onMouseEnter={e => {
                if (!isCompleted) {
                  e.currentTarget.style.borderColor = 'rgba(90,90,240,0.3)';
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)';
                } else {
                  e.currentTarget.style.opacity = '0.75';
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.opacity = isCompleted ? '0.55' : '1';
              }}
            >
              {/* Top row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '1.05rem', fontWeight: 700, color: isCompleted ? 'var(--text-tertiary)' : 'var(--text-primary)', textDecoration: isCompleted ? 'line-through' : 'none' }}>
                      {project.name}
                    </span>
                    <span style={{ fontSize: '0.58rem', fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-dim)', padding: '2px 7px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      {project.category}
                    </span>
                  </div>
                  {project.description && (
                    <p style={{ margin: '6px 0 0', color: 'var(--text-tertiary)', fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                      {project.description}
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)' }}>{project.currentTeamSize || 0} members</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: 2 }}>{formatDate(project.targetEndDate)}</div>
                  </div>
                  <span style={{ fontSize: '0.65rem', fontWeight: 600, color: config.color, background: config.bg, padding: '4px 10px', borderRadius: 8, whiteSpace: 'nowrap' }}>
                    {config.label}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, height: 5, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    width: `${pct}%`, height: '100%',
                    background: isCompleted ? '#64748b' : pct === 100 ? '#10b981' : 'var(--accent)',
                    borderRadius: 3, transition: 'width 0.6s ease',
                  }} />
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isCompleted ? 'var(--text-tertiary)' : pct === 100 ? '#10b981' : 'var(--text-primary)', minWidth: 36, textAlign: 'right' }}>
                  {pct}%
                </span>
              </div>

              {/* Updates ticker (only for active projects) */}
              {!isCompleted && projectUpdates.length > 0 && (
                <div style={{ overflow: 'hidden', position: 'relative', height: 20, marginTop: 10 }}>
                  <div style={{ display: 'flex', gap: 24, animation: `scrollTicker ${projectUpdates.length * 4}s linear infinite`, whiteSpace: 'nowrap' }}>
                    {projectUpdates.concat(projectUpdates).map((u, i) => (
                      <span key={`${u.id}-${i}`} style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 4, height: 4, borderRadius: '50%', background: u.type === 'TASK_COMPLETED' ? '#10b981' : u.type === 'BLOCKER_FOUND' ? '#e05252' : '#5a5af0', flexShrink: 0 }} />
                        {u.title}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes scrollTicker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
