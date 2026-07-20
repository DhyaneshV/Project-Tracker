import React, { useState } from 'react';
import { useMutation, gql } from '@apollo/client';

const COMPLETE_ONBOARDING = gql`
  mutation CompleteOnboarding($organizationName: String!, $orgRole: OrgRole!) {
    completeOnboarding(organizationName: $organizationName, orgRole: $orgRole) {
      id
      orgRole
      organization {
        name
      }
    }
  }
`;

interface Props {
  onComplete: () => void;
  onCancel: () => void;
  token: string;
}

export function OnboardingView({ onComplete, onCancel, token }: Props) {
  const [formData, setFormData] = useState({
    organizationName: '',
    orgRole: 'MEMBER'
  });
  
  const [completeOnboarding, { loading, error }] = useMutation(COMPLETE_ONBOARDING, {
    context: { headers: { Authorization: `Bearer ${token}` } },
    onCompleted: () => {
      onComplete(); // Move to dashboard
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    completeOnboarding({ variables: formData });
  };

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh', 
      background: 'var(--bg-base)', 
      fontFamily: '"Inter", "Segoe UI", sans-serif',
      backgroundImage: 'radial-gradient(circle at 50% 50%, var(--bg-surface) 0%, var(--bg-base) 100%)'
    }}>
      <div style={{ 
        background: 'var(--bg-surface)', 
        padding: '3.5rem', 
        borderRadius: '24px', 
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', 
        width: '440px', 
        border: '1px solid var(--border)',
        borderTop: '4px solid #10b981',
        position: 'relative'
      }}>
        <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#10b981', color: 'white', padding: '4px 12px', borderRadius: '100px', fontSize: '0.7rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Final Step
        </div>
        
        <h2 style={{ marginBottom: '0.75rem', color: '#ffffff', textAlign: 'center', fontSize: '1.75rem', fontWeight: '800', letterSpacing: '-0.5px' }}>
          Welcome to ProjectTracker!
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem', textAlign: 'center', fontSize: '0.95rem', lineHeight: '1.5' }}>
          Let's set up your workspace. Please tell us a bit about your organization.
        </p>

        {error && (
          <div style={{ 
            backgroundColor: 'rgba(231, 76, 60, 0.1)', 
            color: '#e74c3c', 
            padding: '12px', 
            borderRadius: '12px', 
            marginBottom: '1.5rem', 
            fontSize: '0.85rem', 
            textAlign: 'center',
            border: '1px solid rgba(231, 76, 60, 0.2)'
          }}>
            Error: {error.message}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.6rem', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Organization / Company Name
            </label>
            <input 
              type="text" 
              placeholder="e.g. Acme Corp" 
              value={formData.organizationName}
              onChange={(e) => setFormData({...formData, organizationName: e.target.value})}
              style={{ 
                width: '100%', 
                padding: '14px', 
                borderRadius: '12px', 
                border: '1px solid var(--border)', 
                background: 'var(--bg-base)', 
                color: 'white', 
                boxSizing: 'border-box',
                fontSize: '1rem',
                outline: 'none',
                transition: 'border-color 0.2s'
              }} 
              onFocus={(e) => (e.currentTarget.style.borderColor = '#10b981')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              required
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.6rem', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Your Role
            </label>
            <select 
              value={formData.orgRole}
              onChange={(e) => setFormData({...formData, orgRole: e.target.value})}
              style={{ 
                width: '100%', 
                padding: '14px', 
                borderRadius: '12px', 
                border: '1px solid var(--border)', 
                background: 'var(--bg-base)', 
                color: 'white', 
                boxSizing: 'border-box',
                fontSize: '1rem',
                outline: 'none',
                cursor: 'pointer'
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#10b981')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin (Organization Creator)</option>
            </select>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <button 
              type="submit" 
              disabled={loading || !formData.organizationName}
              style={{ 
                padding: '14px', 
                backgroundColor: '#6366f1', 
                color: '#ffffff', 
                border: 'none', 
                borderRadius: '12px', 
                cursor: (loading || !formData.organizationName) ? 'not-allowed' : 'pointer', 
                fontWeight: '700',
                fontSize: '1rem',
                opacity: (loading || !formData.organizationName) ? 0.6 : 1,
                boxShadow: '0 10px 20px -5px rgba(99, 102, 241, 0.4)',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => { if(!loading && formData.organizationName) e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              {loading ? 'Setting up...' : 'Complete Setup & Go to Dashboard'}
            </button>
            <button 
              type="button" 
              onClick={onCancel}
              style={{ 
                padding: '14px', 
                backgroundColor: 'transparent', 
                color: 'var(--text-secondary)', 
                border: '1px solid var(--border)', 
                borderRadius: '12px', 
                cursor: 'pointer', 
                fontWeight: '600',
                fontSize: '0.9rem',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => (e.currentTarget.style.borderColor = '#94a3b8')}
              onMouseOut={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              Cancel & Logout
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
