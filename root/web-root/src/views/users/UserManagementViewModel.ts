import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useApolloClient, gql } from '@apollo/client';
import { GET_ALL_USERS, UPDATE_USER_ROLE, INVITE_USER, DROP_USER, RESEND_INVITATION, GET_PROJECTS, ADMIN_UPDATE_2FA, REQUEST_SECURITY_OTP } from './queries';
import { FunctionalRole, UserCategory, UserStatus, TwoFactorMethod } from '@project-tracker/shared-types';

const GET_ME = gql`
  query GetMeSelf {
    me {
      id
    }
  }
`;

/** Number of rows per page */
const PAGE_SIZE = 20;

export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

export interface FilterState {
  categories: UserCategory[];
  roles: FunctionalRole[];
  statuses: UserStatus[];
  departments: string[];
  twoFactor: 'ALL' | 'ENABLED' | 'DISABLED';
  project: string; // 'ALL' | 'NONE' | 'ANY' | specific project ID
}

export function useUserManagementViewModel(token?: string) {
  const client = useApolloClient();
  const context = token ? { headers: { Authorization: `Bearer ${token}` } } : undefined;
  
  const { data, loading, error, refetch } = useQuery(GET_ALL_USERS, { context, fetchPolicy: 'cache-and-network', nextFetchPolicy: 'cache-first' });
  const { data: projectsData } = useQuery(GET_PROJECTS, { context });
  
  const [updateUserRoleMutation] = useMutation(UPDATE_USER_ROLE, { 
    context,
    onCompleted: () => refetch()
  });

  const [inviteUserMutation] = useMutation(INVITE_USER, {
    context,
    onCompleted: () => refetch()
  });

  const [resendInvitationMutation] = useMutation(RESEND_INVITATION, {
    context
  });

  const [dropUserMutation] = useMutation(DROP_USER, {
    context,
    onCompleted: () => {
        refetch();
        setDropOtpState({ isOpen: false, userId: null, loading: false, error: null, attempts: 0, locked: false });
    }
  });

  const [requestSecurityOTPMutation] = useMutation(REQUEST_SECURITY_OTP, { context });

  const [adminUpdate2FAMutation] = useMutation(ADMIN_UPDATE_2FA, {
    context,
    onCompleted: () => refetch()
  });

  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [dropOtpState, setDropOtpState] = useState<{
    isOpen: boolean;
    userId: string | null;
    loading: boolean;
    error: string | null;
    attempts: number;
    locked: boolean;
  }>({
    isOpen: false,
    userId: null,
    loading: false,
    error: null,
    attempts: 0,
    locked: false,
  });

  // Search, Filter, Sort, and Pagination State
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<FilterState>({
    categories: [],
    roles: [],
    statuses: [],
    departments: [],
    twoFactor: 'ALL',
    project: 'ALL'
  });
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'createdAt',
    direction: 'desc'
  });
  const [currentPage, setCurrentPage] = useState(1);

  // Bulk Selection State
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  const toggleUserSelection = (userId: string) => {
    const newSelection = new Set(selectedUserIds);
    if (newSelection.has(userId)) {
      newSelection.delete(userId);
    } else {
      newSelection.add(userId);
    }
    setSelectedUserIds(newSelection);
  };

  const toggleAllSelection = (usersOnPage: any[]) => {
    if (selectedUserIds.size === usersOnPage.length && usersOnPage.length > 0) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(usersOnPage.map(u => u.id)));
    }
  };

  const clearSelection = () => setSelectedUserIds(new Set());

  const handleInviteUser = async (formData: any) => {
    try {
        const { data } = await inviteUserMutation({
            variables: { 
                email: formData.email, 
                fullName: formData.fullName,
                category: formData.category,
                role: formData.role,
                department: formData.department,
                assignedProjectId: formData.assignedProjectId,
                twoFactorRequired: formData.twoFactorRequired
            }
        });
        return data.inviteUser;
    } catch (err) {
        console.error('Error provisioning user:', err);
        throw err;
    }
  };

  const handleResendInvitation = async (userId: string) => {
    try {
      await resendInvitationMutation({ variables: { userId } });
      return true;
    } catch (err: any) {
      console.error('Failed to resend invitation:', err);
      throw err;
    }
  };

  const handleBulkResend = async () => {
    const ids = Array.from(selectedUserIds);
    if (ids.length === 0) return;
    
    if (window.confirm(`Resend invitations to ${ids.length} selected members?`)) {
      let successCount = 0;
      for (const id of ids) {
        try {
          await handleResendInvitation(id);
          successCount++;
        } catch (e) {
          console.error(`Failed to resend for ${id}`, e);
        }
      }
      alert(`Successfully resent ${successCount} invitations.`);
      setSelectedUserIds(new Set());
    }
  };

  const handleUpdateRole = async (userId: string, role: FunctionalRole, orgRole: any) => {
    try {
        await updateUserRoleMutation({
            variables: { userId, orgRole, role }
        });
    } catch (err) {
        console.error('Error updating role:', err);
        alert('Failed to update role. Ensure you have MANAGER permissions.');
    }
  };

  const handleDropUser = async (userId: string) => {
    // Safety Check: Prevent self-drop
    const meData: any = client.readQuery({ query: GET_ME });
    if (meData?.me?.id === userId) {
      alert("Security Protocol: You cannot drop your own account while logged in. Please contact another Manager for account decommissioning.");
      return false;
    }

    if (!window.confirm("CRITICAL ACTION: Are you sure you want to PERMANENTLY REMOVE this member? This action cannot be undone and will require a security code.")) {
      return false;
    }

    try {
        setDropOtpState({ isOpen: true, userId, loading: true, error: null, attempts: 0, locked: false });
        await requestSecurityOTPMutation();
        setDropOtpState(prev => ({ ...prev, loading: false }));
        return true;
    } catch (err: any) {
        console.error('Error initiating drop:', err);
        setDropOtpState({ isOpen: false, userId: null, loading: false, error: err.message, attempts: 0, locked: false });
        alert(`Security Error: ${err.message}`);
        return false;
    }
  };

  const handleVerifyDrop = async (otp: string) => {
      if (!dropOtpState.userId) return;
      
      setDropOtpState(prev => ({ ...prev, loading: true, error: null }));
      try {
          const { data: dropRes } = await dropUserMutation({
              variables: { userId: dropOtpState.userId, otp }
          });
          if (dropRes.dropUser.success) {
              alert("Decommissioning Successful: Member has been permanently removed from the organization.");
          }
      } catch (err: any) {
          console.error('Verification failed:', err);
          const newAttempts = dropOtpState.attempts + 1;
          const isLocked = newAttempts >= 3 || err.message?.toLowerCase().includes('locked');
          setDropOtpState(prev => ({
            ...prev,
            loading: false,
            error: err.message,
            attempts: newAttempts,
            locked: isLocked,
          }));
      }
  };

  const handleBulkDrop = async () => {
    const ids = Array.from(selectedUserIds);
    if (ids.length === 0) return;
    alert("Bulk Drop is currently disabled for security. Please decommission members individually via the high-security OTP flow.");
  };

  const handleBulkEnable2FA = async () => {
    const rawUsers = data?.getAllUsers || [];
    const targets = rawUsers.filter((u: any) => selectedUserIds.has(u.id) && !u.twoFactorEnabled);
    
    if (targets.length === 0) {
      alert('All selected members already have 2FA enabled.');
      return;
    }

    if (window.confirm(`Force-enable Email 2FA for ${targets.length} unprotected member(s)?`)) {
      let successCount = 0;
      for (const user of targets) {
        try {
          await adminUpdate2FAMutation({
            variables: { userId: user.id, enabled: true, method: TwoFactorMethod.EMAIL_OTP }
          });
          successCount++;
        } catch (e) {
          console.error(`Failed to enable 2FA for ${user.id}`, e);
        }
      }
      alert(`Successfully secured ${successCount} account(s).`);
      setSelectedUserIds(new Set());
    }
  };

  const handleBulkSuspend = async () => {
    const ids = Array.from(selectedUserIds);
    if (ids.length === 0) return;
    alert("Bulk Suspend requires individual OTP verification for security. Please use Action Dropdown on each user.");
  };

  const handleRequestNewOtp = async () => {
    if (!dropOtpState.userId) return;
    try {
      setDropOtpState(prev => ({ ...prev, loading: true, error: null }));
      await requestSecurityOTPMutation();
      setDropOtpState(prev => ({ ...prev, loading: false, attempts: 0, locked: false }));
    } catch (err: any) {
      setDropOtpState(prev => ({ ...prev, loading: false, error: err.message }));
    }
  };

  // ─── FILTERING AND SORTING ──────────────────────────────────────

  const filteredUsers = useMemo(() => {
    let users = [...(data?.getAllUsers || [])];

    // 1. Apply Search (300ms debounce is handled by the component)
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      users = users.filter(u => 
        u.fullName?.toLowerCase().includes(lowerSearch) ||
        u.email?.toLowerCase().includes(lowerSearch)
      );
    }

    // 2. Apply Filters (logical AND)
    if (filters.categories.length > 0) {
      users = users.filter(u => filters.categories.includes(u.category));
    }
    if (filters.roles.length > 0) {
      users = users.filter(u => filters.roles.includes(u.role));
    }
    if (filters.statuses.length > 0) {
      users = users.filter(u => filters.statuses.includes(u.status));
    } else {
      // Default: hide INACTIVE from view when no status filter is active
      users = users.filter(u => u.status !== UserStatus.INACTIVE);
    }
    if (filters.departments.length > 0) {
      users = users.filter(u => filters.departments.includes(u.department));
    }
    if (filters.twoFactor !== 'ALL') {
      const wantEnabled = filters.twoFactor === 'ENABLED';
      users = users.filter(u => u.twoFactorEnabled === wantEnabled);
    }
    if (filters.project === 'NONE') {
      users = users.filter(u => !u.projectId);
    } else if (filters.project === 'ANY') {
      users = users.filter(u => !!u.projectId);
    } else if (filters.project !== 'ALL') {
      users = users.filter(u => u.projectId === filters.project);
    }

    // 3. Apply Sort
    users.sort((a, b) => {
      let valA = a[sortConfig.key] ?? '';
      let valB = b[sortConfig.key] ?? '';

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return users;
  }, [data, searchTerm, filters, sortConfig]);

  // ─── PAGINATION ─────────────────────────────────────────────────

  const totalFilteredCount = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / PAGE_SIZE));

  // Reset to page 1 when filters change
  const safeCurrentPage = currentPage > totalPages ? 1 : currentPage;
  
  const paginatedUsers = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
    return filteredUsers.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredUsers, safeCurrentPage]);

  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  }, [totalPages]);

  // Reset page when filters or search change
  const setSearchTermWithReset = useCallback((term: string) => {
    setSearchTerm(term);
    setCurrentPage(1);
  }, []);

  const setFiltersWithReset = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
    setCurrentPage(1);
  }, []);

  // ─── DERIVED DATA ───────────────────────────────────────────────

  const projects = useMemo(() => {
    return projectsData?.getProjects || [];
  }, [projectsData]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const stats = useMemo(() => {
    const rawUsers = data?.getAllUsers || [];
    const total = rawUsers.length;

    // All 5 status breakdowns (including zero counts)
    const active = rawUsers.filter((u: any) => u.status === 'ACTIVE').length;
    const inactive = rawUsers.filter((u: any) => u.status === 'INACTIVE').length;
    const suspended = rawUsers.filter((u: any) => u.status === 'SUSPENDED').length;
    const pendingVerification = rawUsers.filter((u: any) => u.status === 'PENDING_VERIFICATION').length;
    const onboarding = rawUsers.filter((u: any) => u.status === 'ONBOARDING').length;

    // 2FA adoption: percentage rounded to 1 decimal place
    const twoFactorCount = rawUsers.filter((u: any) => u.twoFactorEnabled).length;
    const twoFactorRate = total > 0 ? parseFloat(((twoFactorCount / total) * 100).toFixed(1)) : 0;

    return {
      total,
      active,
      inactive,
      suspended,
      pendingVerification,
      onboarding,
      twoFactorRate,
    };
  }, [data]);

  return {
    users: paginatedUsers,
    allFilteredUsers: filteredUsers,
    totalCount: data?.getAllUsers?.length || 0,
    totalFilteredCount,
    currentPage: safeCurrentPage,
    totalPages,
    pageSize: PAGE_SIZE,
    goToPage,
    projects,
    stats,
    loading,
    error,
    refetch,
    isWizardOpen,
    setIsWizardOpen,
    dropOtpState,
    setDropOtpState,
    searchTerm,
    setSearchTerm: setSearchTermWithReset,
    filters,
    setFilters: setFiltersWithReset,
    sortConfig,
    requestSort,
    selectedUserIds,
    toggleUserSelection,
    toggleAllSelection,
    clearSelection,
    handleInviteUser,
    handleResendInvitation,
    handleBulkResend,
    handleUpdateRole,
    handleDropUser,
    handleVerifyDrop,
    handleBulkDrop,
    handleBulkEnable2FA,
    handleBulkSuspend,
    handleRequestNewOtp,
  };
}
