import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { CHANGE_PASSWORD } from './queries';

interface Props {
  onSuccess: () => void;
}

export function PasswordChangeModal({ onSuccess }: Props) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [changePassword, { loading }] = useMutation(CHANGE_PASSWORD);

  const requirements = {
    length: newPassword.length >= 12,
    upper: /[A-Z]/.test(newPassword),
    lower: /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    symbol: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword)
  };

  const allMet = Object.values(requirements).every(Boolean) && newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!allMet) return;

    try {
      await changePassword({ variables: { newPassword } });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    }
  };

  const Requirement = ({ met, label }: { met: boolean, label: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: met ? '#10b981' : '#64748b' }}>
      <span>{met ? '✓' : '○'}</span>
      <span>{label}</span>
    </div>
  );

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.95)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000, backdropFilter: 'blur(10px)' }}>
      <div style={{ background: 'var(--bg-surface)', width: '100%', maxWidth: '440px', padding: '3rem', borderRadius: '32px', border: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: '900', marginBottom: '0.5rem', color: 'white' }}>Change Password</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '2rem' }}>You must update your temporary password before accessing the dashboard.</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>New Password</label>
            <input 
              type="password"
              placeholder="••••••••••••"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
              style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'white' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '1rem', background: 'var(--bg-base)', borderRadius: '16px', border: '1px solid var(--border)' }}>
            <Requirement met={requirements.length} label="12+ Characters" />
            <Requirement met={requirements.upper} label="Uppercase" />
            <Requirement met={requirements.lower} label="Lowercase" />
            <Requirement met={requirements.number} label="Number" />
            <Requirement met={requirements.symbol} label="Symbol" />
            <Requirement met={newPassword === confirmPassword && confirmPassword !== ''} label="Passwords Match" />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>Confirm Password</label>
            <input 
              type="password"
              placeholder="••••••••••••"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'white' }}
            />
          </div>

          {error && <div style={{ color: '#ef4444', fontSize: '0.85rem', textAlign: 'center' }}>{error}</div>}

          <button 
            type="submit" 
            disabled={loading || !allMet} 
            style={{ padding: '16px', backgroundColor: '#6366f1', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '800', cursor: 'pointer', opacity: allMet ? 1 : 0.5 }}
          >
            {loading ? 'Updating...' : 'Update Password & Enter'}
          </button>
        </form>
      </div>
    </div>
  );
}
