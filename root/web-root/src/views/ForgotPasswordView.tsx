import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { REQUEST_PASSWORD_RESET, RESET_PASSWORD } from './users/queries';

/**
 * ForgotPasswordView - Complete password reset flow
 * 
 * Step 1: Enter email → calls requestPasswordReset → sends reset link
 * Step 2: Enter reset token + new password → calls resetPassword → success
 * 
 * The flow is:
 * 1. User clicks "Forgot Password?" on login page
 * 2. Enters their email
 * 3. Backend sends reset email with a tokenized link
 * 4. User clicks link or enters token manually
 * 5. User enters new password
 * 6. Backend validates token + updates password
 * 7. User redirected back to login
 */
export function ForgotPasswordView({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<'request' | 'reset' | 'success'>('request');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const [requestReset, { loading: requesting }] = useMutation(REQUEST_PASSWORD_RESET);
  const [resetPassword, { loading: resetting }] = useMutation(RESET_PASSWORD);

  const handleRequestReset = async () => {
    setError('');
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    try {
      await requestReset({ variables: { email } });
      setStep('reset');
    } catch (err: any) {
      // Don't reveal whether the email exists (security)
      setStep('reset');
    }
  };

  const handleResetPassword = async () => {
    setError('');
    if (!token.trim()) {
      setError('Please enter the reset token from your email');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    try {
      await resetPassword({ variables: { token: token.trim(), newPassword } });
      setStep('success');
    } catch (err: any) {
      setError(err.graphQLErrors?.[0]?.message || 'Invalid or expired reset token. Please request a new one.');
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: 400, margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '36px 32px' }}>
        
        {step === 'request' && (
          <>
            <h2 style={{ color: 'var(--text-primary)', fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px', textAlign: 'center' }}>
              Reset Password
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', textAlign: 'center', margin: '0 0 24px', lineHeight: 1.5 }}>
              Enter your email address and we'll send you a reset link.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                onKeyDown={(e) => e.key === 'Enter' && handleRequestReset()}
                style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.85rem' }}
              />
            </div>

            {error && <p style={{ color: '#ef4444', fontSize: '0.78rem', margin: '0 0 12px', textAlign: 'center' }}>{error}</p>}

            <button
              onClick={handleRequestReset}
              disabled={requesting}
              style={{ width: '100%', padding: '12px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.85rem', cursor: requesting ? 'not-allowed' : 'pointer', opacity: requesting ? 0.6 : 1, marginBottom: 12 }}
            >
              {requesting ? 'Sending...' : 'Send Reset Link'}
            </button>

            <button
              onClick={onBack}
              style={{ width: '100%', padding: '10px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-secondary)', fontSize: '0.82rem', cursor: 'pointer' }}
            >
              Back to Login
            </button>
          </>
        )}

        {step === 'reset' && (
          <>
            <h2 style={{ color: 'var(--text-primary)', fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px', textAlign: 'center' }}>
              Enter Reset Code
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', textAlign: 'center', margin: '0 0 24px', lineHeight: 1.5 }}>
              Check your email for the reset token. Enter it below with your new password.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>Reset Token</label>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste reset token from email"
                style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.85rem', fontFamily: 'monospace' }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                onKeyDown={(e) => e.key === 'Enter' && handleResetPassword()}
                style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.85rem' }}
              />
            </div>

            {error && <p style={{ color: '#ef4444', fontSize: '0.78rem', margin: '0 0 12px', textAlign: 'center' }}>{error}</p>}

            <button
              onClick={handleResetPassword}
              disabled={resetting}
              style={{ width: '100%', padding: '12px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.85rem', cursor: resetting ? 'not-allowed' : 'pointer', opacity: resetting ? 0.6 : 1, marginBottom: 12 }}
            >
              {resetting ? 'Resetting...' : 'Reset Password'}
            </button>

            <button
              onClick={() => { setStep('request'); setError(''); }}
              style={{ width: '100%', padding: '10px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-secondary)', fontSize: '0.82rem', cursor: 'pointer' }}
            >
              Request New Token
            </button>
          </>
        )}

        {step === 'success' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ width: 48, height: 48, margin: '0 auto 16px', borderRadius: '50%', background: 'rgba(16,185,129,0.1)', border: '2px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '1.2rem' }}>✓</span>
              </div>
              <h2 style={{ color: 'var(--text-primary)', fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px' }}>
                Password Updated
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: 0, lineHeight: 1.5 }}>
                Your password has been successfully reset. You can now log in with your new password.
              </p>
            </div>

            <button
              onClick={onBack}
              style={{ width: '100%', padding: '12px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
            >
              Back to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
}
