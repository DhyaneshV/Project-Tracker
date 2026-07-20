import {
  UserCategory,
  FunctionalRole,
  getHierarchyLevel,
} from '@project-tracker/shared-types';

export enum DataType {
  SALARY = 'SALARY',
  DIRECT_REPORTS = 'DIRECT_REPORTS',
  OWN_PROFILE = 'OWN_PROFILE',
  TEAM_DATA = 'TEAM_DATA',
  DEPT_DATA = 'DEPT_DATA',
  ORG_DATA = 'ORG_DATA',
  C_LEVEL_DATA = 'C_LEVEL_DATA',
}

/**
 * Plain user object from DynamoDB (no Mongoose Document).
 */
export interface RbacUser {
  userId: string;
  department?: string;
  hierarchyLevel: number;
  teamId?: string;
  reportingManagerId?: string;
  role: FunctionalRole;
  category: UserCategory;
  organizationId: string;
  [key: string]: any;
}

/**
 * Can caller access target user's record?
 * Based on 7-level hierarchy constraint specification.
 */
export const canAccessUser = (caller: RbacUser, target: RbacUser): boolean => {
  // 1. Same person
  if (caller.userId === target.userId) return true;

  // 2. Direct manager
  if (target.reportingManagerId === caller.userId) return true;

  // 3. Two or more hierarchy levels higher
  if (target.hierarchyLevel - caller.hierarchyLevel >= 2) return true;

  // 4. VP+ (L1-L3): broad visibility with department constraints
  if (caller.hierarchyLevel <= 3) {
    if (caller.hierarchyLevel === 1) return true; // C-Suite: all access
    if (caller.department === target.department) return true;
    if (
      caller.role === FunctionalRole.VP_HR ||
      caller.category === UserCategory.SVP
    )
      return true;
  }

  // 5. Same team, caller is Manager or above (L5 or below number)
  if (caller.teamId && caller.teamId === target.teamId && caller.hierarchyLevel <= 5) {
    return true;
  }

  return false;
};

/**
 * Can caller see a specific data category?
 * Based on data access control matrix.
 */
export const canSeeData = (
  caller: RbacUser,
  dataType: DataType,
  target?: RbacUser
): boolean => {
  const level = caller.hierarchyLevel;

  switch (dataType) {
    case DataType.SALARY:
      if (target && caller.userId === target.userId) return true;
      if (target && target.reportingManagerId === caller.userId) return true;
      if (caller.department === 'HR' && level <= 5) return true;
      if (level <= 2 || caller.role === FunctionalRole.VP_HR) return true;
      return false;

    case DataType.TEAM_DATA:
      return level <= 7;

    case DataType.DEPT_DATA:
      if (caller.role === FunctionalRole.RECRUITER) return true;
      return level <= 5;

    case DataType.ORG_DATA:
      if (caller.department === 'HR' && level <= 5) return true;
      return level <= 3;

    case DataType.C_LEVEL_DATA:
      return level === 1;

    default:
      return false;
  }
};

/**
 * Remove salary from a user record if the caller is not authorised.
 */
export const redactSensitiveData = (target: any, caller: RbacUser): any => {
  if (canSeeData(caller, DataType.SALARY, target as RbacUser)) return target;
  const result = { ...target };
  delete result.salary;
  delete result.compensation;
  return result;
};

/**
 * Filter a list of users to only those the caller can see.
 */
export const filterByHierarchy = (users: RbacUser[], caller: RbacUser): RbacUser[] =>
  users.filter(u => canAccessUser(caller, u));

/**
 * Validate that a manager is at a strictly higher hierarchy level.
 */
export const validateReportingHierarchy = (
  targetLevel: number,
  managerLevel: number
): boolean => managerLevel < targetLevel;
