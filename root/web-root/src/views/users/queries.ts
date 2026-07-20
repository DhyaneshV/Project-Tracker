import { gql } from '@apollo/client';

export const GET_ALL_USERS = gql`
  query GetAllUsers {
    getAllUsers {
      id
      email
      fullName
      orgRole
      category
      role
      department
      hierarchyLevel
      status
      twoFactorEnabled
      twoFactorMethod
      lastLoginAt
      createdAt
      reportingManagerId
      directReportCount
    }
  }
`;

export const GET_AUDIT_LOGS = gql`
  query GetAuditLogs($limit: Int, $cursor: String) {
    getAuditLogs(limit: $limit, cursor: $cursor) {
      items {
        auditId
        userId
        actionType
        targetUserId
        oldValue
        newValue
        ipAddress
        timestamp
      }
      nextCursor
      totalCount
    }
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
    $twoFactorRequired: Boolean
  ) {
    inviteUser(
      email: $email
      fullName: $fullName
      category: $category
      role: $role
      department: $department
      reportingManagerId: $reportingManagerId
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

export const DROP_USER = gql`
  mutation DropUser($userId: ID!, $otp: String!) {
    dropUser(userId: $userId, otp: $otp) {
      success
      auditId
    }
  }
`;

export const REQUEST_SECURITY_OTP = gql`
  mutation RequestSecurityOTP {
    requestSecurityOTP
  }
`;

export const UPDATE_USER_ROLE = gql`
  mutation UpdateUserOrgRole($userId: ID!, $orgRole: OrgRole!, $role: FunctionalRole) {
    updateUserOrgRole(userId: $userId, orgRole: $orgRole, role: $role) {
      id
      fullName
      orgRole
      role
    }
  }
`;

export const ADMIN_UPDATE_2FA = gql`
  mutation AdminUpdate2FA($userId: ID!, $enabled: Boolean!, $method: TwoFactorMethod) {
    adminUpdate2FA(userId: $userId, enabled: $enabled, method: $method) {
      id
      twoFactorEnabled
      twoFactorMethod
    }
  }
`;

export const ENABLE_2FA = gql`
  mutation Enable2FA($method: TwoFactorMethod!) {
    enable2FA(method: $method) {
      method
      qrCodeSVG
      secret
      instructions
    }
  }
`;

export const VERIFY_2FA_SETUP = gql`
  mutation Verify2FASetup($method: TwoFactorMethod!, $code: String!) {
    verify2FASetup(method: $method, code: $code)
  }
`;

export const LOGIN_MUTATION = gql`
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
        fullName
        email
        orgRole
        category
        role
        hierarchyLevel
        department
        status
        organizationId
        twoFactorEnabled
        twoFactorMethod
      }
    }
  }
`;

export const CHANGE_PASSWORD = gql`
  mutation ChangePassword($newPassword: String!) {
    changePassword(newPassword: $newPassword)
  }
`;

export const REQUEST_PASSWORD_RESET = gql`
  mutation RequestPasswordReset($email: String!) {
    requestPasswordReset(email: $email)
  }
`;

export const RESET_PASSWORD = gql`
  mutation ResetPassword($token: String!, $newPassword: String!) {
    resetPassword(token: $token, newPassword: $newPassword)
  }
`;

export const SIGNUP_MUTATION = gql`
  mutation Signup($email: String!, $fullName: String!, $password: String!) {
    signup(email: $email, fullName: $fullName, password: $password) {
      token
      isNewUser
      requiredActions
      user {
        id
        fullName
        email
        orgRole
        category
        role
        hierarchyLevel
        department
        status
        organizationId
      }
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
  mutation SuspendUser($userId: ID!, $reason: String) {
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

export const UPDATE_USER_STATUS = gql`
  mutation UpdateUserStatus($userId: ID!, $status: UserStatus!) {
    updateUserStatus(userId: $userId, status: $status) {
      id
      status
    }
  }
`;

export const GET_PROJECTS = gql`
  query GetProjects {
    getProjects {
      id
      name
    }
  }
`;

export const GET_DEPARTMENT_EMPLOYEES = gql`
  query GetDepartmentEmployees($department: Department!) {
    getDepartmentEmployees(department: $department) {
      id
      fullName
      email
      role
      status
      hierarchyLevel
    }
  }
`;

export const GET_MY_TEAM_MEMBERS = gql`
  query GetMyTeamMembers {
    getMyTeamMembers {
      id
      email
      fullName
      role
      department
      status
      hierarchyLevel
      twoFactorEnabled
      twoFactorMethod
      lastLoginAt
      projectId
      reportingManagerId
      credentialsExpiryDate
      directReports {
        id
        fullName
        role
        status
      }
    }
  }
`;

export const GET_PROJECT_TASKS = gql`
  query GetProjectTasks($projectId: ID!) {
    getProjectTasks(projectId: $projectId) {
      id
      title
      status
      priority
      assignedTo { id fullName }
      dueDate
    }
  }
`;

export const GET_MY_PROJECTS = gql`
  query GetMyProjects {
    getProjects {
      id
      name
      status
      completionPercentage
      teamSize
      teamMembers {
        userId
        role
      }
    }
  }
`;
