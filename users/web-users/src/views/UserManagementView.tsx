import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import {
  GET_ME,
  GET_ALL_USERS,
  GET_MY_TEAM_MEMBERS,
  GET_DEPARTMENT_EMPLOYEES,
  RESEND_INVITATION,
  REQUEST_SECURITY_OTP,
  DROP_USER,
} from '../api/queries';
import { User, ViewMetrics } from '../types';
import { getDashboardConfig, getRoleDisplayName, getDepartmentIcon } from '../utils/roleConfig';
import { DashboardMetrics } from '../components/DashboardMetrics';
import { UsersTable } from '../components/UsersTable';
import { InvitationWizard } from '../components/InvitationWizard';
import { AuditLogViewer } from '../components/AuditLogViewer';

export function UserManagementView() {
  const [activeView, setActiveView] = useState<'org' | 'department' | 'team' | 'audit'>('org');
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Fetch current user
  const { data: meData, loading: meLoading } = useQuery(GET_ME);
  const currentUser = meData?.me;

  // Determine dashboard config
  const dashboardConfig = useMemo(() => {
    if (!currentUser) return null;
    return getDashboardConfig(
      currentUser.role,
      currentUser.category,
      currentUser.department,
      currentUser.hierarchyLevel
    );
  }, [currentUser]);

  // Fetch users based on view scope
  const { data: orgData, loading: orgLoading, refetch: refetchOrg } = useQuery(GET_ALL_USERS, {
    skip: !dashboardConfig?.canViewOrgWide,
  });

  const { data: deptData, loading: deptLoading, refetch: refetchDept } = useQuery(GET_DEPARTMENT_EMPLOYEES, {
    skip: !dashboardConfig?.canViewDepartmentWide,
    variables: { department: currentUser?.department },
  });

  const { data: teamData, loading: teamLoading, refetch: refetchTeam } = useQuery(GET_MY_TEAM_MEMBERS, {
    skip: !dashboardConfig?.canViewDirectReports,
  });

  // Mutations
  const [resendInvitation] = useMutation(RESEND_INVITATION);
  const [requestOTP] = useMutation(REQUEST_SECURITY_OTP);
  const [dropUser] = useMutation(DROP_USER);

  // Determine which users to display
  const displayUsers: User[] = useMemo(() => {
    if (activeView === 'org' && dashboardConfig?.canViewOrgWide) {
      return orgData?.getAllUsers || [];
    }
    if (activeView === 'department' && dashboardConfig?.canViewDepartmentWide) {
      return deptData?.getDepartmentEmployees || [];
    }
    if (activeView === 'team' && dashboardConfig?.canViewDirectReports) {
      return teamData?.getMyTeamMembers || [];
    }
    return [];
  }, [activeView, orgData, deptData, teamData, dashboardConfig]);

  // Calculate metrics
  const metrics: ViewMetrics = useMemo(() => {
    const totalUsers = displayUsers.length;
    const activeUsers = displayUsers.filter((u) => u.status === 'ACTIVE').length;
    const pendingUsers = displayUsers.filter((u) => u.status === 'PENDING_VERIFICATION' || u.status === 'ONBOARDING').length;
    const suspendedUsers = displayUsers.filter((u) => u.status === 'SUSPENDED').length;
    const twoFactorAdoption = displayUsers.filter((u) => u.twoFactorEnabled).length;
    const directReports = currentUser?.directReportCount;
    const departmentSize = activeView === 'department' ? displayUsers.length : undefined;

    return {
      totalUsers,
      activeUsers,
      pendingUsers,
      suspendedUsers,
      twoFactorAdoption,
      directReports,
      departmentSize,
    };
  }, [displayUsers, currentUser, activeView]);

  // Handlers
  const handleResendInvite = async (userId: string) => {
    try {
      await resendInvitation({ variables: { userId } });
      alert('Invitation resent successfully!');
      if (activeView === 'org') refetchOrg();
      if (activeView === 'department') refetchDept();
      if (activeView === 'team') refetchTeam();
    } catch (err: any) {
      alert(`Failed to resend invitation: ${err.message}`);
    }
  };

  const handleDropUser = async (userId: string) => {
    try {
      // Request OTP first
      await requestOTP();
      const otp = prompt('Enter the security OTP sent to your email:');
      if (!otp) return;

      await dropUser({ variables: { userId, otp } });
      alert('User dropped successfully.');
      if (activeView === 'org') refetchOrg();
      if (activeView === 'department') refetchDept();
      if (activeView === 'team') refetchTeam();
    } catch (err: any) {
      alert(`Failed to drop user: ${err.message}`);
    }
  };

  const handleInviteUser = () => {
    setShowInviteModal(true);
  };

  const handleInviteSuccess = () => {
    // Refetch all data
    if (activeView === 'org') refetchOrg();
    if (activeView === 'department') refetchDept();
    if (activeView === 'team') refetchTeam();
  };

  // Loading state
  if (meLoading) {
    return (
      <div style={{ padding: '40px', fontFamily: 'sans-serif', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', color: '#6c757d' }}>Loading your dashboard...</div>
      </div>
    );
  }

  // Error state
  if (!currentUser || !dashboardConfig) {
    return (
      <div style={{ padding: '40px', fontFamily: 'sans-serif', color: '#721c24', backgroundColor: '#f8d7da', borderRadius: '8px', maxWidth: '800px', margin: '40px auto' }}>
        <h3>⚠️ Authentication Required</h3>
        <p>Please log in to access the dashboard.</p>
      </div>
    );
  }

  const loading = orgLoading || deptLoading || teamLoading;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa', fontFamily: 'sans-serif' }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'white',
        borderBottom: '2px solid #dee2e6',
        padding: '20px 40px',
        marginBottom: '30px',
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <div>
              <h1 style={{ margin: '0 0 5px 0', fontSize: '28px', color: '#212529' }}>
                {getDepartmentIcon(currentUser.department)} Team Management Dashboard
              </h1>
              <p style={{ margin: 0, color: '#6c757d', fontSize: '14px' }}>
                Logged in as: <strong>{currentUser.fullName}</strong> • {getRoleDisplayName(currentUser.role)}
              </p>
            </div>
            <div style={{
              backgroundColor: '#e2e3e5',
              padding: '8px 16px',
              borderRadius: '4px',
              fontSize: '14px',
              color: '#383d41',
              fontWeight: '600',
            }}>
              Level {currentUser.hierarchyLevel}
            </div>
          </div>

          {/* View Switcher */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {dashboardConfig.canViewOrgWide && (
              <button
                onClick={() => setActiveView('org')}
                style={{
                  backgroundColor: activeView === 'org' ? '#007bff' : '#e2e3e5',
                  color: activeView === 'org' ? 'white' : '#383d41',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                }}
              >
                🏢 Organization View
              </button>
            )}

            {dashboardConfig.canViewDepartmentWide && (
              <button
                onClick={() => setActiveView('department')}
                style={{
                  backgroundColor: activeView === 'department' ? '#007bff' : '#e2e3e5',
                  color: activeView === 'department' ? 'white' : '#383d41',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                }}
              >
                {getDepartmentIcon(currentUser.department)} {currentUser.department} Department
              </button>
            )}

            {dashboardConfig.canViewDirectReports && (
              <button
                onClick={() => setActiveView('team')}
                style={{
                  backgroundColor: activeView === 'team' ? '#007bff' : '#e2e3e5',
                  color: activeView === 'team' ? 'white' : '#383d41',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                }}
              >
                👥 My Team
              </button>
            )}

            {dashboardConfig.canViewAuditLogs && (
              <button
                onClick={() => setActiveView('audit')}
                style={{
                  backgroundColor: activeView === 'audit' ? '#007bff' : '#e2e3e5',
                  color: activeView === 'audit' ? 'white' : '#383d41',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                }}
              >
                📋 Audit Logs
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 40px 40px' }}>
        {activeView === 'audit' ? (
          /* Audit Log View */
          <>
            <h2 style={{ marginBottom: '20px' }}>📋 Audit Trail</h2>
            <AuditLogViewer />
          </>
        ) : (
          /* Users View */
          <>
            {/* Metrics */}
            <DashboardMetrics
              metrics={metrics}
              showDirectReports={dashboardConfig.canViewDirectReports}
              showDepartmentSize={activeView === 'department'}
            />

            {/* Users Table */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
                Loading users...
              </div>
            ) : (
              <UsersTable
                users={displayUsers}
                canPerformActions={dashboardConfig.canInviteUsers || dashboardConfig.canDropUsers}
                onInviteUser={dashboardConfig.canInviteUsers ? handleInviteUser : undefined}
                onDropUser={dashboardConfig.canDropUsers ? handleDropUser : undefined}
                onResendInvite={dashboardConfig.canInviteUsers ? handleResendInvite : undefined}
                onViewDetails={(userId) => alert(`View details for user ${userId} - Not yet implemented`)}
              />
            )}
          </>
        )}
      </div>

      {/* Invitation Wizard Modal */}
      {showInviteModal && currentUser && (
        <InvitationWizard
          onClose={() => setShowInviteModal(false)}
          onSuccess={handleInviteSuccess}
          currentUserId={currentUser.id}
        />
      )}
    </div>
  );
}
