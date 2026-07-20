import { FunctionalRole, UserCategory, Department, DashboardViewConfig } from '../types';

// ─── ROLE-BASED DASHBOARD CONFIGURATION ─────────────────────────────────────

/**
 * Returns dashboard configuration based on user's functional role and hierarchy level.
 * This determines what data the user can see and what actions they can perform.
 */
export function getDashboardConfig(
  role: FunctionalRole,
  category: UserCategory,
  department: Department,
  hierarchyLevel: number
): DashboardViewConfig {
  // ─── C-SUITE (Level 1) ─────────────────────────────────────────────────────
  if (hierarchyLevel === 1) {
    return {
      canViewOrgWide: true,
      canViewDepartmentWide: true,
      canViewCrossDepartment: true,
      canViewDirectReports: true,
      canInviteUsers: true,
      canDropUsers: true,
      canPromoteUsers: true,
      canSuspendUsers: true,
      canViewAuditLogs: true,
      canViewSalaryData: true,
      canManageTeams: true,
      defaultViewScope: 'org',
      restrictedDataTypes: [],
    };
  }

  // ─── SVP (Level 2) ─────────────────────────────────────────────────────────
  if (hierarchyLevel === 2) {
    return {
      canViewOrgWide: true,
      canViewDepartmentWide: true,
      canViewCrossDepartment: true,
      canViewDirectReports: true,
      canInviteUsers: true,
      canDropUsers: false,
      canPromoteUsers: true,
      canSuspendUsers: true,
      canViewAuditLogs: true,
      canViewSalaryData: role === FunctionalRole.SVP_OPERATIONS,
      canManageTeams: true,
      defaultViewScope: 'org',
      restrictedDataTypes: [],
    };
  }

  // ─── VP/DIRECTOR (Level 3) ─────────────────────────────────────────────────
  if (hierarchyLevel === 3) {
    const isHR = department === Department.HR;
    return {
      canViewOrgWide: isHR,
      canViewDepartmentWide: true,
      canViewCrossDepartment: isHR,
      canViewDirectReports: true,
      canInviteUsers: true,
      canDropUsers: isHR,
      canPromoteUsers: true,
      canSuspendUsers: isHR,
      canViewAuditLogs: isHR,
      canViewSalaryData: isHR,
      canManageTeams: true,
      defaultViewScope: isHR ? 'org' : 'department',
      restrictedDataTypes: isHR ? [] : ['salary', 'compensation'],
    };
  }

  // ─── SENIOR MANAGER/DIRECTOR (Level 4) ─────────────────────────────────────
  if (hierarchyLevel === 4) {
    const isHR = department === Department.HR;
    return {
      canViewOrgWide: false,
      canViewDepartmentWide: true,
      canViewCrossDepartment: isHR,
      canViewDirectReports: true,
      canInviteUsers: true,
      canDropUsers: false,
      canPromoteUsers: false,
      canSuspendUsers: false,
      canViewAuditLogs: isHR,
      canViewSalaryData: false,
      canManageTeams: true,
      defaultViewScope: 'department',
      restrictedDataTypes: ['salary', 'compensation'],
    };
  }

  // ─── MANAGER/TEAM LEAD (Level 5) ──────────────────────────────────────────
  if (hierarchyLevel === 5) {
    const isHR = department === Department.HR;
    return {
      canViewOrgWide: false,
      canViewDepartmentWide: isHR,
      canViewCrossDepartment: false,
      canViewDirectReports: true,
      canInviteUsers: isHR,
      canDropUsers: false,
      canPromoteUsers: false,
      canSuspendUsers: false,
      canViewAuditLogs: false,
      canViewSalaryData: false,
      canManageTeams: true,
      defaultViewScope: 'team',
      restrictedDataTypes: ['salary', 'compensation', 'audit'],
    };
  }

  // ─── SENIOR IC (Level 6) ───────────────────────────────────────────────────
  if (hierarchyLevel === 6) {
    const isHR = department === Department.HR || role === FunctionalRole.RECRUITER;
    return {
      canViewOrgWide: false,
      canViewDepartmentWide: false,
      canViewCrossDepartment: false,
      canViewDirectReports: false,
      canInviteUsers: false,
      canDropUsers: false,
      canPromoteUsers: false,
      canSuspendUsers: false,
      canViewAuditLogs: false,
      canViewSalaryData: false,
      canManageTeams: false,
      defaultViewScope: 'self',
      restrictedDataTypes: ['salary', 'compensation', 'audit', 'team'],
    };
  }

  // ─── JUNIOR IC (Level 7) ───────────────────────────────────────────────────
  return {
    canViewOrgWide: false,
    canViewDepartmentWide: false,
    canViewCrossDepartment: false,
    canViewDirectReports: false,
    canInviteUsers: false,
    canDropUsers: false,
    canPromoteUsers: false,
    canSuspendUsers: false,
    canViewAuditLogs: false,
    canViewSalaryData: false,
    canManageTeams: false,
    defaultViewScope: 'self',
    restrictedDataTypes: ['salary', 'compensation', 'audit', 'team', 'department'],
  };
}

/**
 * Get display-friendly role name
 */
export function getRoleDisplayName(role: FunctionalRole): string {
  const roleMap: Record<FunctionalRole, string> = {
    // C-SUITE
    [FunctionalRole.CEO]: 'Chief Executive Officer',
    [FunctionalRole.CTO]: 'Chief Technology Officer',
    [FunctionalRole.CFO]: 'Chief Financial Officer',
    [FunctionalRole.COO]: 'Chief Operating Officer',
    [FunctionalRole.CHRO]: 'Chief Human Resources Officer',

    // SVP
    [FunctionalRole.SVP_ENGINEERING]: 'SVP Engineering',
    [FunctionalRole.SVP_PRODUCT]: 'SVP Product',
    [FunctionalRole.SVP_OPERATIONS]: 'SVP Operations',

    // VP/DIRECTOR
    [FunctionalRole.VP_BACKEND]: 'VP Backend Engineering',
    [FunctionalRole.VP_FRONTEND]: 'VP Frontend Engineering',
    [FunctionalRole.VP_MOBILE]: 'VP Mobile Engineering',
    [FunctionalRole.VP_DEVOPS]: 'VP DevOps',
    [FunctionalRole.VP_QA]: 'VP Quality Assurance',
    [FunctionalRole.VP_PRODUCT]: 'VP Product',
    [FunctionalRole.VP_DESIGN]: 'VP Design',
    [FunctionalRole.VP_DATA]: 'VP Data',
    [FunctionalRole.VP_HR]: 'VP Human Resources',
    [FunctionalRole.VP_SALES]: 'VP Sales',

    // SENIOR MANAGER
    [FunctionalRole.SENIOR_ENGINEERING_MANAGER]: 'Senior Engineering Manager',
    [FunctionalRole.SENIOR_PRODUCT_DIRECTOR]: 'Senior Product Director',
    [FunctionalRole.SENIOR_QA_DIRECTOR]: 'Senior QA Director',
    [FunctionalRole.SENIOR_DATA_DIRECTOR]: 'Senior Data Director',

    // TEAM LEAD/MANAGER
    [FunctionalRole.BACKEND_TEAM_MANAGER]: 'Backend Team Manager',
    [FunctionalRole.FRONTEND_TEAM_MANAGER]: 'Frontend Team Manager',
    [FunctionalRole.MOBILE_TEAM_MANAGER]: 'Mobile Team Manager',
    [FunctionalRole.DEVOPS_TEAM_MANAGER]: 'DevOps Team Manager',
    [FunctionalRole.QA_TEAM_MANAGER]: 'QA Team Manager',
    [FunctionalRole.PRODUCT_TEAM_MANAGER]: 'Product Team Manager',
    [FunctionalRole.DESIGN_TEAM_MANAGER]: 'Design Team Manager',
    [FunctionalRole.DATA_TEAM_MANAGER]: 'Data Team Manager',
    [FunctionalRole.HR_TEAM_MANAGER]: 'HR Team Manager',
    [FunctionalRole.SALES_TEAM_MANAGER]: 'Sales Team Manager',

    // SENIOR IC
    [FunctionalRole.SENIOR_BACKEND_DEV]: 'Senior Backend Developer',
    [FunctionalRole.SENIOR_FRONTEND_DEV]: 'Senior Frontend Developer',
    [FunctionalRole.SENIOR_MOBILE_DEV]: 'Senior Mobile Developer',
    [FunctionalRole.SENIOR_DEVOPS_ENG]: 'Senior DevOps Engineer',
    [FunctionalRole.SENIOR_QA_ENG]: 'Senior QA Engineer',
    [FunctionalRole.SENIOR_DATA_ENG]: 'Senior Data Engineer',
    [FunctionalRole.SENIOR_DATA_SCIENTIST]: 'Senior Data Scientist',
    [FunctionalRole.SENIOR_DESIGNER]: 'Senior Designer',
    [FunctionalRole.SENIOR_PRODUCT_MANAGER]: 'Senior Product Manager',
    [FunctionalRole.SENIOR_HR_SPECIALIST]: 'Senior HR Specialist',
    [FunctionalRole.RECRUITER]: 'Recruiter',
    [FunctionalRole.SENIOR_SALES_EXECUTIVE]: 'Senior Sales Executive',

    // JUNIOR IC
    [FunctionalRole.BACKEND_DEV]: 'Backend Developer',
    [FunctionalRole.FRONTEND_DEV]: 'Frontend Developer',
    [FunctionalRole.MOBILE_DEV]: 'Mobile Developer',
    [FunctionalRole.DEVOPS_ENG]: 'DevOps Engineer',
    [FunctionalRole.QA_ENG]: 'QA Engineer',
    [FunctionalRole.DATA_ANALYST]: 'Data Analyst',
    [FunctionalRole.DATA_ENG]: 'Data Engineer',
    [FunctionalRole.DESIGNER]: 'Designer',
    [FunctionalRole.PRODUCT_ASSOCIATE]: 'Product Associate',
    [FunctionalRole.HR_COORDINATOR]: 'HR Coordinator',
    [FunctionalRole.SALES_REP]: 'Sales Representative',
    [FunctionalRole.INTERN]: 'Intern',

    // Legacy
    [FunctionalRole.MANAGER]: 'Manager',
    [FunctionalRole.TEAM_LEADER]: 'Team Leader',
  };

  return roleMap[role] || role;
}

/**
 * Get color scheme for status badges
 */
export function getStatusColor(status: string): { bg: string; text: string } {
  const colorMap: Record<string, { bg: string; text: string }> = {
    ACTIVE: { bg: '#d4edda', text: '#155724' },
    PENDING_VERIFICATION: { bg: '#fff3cd', text: '#856404' },
    ONBOARDING: { bg: '#cce5ff', text: '#004085' },
    INACTIVE: { bg: '#f8d7da', text: '#721c24' },
    SUSPENDED: { bg: '#f5c6cb', text: '#721c24' },
  };

  return colorMap[status] || { bg: '#e2e3e5', text: '#383d41' };
}

/**
 * Get color scheme for hierarchy level badges
 */
export function getHierarchyColor(level: number): { bg: string; text: string } {
  const colorMap: Record<number, { bg: string; text: string }> = {
    1: { bg: '#d4af37', text: '#000000' }, // Gold for C-Suite
    2: { bg: '#c0c0c0', text: '#000000' }, // Silver for SVP
    3: { bg: '#cd7f32', text: '#ffffff' }, // Bronze for VP
    4: { bg: '#6c757d', text: '#ffffff' }, // Gray for Senior Manager
    5: { bg: '#007bff', text: '#ffffff' }, // Blue for Manager
    6: { bg: '#28a745', text: '#ffffff' }, // Green for Senior IC
    7: { bg: '#17a2b8', text: '#ffffff' }, // Teal for Junior IC
  };

  return colorMap[level] || { bg: '#6c757d', text: '#ffffff' };
}

/**
 * Get department-specific icon
 */
export function getDepartmentIcon(department: Department): string {
  const iconMap: Record<Department, string> = {
    [Department.BACKEND]: '⚙️',
    [Department.FRONTEND]: '🎨',
    [Department.MOBILE]: '📱',
    [Department.DEVOPS]: '🚀',
    [Department.QA]: '🧪',
    [Department.PRODUCT]: '📊',
    [Department.DESIGN]: '🎭',
    [Department.DATA]: '📈',
    [Department.HR]: '👥',
    [Department.SALES]: '💼',
    [Department.EXECUTIVE]: '🏢',
  };

  return iconMap[department] || '📋';
}
