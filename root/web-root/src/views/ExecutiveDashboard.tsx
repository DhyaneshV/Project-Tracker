import React from 'react';
import { useQuery, gql } from '@apollo/client';

const GET_ORG_ANALYTICS = gql`
  query GetOrgAnalytics {
    getOrgAnalytics {
      totalProjects
      activeProjects
      completedProjects
      onHoldProjects
      totalTasks
      completedTasks
      blockedTasks
      inProgressTasks
      totalBudget
      spentBudget
      totalHeadcount
      avgProjectHealth
      avgCompletionRate
      projectsByCategory { category count }
      departmentUtilization { department memberCount activeTaskCount }
    }
  }
`;

const GET_RISK_ALERTS = gql`
  query GetOrgRiskAlerts { getOrgRiskAlerts { id projectId projectName type severity message createdAt } }
`;

const GET_BUDGET_OVERVIEW = gql`
  query GetBudgetOverview { getBudgetOverview { projectId projectName budgetUSD completionPercentage status burnRate estimatedOverrun } }
`;

export function ExecutiveDashboard() {
  const { data: analytics, loading: loadingAnalytics } = useQuery(GET_ORG_ANALYTICS, { pollInterval: 30000 });
  const { data: risksData, loading: loadingRisks } = useQuery(GET_RISK_ALERTS, { pollInterval: 30000 });
  const { data: budgetData, loading: loadingBudget } = useQuery(GET_BUDGET_OVERVIEW, { pollInterval: 30000 });

  const org = analytics?.getOrgAnalytics;
  const risks = risksData?.getOrgRiskAlerts || [];
  const budgets = budgetData?.getBudgetOverview || [];

  if (loadingAnalytics && !org) return <LoadingState />;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>Executive Overview</h1>
        <p style={{ color: 'var(--text-tertiary)', margin: 0, fontSize: '0.85rem' }}>Organization-wide metrics / Real-time</p>
      </div>

      {org && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          <KPICard label="Total Projects" value={org.totalProjects} sub={`${org.activeProjects} active`} color="var(--accent)" />
          <KPICard label="Total Tasks" value={org.totalTasks} sub={`${org.completedTasks} done / ${org.blockedTasks} blocked`} color="var(--accent)" />
          <KPICard label="Total Budget" value={`$${(org.totalBudget / 1000).toFixed(0)}K`} sub={`$${(org.spentBudget / 1000).toFixed(0)}K spent`} color="var(--accent)" />
          <KPICard label="Headcount" value={org.totalHeadcount} sub="Across all projects" color="var(--accent)" />
        </div>
      )}

      {org && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 12 }}>Avg Project Health</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ fontSize: '2rem', fontWeight: 600, color: org.avgProjectHealth > 70 ? '#10b981' : org.avgProjectHealth > 40 ? '#f59e0b' : '#ef4444' }}>
                {org.avgProjectHealth.toFixed(0)}%
              </div>
              <div style={{ flex: 1, height: 4, background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${org.avgProjectHealth}%`, height: '100%', background: org.avgProjectHealth > 70 ? '#10b981' : org.avgProjectHealth > 40 ? '#f59e0b' : '#ef4444', borderRadius: 4, transition: 'width 0.5s' }} />
              </div>
            </div>
          </div>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 12 }}>Avg Completion Rate</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--accent)' }}>{org.avgCompletionRate.toFixed(0)}%</div>
              <div style={{ flex: 1, height: 4, background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${org.avgCompletionRate}%`, height: '100%', background: 'var(--accent)', borderRadius: 4, transition: 'width 0.5s' }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {org && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 16 }}>Projects by Category</div>
            {(org.projectsByCategory || []).map((c: any) => (
              <div key={c.category} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: '0.88rem' }}>{c.category}</span>
                <span style={{ color: 'var(--accent)', fontSize: '0.8rem', fontWeight: 600 }}>{c.count}</span>
              </div>
            ))}
            {org.projectsByCategory.length === 0 && <div style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '2rem' }}>No data</div>}
          </div>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 16 }}>Department Utilization</div>
            {(org.departmentUtilization || []).map((d: any) => (
              <div key={d.department} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: '0.88rem' }}>{d.department}</span>
                <div style={{ display: 'flex', gap: 12 }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{d.memberCount} members</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{d.activeTaskCount} tasks</span>
                </div>
              </div>
            ))}
            {org.departmentUtilization.length === 0 && <div style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '2rem' }}>No data</div>}
          </div>
        </div>
      )}

      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px' }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Risk Alerts</div>
        {risks.length === 0 && <div style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '2rem' }}>No active risk alerts -- all systems nominal</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {risks.slice(0, 10).map((r: any) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: r.severity === 'CRITICAL' ? '#ef4444' : r.severity === 'WARNING' ? '#f59e0b' : '#6366f1' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.88rem' }}>{r.projectName}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: 2 }}>{r.message}</div>
              </div>
              <div style={{ fontSize: '0.65rem', fontWeight: 600, color: r.severity === 'CRITICAL' ? '#ef4444' : r.severity === 'WARNING' ? '#f59e0b' : '#6366f1', textTransform: 'uppercase' }}>{r.type.replace(/_/g, ' ')}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px' }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Budget Tracker</div>
        {budgets.length === 0 && <div style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '2rem' }}>No budget data available</div>}
        <div style={{ display: 'grid', gap: 0 }}>
          {budgets.map((b: any) => (
            <div key={b.projectId} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.88rem' }}>{b.projectName}</div>
                <div style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem', marginTop: 2 }}>{b.status}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Budget</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>${(b.budgetUSD / 1000).toFixed(0)}K</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Progress</div>
                <div style={{ fontWeight: 600, color: 'var(--accent)', fontSize: '0.9rem' }}>{b.completionPercentage.toFixed(0)}%</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Burn/Day</div>
                <div style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>${b.burnRate.toFixed(0)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Overrun</div>
                <div style={{ fontWeight: 600, color: b.estimatedOverrun > 0 ? '#ef4444' : '#10b981', fontSize: '0.9rem' }}>
                  {b.estimatedOverrun > 0 ? `+$${(b.estimatedOverrun / 1000).toFixed(1)}K` : 'Safe'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KPICard({ label, value, sub, color }: { label: string; value: any; sub: string; color: string }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '22px 24px' }}>
      <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: '2rem', fontWeight: 600, color }}>{value}</div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid var(--bg-elevated)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
        <div style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>Loading executive data...</div>
      </div>
    </div>
  );
}
