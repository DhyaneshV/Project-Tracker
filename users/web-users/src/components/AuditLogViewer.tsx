import React, { useState, useMemo } from 'react';
import { useQuery } from '@apollo/client';
import { GET_AUDIT_LOGS } from '../api/queries';
import { AuditLog, ActionType } from '../types';

export function AuditLogViewer() {
  const { data, loading, error } = useQuery(GET_AUDIT_LOGS);
  const [actionFilter, setActionFilter] = useState<ActionType | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const auditLogs: AuditLog[] = data?.getAuditLogs || [];

  const filteredLogs = useMemo(() => {
    let result = [...auditLogs];

    // Action type filter
    if (actionFilter !== 'ALL') {
      result = result.filter((log) => log.actionType === actionFilter);
    }

    // Search filter (userId, targetUserId, or values)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (log) =>
          log.userId.toLowerCase().includes(term) ||
          log.targetUserId?.toLowerCase().includes(term) ||
          log.oldValue?.toLowerCase().includes(term) ||
          log.newValue?.toLowerCase().includes(term)
      );
    }

    // Sort by timestamp descending (newest first)
    result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return result;
  }, [auditLogs, actionFilter, searchTerm]);

  const getActionIcon = (actionType: ActionType): string => {
    const iconMap: Record<ActionType, string> = {
      [ActionType.INVITE]: '📧',
      [ActionType.DROP]: '🗑️',
      [ActionType.ROLE_UPDATE]: '🔄',
      [ActionType.STATUS_UPDATE]: '⚡',
      [ActionType.ENABLE_2FA]: '🔐',
      [ActionType.DISABLE_2FA]: '🔓',
      [ActionType.LOGIN]: '🔑',
      [ActionType.ACCOUNT_LOCK]: '🔒',
      [ActionType.RESEND_INVITE]: '📬',
    };
    return iconMap[actionType] || '📋';
  };

  const getActionColor = (actionType: ActionType): { bg: string; text: string } => {
    const colorMap: Record<ActionType, { bg: string; text: string }> = {
      [ActionType.INVITE]: { bg: '#d4edda', text: '#155724' },
      [ActionType.DROP]: { bg: '#f8d7da', text: '#721c24' },
      [ActionType.ROLE_UPDATE]: { bg: '#cce5ff', text: '#004085' },
      [ActionType.STATUS_UPDATE]: { bg: '#fff3cd', text: '#856404' },
      [ActionType.ENABLE_2FA]: { bg: '#d1ecf1', text: '#0c5460' },
      [ActionType.DISABLE_2FA]: { bg: '#f5c6cb', text: '#721c24' },
      [ActionType.LOGIN]: { bg: '#e2e3e5', text: '#383d41' },
      [ActionType.ACCOUNT_LOCK]: { bg: '#f5c6cb', text: '#721c24' },
      [ActionType.RESEND_INVITE]: { bg: '#cce5ff', text: '#004085' },
    };
    return colorMap[actionType] || { bg: '#e2e3e5', text: '#383d41' };
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif', color: '#6c757d' }}>
        Loading audit logs...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '20px',
        backgroundColor: '#f8d7da',
        color: '#721c24',
        borderRadius: '8px',
        border: '1px solid #f5c6cb',
        fontFamily: 'sans-serif',
      }}>
        <strong>Error loading audit logs:</strong> {error.message}
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'sans-serif' }}>
      {/* Filters */}
      <div style={{
        backgroundColor: '#f8f9fa',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '20px',
        border: '1px solid #dee2e6',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
          {/* Search */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', marginBottom: '5px', fontWeight: '500' }}>
              🔍 Search
            </label>
            <input
              type="text"
              placeholder="User ID, target ID, or values..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '14px',
              }}
            />
          </div>

          {/* Action Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', marginBottom: '5px', fontWeight: '500' }}>
              Action Type
            </label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value as ActionType | 'ALL')}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '14px',
              }}
            >
              <option value="ALL">All Actions</option>
              {Object.values(ActionType).map((action) => (
                <option key={action} value={action}>
                  {getActionIcon(action)} {action.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Results Count */}
          <div style={{ display: 'flex', alignItems: 'flex-end', color: '#6c757d', fontSize: '14px' }}>
            Showing {filteredLogs.length} of {auditLogs.length} logs
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div style={{ overflowX: 'auto', border: '1px solid #dee2e6', borderRadius: '8px' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          backgroundColor: 'white',
        }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
              <th style={{ padding: '12px', textAlign: 'left' }}>Timestamp</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Action</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>User ID</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Target User</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Changes</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>IP Address</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#6c757d' }}>
                  No audit logs found matching your filters.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                const actionColors = getActionColor(log.actionType);

                return (
                  <tr key={log.auditId} style={{ borderBottom: '1px solid #dee2e6' }}>
                    <td style={{ padding: '12px', fontSize: '13px', color: '#6c757d', whiteSpace: 'nowrap' }}>
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        backgroundColor: actionColors.bg,
                        color: actionColors.text,
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '500',
                        whiteSpace: 'nowrap',
                      }}>
                        {getActionIcon(log.actionType)} {log.actionType.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', fontFamily: 'monospace', color: '#495057' }}>
                      {log.userId.substring(0, 8)}...
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', fontFamily: 'monospace', color: '#495057' }}>
                      {log.targetUserId ? `${log.targetUserId.substring(0, 8)}...` : '—'}
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px' }}>
                      {log.oldValue && (
                        <div style={{ marginBottom: '4px' }}>
                          <span style={{ color: '#6c757d', fontSize: '11px' }}>Old:</span>{' '}
                          <code style={{ backgroundColor: '#f8f9fa', padding: '2px 4px', borderRadius: '3px' }}>
                            {log.oldValue.length > 50 ? `${log.oldValue.substring(0, 50)}...` : log.oldValue}
                          </code>
                        </div>
                      )}
                      {log.newValue && (
                        <div>
                          <span style={{ color: '#6c757d', fontSize: '11px' }}>New:</span>{' '}
                          <code style={{ backgroundColor: '#f8f9fa', padding: '2px 4px', borderRadius: '3px' }}>
                            {log.newValue.length > 50 ? `${log.newValue.substring(0, 50)}...` : log.newValue}
                          </code>
                        </div>
                      )}
                      {!log.oldValue && !log.newValue && '—'}
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', color: '#6c757d', fontFamily: 'monospace' }}>
                      {log.ipAddress || '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Export Option */}
      <div style={{ marginTop: '20px', textAlign: 'right' }}>
        <button
          onClick={() => {
            const csv = [
              ['Timestamp', 'Action', 'User ID', 'Target User', 'Old Value', 'New Value', 'IP Address'],
              ...filteredLogs.map((log) => [
                log.timestamp,
                log.actionType,
                log.userId,
                log.targetUserId || '',
                log.oldValue || '',
                log.newValue || '',
                log.ipAddress || '',
              ]),
            ]
              .map((row) => row.map((cell) => `"${cell}"`).join(','))
              .join('\n');

            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `audit-logs-${new Date().toISOString()}.csv`;
            a.click();
          }}
          disabled={filteredLogs.length === 0}
          style={{
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '4px',
            cursor: filteredLogs.length > 0 ? 'pointer' : 'not-allowed',
            fontSize: '14px',
            opacity: filteredLogs.length > 0 ? 1 : 0.6,
          }}
        >
          📥 Export to CSV
        </button>
      </div>
    </div>
  );
}
