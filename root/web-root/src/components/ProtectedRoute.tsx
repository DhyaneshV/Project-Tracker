import React from 'react';
import { usePermissions } from './RBACContext';

interface ProtectedRouteProps {
  requiredCapability?: 'canAccessExecutiveDashboard' | 'canAccessDeptDashboard' | 'canAccessTeamDashboard' | 'canManageFullOrg' | 'canManageDept' | 'canManageTeam' | 'canViewSalary' | 'canViewAllOrgData' | 'canManageProjectTeam' | 'canUpdateProjectDashboard';
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  requiredCapability, 
  children, 
  fallback = null 
}) => {
  const permissions = usePermissions();
  
  if (!requiredCapability) {
      return <>{children}</>;
  }

  const isAuthorized = permissions[requiredCapability];

  if (!isAuthorized) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
