import React, { useState, useMemo } from 'react';
import { User, UserStatus, FunctionalRole, Department } from '../types';
import { getStatusColor, getHierarchyColor, getDepartmentIcon, getRoleDisplayName } from '../utils/roleConfig';

interface UsersTableProps {
  users: User[];
  canPerformActions: boolean;
  onInviteUser?: () => void;
  onDropUser?: (userId: string) => void;
  onResendInvite?: (userId: string) => void;
  onViewDetails?: (userId: string) => void;
}

export function UsersTable({ users, canPerformActions, onInviteUser, onDropUser, onResendInvite, onViewDetails }: UsersTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'ALL'>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<Department | 'ALL'>('ALL');
  const [twoFactorFilter, setTwoFactorFilter] = useState<'ALL' | 'ENABLED' | 'DISABLED'>('ALL');
  const [sortField, setSortField] = useState<keyof User>('fullName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

  // Filtering and sorting
  const filteredAndSortedUsers = useMemo(() => {
    let result = [...users];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (u) =>
          u.fullName.toLowerCase().includes(term) ||
          u.email.toLowerCase().includes(term) ||
          u.role.toLowerCase().includes(term)
      );
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      result = result.filter((u) => u.status === statusFilter);
    }

    // Department filter
    if (departmentFilter !== 'ALL') {
      result = result.filter((u) => u.department === departmentFilter);
    }

    // 2FA filter
    if (twoFactorFilter === 'ENABLED') {
      result = result.filter((u) => u.twoFactorEnabled);
    } else if (twoFactorFilter === 'DISABLED') {
      result = result.filter((u) => !u.twoFactorEnabled);
    }

    // Sorting
    result.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Handle undefined/null
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;

      // Convert to comparable values
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [users, searchTerm, statusFilter, departmentFilter, twoFactorFilter, sortField, sortDirection]);

  const handleSort = (field: keyof User) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSelectAll = () => {
    if (selectedUsers.size === filteredAndSortedUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredAndSortedUsers.map((u) => u.id)));
    }
  };

  const handleSelectUser = (userId: string) => {
    const newSet = new Set(selectedUsers);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSelectedUsers(newSet);
  };

  const formatLastLogin = (lastLoginAt?: string) => {
    if (!lastLoginAt) return 'Never';
    const date = new Date(lastLoginAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div style={{ fontFamily: 'sans-serif' }}>
      {/* Filters & Search */}
      <div style={{
        backgroundColor: '#f8f9fa',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '20px',
        border: '1px solid #dee2e6',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '15px' }}>
          {/* Search */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', marginBottom: '5px', fontWeight: '500' }}>
              🔍 Search
            </label>
            <input
              type="text"
              placeholder="Name, email, or role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '14px',
              }}
            />
          </div>

          {/* Status Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', marginBottom: '5px', fontWeight: '500' }}>
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as UserStatus | 'ALL')}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '14px',
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value={UserStatus.ACTIVE}>Active</option>
              <option value={UserStatus.PENDING_VERIFICATION}>Pending</option>
              <option value={UserStatus.ONBOARDING}>Onboarding</option>
              <option value={UserStatus.INACTIVE}>Inactive</option>
              <option value={UserStatus.SUSPENDED}>Suspended</option>
            </select>
          </div>

          {/* Department Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', marginBottom: '5px', fontWeight: '500' }}>
              Department
            </label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value as Department | 'ALL')}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '14px',
              }}
            >
              <option value="ALL">All Departments</option>
              {Object.values(Department).map((dept) => (
                <option key={dept} value={dept}>
                  {getDepartmentIcon(dept)} {dept}
                </option>
              ))}
            </select>
          </div>

          {/* 2FA Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', marginBottom: '5px', fontWeight: '500' }}>
              2FA Status
            </label>
            <select
              value={twoFactorFilter}
              onChange={(e) => setTwoFactorFilter(e.target.value as 'ALL' | 'ENABLED' | 'DISABLED')}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '14px',
              }}
            >
              <option value="ALL">All</option>
              <option value="ENABLED">🔐 Enabled</option>
              <option value="DISABLED">❌ Disabled</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {canPerformActions && onInviteUser && (
            <button
              onClick={onInviteUser}
              style={{
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
              }}
            >
              ➕ Invite User
            </button>
          )}

          {selectedUsers.size > 0 && (
            <>
              <button
                onClick={() => setSelectedUsers(new Set())}
                style={{
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                Clear Selection ({selectedUsers.size})
              </button>
            </>
          )}

          <div style={{ marginLeft: 'auto', color: '#6c757d', fontSize: '14px', padding: '10px 0' }}>
            Showing {filteredAndSortedUsers.length} of {users.length} users
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', border: '1px solid #dee2e6', borderRadius: '8px' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          backgroundColor: 'white',
        }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
              {canPerformActions && (
                <th style={{ padding: '12px', textAlign: 'left', width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={selectedUsers.size === filteredAndSortedUsers.length && filteredAndSortedUsers.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
              )}
              <th
                style={{ padding: '12px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('fullName')}
              >
                Name {sortField === 'fullName' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th
                style={{ padding: '12px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('role')}
              >
                Role {sortField === 'role' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th
                style={{ padding: '12px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('department')}
              >
                Department {sortField === 'department' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th
                style={{ padding: '12px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('hierarchyLevel')}
              >
                Level {sortField === 'hierarchyLevel' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th
                style={{ padding: '12px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('status')}
              >
                Status {sortField === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th style={{ padding: '12px', textAlign: 'center' }}>2FA</th>
              <th
                style={{ padding: '12px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('lastLoginAt')}
              >
                Last Login {sortField === 'lastLoginAt' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              {canPerformActions && <th style={{ padding: '12px', textAlign: 'center' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedUsers.length === 0 ? (
              <tr>
                <td colSpan={canPerformActions ? 9 : 8} style={{ padding: '40px', textAlign: 'center', color: '#6c757d' }}>
                  No users found matching your filters.
                </td>
              </tr>
            ) : (
              filteredAndSortedUsers.map((user) => {
                const statusColors = getStatusColor(user.status);
                const hierarchyColors = getHierarchyColor(user.hierarchyLevel);

                return (
                  <tr key={user.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                    {canPerformActions && (
                      <td style={{ padding: '12px' }}>
                        <input
                          type="checkbox"
                          checked={selectedUsers.has(user.id)}
                          onChange={() => handleSelectUser(user.id)}
                        />
                      </td>
                    )}
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: '600' }}>{user.fullName}</div>
                      <div style={{ fontSize: '12px', color: '#6c757d' }}>{user.email}</div>
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px' }}>
                      {getRoleDisplayName(user.role)}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ fontSize: '14px' }}>
                        {getDepartmentIcon(user.department)} {user.department}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        backgroundColor: hierarchyColors.bg,
                        color: hierarchyColors.text,
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '600',
                      }}>
                        L{user.hierarchyLevel}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        backgroundColor: statusColors.bg,
                        color: statusColors.text,
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '500',
                      }}>
                        {user.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      {user.twoFactorEnabled ? (
                        <span title={`Method: ${user.twoFactorMethod}`}>🔐</span>
                      ) : (
                        <span style={{ color: '#dc3545' }}>❌</span>
                      )}
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', color: '#6c757d' }}>
                      {formatLastLogin(user.lastLoginAt)}
                    </td>
                    {canPerformActions && (
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                          {onViewDetails && (
                            <button
                              onClick={() => onViewDetails(user.id)}
                              style={{
                                backgroundColor: '#007bff',
                                color: 'white',
                                border: 'none',
                                padding: '5px 10px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px',
                              }}
                              title="View Details"
                            >
                              👁️
                            </button>
                          )}
                          {user.status === UserStatus.PENDING_VERIFICATION && onResendInvite && (
                            <button
                              onClick={() => onResendInvite(user.id)}
                              style={{
                                backgroundColor: '#ffc107',
                                color: 'black',
                                border: 'none',
                                padding: '5px 10px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px',
                              }}
                              title="Resend Invitation"
                            >
                              📧
                            </button>
                          )}
                          {onDropUser && user.status !== UserStatus.INACTIVE && (
                            <button
                              onClick={() => {
                                if (confirm(`Are you sure you want to drop ${user.fullName}?`)) {
                                  onDropUser(user.id);
                                }
                              }}
                              style={{
                                backgroundColor: '#dc3545',
                                color: 'white',
                                border: 'none',
                                padding: '5px 10px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px',
                              }}
                              title="Drop User"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
