import React, { useState, useMemo } from 'react';
import { useQuery, gql } from '@apollo/client';
import { FunctionalRole, UserCategory } from '@project-tracker/shared-types';
import { usePermissions } from '../../components/RBACContext';
import { useFocusTrap } from '../../hooks/useFocusTrap';

const GET_USERS_FOR_MANAGER = gql`
  query GetAllUsers { getAllUsers { id fullName department hierarchyLevel } }
`;

interface InvitationWizardProps {
  projects: any[];
  onInvite: (data: any) => Promise<any>;
  onClose: () => void;
}

// Map each category to its hierarchy level
const CATEGORY_LEVEL: Record<string, number> = {
  [UserCategory.C_SUITE]: 1,
  [UserCategory.SVP]: 2,
  [UserCategory.VP]: 3,
  [UserCategory.SENIOR_MANAGER]: 4,
  [UserCategory.MANAGER]: 5,
  [UserCategory.TEAM_LEAD]: 5,
  [UserCategory.SENIOR_IC]: 6,
  [UserCategory.JUNIOR_IC]: 7,
};

// Map roles to their category
const ROLE_TO_CATEGORY: Record<string, UserCategory> = {};
// C-Suite roles
[FunctionalRole.CEO, FunctionalRole.CTO, FunctionalRole.CFO, FunctionalRole.COO, FunctionalRole.CHRO].forEach(r => ROLE_TO_CATEGORY[r] = UserCategory.C_SUITE);
// SVP roles
[FunctionalRole.SVP_ENGINEERING, FunctionalRole.SVP_PRODUCT, FunctionalRole.SVP_OPERATIONS].forEach(r => ROLE_TO_CATEGORY[r] = UserCategory.SVP);
// VP roles
Object.values(FunctionalRole).filter(r => r.startsWith('VP_')).forEach(r => ROLE_TO_CATEGORY[r] = UserCategory.VP);
// Senior Manager roles
Object.values(FunctionalRole).filter(r => r.startsWith('SENIOR_') && (r.includes('MANAGER') || r.includes('DIRECTOR'))).forEach(r => ROLE_TO_CATEGORY[r] = UserCategory.SENIOR_MANAGER);
// Manager roles
Object.values(FunctionalRole).filter(r => r.includes('TEAM_MANAGER')).forEach(r => ROLE_TO_CATEGORY[r] = UserCategory.MANAGER);
// Team Lead roles
[FunctionalRole.TEAM_LEAD, FunctionalRole.TECH_LEAD].forEach(r => ROLE_TO_CATEGORY[r] = UserCategory.TEAM_LEAD);
// Senior IC roles
Object.values(FunctionalRole).filter(r => r.startsWith('SENIOR_') && !r.includes('MANAGER') && !r.includes('DIRECTOR')).forEach(r => { if (!ROLE_TO_CATEGORY[r]) ROLE_TO_CATEGORY[r] = UserCategory.SENIOR_IC; });
// Everything else = Junior IC
Object.values(FunctionalRole).forEach(r => { if (!ROLE_TO_CATEGORY[r]) ROLE_TO_CATEGORY[r] = UserCategory.JUNIOR_IC; });

export function InvitationWizard({ projects, onInvite, onClose }: InvitationWizardProps) {
  const { hierarchyLevel: callerLevel } = usePermissions();
  const focusTrapRef = useFocusTrap(true, onClose);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    category: '' as string,
    role: '' as string,
    department: '',
    reportingManagerId: '',
    twoFactorRequired: true
  });
  const [invitationResult, setInvitationResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Only show categories BELOW the caller's level
  const availableCategories = useMemo(() => {
    return Object.entries(CATEGORY_LEVEL)
      .filter(([_, level]) => level > callerLevel)
      .sort((a, b) => a[1] - b[1])
      .map(([cat]) => cat);
  }, [callerLevel]);

  // Only show roles belonging to the selected category
  const availableRoles = useMemo(() => {
    if (!formData.category) return [];
    return Object.entries(ROLE_TO_CATEGORY)
      .filter(([_, cat]) => cat === formData.category)
      .map(([role]) => role);
  }, [formData.category]);

  // Query users for reporting manager dropdown
  const { data: usersData } = useQuery(GET_USERS_FOR_MANAGER);

  // Reporting manager: same department + higher hierarchy (lower level number) than selected category
  const availableManagers = useMemo(() => {
    if (!formData.department || !formData.category) return [];
    const selectedLevel = CATEGORY_LEVEL[formData.category] || 7;
    return (usersData?.getAllUsers || []).filter((u: any) => {
      const sameOrRelatedDept = !formData.department || u.department === formData.department;
      const higherRank = (u.hierarchyLevel || 7) < selectedLevel;
      return sameOrRelatedDept && higherRank;
    });
  }, [usersData, formData.department, formData.category]);

  const handleNext = async () => {
    if (step === 1) {
      // Field-level validation
      const errors: Record<string, string> = {};
      if (!formData.fullName || formData.fullName.length < 2 || formData.fullName.length > 100) {
        errors.fullName = 'Full name must be 2-100 characters';
      }
      if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) || formData.email.length > 254) {
        errors.email = 'Valid email required (max 254 chars)';
      }
      if (!formData.department) {
        errors.department = 'Department is required';
      }
      if (!formData.category) {
        errors.category = 'Category is required';
      }
      if (!formData.role) {
        errors.role = 'Functional role is required';
      }
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0) return;

      setLoading(true);
      setError(null);
      try {
        const result = await onInvite({
          ...formData,
          hierarchyLevel: undefined 
        });
        setInvitationResult(result);
        setStep(2);
      } catch (err: any) {
        setError(err.message || 'Failed to invite user');
      } finally {
        setLoading(false);
      }
    } else if (step === 2) {
      setStep(3);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.8)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)'
    }}>
      <div ref={focusTrapRef} className="glass-panel" role="dialog" aria-modal="true" aria-label="Invite Team Member" style={{
        backgroundColor: 'var(--bg-surface)',
        width: '100%',
        maxWidth: '480px',
        padding: '2.5rem',
      }}>
        {/* Progress Dots */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '1.5rem', justifyContent: 'center' }}>
          {[1, 2, 3].map(s => (
            <div key={s} style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: s === step ? 'var(--primary)' : 'var(--border-subtle)',
              transition: 'all 0.3s'
            }} />
          ))}
        </div>

        {step === 1 && (
          <div className="animate-fade-in">
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '0.5rem' }}>Send Invitation</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>Add a new member to the organization hierarchy.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '4px' }}>Full Name</label>
                  <input
                    type="text"
                    placeholder="Jane Doe"
                    value={formData.fullName}
                    onChange={e => { setFormData({ ...formData, fullName: e.target.value }); setFieldErrors(f => ({ ...f, fullName: '' })); }}
                    style={{ width: '100%', borderColor: fieldErrors.fullName ? '#ef4444' : undefined }}
                  />
                  {fieldErrors.fullName && <div style={{ color: '#ef4444', fontSize: '0.65rem', marginTop: 2 }}>{fieldErrors.fullName}</div>}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '4px' }}>Email</label>
                  <input
                    type="email"
                    placeholder="jane@org.com"
                    value={formData.email}
                    onChange={e => { setFormData({ ...formData, email: e.target.value }); setFieldErrors(f => ({ ...f, email: '' })); }}
                    style={{ width: '100%', borderColor: fieldErrors.email ? '#ef4444' : undefined }}
                  />
                  {fieldErrors.email && <div style={{ color: '#ef4444', fontSize: '0.65rem', marginTop: 2 }}>{fieldErrors.email}</div>}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '4px' }}>Department</label>
                <select
                  value={formData.department}
                  onChange={e => setFormData({ ...formData, department: e.target.value })}
                  style={{ width: '100%' }}
                >
                  <option value="BACKEND">Engineering (Backend)</option>
                  <option value="FRONTEND">Engineering (Frontend)</option>
                  <option value="PRODUCT">Product Management</option>
                  <option value="HR">Human Resources</option>
                  <option value="EXECUTIVE">Executive Office</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '4px' }}>Category (Hierarchy Level)</label>
                <select
                  value={formData.category}
                  onChange={e => { setFormData({ ...formData, category: e.target.value, role: '' }); setFieldErrors(f => ({ ...f, category: '' })); }}
                  style={{ width: '100%' }}
                >
                  <option value="">Select category...</option>
                  {availableCategories.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')} (Level {CATEGORY_LEVEL[c]})</option>)}
                </select>
                {fieldErrors.category && <div style={{ color: '#ef4444', fontSize: '0.65rem', marginTop: 2 }}>{fieldErrors.category}</div>}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '4px' }}>Functional Role</label>
                <select
                  value={formData.role}
                  onChange={e => { setFormData({ ...formData, role: e.target.value }); setFieldErrors(f => ({ ...f, role: '' })); }}
                  style={{ width: '100%' }}
                  disabled={!formData.category}
                >
                  <option value="">{formData.category ? 'Select role...' : 'Select category first'}</option>
                  {availableRoles.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                </select>
                {fieldErrors.role && <div style={{ color: '#ef4444', fontSize: '0.65rem', marginTop: 2 }}>{fieldErrors.role}</div>}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '4px' }}>Reporting Manager</label>
                <select
                  value={formData.reportingManagerId}
                  onChange={e => setFormData({ ...formData, reportingManagerId: e.target.value })}
                  style={{ width: '100%' }}
                  disabled={!formData.category || !formData.department}
                >
                  <option value="">{(!formData.category || !formData.department) ? 'Select category & department first' : 'Select reporting manager...'}</option>
                  {availableManagers.map((u: any) => (
                    <option key={u.id} value={u.id}>{u.fullName} (Level {u.hierarchyLevel})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="2fa"
                  checked={formData.twoFactorRequired}
                  onChange={e => setFormData({ ...formData, twoFactorRequired: e.target.checked })}
                />
                <label htmlFor="2fa" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Require 2FA</label>
              </div>
            </div>
          </div>
        )}

        {step === 2 && invitationResult && (
          <div className="animate-fade-in">
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '0.5rem' }}>Credentials</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>Inform the user of their temporary password.</p>
            
            <div style={{ backgroundColor: 'var(--bg-hover)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-subtle)', marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '700', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '8px' }}>Temporal Password</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <code style={{ flex: 1, color: 'var(--primary)', fontWeight: '700', fontSize: '1.25rem' }}>
                  {invitationResult.temporaryPassword}
                </code>
                <button onClick={() => copyToClipboard(invitationResult.temporaryPassword)} className="btn-secondary" style={{ padding: '4px 12px' }}>Copy</button>
              </div>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>This password expires in 7 days and must be changed on first login.</p>
          </div>
        )}

        {step === 3 && (
          <div className="animate-fade-in" style={{ textAlign: 'center' }}>
            <div style={{ width: '48px', height: '48px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.5rem', margin: '0 auto 1rem' }}>✓</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '0.5rem' }}>Invitation Sent</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>{formData.email} has been added to the organization.</p>
          </div>
        )}

        {error && (
          <div style={{ marginTop: '1rem', color: 'var(--error)', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '2.5rem' }}>
          {step === 1 ? (
            <>
              <button onClick={onClose} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button 
                onClick={handleNext} 
                disabled={loading || !formData.email || !formData.fullName} 
                className="btn-primary"
                style={{ flex: 2, opacity: (loading || !formData.email || !formData.fullName) ? 0.5 : 1 }}
              >
                {loading ? 'Processing...' : 'Send Invite'}
              </button>
            </>
          ) : step === 2 ? (
            <button onClick={handleNext} className="btn-primary" style={{ flex: 1 }}>Done</button>
          ) : (
            <button onClick={onClose} className="btn-primary" style={{ flex: 1, backgroundColor: 'var(--success)' }}>Finish</button>
          )}
        </div>
      </div>
    </div>
  );
}
