import React, { useState, useEffect } from 'react';
import { useMutation } from '@apollo/client';
import { LOGIN_MUTATION, VERIFY_LOGIN_OTP } from './users/queries';
import { ForgotPasswordView } from './ForgotPasswordView';

interface Props {
    onAuthSuccess: (token: string, user: any, isNewUser: boolean, requiredActions?: string[]) => void;
}

export function LandingPageView({ onAuthSuccess }: Props) {
  const [step, setStep] = useState<'credentials' | 'otp' | 'forgot'>('credentials');
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [login, { loading: loginLoading }] = useMutation(LOGIN_MUTATION);
  const [verifyOtp, { loading: otpLoading }] = useMutation(VERIFY_LOGIN_OTP);

  useEffect(() => {
    let interval: any;
    if (timer > 0) interval = setInterval(() => setTimer(prev => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  useEffect(() => {
    let interval: any;
    if (resendCooldown > 0) interval = setInterval(() => setResendCooldown(prev => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (loginLoading) return;
    try {
      const { data } = await login({ variables: { email: formData.email.trim().toLowerCase(), password: formData.password } });
      if (data.login.requiresOTP) { setStep('otp'); setTimer(300); setResendCooldown(20); }
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    try {
      await login({ variables: { email: formData.email.trim().toLowerCase(), password: formData.password } });
      setTimer(300);
      setResendCooldown(20);
      setOtp('');
    } catch (err: any) {
      setError(err.message || 'Failed to resend OTP');
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (otpLoading) return;
    try {
      const { data } = await verifyOtp({ variables: { email: formData.email.trim().toLowerCase(), otp: otp.trim() } });
      const result = data.verifyLoginOTP;
      onAuthSuccess(result.token, result.user, result.isNewUser, result.requiredActions);
    } catch (err: any) {
      setError(err.message || 'Invalid verification code');
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', padding: '2rem' }}>
      <div className="animate-fade-in" style={{ width: '100%', maxWidth: 380, padding: '2.5rem', borderRadius: 16, background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ width: 40, height: 40, background: 'var(--accent)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.1rem', fontWeight: 700, margin: '0 auto 16px' }}>P</div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>
            {step === 'otp' ? 'Verify code' : 'Sign in'}
          </h1>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem', margin: 0 }}>
            {step === 'otp' ? 'Enter the code sent to your email' : 'Access your workspace'}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: 'rgba(224,82,82,0.06)', color: '#e05252', padding: '10px 14px', borderRadius: 10, marginBottom: '1.5rem', fontSize: '0.8rem', border: '1px solid rgba(224,82,82,0.12)', textAlign: 'center', fontWeight: 500 }}>
            {error}
          </div>
        )}

        {/* Login Form */}
        {step === 'credentials' && (
          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Email</label>
              <input type="email" placeholder="you@company.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Password</label>
              <input type="password" placeholder="••••••••" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required style={{ width: '100%' }} />
            </div>
            <button type="submit" disabled={loginLoading} className="btn-primary" style={{ marginTop: 8, width: '100%' }}>
              {loginLoading ? 'Signing in...' : 'Sign in'}
            </button>
            <button type="button" onClick={() => setStep('forgot')} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: '0.78rem', cursor: 'pointer', marginTop: 4, textAlign: 'center', width: '100%' }}>
              Forgot password?
            </button>
          </form>
        )}

        {/* OTP Form */}
        {step === 'otp' && (
          <form onSubmit={handleOtpSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="000000" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} maxLength={6} autoFocus style={{ width: '100%', textAlign: 'center', fontSize: '1.8rem', letterSpacing: '8px', fontWeight: 600, padding: '16px' }} />
              <div style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 10 }}>
                Expires in <span style={{ color: timer < 60 ? '#e05252' : 'var(--text-secondary)', fontWeight: 600 }}>{formatTime(timer)}</span>
              </div>
            </div>
            <button type="submit" disabled={otpLoading || otp.length !== 6 || timer === 0} className="btn-primary" style={{ width: '100%', opacity: (otp.length === 6 && timer > 0) ? 1 : 0.5 }}>
              {timer === 0 ? 'Code Expired' : otpLoading ? 'Verifying...' : 'Verify'}
            </button>
            <button type="button" onClick={handleResendOtp} disabled={resendCooldown > 0} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '8px', color: resendCooldown > 0 ? 'var(--text-tertiary)' : 'var(--text-secondary)', cursor: resendCooldown > 0 ? 'default' : 'pointer', fontWeight: 500, fontSize: '0.78rem' }}>
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
            </button>
            <button type="button" onClick={() => setStep('credentials')} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontWeight: 500, fontSize: '0.78rem' }}>
              ← Back
            </button>
          </form>
        )}

        {/* Forgot Password Flow */}
        {step === 'forgot' && (
          <ForgotPasswordView onBack={() => setStep('credentials')} />
        )}
      </div>
    </div>
  );
}
