// ─── SHARED TYPES ────────────────────────────────────────────────────────────

export enum OrgRole {
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

export enum UserCategory {
  C_SUITE = 'C_SUITE',
  SVP = 'SVP',
  VP = 'VP',
  SENIOR_MANAGER = 'SENIOR_MANAGER',
  MANAGER = 'MANAGER',
  TEAM_LEAD = 'TEAM_LEAD',
  SENIOR_IC = 'SENIOR_IC',
  JUNIOR_IC = 'JUNIOR_IC',
}

export enum FunctionalRole {
  // LEVEL 1: C-SUITE
  CEO = 'CEO',
  CTO = 'CTO',
  CFO = 'CFO',
  COO = 'COO',
  CHRO = 'CHRO',

  // LEVEL 2: SVP
  SVP_ENGINEERING = 'SVP_ENGINEERING',
  SVP_PRODUCT = 'SVP_PRODUCT',
  SVP_OPERATIONS = 'SVP_OPERATIONS',

  // LEVEL 3: VP/DIRECTOR
  VP_BACKEND = 'VP_BACKEND',
  VP_FRONTEND = 'VP_FRONTEND',
  VP_MOBILE = 'VP_MOBILE',
  VP_DEVOPS = 'VP_DEVOPS',
  VP_QA = 'VP_QA',
  VP_PRODUCT = 'VP_PRODUCT',
  VP_DESIGN = 'VP_DESIGN',
  VP_DATA = 'VP_DATA',
  VP_HR = 'VP_HR',
  VP_SALES = 'VP_SALES',

  // LEVEL 4: SENIOR MANAGER/DIRECTOR
  SENIOR_ENGINEERING_MANAGER = 'SENIOR_ENGINEERING_MANAGER',
  SENIOR_PRODUCT_DIRECTOR = 'SENIOR_PRODUCT_DIRECTOR',
  SENIOR_QA_DIRECTOR = 'SENIOR_QA_DIRECTOR',
  SENIOR_DATA_DIRECTOR = 'SENIOR_DATA_DIRECTOR',

  // LEVEL 5: MANAGER/TEAM LEAD
  BACKEND_TEAM_MANAGER = 'BACKEND_TEAM_MANAGER',
  FRONTEND_TEAM_MANAGER = 'FRONTEND_TEAM_MANAGER',
  MOBILE_TEAM_MANAGER = 'MOBILE_TEAM_MANAGER',
  DEVOPS_TEAM_MANAGER = 'DEVOPS_TEAM_MANAGER',
  QA_TEAM_MANAGER = 'QA_TEAM_MANAGER',
  PRODUCT_TEAM_MANAGER = 'PRODUCT_TEAM_MANAGER',
  DESIGN_TEAM_MANAGER = 'DESIGN_TEAM_MANAGER',
  DATA_TEAM_MANAGER = 'DATA_TEAM_MANAGER',
  HR_TEAM_MANAGER = 'HR_TEAM_MANAGER',
  SALES_TEAM_MANAGER = 'SALES_TEAM_MANAGER',

  // LEVEL 6: SENIOR IC
  SENIOR_BACKEND_DEV = 'SENIOR_BACKEND_DEV',
  SENIOR_FRONTEND_DEV = 'SENIOR_FRONTEND_DEV',
  SENIOR_MOBILE_DEV = 'SENIOR_MOBILE_DEV',
  SENIOR_DEVOPS_ENG = 'SENIOR_DEVOPS_ENG',
  SENIOR_QA_ENG = 'SENIOR_QA_ENG',
  SENIOR_DATA_ENG = 'SENIOR_DATA_ENG',
  SENIOR_DATA_SCIENTIST = 'SENIOR_DATA_SCIENTIST',
  SENIOR_DESIGNER = 'SENIOR_DESIGNER',
  SENIOR_PRODUCT_MANAGER = 'SENIOR_PRODUCT_MANAGER',
  SENIOR_HR_SPECIALIST = 'SENIOR_HR_SPECIALIST',
  RECRUITER = 'RECRUITER',
  SENIOR_SALES_EXECUTIVE = 'SENIOR_SALES_EXECUTIVE',

  // LEVEL 7: JUNIOR IC
  BACKEND_DEV = 'BACKEND_DEV',
  FRONTEND_DEV = 'FRONTEND_DEV',
  MOBILE_DEV = 'MOBILE_DEV',
  DEVOPS_ENG = 'DEVOPS_ENG',
  QA_ENG = 'QA_ENG',
  DATA_ANALYST = 'DATA_ANALYST',
  DATA_ENG = 'DATA_ENG',
  DESIGNER = 'DESIGNER',
  PRODUCT_ASSOCIATE = 'PRODUCT_ASSOCIATE',
  HR_COORDINATOR = 'HR_COORDINATOR',
  SALES_REP = 'SALES_REP',
  INTERN = 'INTERN',

  // Legacy
  MANAGER = 'MANAGER',
  TEAM_LEADER = 'TEAM_LEADER',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  ONBOARDING = 'ONBOARDING',
}

export enum Department {
  BACKEND = 'BACKEND',
  FRONTEND = 'FRONTEND',
  MOBILE = 'MOBILE',
  DEVOPS = 'DEVOPS',
  QA = 'QA',
  PRODUCT = 'PRODUCT',
  DESIGN = 'DESIGN',
  DATA = 'DATA',
  HR = 'HR',
  SALES = 'SALES',
  EXECUTIVE = 'EXECUTIVE',
}

export enum TwoFactorMethod {
  EMAIL_OTP = 'EMAIL_OTP',
  TOTP = 'TOTP',
  NONE = 'NONE',
}

export enum ActionType {
  INVITE = 'INVITE',
  DROP = 'DROP',
  ROLE_UPDATE = 'ROLE_UPDATE',
  STATUS_UPDATE = 'STATUS_UPDATE',
  ENABLE_2FA = 'ENABLE_2FA',
  DISABLE_2FA = 'DISABLE_2FA',
  LOGIN = 'LOGIN',
  ACCOUNT_LOCK = 'ACCOUNT_LOCK',
  RESEND_INVITE = 'RESEND_INVITE',
}

// ─── USER TYPES ──────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  fullName: string;
  orgRole: OrgRole;
  category: UserCategory;
  role: FunctionalRole;
  department: Department;
  status: UserStatus;
  hierarchyLevel: number;
  directReportCount: number;
  reportingManagerId?: string;
  managedTeams?: string[];
  managedEmployees?: string[];
  twoFactorEnabled: boolean;
  twoFactorMethod: TwoFactorMethod;
  lastLoginAt?: string;
  createdAt: string;
}

export interface AuditLog {
  auditId: string;
  userId: string;
  actionType: ActionType;
  targetUserId?: string;
  oldValue?: string;
  newValue?: string;
  ipAddress?: string;
  timestamp: string;
}

// ─── DASHBOARD VIEW CONFIG ───────────────────────────────────────────────────

export interface DashboardViewConfig {
  canViewOrgWide: boolean;
  canViewDepartmentWide: boolean;
  canViewCrossDepartment: boolean;
  canViewDirectReports: boolean;
  canInviteUsers: boolean;
  canDropUsers: boolean;
  canPromoteUsers: boolean;
  canSuspendUsers: boolean;
  canViewAuditLogs: boolean;
  canViewSalaryData: boolean;
  canManageTeams: boolean;
  defaultViewScope: 'org' | 'department' | 'team' | 'self';
  restrictedDataTypes: string[];
}

export interface ViewMetrics {
  totalUsers: number;
  activeUsers: number;
  pendingUsers: number;
  suspendedUsers: number;
  twoFactorAdoption: number;
  directReports?: number;
  departmentSize?: number;
}
