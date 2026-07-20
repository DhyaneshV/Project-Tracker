import React, { useState, useEffect, useRef } from 'react';
import { useQuery, gql } from '@apollo/client';
import { useUserManagementViewModel } from './UserManagementViewModel';
import { FunctionalRole, UserCategory, UserStatus } from '@project-tracker/shared-types';
import { InvitationWizard } from './InvitationWizard';
import { AuditLogViewer } from './AuditLogViewer';
import { ActionDropdown } from './ActionDropdown';
import { usePermissions } from '../../components/RBACContext';
import { UserTableSkeleton } from '../../components/Skeleton';

const GET_ME_CALLER = gql`
  query GetMeCaller {
    me {
      id
      role
      hierarchyLevel
      department
    }
  }
`;

export function UserManagementView({ token }: { token: string }) {
  const [activeView, setActiveView] = useState<'members' | 'audit'>('members');
  const [dropOtpInput, setDropOtpInput] = useState('');
  const { role, hierarchyLevel, canManageTeam } = usePermissions();
  const isAuthorizedToInvite = canManageTeam || hierarchyLevel <= 3;

  // Get full caller info for ActionDropdown RBAC
  const { data: meData } = useQuery(GET_ME_CALLER, {
    context: { headers: { Authorization: `Bearer ${token}` } },
    fetchPolicy: 'cache-first',
  });
  const callerInfo = meData?.me ? {
    id: meData.me.id,
    hierarchyLevel: meData.me.hierarchyLevel,
    role: meData.me.role,
    department: meData.me.department,
  } : null;

  // Debounced search
  const [localSearch, setLocalSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const { 
    users, 
    totalCount,
    totalFilteredCount,
    currentPage,
    totalPages,
    pageSize,
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
    setSearchTerm,
    filters,
    setFilters,
    sortConfig,
    requestSort,
    selectedUserIds,
    toggleUserSelection,
    toggleAllSelection,
    clearSelection,
    handleInviteUser, 
    handleVerifyDrop,
    handleDropUser,
    handleResendInvitation,
    handleBulkResend,
    handleBulkDrop,
    handleBulkEnable2FA,
    handleBulkSuspend,
    handleRequestNewOtp,
  } = useUserManagementViewModel(token);

  // 300ms debounce for search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchTerm(localSearch);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [localSearch, setSearchTerm]);

  if (loading) {
    return <UserTableSkeleton />;
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border)', textAlign: 'center' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Failed to Load Data</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>{error.message}</p>
        <button onClick={() => refetch()} style={{ padding: '8px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>
          Retry
        </button>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return '#10b981';
      case 'PENDING_VERIFICATION': return '#f59e0b';
      case 'SUSPENDED': return '#ef4444';
      case 'ONBOARDING': return '#6366f1';
      case 'INACTIVE': return '#64748b';
      default: return '#94a3b8';
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig.key !== column) return <span style={{ opacity: 0.3, marginLeft: 4 }}>↕</span>;
    return <span style={{ marginLeft: 4, color: 'var(--accent)' }}>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
  };

  const formatLastLogin = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHrs < 1) return 'Just now';
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <div style={{ width: '100%' }}>
      {isWizardOpen && isAuthorizedToInvite && (
        <InvitationWizard 
          projects={projects}
          onInvite={handleInviteUser} 
          onClose={() => setIsWizardOpen(false)} 
        />
      )}

      {/* Security OTP Modal */}
      {dropOtpState.isOpen && (
        <OtpModal
          dropOtpState={dropOtpState}
          dropOtpInput={dropOtpInput}
          setDropOtpInput={setDropOtpInput}
          handleVerifyDrop={handleVerifyDrop}
          setDropOtpState={setDropOtpState}
          handleRequestNewOtp={handleRequestNewOtp}
        />
      )}

      {/* Header */}
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Team Management</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.4rem', fontSize: '0.82rem' }}>Manage roles, invitations, and organizational security.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', background: 'var(--bg-elevated)', padding: 3, borderRadius: 8, border: '1px solid var(--border)' }}>
            <button onClick={() => setActiveView('members')} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: activeView === 'members' ? 'var(--bg-surface)' : 'transparent', color: activeView === 'members' ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>Members</button>
            <button onClick={() => setActiveView('audit')} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: activeView === 'audit' ? 'var(--bg-surface)' : 'transparent', color: activeView === 'audit' ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>Audit Logs</button>
          </div>
          {isAuthorizedToInvite && (
            <button onClick={() => setIsWizardOpen(true)} style={{ padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>
              Invite Member
            </button>
          )}
        </div>
      </div>

      {/* Status Dashboard */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '2rem' }}>
        <StatCard label="Total Members" value={stats.total} />
        <StatCard label="Active" value={stats.active} color="#10b981" />
        <StatCard label="Inactive" value={stats.inactive} color="#64748b" />
        <StatCard label="Suspended" value={stats.suspended} color="#ef4444" />
        <StatCard label="Pending Invitations" value={stats.pendingVerification} color="#f59e0b" />
        <StatCard label="Onboarding" value={stats.onboarding} color="#6366f1" />
        <StatCard label="2FA Adoption" value={`${stats.twoFactorRate}%`} color="var(--accent)" />
      </div>

      {activeView === 'members' ? (
        <MembersTable
          users={users}
          totalFilteredCount={totalFilteredCount}
          totalCount={totalCount}
          currentPage={currentPage}
          totalPages={totalPages}
          goToPage={goToPage}
          localSearch={localSearch}
          setLocalSearch={setLocalSearch}
          filters={filters}
          setFilters={setFilters}
          sortConfig={sortConfig}
          requestSort={requestSort}
          selectedUserIds={selectedUserIds}
          toggleUserSelection={toggleUserSelection}
          toggleAllSelection={toggleAllSelection}
          clearSelection={clearSelection}
          handleResendInvitation={handleResendInvitation}
          handleDropUser={handleDropUser}
          handleBulkResend={handleBulkResend}
          handleBulkEnable2FA={handleBulkEnable2FA}
          handleBulkSuspend={handleBulkSuspend}
          getStatusColor={getStatusColor}
          SortIcon={SortIcon}
          formatLastLogin={formatLastLogin}
          projects={projects}
          callerInfo={callerInfo}
          token={token}
          onRefresh={refetch}
          onInviteUser={() => setIsWizardOpen(true)}
        />
      ) : (
        <AuditLogViewer token={token} />
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
      <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: color || 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}

interface MembersTableProps {
  users: any[];
  totalFilteredCount: number;
  totalCount: number;
  currentPage: number;
  totalPages: number;
  goToPage: (page: number) => void;
  localSearch: string;
  setLocalSearch: (s: string) => void;
  filters: any;
  setFilters: (f: any) => void;
  sortConfig: any;
  requestSort: (key: string) => void;
  selectedUserIds: Set<string>;
  toggleUserSelection: (id: string) => void;
  toggleAllSelection: (users: any[]) => void;
  clearSelection: () => void;
  handleResendInvitation: (id: string) => void;
  handleDropUser: (id: string) => void;
  handleBulkResend: () => void;
  handleBulkEnable2FA: () => void;
  handleBulkSuspend: () => void;
  getStatusColor: (status: string) => string;
  SortIcon: React.FC<{ column: string }>;
  formatLastLogin: (d: string | null) => string;
  projects: any[];
  callerInfo: { id: string; hierarchyLevel: number; role: string; department: string } | null;
  token: string;
  onRefresh: () => void;
  onInviteUser: () => void;
}

function MembersTable({
  users, totalFilteredCount, totalCount, currentPage, totalPages, goToPage,
  localSearch, setLocalSearch, filters, setFilters, sortConfig, requestSort,
  selectedUserIds, toggleUserSelection, toggleAllSelection, clearSelection,
  handleResendInvitation, handleDropUser, handleBulkResend, handleBulkEnable2FA, handleBulkSuspend,
  getStatusColor, SortIcon, formatLastLogin, projects,
  callerInfo, token, onRefresh, onInviteUser,
}: MembersTableProps) {

  const hasSelection = selectedUserIds.size > 0;

  return (
    <>
      {/* Bulk Operations Toolbar */}
      {hasSelection && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', marginBottom: 12, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 10 }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent)' }}>{selectedUserIds.size} selected</span>
          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
          <button onClick={handleBulkEnable2FA} style={bulkBtnStyle}>Enable 2FA</button>
          <button onClick={handleBulkSuspend} style={bulkBtnStyle}>Suspend</button>
          <button onClick={handleBulkResend} style={bulkBtnStyle}>Resend Invite</button>
          <button onClick={clearSelection} style={{ ...bulkBtnStyle, marginLeft: 'auto', color: 'var(--text-tertiary)' }}>Clear</button>
        </div>
      )}

      {/* Filters Bar */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <input 
            type="text"
            placeholder="Search by name or email..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            aria-label="Search users"
            style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.82rem' }}
          />
        </div>
        <MultiSelect
          label="Category"
          options={Object.values(UserCategory).map(c => ({ value: c, label: c.replace(/_/g, ' ') }))}
          selected={filters.categories}
          onChange={(v) => setFilters({...filters, categories: v})}
        />
        <MultiSelect
          label="Role"
          options={Object.values(FunctionalRole).map(r => ({ value: r, label: r.replace(/_/g, ' ') }))}
          selected={filters.roles}
          onChange={(v) => setFilters({...filters, roles: v})}
        />
        <MultiSelect
          label="Status"
          options={Object.values(UserStatus).map(s => ({ value: s, label: s.replace(/_/g, ' ') }))}
          selected={filters.statuses}
          onChange={(v) => setFilters({...filters, statuses: v})}
        />
        <select value={filters.twoFactor} onChange={(e) => setFilters({...filters, twoFactor: e.target.value as any})} aria-label="Filter by 2FA" style={selectStyle}>
          <option value="ALL">2FA: All</option>
          <option value="ENABLED">2FA: Enabled</option>
          <option value="DISABLED">2FA: Disabled</option>
        </select>
        <select value={filters.project} onChange={(e) => setFilters({...filters, project: e.target.value})} aria-label="Filter by project" style={selectStyle}>
          <option value="ALL">Project: All</option>
          <option value="ANY">Has Project</option>
          <option value="NONE">No Project</option>
          {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', fontWeight: 600 }}>
          {totalFilteredCount} result{totalFilteredCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }} role="region" aria-label="User table" tabIndex={0}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)' }}>
                <Th width={36}><input type="checkbox" checked={selectedUserIds.size === users.length && users.length > 0} onChange={() => toggleAllSelection(users)} aria-label="Select all" /></Th>
                <Th sortable onClick={() => requestSort('fullName')}>Name <SortIcon column="fullName" /></Th>
                <Th sortable onClick={() => requestSort('email')}>Email <SortIcon column="email" /></Th>
                <Th sortable onClick={() => requestSort('role')}>Functional Role <SortIcon column="role" /></Th>
                <Th sortable onClick={() => requestSort('department')}>Department <SortIcon column="department" /></Th>
                <Th sortable onClick={() => requestSort('status')}>Status <SortIcon column="status" /></Th>
                <Th>2FA</Th>
                <Th sortable onClick={() => requestSort('lastLoginAt')}>Last Login <SortIcon column="lastLoginAt" /></Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                    No users match the current filters.
                  </td>
                </tr>
              )}
              {users.map((user: any) => (
                <tr key={user.id} style={{ borderBottom: '1px solid var(--border)', background: selectedUserIds.has(user.id) ? 'rgba(99,102,241,0.04)' : 'transparent' }}>
                  <td style={tdStyle}><input type="checkbox" checked={selectedUserIds.has(user.id)} onChange={() => toggleUserSelection(user.id)} aria-label={`Select ${user.fullName}`} /></td>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{user.fullName}</div>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{user.email}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{user.role?.replace(/_/g, ' ')}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ color: 'var(--text-secondary)' }}>{user.department?.replace(/_/g, ' ') || '—'}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 700, background: `${getStatusColor(user.status)}15`, color: getStatusColor(user.status) }}>
                      {user.status?.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    {user.twoFactorEnabled ? (
                      <span title={user.twoFactorMethod || 'Enabled'} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ color: '#10b981', fontSize: '0.9rem' }}>●</span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>{user.twoFactorMethod === 'TOTP' ? 'TOTP' : 'OTP'}</span>
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }} title="2FA not enabled">○</span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>{formatLastLogin(user.lastLoginAt)}</span>
                  </td>
                  <td style={tdStyle}>
                    {callerInfo && (
                      <ActionDropdown
                        targetUser={{
                          id: user.id,
                          fullName: user.fullName,
                          status: user.status,
                          hierarchyLevel: user.hierarchyLevel,
                          department: user.department,
                          reportingManagerId: user.reportingManagerId,
                        }}
                        caller={callerInfo}
                        token={token}
                        onDropUser={handleDropUser}
                        onInviteUser={onInviteUser}
                        onRefresh={onRefresh}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)' }} role="navigation" aria-label="Pagination">
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              Page {currentPage} of {totalPages} ({totalFilteredCount} users)
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <PaginationBtn label="«" onClick={() => goToPage(1)} disabled={currentPage === 1} />
              <PaginationBtn label="‹" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} />
              {getPaginationRange(currentPage, totalPages).map((p, i) => (
                p === '...' 
                  ? <span key={`ellipsis-${i}`} style={{ padding: '4px 6px', color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>…</span>
                  : <PaginationBtn key={p} label={String(p)} onClick={() => goToPage(p as number)} active={p === currentPage} />
              ))}
              <PaginationBtn label="›" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} />
              <PaginationBtn label="»" onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── HELPER COMPONENTS ──────────────────────────────────────────

function Th({ children, sortable, onClick, width }: { children: React.ReactNode; sortable?: boolean; onClick?: () => void; width?: number }) {
  return (
    <th
      onClick={onClick}
      style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--border)',
        color: 'var(--text-tertiary)',
        fontSize: '0.68rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        cursor: sortable ? 'pointer' : 'default',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        width: width ? `${width}px` : undefined,
      }}
    >
      {children}
    </th>
  );
}

function PaginationBtn({ label, onClick, disabled, active }: { label: string; onClick: () => void; disabled?: boolean; active?: boolean }) {
  const ariaLabel = label === '«' ? 'First page' : label === '»' ? 'Last page' : label === '‹' ? 'Previous page' : label === '›' ? 'Next page' : `Page ${label}`;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-current={active ? 'page' : undefined}
      style={{
        minWidth: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 6, border: 'none', cursor: disabled ? 'default' : 'pointer',
        background: active ? 'var(--accent)' : 'var(--bg-surface)',
        color: active ? '#fff' : disabled ? 'var(--text-tertiary)' : 'var(--text-secondary)',
        fontSize: '0.75rem', fontWeight: active ? 700 : 500,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {label}
    </button>
  );
}

function getPaginationRange(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '...')[] = [];
  pages.push(1);
  if (current > 3) pages.push('...');
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}

// ─── OTP MODAL COMPONENT ────────────────────────────────────────

const OTP_DURATION_SECONDS = 300; // 5 minutes

function OtpModal({ dropOtpState, dropOtpInput, setDropOtpInput, handleVerifyDrop, setDropOtpState, handleRequestNewOtp }: {
  dropOtpState: any;
  dropOtpInput: string;
  setDropOtpInput: (v: string) => void;
  handleVerifyDrop: (otp: string) => void;
  setDropOtpState: (s: any) => void;
  handleRequestNewOtp: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(OTP_DURATION_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const expired = secondsLeft <= 0;
  const disabled = dropOtpState.locked || expired;

  // Start countdown
  useEffect(() => {
    setSecondsLeft(OTP_DURATION_SECONDS);
    timerRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Focus trap: Tab cycling within modal
  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;
    const focusableSelector = 'input, button, [tabindex]:not([tabindex="-1"])';
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = Array.from(modal.querySelectorAll(focusableSelector)) as HTMLElement[];
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleClose = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setDropOtpState({ isOpen: false, userId: null, loading: false, error: null, attempts: 0, locked: false });
    setDropOtpInput('');
  };

  const handleNewOtp = () => {
    handleRequestNewOtp();
    setSecondsLeft(OTP_DURATION_SECONDS);
    setDropOtpInput('');
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="otp-modal-title" style={{ width: '100%', maxWidth: 400, padding: '2rem', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16 }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h2 id="otp-modal-title" style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Security Verification</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            Enter the 6-digit code sent to your email to authorize member removal.
          </p>
        </div>

        {/* Countdown Timer */}
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <span style={{
            fontSize: '1.2rem', fontWeight: 700, fontFamily: 'monospace',
            color: expired ? '#ef4444' : secondsLeft < 60 ? '#f59e0b' : 'var(--accent)',
          }}>
            {expired ? 'EXPIRED' : formatTime(secondsLeft)}
          </span>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
            {expired ? 'Code has expired' : 'Time remaining'}
          </div>
        </div>

        {/* OTP Input */}
        <div style={{ marginBottom: '1rem' }}>
          <input
            type="text"
            placeholder="000000"
            value={dropOtpInput}
            onChange={(e) => { if (/^\d{0,6}$/.test(e.target.value)) setDropOtpInput(e.target.value); }}
            maxLength={6}
            disabled={disabled}
            autoFocus
            aria-label="6-digit verification code"
            style={{
              width: '100%', textAlign: 'center', fontSize: '1.5rem', letterSpacing: 4,
              fontWeight: 700, padding: '12px', background: 'var(--bg-elevated)',
              border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)',
              opacity: disabled ? 0.5 : 1,
            }}
          />
        </div>

        {/* Error Message */}
        {dropOtpState.error && !dropOtpState.locked && (
          <div style={{ marginBottom: '1rem', color: '#ef4444', fontSize: '0.78rem', textAlign: 'center' }}>
            {dropOtpState.error}
            <span style={{ display: 'block', marginTop: 4, color: 'var(--text-tertiary)' }}>
              {3 - dropOtpState.attempts} attempt{3 - dropOtpState.attempts !== 1 ? 's' : ''} remaining
            </span>
          </div>
        )}

        {/* Locked State */}
        {dropOtpState.locked && (
          <div style={{ marginBottom: '1rem', padding: '12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#ef4444', fontSize: '0.78rem', textAlign: 'center' }}>
            OTP locked. Maximum 3 attempts reached. Please close and try again later.
          </div>
        )}

        {/* Expired State */}
        {expired && !dropOtpState.locked && (
          <div style={{ marginBottom: '1rem', padding: '12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, textAlign: 'center' }}>
            <p style={{ color: '#f59e0b', fontSize: '0.78rem', margin: '0 0 8px' }}>Code has expired.</p>
            <button
              onClick={handleNewOtp}
              disabled={dropOtpState.loading}
              style={{ padding: '6px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Request New Code
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={handleClose}
            style={{ flex: 1, padding: '10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 500, fontSize: '0.82rem' }}
          >
            {dropOtpState.locked ? 'Close' : 'Cancel'}
          </button>
          {!dropOtpState.locked && !expired && (
            <button
              onClick={() => handleVerifyDrop(dropOtpInput)}
              disabled={dropOtpState.loading || dropOtpInput.length !== 6}
              style={{
                flex: 1, padding: '10px', backgroundColor: '#ef4444', color: '#fff',
                border: 'none', borderRadius: 8,
                cursor: dropOtpState.loading ? 'not-allowed' : 'pointer',
                fontWeight: 600, fontSize: '0.82rem',
                opacity: dropOtpState.loading || dropOtpInput.length !== 6 ? 0.5 : 1,
              }}
            >
              {dropOtpState.loading ? 'Verifying...' : 'Authorize'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── STYLES ─────────────────────────────────────────────────────

const tdStyle: React.CSSProperties = {
  padding: '10px 14px',
  verticalAlign: 'middle',
};

const selectStyle: React.CSSProperties = {
  padding: '8px 10px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--text-primary)',
  fontSize: '0.78rem',
};

const bulkBtnStyle: React.CSSProperties = {
  padding: '5px 12px',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text-primary)',
  fontSize: '0.72rem',
  fontWeight: 600,
  cursor: 'pointer',
};

// ─── MULTI-SELECT COMPONENT ─────────────────────────────────────

function MultiSelect({ label, options, selected, onChange }: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggleValue = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter(v => v !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  const displayLabel = selected.length === 0 ? label : `${label} (${selected.length})`;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={`Filter by ${label}`}
        style={{
          ...selectStyle,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 4,
          background: selected.length > 0 ? 'rgba(99,102,241,0.08)' : 'var(--bg-elevated)',
          borderColor: selected.length > 0 ? 'rgba(99,102,241,0.3)' : 'var(--border)',
          color: selected.length > 0 ? 'var(--accent)' : 'var(--text-primary)',
          fontWeight: selected.length > 0 ? 600 : 400,
          whiteSpace: 'nowrap',
        }}
      >
        {displayLabel} <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>▼</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4,
          minWidth: 200, maxHeight: 240, overflowY: 'auto',
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', zIndex: 1002,
        }}>
          {selected.length > 0 && (
            <button
              onClick={() => onChange([])}
              style={{
                display: 'block', width: '100%', padding: '6px 12px',
                background: 'none', border: 'none', borderBottom: '1px solid var(--border)',
                color: 'var(--accent)', fontSize: '0.7rem', fontWeight: 600,
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              Clear all
            </button>
          )}
          {options.map(opt => {
            const isSelected = selected.includes(opt.value);
            return (
              <label
                key={opt.value}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 12px', cursor: 'pointer', fontSize: '0.75rem',
                  color: 'var(--text-primary)',
                  background: isSelected ? 'rgba(99,102,241,0.05)' : 'transparent',
                }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleValue(opt.value)}
                  style={{ accentColor: 'var(--accent)', margin: 0 }}
                />
                {opt.label}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
