import React, { useState } from 'react';
import { useQuery, gql } from '@apollo/client';
import { usePermissions } from '../components/RBACContext';

const GET_ALL_USERS = gql`
  query GetAllUsers { getAllUsers { id fullName email role category department hierarchyLevel status lastLoginAt } }
`;

/**
 * DirectoryView - Organization directory with RBAC-based field visibility.
 * 
 * Level 1-3 (Admin): See everything (emails, status, last login, all levels)
 * Level 4-5 (Manager): See most info, emails of direct reports, not C-Suite emails
 * Level 6-7 (IC): See names, roles, departments only. No emails, no login times, no sensitive data.
 */
export function DirectoryView() {
  const { hierarchyLevel: viewerLevel } = usePermissions();
  const { data, loading } = useQuery(GET_ALL_USERS);
  const [filter, setFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');

  const users = data?.getAllUsers || [];
  const filtered = users.filter((u: any) => {
    const matchesSearch = !filter || u.fullName?.toLowerCase().includes(filter.toLowerCase()) || u.role?.toLowerCase().includes(filter.toLowerCase()) || u.department?.toLowerCase().includes(filter.toLowerCase());
    const matchesDept = deptFilter === 'ALL' || u.department === deptFilter;
    return matchesSearch && matchesDept;
  });

  const departments = [...new Set(users.map((u: any) => u.department).filter(Boolean))] as string[];
  const levelLabel: Record<number, string> = { 1: 'C-Suite', 2: 'SVP', 3: 'VP', 4: 'Senior Manager', 5: 'Manager / Team Lead', 6: 'Senior IC', 7: 'IC' };
  const levelColor: Record<number, string> = { 1: '#e05252', 2: '#f59e0b', 3: '#f59e0b', 4: '#10b981', 5: '#5a5af0', 6: '#5a5af0', 7: 'var(--text-tertiary)' };

  // Visibility rules based on viewer's hierarchy level
  const canSeeEmail = (targetLevel: number) => {
    if (viewerLevel <= 3) return true; // Admins see all emails
    if (viewerLevel <= 5) return targetLevel >= viewerLevel; // Managers see peers and below
    return false; // ICs don't see emails
  };
  const canSeeStatus = viewerLevel <= 5; // Only managers+ see status
  const canSeeLastLogin = viewerLevel <= 3; // Only admins see last login

  // Group by hierarchy level
  const byLevel = filtered.reduce((acc: any, u: any) => {
    const lvl = u.hierarchyLevel || 7;
    if (!acc[lvl]) acc[lvl] = [];
    acc[lvl].push(u);
    return acc;
  }, {} as Record<number, any[]>);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>Directory</h1>
          <p style={{ color: 'var(--text-tertiary)', margin: 0, fontSize: '0.85rem' }}>{users.length} team members</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search name, role, department..." style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '10px 14px', borderRadius: 8, fontSize: '0.82rem', width: 220 }} />
          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '10px 14px', borderRadius: 8, fontSize: '0.82rem' }}>
            <option value="ALL">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)' }}>Loading directory...</div>}

      {/* Org Chart by Level */}
      {Object.entries(byLevel).sort(([a], [b]) => Number(a) - Number(b)).map(([level, people]) => (
        <div key={level} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 4, height: 20, borderRadius: 2, background: levelColor[Number(level)] || 'var(--text-tertiary)' }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: levelColor[Number(level)] || 'var(--text-tertiary)' }}>{levelLabel[Number(level)] || `Level ${level}`}</span>
            <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-tertiary)', background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 8 }}>{(people as any[]).length}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
            {(people as any[]).map((u: any) => {
              const targetLevel = u.hierarchyLevel || 7;
              const showEmail = canSeeEmail(targetLevel);

              return (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg-raised)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--bg-elevated)', border: `2px solid ${levelColor[targetLevel] || 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.85rem' }}>
                    {u.fullName?.charAt(0) || '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.fullName}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: 2 }}>{u.role?.replace(/_/g, ' ')}</div>
                    {showEmail && u.email && (
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {canSeeStatus && (
                      <div style={{ fontSize: '0.6rem', fontWeight: 600, color: u.status === 'ACTIVE' ? '#10b981' : '#f59e0b', background: u.status === 'ACTIVE' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', padding: '2px 6px', borderRadius: 4 }}>{u.status?.replace(/_/g, ' ')}</div>
                    )}
                    {u.department && <div style={{ fontSize: '0.58rem', color: 'var(--text-tertiary)', marginTop: 3 }}>{u.department?.replace(/_/g, ' ')}</div>}
                    {canSeeLastLogin && u.lastLoginAt && (
                      <div style={{ fontSize: '0.55rem', color: 'var(--text-tertiary)', marginTop: 2 }}>{new Date(u.lastLoginAt).toLocaleDateString()}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {filtered.length === 0 && !loading && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '3rem', textAlign: 'center' }}>
          <div style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>No people found matching your search.</div>
        </div>
      )}
    </div>
  );
}
