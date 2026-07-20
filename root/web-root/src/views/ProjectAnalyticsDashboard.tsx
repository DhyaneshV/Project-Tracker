import React, { useState, useMemo } from 'react';
import { useQuery, gql } from '@apollo/client';

const GET_PROJECTS = gql`query { getProjects { id name status } }`;
const GET_ANALYTICS = gql`
  query GetProjectAnalytics($projectId: ID!) {
    getProjectAnalytics(projectId: $projectId) {
      projectId totalTasks completedTasks blockedTasks velocity
      teamContribution { user { id fullName } contributionPercentage tasksCompleted }
      timelineHealth
    }
  }
`;
const GET_TASKS = gql`
  query GetProjectTasks($projectId: ID!) {
    getProjectTasks(projectId: $projectId) { id status completedAt createdAt }
  }
`;

/**
 * BurndownView - Burndown chart + velocity metrics for a project.
 * Pure CSS-based visualization (no chart library).
 */
export function BurndownView() {
  const [projectId, setProjectId] = useState('');
  const { data: projData } = useQuery(GET_PROJECTS);
  const { data: analyticsData, loading: aLoading } = useQuery(GET_ANALYTICS, { variables: { projectId }, skip: !projectId });
  const { data: tasksData, loading: tLoading } = useQuery(GET_TASKS, { variables: { projectId }, skip: !projectId });

  const projects = projData?.getProjects || [];
  const analytics = analyticsData?.getProjectAnalytics;
  const tasks = tasksData?.getProjectTasks || [];
  const loading = aLoading || tLoading;

  // Build burndown data: tasks remaining over time
  const burndownData = useMemo(() => {
    if (tasks.length === 0) return [];
    const total = tasks.length;
    const completedTasks = tasks.filter((t: any) => t.completedAt).sort((a: any, b: any) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime());
    if (completedTasks.length === 0) return [{ date: 'Start', remaining: total }];

    const points: { date: string; remaining: number }[] = [];
    const firstDate = new Date(tasks.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0].createdAt);
    points.push({ date: firstDate.toLocaleDateString('en', { month: 'short', day: 'numeric' }), remaining: total });

    let remaining = total;
    // Group completions by day
    const byDay = new Map<string, number>();
    completedTasks.forEach((t: any) => {
      const day = new Date(t.completedAt).toLocaleDateString('en', { month: 'short', day: 'numeric' });
      byDay.set(day, (byDay.get(day) || 0) + 1);
    });

    byDay.forEach((count, day) => {
      remaining -= count;
      points.push({ date: day, remaining });
    });

    return points;
  }, [tasks]);

  const maxRemaining = burndownData.length > 0 ? Math.max(...burndownData.map(d => d.remaining)) : 0;

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Burndown & Velocity</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 4 }}>Project progress metrics</p>
        </div>
        <select value={projectId} onChange={e => setProjectId(e.target.value)} style={{ padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.82rem' }}>
          <option value="">Select project</option>
          {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {!projectId && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 48, textAlign: 'center' }}>
          <div style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>Select a project to view metrics</div>
        </div>
      )}

      {projectId && loading && <div style={{ color: 'var(--text-secondary)', padding: 20 }}>Loading metrics...</div>}

      {projectId && !loading && analytics && (
        <>
          {/* Velocity Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
            <MetricCard label="Total Tasks" value={analytics.totalTasks} />
            <MetricCard label="Completed" value={analytics.completedTasks} color="#10b981" />
            <MetricCard label="Blocked" value={analytics.blockedTasks} color="#ef4444" />
            <MetricCard label="Velocity" value={`${analytics.velocity}/wk`} color="#5a5af0" />
            <MetricCard label="Health" value={analytics.timelineHealth || 'Good'} color={analytics.timelineHealth === 'AT_RISK' ? '#f59e0b' : '#10b981'} />
          </div>

          {/* Burndown Chart */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, marginBottom: 24 }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 16px' }}>Burndown Chart</h3>
            {burndownData.length <= 1 ? (
              <div style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem', textAlign: 'center', padding: 24 }}>Not enough completion data to show burndown</div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 160, padding: '0 4px' }}>
                {burndownData.map((point, i) => {
                  const heightPct = maxRemaining > 0 ? (point.remaining / maxRemaining) * 100 : 0;
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: '0.58rem', color: 'var(--text-tertiary)' }}>{point.remaining}</span>
                      <div style={{ width: '100%', maxWidth: 32, height: `${heightPct}%`, minHeight: 2, background: i === burndownData.length - 1 && point.remaining === 0 ? '#10b981' : '#5a5af0', borderRadius: '3px 3px 0 0', transition: 'height 0.3s' }} />
                      <span style={{ fontSize: '0.55rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', transform: 'rotate(-45deg)', transformOrigin: 'top left', width: 40 }}>{point.date}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {/* Ideal line indicator */}
            <div style={{ marginTop: 16, display: 'flex', gap: 16, justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 16, height: 4, borderRadius: 2, background: '#5a5af0' }} />
                <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>Remaining tasks</span>
              </div>
            </div>
          </div>

          {/* Team Contribution */}
          {analytics.teamContribution && analytics.teamContribution.length > 0 && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 16px' }}>Team Contribution</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {analytics.teamContribution.map((member: any) => (
                  <div key={member.user.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 500, width: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.user.fullName}</span>
                    <div style={{ flex: 1, height: 8, background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${member.contributionPercentage}%`, height: '100%', background: '#5a5af0', borderRadius: 4, transition: 'width 0.5s' }} />
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', minWidth: 60, textAlign: 'right' }}>{member.tasksCompleted} tasks ({member.contributionPercentage}%)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: any; color?: string }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '1.2rem', fontWeight: 700, color: color || 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}
