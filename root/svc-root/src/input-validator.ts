/**
 * Input Validation & Sanitization for GraphQL Gateway
 * 
 * Validates and sanitizes all mutation inputs before proxying to microservices.
 * This is defense-in-depth — the microservices should also validate, but
 * the gateway catches malformed/malicious inputs early.
 * 
 * Rules:
 * - Strings are trimmed and HTML-stripped
 * - Emails are validated against RFC 5322 (simplified)
 * - Enum values are validated against allowed sets
 * - IDs are validated as non-empty strings (UUID-like)
 * - Numeric fields are validated for range
 * - Passwords have minimum strength requirements
 */

// ─── ENUM DEFINITIONS ───────────────────────────────────────────

const VALID_USER_CATEGORIES = [
  'C_SUITE', 'SVP', 'VP', 'SENIOR_MANAGEMENT', 'TEAM_MANAGEMENT', 'SENIOR_IC', 'JUNIOR_IC'
];

const VALID_FUNCTIONAL_ROLES = [
  'CEO', 'CTO', 'CFO', 'COO', 'CHRO', 'CMO', 'CPO',
  'SVP_ENGINEERING', 'SVP_PRODUCT', 'SVP_SALES', 'SVP_OPERATIONS',
  'VP_ENGINEERING', 'VP_PRODUCT', 'VP_DESIGN', 'VP_DATA', 'VP_HR', 'VP_FINANCE', 'VP_MARKETING', 'VP_SALES',
  'SENIOR_ENGINEERING_MANAGER', 'SENIOR_PRODUCT_MANAGER', 'SENIOR_DESIGN_MANAGER',
  'ENGINEERING_MANAGER', 'PRODUCT_MANAGER', 'DESIGN_MANAGER', 'QA_MANAGER', 'DATA_MANAGER',
  'BACKEND_LEAD', 'FRONTEND_LEAD', 'MOBILE_LEAD', 'DEVOPS_LEAD', 'QA_LEAD', 'DATA_LEAD', 'DESIGN_LEAD', 'ML_LEAD',
  'SENIOR_BACKEND_DEV', 'SENIOR_FRONTEND_DEV', 'SENIOR_MOBILE_DEV', 'SENIOR_DEVOPS_ENGINEER', 'SENIOR_QA_ENGINEER', 'SENIOR_DATA_ENGINEER', 'SENIOR_DESIGNER', 'SENIOR_ML_ENGINEER',
  'BACKEND_DEV', 'FRONTEND_DEV', 'MOBILE_DEV', 'DEVOPS_ENGINEER', 'QA_ENGINEER', 'DATA_ENGINEER', 'DESIGNER', 'ML_ENGINEER',
  'JUNIOR_BACKEND_DEV', 'JUNIOR_FRONTEND_DEV', 'JUNIOR_MOBILE_DEV', 'JUNIOR_QA', 'JUNIOR_DESIGNER', 'INTERN',
  'HR_MANAGER', 'HR_SPECIALIST', 'RECRUITER', 'FINANCE_ANALYST', 'MARKETING_SPECIALIST',
  'MANAGER', 'TEAM_LEADER', 'TEAM_LEAD'
];

const VALID_DEPARTMENTS = [
  'ENGINEERING', 'PRODUCT', 'DESIGN', 'QA', 'DATA', 'DEVOPS', 'ML_AI',
  'HR', 'HUMAN_RESOURCES', 'FINANCE', 'MARKETING', 'SALES', 'OPERATIONS', 'EXECUTIVE',
  'BACKEND', 'FRONTEND', 'MOBILE', 'SECURITY', 'SUPPORT'
];

const VALID_ORG_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'];

const VALID_USER_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION', 'ONBOARDING'];

const VALID_TWO_FACTOR_METHODS = ['EMAIL_OTP', 'TOTP', 'NONE'];

const VALID_PROJECT_STATUSES = ['PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];

const VALID_TASK_STATUSES = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'DONE', 'CANCELLED'];

const VALID_TASK_PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const VALID_PROJECT_ROLES = ['PROJECT_LEAD', 'VICE_LEAD', 'TEAM_LEAD', 'SENIOR_MEMBER', 'MEMBER', 'OBSERVER'];

const VALID_MEMBER_SPECIALTIES = [
  'BACKEND', 'FRONTEND', 'MOBILE', 'DEVOPS', 'QA', 'DATA', 'DESIGN', 'ML', 'FULLSTACK', 'PRODUCT', 'SECURITY'
];

// ─── HELPER FUNCTIONS ───────────────────────────────────────────

/** Strip HTML tags and dangerous characters */
function sanitizeString(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')          // Remove HTML tags
    .replace(/[<>]/g, '')             // Remove remaining angle brackets
    .replace(/javascript:/gi, '')      // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '')       // Remove inline event handlers
    .trim();
}

/** Validate email format (RFC 5322 simplified) */
function isValidEmail(email: string): boolean {
  if (!email || email.length > 254) return false;
  const regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return regex.test(email);
}

/** Validate string length */
function isValidLength(str: string, min: number, max: number): boolean {
  return str.length >= min && str.length <= max;
}

/** Validate an ID (non-empty, reasonable length, no special chars) */
function isValidId(id: string): boolean {
  if (!id || id.length > 128) return false;
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

/** Validate password strength */
function isStrongPassword(password: string): boolean {
  if (password.length < 8) return false;
  if (password.length > 128) return false;
  return true; // Backend enforces complexity rules
}

/** Validate a number is within range */
function isInRange(num: number, min: number, max: number): boolean {
  return typeof num === 'number' && !isNaN(num) && num >= min && num <= max;
}

/** Check if value is in an enum set (case-insensitive) */
function isValidEnum(value: string, validValues: string[]): boolean {
  return validValues.includes(value);
}

// ─── VALIDATION RULES PER OPERATION ─────────────────────────────

interface ValidationError {
  field: string;
  message: string;
}

type Validator = (variables: any) => ValidationError[];

const validators: Record<string, Validator> = {
  signup: (vars) => {
    const errors: ValidationError[] = [];
    if (!vars.email || !isValidEmail(vars.email)) errors.push({ field: 'email', message: 'Invalid email address (max 254 chars)' });
    if (!vars.fullName || !isValidLength(vars.fullName, 2, 100)) errors.push({ field: 'fullName', message: 'Full name must be 2-100 characters' });
    if (!vars.password || !isStrongPassword(vars.password)) errors.push({ field: 'password', message: 'Password must be 8-128 characters' });
    if (vars.organizationName && !isValidLength(vars.organizationName, 2, 100)) errors.push({ field: 'organizationName', message: 'Organization name must be 2-100 characters' });
    return errors;
  },

  login: (vars) => {
    const errors: ValidationError[] = [];
    if (!vars.email || !isValidEmail(vars.email)) errors.push({ field: 'email', message: 'Invalid email address' });
    if (!vars.password || typeof vars.password !== 'string') errors.push({ field: 'password', message: 'Password is required' });
    return errors;
  },

  verifyLoginOTP: (vars) => {
    const errors: ValidationError[] = [];
    if (!vars.email || !isValidEmail(vars.email)) errors.push({ field: 'email', message: 'Invalid email address' });
    if (!vars.otp || !/^\d{6}$/.test(vars.otp)) errors.push({ field: 'otp', message: 'OTP must be exactly 6 digits' });
    return errors;
  },

  changePassword: (vars) => {
    const errors: ValidationError[] = [];
    if (!vars.newPassword || !isStrongPassword(vars.newPassword)) errors.push({ field: 'newPassword', message: 'Password must be 8-128 characters' });
    return errors;
  },

  inviteUser: (vars) => {
    const errors: ValidationError[] = [];
    if (!vars.email || !isValidEmail(vars.email)) errors.push({ field: 'email', message: 'Invalid email address (max 254 chars)' });
    if (!vars.fullName || !isValidLength(vars.fullName, 2, 100)) errors.push({ field: 'fullName', message: 'Full name must be 2-100 characters' });
    if (!vars.category || !isValidEnum(vars.category, VALID_USER_CATEGORIES)) errors.push({ field: 'category', message: 'Invalid user category' });
    if (!vars.role || !isValidEnum(vars.role, VALID_FUNCTIONAL_ROLES)) errors.push({ field: 'role', message: 'Invalid functional role' });
    if (!vars.department || !isValidEnum(vars.department, VALID_DEPARTMENTS)) errors.push({ field: 'department', message: 'Invalid department' });
    if (vars.reportingManagerId && !isValidId(vars.reportingManagerId)) errors.push({ field: 'reportingManagerId', message: 'Invalid manager ID' });
    return errors;
  },

  dropUser: (vars) => {
    const errors: ValidationError[] = [];
    if (!vars.userId || !isValidId(vars.userId)) errors.push({ field: 'userId', message: 'Invalid user ID' });
    if (!vars.otp || !/^\d{6}$/.test(vars.otp)) errors.push({ field: 'otp', message: 'OTP must be exactly 6 digits' });
    return errors;
  },

  updateUserOrgRole: (vars) => {
    const errors: ValidationError[] = [];
    if (!vars.userId || !isValidId(vars.userId)) errors.push({ field: 'userId', message: 'Invalid user ID' });
    if (!vars.orgRole || !isValidEnum(vars.orgRole, VALID_ORG_ROLES)) errors.push({ field: 'orgRole', message: 'Invalid org role' });
    if (vars.role && !isValidEnum(vars.role, VALID_FUNCTIONAL_ROLES)) errors.push({ field: 'role', message: 'Invalid functional role' });
    return errors;
  },

  adminUpdate2FA: (vars) => {
    const errors: ValidationError[] = [];
    if (!vars.userId || !isValidId(vars.userId)) errors.push({ field: 'userId', message: 'Invalid user ID' });
    if (typeof vars.enabled !== 'boolean') errors.push({ field: 'enabled', message: 'enabled must be a boolean' });
    if (vars.method && !isValidEnum(vars.method, VALID_TWO_FACTOR_METHODS)) errors.push({ field: 'method', message: 'Invalid 2FA method' });
    return errors;
  },

  verify2FASetup: (vars) => {
    const errors: ValidationError[] = [];
    if (!vars.method || !isValidEnum(vars.method, VALID_TWO_FACTOR_METHODS)) errors.push({ field: 'method', message: 'Invalid 2FA method' });
    if (!vars.code || !/^\d{6}$/.test(vars.code)) errors.push({ field: 'code', message: 'Code must be exactly 6 digits' });
    return errors;
  },

  createProject: (vars) => {
    const errors: ValidationError[] = [];
    if (!vars.name || !isValidLength(vars.name, 2, 200)) errors.push({ field: 'name', message: 'Project name must be 2-200 characters' });
    if (!vars.description || !isValidLength(vars.description, 0, 5000)) errors.push({ field: 'description', message: 'Description max 5000 characters' });
    if (vars.maxTeamSize && !isInRange(vars.maxTeamSize, 1, 500)) errors.push({ field: 'maxTeamSize', message: 'Team size must be 1-500' });
    if (vars.budgetUSD && !isInRange(vars.budgetUSD, 0, 100_000_000)) errors.push({ field: 'budgetUSD', message: 'Budget must be 0-100M' });
    return errors;
  },

  createTask: (vars) => {
    const errors: ValidationError[] = [];
    if (!vars.projectId || !isValidId(vars.projectId)) errors.push({ field: 'projectId', message: 'Invalid project ID' });
    if (!vars.title || !isValidLength(vars.title, 1, 500)) errors.push({ field: 'title', message: 'Title must be 1-500 characters' });
    if (!vars.priority || !isValidEnum(vars.priority, VALID_TASK_PRIORITIES)) errors.push({ field: 'priority', message: 'Invalid priority' });
    return errors;
  },

  updateTaskStatus: (vars) => {
    const errors: ValidationError[] = [];
    if (!vars.taskId || !isValidId(vars.taskId)) errors.push({ field: 'taskId', message: 'Invalid task ID' });
    if (!vars.status || !isValidEnum(vars.status, VALID_TASK_STATUSES)) errors.push({ field: 'status', message: 'Invalid task status' });
    if (vars.blockerReason && !isValidLength(vars.blockerReason, 0, 1000)) errors.push({ field: 'blockerReason', message: 'Blocker reason max 1000 chars' });
    return errors;
  },

  addMemberToProject: (vars) => {
    const errors: ValidationError[] = [];
    if (!vars.projectId || !isValidId(vars.projectId)) errors.push({ field: 'projectId', message: 'Invalid project ID' });
    if (!vars.userId || !isValidId(vars.userId)) errors.push({ field: 'userId', message: 'Invalid user ID' });
    if (!vars.projectRole || !isValidEnum(vars.projectRole, VALID_PROJECT_ROLES)) errors.push({ field: 'projectRole', message: 'Invalid project role' });
    if (!vars.specialty || !isValidEnum(vars.specialty, VALID_MEMBER_SPECIALTIES)) errors.push({ field: 'specialty', message: 'Invalid specialty' });
    if (!vars.allocation || !isInRange(vars.allocation, 1, 100)) errors.push({ field: 'allocation', message: 'Allocation must be 1-100%' });
    return errors;
  },

  resendInvitation: (vars) => {
    const errors: ValidationError[] = [];
    if (!vars.userId || !isValidId(vars.userId)) errors.push({ field: 'userId', message: 'Invalid user ID' });
    return errors;
  },

  sendDirectMessage: (vars) => {
    const errors: ValidationError[] = [];
    if (!vars.recipientId || !isValidId(vars.recipientId)) errors.push({ field: 'recipientId', message: 'Invalid recipient ID' });
    if (!vars.content || !isValidLength(vars.content, 1, 10000)) errors.push({ field: 'content', message: 'Message must be 1-10000 characters' });
    if (vars.subject && !isValidLength(vars.subject, 0, 200)) errors.push({ field: 'subject', message: 'Subject max 200 characters' });
    return errors;
  },
};

// ─── PUBLIC API ─────────────────────────────────────────────────

/**
 * Validate mutation inputs at the gateway level.
 * @returns null if valid, or an error message string if validation fails.
 */
export function validateMutationInput(operationName: string, variables: any): string | null {
  const validator = validators[operationName];
  if (!validator) return null; // No validator = pass through (queries, unknown mutations)

  if (!variables || typeof variables !== 'object') {
    return 'Missing or invalid request variables';
  }

  const errors = validator(variables);
  if (errors.length === 0) return null;

  return errors.map(e => `${e.field}: ${e.message}`).join('; ');
}

/**
 * Sanitize string fields in the variables object.
 * Mutates the input object in-place.
 */
export function sanitizeVariables(variables: any): void {
  if (!variables || typeof variables !== 'object') return;

  for (const key of Object.keys(variables)) {
    const val = variables[key];
    if (typeof val === 'string') {
      // Don't sanitize passwords (they might legitimately contain special chars)
      if (key.toLowerCase().includes('password') || key.toLowerCase().includes('secret')) continue;
      // Don't sanitize OTPs
      if (key === 'otp' || key === 'code') continue;
      variables[key] = sanitizeString(val);
    } else if (Array.isArray(val)) {
      val.forEach((item, i) => {
        if (typeof item === 'string') val[i] = sanitizeString(item);
        else if (typeof item === 'object') sanitizeVariables(item);
      });
    } else if (typeof val === 'object' && val !== null) {
      sanitizeVariables(val);
    }
  }
}
