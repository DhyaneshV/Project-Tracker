export enum OrgRole {
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  OWNER = 'OWNER'
}

export enum UserCategory {
  C_SUITE = 'C_SUITE',
  SVP = 'SVP',
  VP = 'VP',
  SENIOR_MANAGER = 'SENIOR_MANAGER',
  MANAGER = 'MANAGER',
  TEAM_LEAD = 'TEAM_LEAD',
  SENIOR_IC = 'SENIOR_IC',
  JUNIOR_IC = 'JUNIOR_IC'
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

  // Legacy (Keeping for compatibility during migration if needed)
  TEAM_LEAD = 'TEAM_LEAD',
  TECH_LEAD = 'TECH_LEAD',

  // Legacy (Keeping for compatibility during migration if needed)
  MANAGER = 'MANAGER'
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  ONBOARDING = 'ONBOARDING'
}

export enum TwoFactorMethod {
  EMAIL_OTP = 'EMAIL_OTP',
  TOTP = 'TOTP',
  NONE = 'NONE'
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
  PROJECT_CREATE = 'PROJECT_CREATE',
  PROJECT_UPDATE = 'PROJECT_UPDATE',
  TASK_CREATE = 'TASK_CREATE',
  TASK_STATUS_UPDATE = 'TASK_STATUS_UPDATE',
  USER_REGISTERED = 'USER_REGISTERED',
  USER_UPDATED = 'USER_UPDATED'
}

export enum ProjectStatus {
  PLANNING = 'PLANNING',
  ACTIVE = 'ACTIVE',
  ON_HOLD = 'ON_HOLD',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED'
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
  EXECUTIVE = 'EXECUTIVE'
}

export enum ProjectCategory {
  INTERNAL = 'INTERNAL',
  CLIENT = 'CLIENT',
  PRODUCT = 'PRODUCT',
  MAINTENANCE = 'MAINTENANCE'
}

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  BLOCKED = 'BLOCKED',
  COMPLETED = 'COMPLETED',
  ON_HOLD = 'ON_HOLD'
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum UpdateType {
  MILESTONE_REACHED = 'MILESTONE_REACHED',
  STATUS_CHANGE = 'STATUS_CHANGE',
  BLOCKER_FOUND = 'BLOCKER_FOUND',
  RISK_ALERT = 'RISK_ALERT',
  TEAM_CHANGE = 'TEAM_CHANGE',
  DEADLINE_CHANGE = 'DEADLINE_CHANGE',
  COMPLETION_CHANGE = 'COMPLETION_CHANGE'
}

export enum Severity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL'
}

export interface User {
  id: string;
  userId: string;
  email: string;
  fullName: string;
  orgRole: OrgRole;
  category: UserCategory;
  role: FunctionalRole;
  department: Department;
  specialty?: MemberSpecialty; // What technical area this user works in
  status: UserStatus;
  organizationId: string;
  departmentId: string;
  teamId: string;
  subTeamId?: string;
  projectId?: string;
  
  // Project assignments
  assignedProjectIds?: string[]; // Projects this user is assigned to (TEAM_LEAD: their project, ENGINEER: all assigned)
  managedTeamIds?: string[];     // Direct report userIds (MANAGER only)
  
  // Hierarchy
  hierarchyLevel: number; // 1-7
  managedTeams?: string[]; // Array of Team IDs
  managedEmployees?: string[]; // Array of User IDs
  reportingManagerId?: string;
  directReportCount: number;

  // Security & 2FA
  twoFactorEnabled: boolean;
  twoFactorMethod: TwoFactorMethod;
  twoFactorSecret?: string; // Encrypted
  twoFactorVerified?: boolean; // For JWT claims
  
  // Credentials & Invitation
  credentialsExpiryDate: string; // ISO8601
  passwordHashedAt?: string;
  passwordExpiresAt?: string;
  invitationToken?: string;
  invitationTokenExpiresAt?: string;
  invitationAcceptedAt?: string;

  // Session & Security Status
  lastLoginAt?: string;
  loginAttempts: number;
  accountLockedUntil?: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  projectId: string;
  name: string;
  description: string;
  category: ProjectCategory;
  status: ProjectStatus;
  completionPercentage: number;
  
  // Timeline
  startDate: string;
  targetEndDate: string;
  releaseDate?: string;      // Planned release date
  estimatedDays?: number;
  
  // Budget & Scope
  budgetUSD?: number;
  maxTeamSize: number;
  currentTeamSize: number;
  specialtiesNeeded?: MemberSpecialty[]; // Required specialties for this project
  
  // Document
  srsDocumentUrl?: string;
  srsDocumentVersion?: number;
  
  // Team
  teamLeaderId: string;       // Primary TEAM_LEAD (projectLeadId)
  projectLeadId?: string;     // Alias for teamLeaderId
  viceTeamLeaderId?: string;
  managedByIds?: string[];    // MANAGERs who oversee this project
  
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export interface ProjectMember {
  projectId: string;
  userId: string;
  name?: string;
  projectRole: ProjectRole;
  specialty: MemberSpecialty;
  contribution: number;
  allocation: number;    // percentage 1-100
  startDate: string;     // ISO date
  joinedAt: string;
  status: 'ACTIVE' | 'ON_LEAVE' | 'REMOVED';
  
  // Stats
  tasksAssigned: number;
  tasksCompleted: number;
  tasksInProgress: number;
}

export interface ProjectTask {
  id: string;
  taskId: string;
  projectId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  specialty?: MemberSpecialty; // Which specialty can work on this task
  assignedTo?: string;
  component?: string;
  startDate?: string;
  dueDate?: string;
  completedAt?: string;
  blockerReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectUpdate {
  updateId: string;
  projectId: string;
  type: UpdateType;
  title: string;
  description: string;
  severity: Severity;
  createdBy: string;
  createdAt: string;
  oldValue?: string;
  newValue?: string;
}

export interface ProjectAnalytics {
    projectId: string;
    totalTasks: number;
    completedTasks: number;
    blockedTasks: number;
    velocity: number;
    teamContribution: MemberContribution[];
    timelineHealth: number;
    snapshotDate: string;
}

export interface MemberContribution {
    userId: string;
    user?: {
      id: string;
      fullName: string;
    };
    contributionPercentage: number;
    tasksCompleted: number;
}

export interface SRSDocument {
    id: string;
    projectId: string;
    version: number;
    url: string;
    status: 'DRAFT' | 'APPROVED' | 'ARCHIVED';
    uploadedBy: string;
    createdAt: string;
}

export interface EmailRoleMapping {
  orgId: string;
  email: string;
  role: FunctionalRole;
  assignedUserId: string;
  isActive: boolean;
  createdAt: string;
}

export interface AuditLog {
  orgId: string;
  auditId: string;
  userId: string; // Who performed the action
  actionType: ActionType;
  targetUserId?: string;
  oldValue?: any;
  newValue?: any;
  changeReason?: string;
  ipAddress?: string;
  timestamp: string;
}

export interface OTPToken {
  userId: string;
  token: string;
  method: TwoFactorMethod;
  attempts: number;
  createdAt: string;
}

export interface InvitationToken {
  token: string;
  email: string;
  role: FunctionalRole;
  orgId: string;
  createdBy: string;
  createdAt: string;
  acceptedAt?: string;
}

export enum ProjectRole {
  TEAM_LEAD = 'TEAM_LEAD',
  VICE_TEAM_LEAD = 'VICE_TEAM_LEAD',
  ENGINEER = 'ENGINEER',
  QA_ENGINEER = 'QA_ENGINEER',
  MEMBER = 'MEMBER'
}

export enum MemberSpecialty {
  FRONTEND = 'FRONTEND',
  BACKEND = 'BACKEND',
  ML = 'ML',
  DEPLOYER = 'DEPLOYER',
  TESTER = 'TESTER',
  DESIGNER = 'DESIGNER',
  QA = 'QA',
  DEVOPS = 'DEVOPS',
  GENERAL = 'GENERAL'
}

// Capability mappings aligned with 7-level hierarchy specification
export const ROLE_CAPABILITIES = {
  CATEGORY: {
    [UserCategory.C_SUITE]: ['access:executive_dashboard', 'manage:full_org', 'view:salary_all'],
    [UserCategory.SVP]: ['access:executive_dashboard', 'manage:multi_dept', 'view:salary_dept'],
    [UserCategory.VP]: ['access:dept_dashboard', 'manage:dept', 'view:salary_dept'],
    [UserCategory.SENIOR_MANAGER]: ['access:team_dashboard', 'manage:multi_team', 'view:salary_reports'],
    [UserCategory.MANAGER]: ['access:team_dashboard', 'manage:team', 'view:salary_reports'],
    [UserCategory.TEAM_LEAD]: ['access:team_dashboard', 'manage:team', 'view:salary_reports'],
    [UserCategory.SENIOR_IC]: ['access:employee_dashboard', 'view:dept_overview'],
    [UserCategory.JUNIOR_IC]: ['access:employee_dashboard', 'view:team_data']
  },
  FUNCTIONAL: {
    // Level 1: C-Suite
    [FunctionalRole.CEO]: ['global:bypass'],
    [FunctionalRole.CTO]: ['global:bypass'],
    [FunctionalRole.CFO]: ['global:bypass'],
    [FunctionalRole.COO]: ['global:bypass'],
    [FunctionalRole.CHRO]: ['global:bypass', 'manage:hr_all'],

    // Level 2: SVP
    [FunctionalRole.SVP_ENGINEERING]: ['manage:engineering'],
    [FunctionalRole.SVP_PRODUCT]: ['manage:product'],
    [FunctionalRole.SVP_OPERATIONS]: ['manage:operations'],

    // Level 3: VP
    [FunctionalRole.VP_BACKEND]: ['manage:backend'],
    [FunctionalRole.VP_FRONTEND]: ['manage:frontend'],
    [FunctionalRole.VP_MOBILE]: ['manage:mobile'],
    [FunctionalRole.VP_DEVOPS]: ['manage:devops'],
    [FunctionalRole.VP_QA]: ['manage:qa'],
    [FunctionalRole.VP_PRODUCT]: ['manage:product'],
    [FunctionalRole.VP_DESIGN]: ['manage:design'],
    [FunctionalRole.VP_DATA]: ['manage:data'],
    [FunctionalRole.VP_HR]: ['manage:hr'],
    [FunctionalRole.VP_SALES]: ['manage:sales'],

    // Level 4: Senior Manager
    [FunctionalRole.SENIOR_ENGINEERING_MANAGER]: ['manage:engineering_subdept'],
    [FunctionalRole.SENIOR_PRODUCT_DIRECTOR]: ['manage:product_subdept'],
    [FunctionalRole.SENIOR_QA_DIRECTOR]: ['manage:qa_subdept'],
    [FunctionalRole.SENIOR_DATA_DIRECTOR]: ['manage:data_subdept'],

    // Level 5: Managers (Team management)
    [FunctionalRole.BACKEND_TEAM_MANAGER]: ['manage:team_resources', 'modify:tasks'],
    [FunctionalRole.FRONTEND_TEAM_MANAGER]: ['manage:team_resources', 'modify:tasks'],
    [FunctionalRole.MOBILE_TEAM_MANAGER]: ['manage:team_resources', 'modify:tasks'],
    [FunctionalRole.DEVOPS_TEAM_MANAGER]: ['manage:team_resources', 'modify:tasks'],
    [FunctionalRole.QA_TEAM_MANAGER]: ['manage:team_resources', 'modify:tasks'],
    [FunctionalRole.PRODUCT_TEAM_MANAGER]: ['manage:team_resources', 'modify:tasks'],
    [FunctionalRole.DESIGN_TEAM_MANAGER]: ['manage:team_resources', 'modify:tasks'],
    [FunctionalRole.DATA_TEAM_MANAGER]: ['manage:team_resources', 'modify:tasks'],
    [FunctionalRole.HR_TEAM_MANAGER]: ['manage:team_resources', 'modify:tasks'],
    [FunctionalRole.SALES_TEAM_MANAGER]: ['manage:team_resources', 'modify:tasks'],
    
    // Level 6: Senior IC
    [FunctionalRole.SENIOR_BACKEND_DEV]: ['execute:tasks_complex'],
    [FunctionalRole.SENIOR_FRONTEND_DEV]: ['execute:tasks_complex'],
    [FunctionalRole.SENIOR_MOBILE_DEV]: ['execute:tasks_complex'],
    [FunctionalRole.SENIOR_DEVOPS_ENG]: ['execute:tasks_complex'],
    [FunctionalRole.SENIOR_QA_ENG]: ['execute:tasks_complex'],
    [FunctionalRole.SENIOR_DATA_ENG]: ['execute:tasks_complex'],
    [FunctionalRole.SENIOR_DATA_SCIENTIST]: ['execute:tasks_complex'],
    [FunctionalRole.SENIOR_DESIGNER]: ['execute:tasks_complex'],
    [FunctionalRole.SENIOR_PRODUCT_MANAGER]: ['execute:tasks_complex'],
    [FunctionalRole.SENIOR_HR_SPECIALIST]: ['execute:tasks_complex'],
    [FunctionalRole.RECRUITER]: ['execute:tasks_complex'],
    [FunctionalRole.SENIOR_SALES_EXECUTIVE]: ['execute:tasks_complex'],

    // Level 7: Junior (Task execution)
    [FunctionalRole.BACKEND_DEV]: ['execute:tasks'],
    [FunctionalRole.FRONTEND_DEV]: ['execute:tasks'],
    [FunctionalRole.MOBILE_DEV]: ['execute:tasks'],
    [FunctionalRole.DEVOPS_ENG]: ['execute:tasks'],
    [FunctionalRole.QA_ENG]: ['execute:tasks'],
    [FunctionalRole.DATA_ANALYST]: ['execute:tasks'],
    [FunctionalRole.DATA_ENG]: ['execute:tasks'],
    [FunctionalRole.DESIGNER]: ['execute:tasks'],
    [FunctionalRole.PRODUCT_ASSOCIATE]: ['execute:tasks'],
    [FunctionalRole.HR_COORDINATOR]: ['execute:tasks'],
    [FunctionalRole.SALES_REP]: ['execute:tasks'],
    [FunctionalRole.INTERN]: ['execute:tasks_limited'],

    // Legacy support
    [FunctionalRole.TEAM_LEAD]: ['manage:team'],
    [FunctionalRole.TECH_LEAD]: ['execute:tasks_complex', 'manage:team_technical'],
    [FunctionalRole.MANAGER]: ['manage:team']
  },
  PROJECT: {
    [ProjectRole.TEAM_LEAD]: [
      'manage:project_team',
      'update:project_dashboard',
      'remove:team_member',
      'assign:vtl'
    ],
    [ProjectRole.VICE_TEAM_LEAD]: [
      'manage:project_team',
      'update:project_dashboard',
      'remove:team_member'
    ],
    [ProjectRole.ENGINEER]: [
      'view:project_dashboard',
      'update:project_dashboard'
    ],
    [ProjectRole.QA_ENGINEER]: [
      'view:project_dashboard',
      'update:project_dashboard'
    ],
    [ProjectRole.MEMBER]: [
      'view:project_dashboard',
      'update:project_dashboard'
    ]
  }
};

// Helper function to get level from category/role
export const getHierarchyLevel = (category: UserCategory): number => {
  const levelMap: Record<UserCategory, number> = {
    [UserCategory.C_SUITE]: 1,
    [UserCategory.SVP]: 2,
    [UserCategory.VP]: 3,
    [UserCategory.SENIOR_MANAGER]: 4,
    [UserCategory.MANAGER]: 5,
    [UserCategory.TEAM_LEAD]: 5,
    [UserCategory.SENIOR_IC]: 6,
    [UserCategory.JUNIOR_IC]: 7
  };
  return levelMap[category];
};

// Helper function to check capabilities.
export const hasCapability = (
  capability: string,
  category: UserCategory,
  role: FunctionalRole,
  projectRole?: ProjectRole | null
): boolean => {
  // Manager/C-Suite bypass (Global)
  if (getHierarchyLevel(category) === 1) {
    return true;
  }
  
  // 1. Check Functional Roles (Global Permissions)
  if (ROLE_CAPABILITIES.FUNCTIONAL[role]?.includes(capability)) {
    return true;
  }

  // 2. Check Category Permissions
  if (ROLE_CAPABILITIES.CATEGORY[category]?.includes(capability)) {
    return true;
  }
  
  // 3. Check Project Specific Roles
  if (projectRole && ROLE_CAPABILITIES.PROJECT[projectRole]?.includes(capability)) {
    return true;
  }
  
  return false;
};

