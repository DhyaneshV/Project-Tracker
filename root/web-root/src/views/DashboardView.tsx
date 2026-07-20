import React from 'react';
import { AdminDashboard } from './AdminDashboard';
import { TeamManagementDashboard } from './TeamManagementDashboard';
import { EmployeeDashboard } from './EmployeeDashboard';

interface Props {
  user: any;
  onLogout: () => void;
  token: string;
}

/**
 * DashboardView - Backward-compatible wrapper.
 * Routes to the correct hierarchy-specific dashboard.
 * 
 * @deprecated Import AdminDashboard, TeamManagementDashboard, or EmployeeDashboard directly.
 */
export function DashboardView({ user, onLogout, token }: Props) {
  const hierarchyLevel = user?.hierarchyLevel || 7;

  if (hierarchyLevel <= 3) {
    return <AdminDashboard user={user} onLogout={onLogout} token={token} />;
  }

  if (hierarchyLevel <= 5) {
    return <TeamManagementDashboard user={user} onLogout={onLogout} token={token} />;
  }

  return <EmployeeDashboard user={user} onLogout={onLogout} token={token} />;
}
