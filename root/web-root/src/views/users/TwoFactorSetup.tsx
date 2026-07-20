import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { ENABLE_2FA, VERIFY_2FA_SETUP } from './queries';
import { TwoFactorMethod } from '@project-tracker/shared-types';

interface TwoFactorSetupProps {
  onComplete: () => void;
  onCancel: () => void;
}

export function TwoFactorSetup({ onComplete, onCancel }: TwoFactorSetupProps) {
  const [step, setStep] = useState(1);
  const [method, setMethod] = useState<TwoFactorMethod>(TwoFactorMethod.TOTP);
  const [setupData, setSetupData] = useState<any>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [enable2FAMutation] = useMutation(ENABLE_2FA);
  const [verify2FAMutation] = useMutation(VERIFY_2FA_SETUP);

  const handleStartSetup = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await enable2FAMutation({ variables: { method } });
      setSetupData(data.enable2FA);
      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Failed to start 2FA setup');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await verify2FAMutation({ 
        variables: { method, code: verificationCode } 
      });
      if (data.verify2FASetup) {
        setStep(3);
      } else {
        setError('Invalid verification code. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.9)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 2000,
      backdropFilter: 'blur(10px)'
    }}>
      <div style={{
        background: 'var(--bg-surface)',
        width: '100%',
        maxWidth: '450px',
        borderRadius: '28px',
        border: '1px solid var(--border)',
        padding: '2.5rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
      }}>
        {step === 1 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛡️</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '1rem', color: 'white' }}>Secure Your Account</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '2rem' }}>
              Add an extra layer of security by enabling Two-Factor Authentication.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2.5rem' }}>
              <button 
                onClick={() => setMethod(TwoFactorMethod.TOTP)}
                style={{ 
                  padding: '16px', 
                  borderRadius: '16px', 
                  backgroundColor: method === TwoFactorMethod.TOTP ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                  border: `2px solid ${method === TwoFactorMethod.TOTP ? '#6366f1' : 'var(--border)'}`,
                  color: 'white',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '15px'
                }}
              >
                <span style={{ fontSize: '1.5rem' }}>📱</span>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '1rem' }}>Authenticator App</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Use Google Authenticator or Authy</div>
                </div>
              </button>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={onCancel} style={{ flex: 1, padding: '12px', borderRadius: '12px', backgroundColor: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontWeight: '700', cursor: 'pointer' }}>Skip</button>
              <button onClick={handleStartSetup} disabled={loading} style={{ flex: 2, padding: '12px', borderRadius: '12px', backgroundColor: '#6366f1', border: 'none', color: 'white', fontWeight: '700', cursor: 'pointer' }}>
                {loading ? 'Starting...' : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {step === 2 && setupData && (
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '0.5rem', color: 'white' }}>Scan QR Code</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Scan this code in your authenticator app to link your account.</p>
            
            <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '20px', display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <img src={setupData.qrCodeSVG} alt="QR Code" style={{ width: '200px', height: '200px' }} />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>Manual Entry Key</label>
              <code style={{ display: 'block', padding: '10px', background: 'var(--bg-base)', borderRadius: '8px', color: '#6366f1', fontSize: '0.9rem', textAlign: 'center', letterSpacing: '2px' }}>
                {setupData.secret}
              </code>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>Verification Code</label>
              <input 
                type="text"
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                maxLength={6}
                style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'white', textAlign: 'center', fontSize: '1.5rem', letterSpacing: '8px', fontWeight: '800' }}
              />
            </div>

            {error && <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '1rem', textAlign: 'center' }}>{error}</div>}

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => setStep(1)} style={{ flex: 1, padding: '12px', borderRadius: '12px', backgroundColor: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontWeight: '700', cursor: 'pointer' }}>Back</button>
              <button 
                onClick={handleVerify} 
                disabled={loading || verificationCode.length !== 6} 
                style={{ flex: 2, padding: '12px', borderRadius: '12px', backgroundColor: '#6366f1', border: 'none', color: 'white', fontWeight: '700', cursor: 'pointer', opacity: verificationCode.length === 6 ? 1 : 0.5 }}
              >
                {loading ? 'Verifying...' : 'Enable 2FA'}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '70px', height: '70px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '2.5rem', margin: '0 auto 1.5rem' }}>✓</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '1rem', color: 'white' }}>Security Enabled!</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '2.5rem' }}>
              Your account is now protected with Two-Factor Authentication. You'll be asked for a code whenever you log in.
            </p>
            <button onClick={onComplete} style={{ width: '100%', padding: '14px', borderRadius: '14px', backgroundColor: '#10b981', border: 'none', color: 'white', fontWeight: '800', cursor: 'pointer' }}>
              Excellent
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
