import { gql } from '@apollo/client';

// ─── QUERIES ─────────────────────────────────────────────────────────────────

export const GET_ME = gql`
  query GetMe {
    me {
      id
      email
      fullName
      orgRole
      category
      role
      department
      status
      hierarchyLevel
      directReportCount
      reportingManagerId
      managedTeams
      managedEmployees
      twoFactorEnabled
      twoFactorMethod
      lastLoginAt
      createdAt
    }
  }
`;

export const GET_ALL_USERS = gql`
  query GetAllUsers(
    $roleFilter: [FunctionalRole]
    $statusFilter: [UserStatus]
    $twoFactorFilter: Boolean
  ) {
    getAllUsers(
      roleFilter: $roleFilter
      statusFilter: $statusFilter
      twoFactorFilter: $twoFactorFilter
    ) {
      id
      email
      fullName
      orgRole
      category
      role
      department
      status
      hierarchyLevel
      directReportCount
      reportingManagerId
      twoFactorEnabled
      twoFactorMethod
      lastLoginAt
      createdAt
    }
  }
`;

export const GET_MY_TEAM_MEMBERS = gql`
  query GetMyTeamMembers {
    getMyTeamMembers {
      id
      email
      fullName
      category
      role
      department
      status
      hierarchyLevel
      twoFactorEnabled
      lastLoginAt
    }
  }
`;

export const GET_DEPARTMENT_EMPLOYEES = gql`
  query GetDepartmentEmployees($department: Department) {
    getDepartmentEmployees(department: $department) {
      id
      email
      fullName
      category
      role
      department
      status
      hierarchyLevel
      reportingManagerId
      twoFactorEnabled
      lastLoginAt
    }
  }
`;

export const GET_EMPLOYEE_BY_ID = gql`
  query GetEmployeeById($userId: ID!) {
    getEmployeeById(userId: $userId) {
      id
      email
      fullName
      orgRole
      category
      role
      department
      status
      hierarchyLevel
      directReportCount
      reportingManagerId
      managedTeams
      managedEmployees
      twoFactorEnabled
      twoFactorMethod
      lastLoginAt
      createdAt
    }
  }
`;

export const GET_AUDIT_LOGS = gql`
  query GetAuditLogs {
    getAuditLogs {
      auditId
      userId
      actionType
      targetUserId
      oldValue
      newValue
      ipAddress
      timestamp
    }
  }
`;

// ─── MUTATIONS ───────────────────────────────────────────────────────────────

export const SIGNUP = gql`
  mutation Signup(
    $email: String!
    $fullName: String!
    $password: String!
    $organizationName: String!
  ) {
    signup(
      email: $email
      fullName: $fullName
      password: $password
      organizationName: $organizationName
    ) {
      token
      isNewUser
      requiredActions
      user {
        id
        email
        fullName
        role
      }
    }
  }
`;

export const LOGIN = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      requiresOTP
      otpExpiry
      message
    }
  }
`;

export const VERIFY_LOGIN_OTP = gql`
  mutation VerifyLoginOTP($email: String!, $otp: String!) {
    verifyLoginOTP(email: $email, otp: $otp) {
      token
      isNewUser
      requiredActions
      user {
        id
        email
        fullName
        role
        category
        hierarchyLevel
      }
    }
  }
`;

export const CHANGE_PASSWORD = gql`
  mutation ChangePassword($newPassword: String!) {
    changePassword(newPassword: $newPassword)
  }
`;

export const INVITE_USER = gql`
  mutation InviteUser(
    $email: String!
    $fullName: String!
    $category: UserCategory!
    $role: FunctionalRole!
    $department: Department!
    $reportingManagerId: ID
    $organizationId: ID
    $twoFactorRequired: Boolean
  ) {
    inviteUser(
      email: $email
      fullName: $fullName
      category: $category
      role: $role
      department: $department
      reportingManagerId: $reportingManagerId
      organizationId: $organizationId
      twoFactorRequired: $twoFactorRequired
    ) {
      userId
      email
      invitationExpiry
      temporaryPassword
      status
    }
  }
`;

export const RESEND_INVITATION = gql`
  mutation ResendInvitation($userId: ID!) {
    resendInvitation(userId: $userId)
  }
`;

export const REQUEST_SECURITY_OTP = gql`
  mutation RequestSecurityOTP {
    requestSecurityOTP
  }
`;

export const DROP_USER = gql`
  mutation DropUser($userId: ID!, $otp: String!) {
    dropUser(userId: $userId, otp: $otp) {
      success
      auditId
    }
  }
`;

export const UPDATE_USER_STATUS = gql`
  mutation UpdateUserStatus($userId: ID!, $status: UserStatus!) {
    updateUserStatus(userId: $userId, status: $status) {
      id
      status
    }
  }
`;

export const UPDATE_USER_ROLE = gql`
  mutation UpdateUserRole($userId: ID!, $newRole: FunctionalRole!) {
    updateUserRole(userId: $userId, newRole: $newRole) {
      id
      role
    }
  }
`;

export const PROMOTE_USER = gql`
  mutation PromoteUser($userId: ID!, $newRole: FunctionalRole, $newLevel: Int) {
    promoteUser(userId: $userId, newRole: $newRole, newLevel: $newLevel) {
      id
      role
      hierarchyLevel
    }
  }
`;

export const SUSPEND_USER = gql`
  mutation SuspendUser($userId: ID!, $reason: String!) {
    suspendUser(userId: $userId, reason: $reason) {
      id
      status
    }
  }
`;

export const CHANGE_REPORTING_MANAGER = gql`
  mutation ChangeReportingManager($userId: ID!, $newManagerId: ID!) {
    changeReportingManager(userId: $userId, newManagerId: $newManagerId) {
      id
      reportingManagerId
    }
  }
`;
