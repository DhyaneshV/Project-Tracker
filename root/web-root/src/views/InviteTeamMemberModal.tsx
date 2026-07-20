import React, { useState, useMemo } from 'react';
import { MemberSpecialty, ProjectRole } from '@project-tracker/shared-types';

interface Props {
  users: any[];
  projectId: string;
  projectName: string;
  isManager: boolean; // true = direct add, false = request allocation
  onDirectAdd: (userId: string, projectRole: ProjectRole, specialty: MemberSpecialty, allocation: number) => Promise<void>;
  onRequestAllocation: (userId: string, projectRole: ProjectRole, specialty: MemberSpecialty, allocation: number, reason: string) => Promise<void>;
  onClose: () => void;
}

export function InviteTeamMemberModal({ users, projectId, projectName, isManager, onDirectAdd, onRequestAllocation, onClose }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [specialty, setSpecialty] = useState<MemberSpecialty>(MemberSpecialty.GENERAL);
  const [projectRole, setProjectRole] = useState<ProjectRole>(ProjectRole.ENGINEER);
  const [allocation, setAllocation] = useState(100);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredUsers = useMemo(() => {
    if (!searchTerm) return [];
    const lower = searchTerm.toLowerCase();
    return users.filter((u: any) => u.fullName?.toLowerCase().includes(lower) || u.email?.toLowerCase().includes(lower)).slice(0, 6);
  }, [users, searchTerm]);

  const selectedUser = users.find((u: any) => u.id === selectedUserId);

  const handleSubmit = async () => {
    if (!selectedUserId) return;
    setLoading(true);
    setError(null);
    try {
      if (isManager) {
        await onDirectAdd(selectedUserId, projectRole, specialty, allocation);
      } else {
        await onRequestAllocation(selectedUserId, projectRole, specialty, allocation, reason);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to process request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(2,6,23,0.95)', zIndex: 3000, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(15px)' }}>
      <div style={{ background: 'var(--bg-surface)', padding: '2.5rem', borderRadius: 24, width: 520, border: '1px solid var(--border)', boxShadow: '0 50px 100px -20px rgba(0,0,0,0.8)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f4f4f5', margin: 0 }}>{isManager ? 'Assign Member' : 'Request Member'}</h2>
            <p style={{ color: '#71717a', fontSize: '0.78rem', margin: '4px 0 0' }}>
              {isManager ? 'Directly allocate to' : 'Request allocation for'}: <span style={{ color: '#7c5cfc', fontWeight: 700 }}>{projectName}</span>
            </p>
          </div>
          {!isManager && <span style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', padding: '4px 10px', borderRadius: 6, fontSize: '0.62rem', fontWeight: 800 }}>REQUIRES MANAGER APPROVAL</span>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <label style={labelStyle}>Search Employee</label>
            <input type="text" placeholder="Name or email..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setSelectedUserId(''); }} style={inputStyle} />
            {filteredUsers.length > 0 && !selectedUserId && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, marginTop: 4, zIndex: 10, overflow: 'hidden' }}>
                {filteredUsers.map((u: any) => (
                  <div key={u.id} onClick={() => { setSelectedUserId(u.id); setSearchTerm(u.fullName); }} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)' }} onMouseOver={e => (e.currentTarget.style.background = 'rgba(124,92,252,0.08)')} onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.85rem' }}>{u.fullName}</div>
                    <div style={{ fontSize: '0.68rem', color: '#71717a' }}>{u.email} — {u.role?.replace(/_/g, ' ')}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedUser && (
            <div style={{ background: 'rgba(16,185,129,0.06)', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(16,185,129,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.88rem' }}>{selectedUser.fullName}</div>
                <div style={{ fontSize: '0.7rem', color: '#71717a' }}>{selectedUser.role?.replace(/_/g, ' ')} • {selectedUser.department}</div>
              </div>
              <button onClick={() => { setSelectedUserId(''); setSearchTerm(''); }} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.68rem', fontWeight: 800, cursor: 'pointer' }}>✕</button>
            </div>
          )}

          {/* Role & Specialty */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Project Role</label>
              <select value={projectRole} onChange={e => setProjectRole(e.target.value as ProjectRole)} style={inputStyle}>
                <option value="ENGINEER">Engineer</option>
                <option value="QA_ENGINEER">QA Engineer</option>
                <option value="MEMBER">Member</option>
                <option value="VICE_TEAM_LEAD">Vice Team Lead</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Specialty</label>
              <select value={specialty} onChange={e => setSpecialty(e.target.value as MemberSpecialty)} style={inputStyle}>
                {Object.values(MemberSpecialty).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Allocation */}
          <div>
            <label style={labelStyle}>Allocation % (time commitment)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input type="range" min={10} max={100} step={10} value={allocation} onChange={e => setAllocation(Number(e.target.value))} style={{ flex: 1, accentColor: '#7c5cfc' }} />
              <span style={{ fontWeight: 800, color: '#7c5cfc', fontSize: '1rem', minWidth: 42 }}>{allocation}%</span>
            </div>
          </div>

          {/* Reason (required for Team Lead requests) */}
          {!isManager && (
            <div>
              <label style={labelStyle}>Reason for Request *</label>
              <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Why is this person needed on this project?" rows={3} style={{ ...inputStyle, resize: 'none' }} />
            </div>
          )}
        </div>

        {error && <div style={{ marginTop: '1rem', color: '#ef4444', fontSize: '0.78rem', background: 'rgba(239,68,68,0.06)', padding: '10px 14px', borderRadius: 8 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 12, marginTop: '2rem' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={loading || !selectedUserId || (!isManager && !reason)} style={{ flex: 2, padding: '12px', background: isManager ? 'linear-gradient(135deg, #7c5cfc, #a855f7)' : 'linear-gradient(135deg, #fbbf24, #f59e0b)', border: 'none', color: isManager ? 'white' : 'var(--text-primary)', borderRadius: 12, cursor: 'pointer', fontWeight: 800, fontSize: '0.85rem', opacity: (loading || !selectedUserId || (!isManager && !reason)) ? 0.5 : 1 }}>
            {loading ? 'Processing...' : isManager ? '✓ Assign to Project' : '📤 Submit Request'}
          </button>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.62rem', fontWeight: 800, color: '#71717a', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 };
const inputStyle: React.CSSProperties = { width: '100%', padding: '12px 14px', borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none', fontSize: '0.88rem' };
