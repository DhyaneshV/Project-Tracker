import React from 'react';
import { useQuery, gql } from '@apollo/client';

const GET_PROJECTS = gql`
  query GetProjects { getProjects { id name status completionPercentage category startDate targetEndDate currentTeamSize budgetUSD } }
`;

const GET_ORG_ANALYTICS = gql`
  query GetOrgAnalytics { getOrgAnalytics { totalProjects activeProjects completedProjects totalTasks completedTasks blockedTasks inProgressTasks totalBudget spentBudget avgProjectHealth avgCompletionRate departmentUtilization { department memberCount activeTaskCount } } }
`;

export function ReportsView({ isExecutive }: { isExecutive?: boolean }) {
  const { data: projData, loading } = useQuery(GET_PROJECTS, { pollInterval: 30000 });
  const { data: orgData } = useQuery(GET_ORG_ANALYTICS, { skip: !isExecutive, pollInterval: 30000 });

  const projects = projData?.getProjects || [];
  const org = orgData?.getOrgAnalytics;

  const statusCounts = projects.reduce((acc: any, p: any) => { acc[p.status] = (acc[p.status] || 0) + 1; return acc; }, {});
  const categoryCounts = projects.reduce((acc: any, p: any) => { acc[p.category] = (acc[p.category] || 0) + 1; return acc; }, {});

  const activeProjects = projects.filter((p: any) => p.status === 'ACTIVE');
  const avgCompletion = activeProjects.length > 0 ? activeProjects.reduce((s: number, p: any) => s + p.completionPercentage, 0) / activeProjects.length : 0;
  const totalTeamSize = projects.reduce((s: number, p: any) => s + (p.currentTeamSize || 0), 0);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>Reports</h1>
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.85rem' }}>Project performance analytics</p>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)' }}>Loading reports...</div>}

      {/* Summary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <StatCard label="Active Projects" value={statusCounts['ACTIVE'] || 0} color="#7c5cfc" />
        <StatCard label="Avg Completion" value={`${avgCompletion.toFixed(0)}%`} color="#10b981" />
        <StatCard label="Total Team" value={totalTeamSize} color="#22d3ee" />
        <StatCard label="Completed" value={statusCounts['COMPLETED'] || 0} color="#34d399" />
      </div>

      {/* Task Metrics (Executive) */}
      {org && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          <StatCard label="Total Tasks" value={org.totalTasks} color="#f472b6" />
          <StatCard label="Tasks Done" value={org.completedTasks} color="#10b981" />
          <StatCard label="In Progress" value={org.inProgressTasks} color="#6366f1" />
          <StatCard label="Blocked" value={org.blockedTasks} color="#ef4444" />
        </div>
      )}

      {/* Project Status Distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Project Status Breakdown</div>
          {Object.entries(statusCounts).map(([status, count]) => (
            <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 600 }}>{status.replace(/_/g, ' ')}</span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{count as number}</span>
                </div>
                <div style={{ height: 4, background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${((count as number) / projects.length) * 100}%`, height: '100%', background: status === 'ACTIVE' ? '#6366f1' : status === 'COMPLETED' ? '#10b981' : status === 'ON_HOLD' ? '#f59e0b' : '#94a3b8', borderRadius: 4 }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>By Category</div>
          {Object.entries(categoryCounts).map(([cat, count]) => (
            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 600 }}>{cat}</span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{count as number}</span>
                </div>
                <div style={{ height: 4, background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${((count as number) / projects.length) * 100}%`, height: '100%', background: cat === 'CLIENT' ? '#f472b6' : cat === 'INTERNAL' ? '#7c5cfc' : cat === 'PRODUCT' ? '#22d3ee' : '#fb923c', borderRadius: 4 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Per-Project Performance Table */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px' }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Project Performance</div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--border)', marginBottom: 8 }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Project</span>
          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', textAlign: 'center' }}>Status</span>
          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', textAlign: 'center' }}>Progress</span>
          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', textAlign: 'center' }}>Team</span>
          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', textAlign: 'right' }}>Budget</span>
        </div>
        {projects.slice(0, 15).map((p: any, i: number) => (
          <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 8, padding: '12px', borderRadius: 8, marginBottom: 2, background: i % 2 === 0 ? 'var(--bg-raised)' : 'transparent' }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem' }}>{p.name}</div>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: p.status === 'ACTIVE' ? '#6366f1' : p.status === 'COMPLETED' ? '#10b981' : '#f59e0b' }}>{p.status}</span>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                <div style={{ width: 40, height: 4, background: 'var(--bg-elevated)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${p.completionPercentage}%`, height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
                </div>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{p.completionPercentage}%</span>
              </div>
            </div>
            <div style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{p.currentTeamSize || 0}</div>
            <div style={{ textAlign: 'right', fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{p.budgetUSD ? `$${(p.budgetUSD / 1000).toFixed(0)}K` : '—'}</div>
          </div>
        ))}
      </div>

      {/* Department Utilization (Executive) */}
      {org && org.departmentUtilization.length > 0 && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Department Workload</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {org.departmentUtilization.map((d: any) => (
              <div key={d.department} style={{ padding: '16px', background: 'var(--bg-raised)', borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.88rem', marginBottom: 8 }}>{d.department}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{d.memberCount} members</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{d.activeTaskCount} tasks</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: any; color: string }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, color }}>{value}</div>
    </div>
  );
}
