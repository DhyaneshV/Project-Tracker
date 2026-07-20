import React from 'react';
import { useQuery, gql } from '@apollo/client';
import { usePermissions } from '../components/RBACContext';

const GET_ACTIVITY_FEED = gql`
  query GetActivityFeed($limit: Int) {
    getActivityFeed(limit: $limit) { id type title description projectName projectId actorName severity createdAt }
  }
`;

const GET_AUDIT_LOGS = gql`
  query GetAuditLogsActivity($limit: Int) { getAuditLogs(limit: $limit) { items { auditId userId actionType targetUserId oldValue newValue timestamp } } }
`;

export function ActivityFeedView() {
  const { hierarchyLevel } = usePermissions();
  const canSeeAuditLogs = hierarchyLevel <= 3;

  const { data: feedData, loading } = useQuery(GET_ACTIVITY_FEED, { variables: { limit: 50 }, pollInterval: 60000 });
  const { data: auditData } = useQuery(GET_AUDIT_LOGS, { variables: { limit: 15 }, skip: !canSeeAuditLogs });

  const feed = feedData?.getActivityFeed || [];
  const audits = auditData?.getAuditLogs?.items || [];

  const typeIcon: Record<string, string> = {
    MILESTONE_REACHED: '◆', STATUS_CHANGE: '●', BLOCKER_FOUND: '▸',
    RISK_ALERT: '▸', TEAM_CHANGE: '●', DEADLINE_CHANGE: '●',
    COMPLETION_CHANGE: '▸', INVITE: '▸', DROP: '●', ROLE_UPDATE: '◆',
    LOGIN: '●', TASK_CREATE: '▸', TASK_STATUS_UPDATE: '●', PROJECT_CREATE: '◆',
  };

  const severityColor: Record<string, string> = { CRITICAL: '#e05252', WARNING: '#f59e0b', INFO: '#5a5af0' };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>Activity Feed</h1>
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.85rem' }}>Real-time updates across your projects</p>
      </div>

      {loading && !feed.length && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)' }}>Loading activity...</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {feed.map((event: any) => (
          <div key={event.id} style={{ display: 'flex', gap: 14, padding: '16px 20px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
            <div style={{ fontSize: '0.9rem', marginTop: 3, color: 'var(--text-tertiary)' }}>{typeIcon[event.type] || '●'}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{event.title}</div>
                {event.severity && <span style={{ fontSize: '0.62rem', fontWeight: 700, color: severityColor[event.severity] || '#5a5af0', background: `${severityColor[event.severity] || '#5a5af0'}15`, padding: '3px 8px', borderRadius: 5 }}>{event.severity}</span>}
              </div>
              {event.description && <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 4, lineHeight: 1.4 }}>{event.description}</div>}
              <div style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'center' }}>
                {event.projectName && <span style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 500 }}>{event.projectName}</span>}
                <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{new Date(event.createdAt).toLocaleString()}</span>
              </div>
            </div>
          </div>
        ))}

        {feed.length === 0 && !loading && (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '3rem', textAlign: 'center' }}>
            <div style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>No recent activity. Updates will appear as projects progress.</div>
          </div>
        )}
      </div>

      {/* Audit Trail - ONLY visible to Level 1-3 (C-Suite, SVP, VP) */}
      {canSeeAuditLogs && audits.length > 0 && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 14, letterSpacing: '0.04em' }}>Audit Trail (Admin Only)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {audits.slice(0, 15).map((a: any) => (
              <div key={a.auditId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-raised)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{typeIcon[a.actionType] || '●'}</span>
                  <span style={{ color: 'var(--text-primary)', fontSize: '0.82rem', fontWeight: 600 }}>{a.actionType?.replace(/_/g, ' ')}</span>
                </div>
                <span style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem' }}>{new Date(a.timestamp).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
