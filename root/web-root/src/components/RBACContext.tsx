import React, { createContext, useContext, useMemo, useState } from 'react';
import { UserCategory, FunctionalRole, ProjectRole, hasCapability } from '@project-tracker/shared-types';

interface RBACContextType {
  category: UserCategory | null;
  role: FunctionalRole | null;
  projectRole: ProjectRole | null;
  hierarchyLevel: number;
  setProjectRole: (pRole: ProjectRole | null) => void;
  
  // Executive & Management
  canAccessExecutiveDashboard: boolean;
  canAccessDeptDashboard: boolean;
  canAccessTeamDashboard: boolean;
  canManageFullOrg: boolean;
  canManageDept: boolean;
  canManageTeam: boolean;
  
  // Data Access
  canViewSalary: boolean;
  canViewAllOrgData: boolean;
  
  // Project Specific
  canManageProjectTeam: boolean;
  canUpdateProjectDashboard: boolean;
}

const RBACContext = createContext<RBACContextType>({
  category: null,
  role: null,
  projectRole: null,
  hierarchyLevel: 7,
  setProjectRole: () => {},
  canAccessExecutiveDashboard: false,
  canAccessDeptDashboard: false,
  canAccessTeamDashboard: false,
  canManageFullOrg: false,
  canManageDept: false,
  canManageTeam: false,
  canViewSalary: false,
  canViewAllOrgData: false,
  canManageProjectTeam: false,
  canUpdateProjectDashboard: false,
});

export const usePermissions = () => useContext(RBACContext);

interface RBACProviderProps {
  user: any; // User object from Apollo me query
  children: React.ReactNode;
}

export const RBACProvider: React.FC<RBACProviderProps> = ({ user, children }) => {
  const [projectRole, setProjectRole] = useState<ProjectRole | null>(null);

  const category = useMemo(() => user?.category as UserCategory || UserCategory.JUNIOR_IC, [user]);
  const role = useMemo(() => user?.role as FunctionalRole || FunctionalRole.FRONTEND_DEV, [user]);
  const hierarchyLevel = useMemo(() => user?.hierarchyLevel || 7, [user]);

  const value = useMemo(() => ({
    category,
    role,
    projectRole,
    hierarchyLevel,
    setProjectRole,
    
    // Hierarchy-based Capabilities
    canAccessExecutiveDashboard: hierarchyLevel <= 2,
    canAccessDeptDashboard: hierarchyLevel <= 3,
    canAccessTeamDashboard: hierarchyLevel <= 5,
    
    canManageFullOrg: hasCapability('manage:full_org', category, role),
    canManageDept: hasCapability('manage:dept', category, role),
    canManageTeam: hasCapability('manage:team', category, role),

    canViewSalary: hasCapability('view:salary_reports', category, role) || hierarchyLevel <= 2,
    canViewAllOrgData: hierarchyLevel <= 3,

    // Project Specific Capabilities
    canManageProjectTeam: hasCapability('manage:project_team', category, role, projectRole),
    canUpdateProjectDashboard: hasCapability('update:project_dashboard', category, role, projectRole),
  }), [category, role, projectRole, hierarchyLevel]);

  return (
    <RBACContext.Provider value={value}>
      {children}
    </RBACContext.Provider>
  );
};
