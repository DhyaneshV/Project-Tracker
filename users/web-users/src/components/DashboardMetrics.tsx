import React from 'react';
import { ViewMetrics } from '../types';

interface DashboardMetricsProps {
  metrics: ViewMetrics;
  showDirectReports?: boolean;
  showDepartmentSize?: boolean;
}

export function DashboardMetrics({ metrics, showDirectReports, showDepartmentSize }: DashboardMetricsProps) {
  const twoFactorPercentage = metrics.totalUsers > 0
    ? Math.round((metrics.twoFactorAdoption / metrics.totalUsers) * 100)
    : 0;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '20px',
      marginBottom: '30px',
    }}>
      {/* Total Users */}
      <div style={{
        backgroundColor: '#f8f9fa',
        padding: '20px',
        borderRadius: '8px',
        border: '1px solid #dee2e6',
      }}>
        <div style={{ fontSize: '14px', color: '#6c757d', marginBottom: '8px' }}>Total Members</div>
        <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#212529' }}>{metrics.totalUsers}</div>
      </div>

      {/* Active Users */}
      <div style={{
        backgroundColor: '#d4edda',
        padding: '20px',
        borderRadius: '8px',
        border: '1px solid #c3e6cb',
      }}>
        <div style={{ fontSize: '14px', color: '#155724', marginBottom: '8px' }}>✅ Active</div>
        <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#155724' }}>{metrics.activeUsers}</div>
      </div>

      {/* Pending Users */}
      <div style={{
        backgroundColor: '#fff3cd',
        padding: '20px',
        borderRadius: '8px',
        border: '1px solid #ffeaa7',
      }}>
        <div style={{ fontSize: '14px', color: '#856404', marginBottom: '8px' }}>⏳ Pending</div>
        <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#856404' }}>{metrics.pendingUsers}</div>
      </div>

      {/* Suspended Users */}
      {metrics.suspendedUsers > 0 && (
        <div style={{
          backgroundColor: '#f8d7da',
          padding: '20px',
          borderRadius: '8px',
          border: '1px solid #f5c6cb',
        }}>
          <div style={{ fontSize: '14px', color: '#721c24', marginBottom: '8px' }}>🛑 Suspended</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#721c24' }}>{metrics.suspendedUsers}</div>
        </div>
      )}

      {/* 2FA Adoption */}
      <div style={{
        backgroundColor: '#cce5ff',
        padding: '20px',
        borderRadius: '8px',
        border: '1px solid #b8daff',
      }}>
        <div style={{ fontSize: '14px', color: '#004085', marginBottom: '8px' }}>🔐 2FA Enabled</div>
        <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#004085' }}>
          {metrics.twoFactorAdoption} <span style={{ fontSize: '18px', color: '#6c757d' }}>({twoFactorPercentage}%)</span>
        </div>
      </div>

      {/* Direct Reports (for managers) */}
      {showDirectReports && metrics.directReports !== undefined && (
        <div style={{
          backgroundColor: '#e2e3e5',
          padding: '20px',
          borderRadius: '8px',
          border: '1px solid #d6d8db',
        }}>
          <div style={{ fontSize: '14px', color: '#383d41', marginBottom: '8px' }}>👤 Direct Reports</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#383d41' }}>{metrics.directReports}</div>
        </div>
      )}

      {/* Department Size (for dept heads) */}
      {showDepartmentSize && metrics.departmentSize !== undefined && (
        <div style={{
          backgroundColor: '#d1ecf1',
          padding: '20px',
          borderRadius: '8px',
          border: '1px solid #bee5eb',
        }}>
          <div style={{ fontSize: '14px', color: '#0c5460', marginBottom: '8px' }}>🏢 Department Size</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#0c5460' }}>{metrics.departmentSize}</div>
        </div>
      )}
    </div>
  );
}
