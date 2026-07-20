import React, { useState, useMemo } from 'react';
import { useQuery } from '@apollo/client';
import { GET_AUDIT_LOGS, GET_ALL_USERS } from './queries';
import { usePermissions } from '../../components/RBACContext';

/** All possible ActionType enum values from the backend */
const ACTION_TYPES = [
  'INVITE', 'DROP', 'ROLE_UPDATE', 'STATUS_UPDATE', 'ENABLE_2FA', 'DISABLE_2FA',
  'LOGIN', 'ACCOUNT_LOCK', 'RESEND_INVITE', 'PROJECT_CREATE', 'PROJECT_UPDATE',
  'TASK_CREATE', 'TASK_STATUS_UPDATE', 'USER_REGISTERED', 'USER_UPDATED',
] as const;

type ActionType = typeof ACTION_TYPES[number];

/**
 * AuditLogViewer - Requirement 9 implementation
 * 
 * Shows immutable audit trail with:
 * - Action type filter (multi-select)
 * - Date range filter (start/end)
 * - CSV export
 * - Hierarchy gating: level > 3 cannot access
 */
export function AuditLogViewer({ token }: { token: string }) {
  const { hierarchyLevel } = usePermissions();
  const context = { headers: { Authorization: `Bearer ${token}` } };

  const [selectedActions, setSelectedActions] = useState<ActionType[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data, loading, error, refetch, fetchMore } = useQuery(GET_AUDIT_LOGS, { context, fetchPolicy: 'network-only', variables: { limit: 50 } });
  const { data: usersData } = useQuery(GET_ALL_USERS, { context, fetchPolicy: 'cache-first' });

  // Hierarchy gating: Level > 3 cannot access
  if (hierarchyLevel > 3) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
        <div style={{ fontSize: '1.5rem', marginBottom: 12, opacity: 0.4 }}>⊘</div>
        <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 8 }}>Access Restricted</h3>
        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>Audit logs are only accessible to Level 1-3 users (VP and above).</p>
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: 20, color: 'var(--text-secondary)' }}>Loading audit logs...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, textAlign: 'center' }}>
        <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 8 }}>Failed to Load Audit Logs</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: 16 }}>{error.message}</p>
        <button onClick={() => refetch()} style={{ padding: '8px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>Retry</button>
      </div>
    );
  }

  const allLogs = data?.getAuditLogs?.items || [];
  const nextCursor = data?.getAuditLogs?.nextCursor;
  const users = usersData?.getAllUsers || [];

  const handleLoadMore = () => {
    if (!nextCursor) return;
    fetchMore({
      variables: { cursor: nextCursor, limit: 50 },
      updateQuery: (prev: any, { fetchMoreResult }: any) => {
        if (!fetchMoreResult) return prev;
        return {
          getAuditLogs: {
            ...fetchMoreResult.getAuditLogs,
            items: [...(prev.getAuditLogs?.items || []), ...fetchMoreResult.getAuditLogs.items],
          },
        };
      },
    });
  };

  return (
    <AuditLogContent
      allLogs={allLogs}
      users={users}
      selectedActions={selectedActions}
      setSelectedActions={setSelectedActions}
      dateFrom={dateFrom}
      setDateFrom={setDateFrom}
      dateTo={dateTo}
      setDateTo={setDateTo}
      nextCursor={nextCursor}
      onLoadMore={handleLoadMore}
    />
  );
}

function AuditLogContent({ allLogs, users, selectedActions, setSelectedActions, dateFrom, setDateFrom, dateTo, setDateTo, nextCursor, onLoadMore }: {
  allLogs: any[];
  users: any[];
  selectedActions: ActionType[];
  setSelectedActions: (a: ActionType[]) => void;
  dateFrom: string;
  setDateFrom: (d: string) => void;
  dateTo: string;
  setDateTo: (d: string) => void;
  nextCursor: string | null | undefined;
  onLoadMore: () => void;
}) {
  // Build user lookup map
  const userMap = useMemo(() => {
    const map: Record<string, string> = {};
    users.forEach((u: any) => { map[u.id] = u.fullName || u.email || u.id; });
    return map;
  }, [users]);

  const resolveUser = (userId: string | null) => {
    if (!userId) return 'System';
    return userMap[userId] || userId.slice(0, 8) + '...';
  };

  // Filter and sort logs
  const filteredLogs = useMemo(() => {
    let logs = [...allLogs];

    // Filter by action type (if any selected; empty = all)
    if (selectedActions.length > 0) {
      logs = logs.filter(log => selectedActions.includes(log.actionType));
    }

    // Filter by date range
    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      logs = logs.filter(log => new Date(log.timestamp).getTime() >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime() + 86400000; // include end day
      logs = logs.filter(log => new Date(log.timestamp).getTime() <= to);
    }

    // Sort descending by timestamp (most recent first)
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return logs;
  }, [allLogs, selectedActions, dateFrom, dateTo]);

  // CSV Export
  const handleExport = () => {
    const headers = ['Action Type', 'Performing User', 'Target User', 'Timestamp', 'Old Value', 'New Value'];
    const rows = filteredLogs.map(log => [
      log.actionType,
      resolveUser(log.userId),
      resolveUser(log.targetUserId),
      new Date(log.timestamp).toLocaleString(),
      log.oldValue || '',
      log.newValue || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const toggleActionFilter = (action: ActionType) => {
    if (selectedActions.includes(action)) {
      setSelectedActions(selectedActions.filter(a => a !== action));
    } else {
      setSelectedActions([...selectedActions, action]);
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'INVITE': case 'USER_REGISTERED': return '#6366f1';
      case 'DROP': case 'ACCOUNT_LOCK': return '#ef4444';
      case 'ROLE_UPDATE': case 'STATUS_UPDATE': case 'USER_UPDATED': return '#f59e0b';
      case 'ENABLE_2FA': case 'DISABLE_2FA': return '#10b981';
      case 'LOGIN': return '#22c55e';
      case 'PROJECT_CREATE': case 'PROJECT_UPDATE': return '#0ea5e9';
      case 'TASK_CREATE': case 'TASK_STATUS_UPDATE': return '#8b5cf6';
      default: return '#94a3b8';
    }
  };

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>Date From</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>Date To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inputStyle} />
        </div>
        <button onClick={handleExport} style={{ padding: '8px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
          Export CSV
        </button>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontWeight: 600, marginLeft: 'auto' }}>
          {filteredLogs.length} entries
        </span>
      </div>

      {/* Action Type Filter Chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {ACTION_TYPES.map(action => {
          const active = selectedActions.includes(action);
          return (
            <button
              key={action}
              onClick={() => toggleActionFilter(action)}
              style={{
                padding: '3px 10px', borderRadius: 12, fontSize: '0.65rem', fontWeight: 600,
                border: active ? `1px solid ${getActionColor(action)}` : '1px solid var(--border)',
                background: active ? `${getActionColor(action)}15` : 'var(--bg-elevated)',
                color: active ? getActionColor(action) : 'var(--text-tertiary)',
                cursor: 'pointer',
              }}
            >
              {action.replace(/_/g, ' ')}
            </button>
          );
        })}
        {selectedActions.length > 0 && (
          <button
            onClick={() => setSelectedActions([])}
            style={{ padding: '3px 10px', borderRadius: 12, fontSize: '0.65rem', fontWeight: 600, border: 'none', background: 'none', color: 'var(--accent)', cursor: 'pointer' }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Logs Table */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)' }}>
                <th style={thStyle}>Timestamp</th>
                <th style={thStyle}>Action</th>
                <th style={thStyle}>Performed By</th>
                <th style={thStyle}>Target</th>
                <th style={thStyle}>Changes</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                    No audit log entries match the current filters.
                  </td>
                </tr>
              )}
              {filteredLogs.map((log: any) => (
                <tr key={log.auditId} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={tdStyle}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 5,
                      fontSize: '0.65rem', fontWeight: 700,
                      background: `${getActionColor(log.actionType)}15`,
                      color: getActionColor(log.actionType),
                      border: `1px solid ${getActionColor(log.actionType)}30`,
                    }}>
                      {log.actionType}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{resolveUser(log.userId)}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ color: 'var(--text-secondary)' }}>{resolveUser(log.targetUserId)}</span>
                  </td>
                  <td style={tdStyle}>
                    {(log.oldValue || log.newValue) ? (
                      <div style={{ fontSize: '0.72rem', fontFamily: 'monospace' }}>
                        {log.oldValue && <div style={{ color: 'var(--text-tertiary)' }}>from: {log.oldValue}</div>}
                        {log.newValue && <div style={{ color: 'var(--text-primary)' }}>to: {log.newValue}</div>}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {nextCursor && (
          <div style={{ padding: '16px', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
            <button onClick={onLoadMore} style={{ padding: '8px 24px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
              Load More
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderBottom: '1px solid var(--border)',
  color: 'var(--text-tertiary)',
  fontSize: '0.68rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 14px',
  verticalAlign: 'top',
};

const inputStyle: React.CSSProperties = {
  padding: '7px 10px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text-primary)',
  fontSize: '0.78rem',
};
