import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, gql, useApolloClient, useMutation } from '@apollo/client';
import { LandingPageView } from './views/LandingPageView';
import { AdminDashboard } from './views/AdminDashboard';
import { TeamManagementDashboard } from './views/TeamManagementDashboard';
import { EmployeeDashboard } from './views/EmployeeDashboard';
import { RBACProvider } from './components/RBACContext';
import { PasswordChangeModal } from './views/users/PasswordChangeModal';

const GET_ME = gql`
  query GetMe {
    me {
      id
      email
      fullName
      orgRole
      category
      role
      hierarchyLevel
      department
      status
      organizationId
      twoFactorEnabled
      twoFactorMethod
    }
  }
`;

const LOGOUT_MUTATION = gql`
  mutation Logout {
    logout
  }
`;

interface MeData {
  me: {
    id: string;
    email: string;
    fullName: string;
    orgRole: string;
    category: string;
    role: string;
    hierarchyLevel: number;
    department: string;
    status: string;
    organizationId: string;
    twoFactorEnabled: boolean;
    twoFactorMethod: string;
  } | null;
}

/** Timeout duration for the me query (ms) */
const QUERY_TIMEOUT_MS = 10000;

function App() {
  const client = useApolloClient();
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isNewUser, setIsNewUser] = useState(false);
  const [localUser, setLocalUser] = useState<any>(null);
  const [queryTimedOut, setQueryTimedOut] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, loading, error, refetch } = useQuery<MeData>(GET_ME, {
    skip: !token,
    fetchPolicy: 'network-only',
    onCompleted: (res) => {
      // Clear timeout on success
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setQueryTimedOut(false);
      if (res.me) {
        setLocalUser(res.me);
      }
    },
    onError: () => {
      // Clear timeout on error (error handled below)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setQueryTimedOut(false);
    },
  });

  const [logoutMutation] = useMutation(LOGOUT_MUTATION);

  // Start timeout when query begins loading
  useEffect(() => {
    if (token && loading && !timeoutRef.current) {
      timeoutRef.current = setTimeout(() => {
        setQueryTimedOut(true);
        timeoutRef.current = null;
      }, QUERY_TIMEOUT_MS);
    }

    // Cleanup on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [token, loading]);

  const handleLogout = useCallback(async () => {
    try {
      if (token) {
        await logoutMutation().catch(e => console.warn('Server logout failed', e));
      }
    } finally {
      localStorage.removeItem('token');
      setToken(null);
      setLocalUser(null);
      setIsNewUser(false);
      setQueryTimedOut(false);
      await client.clearStore();
    }
  }, [token, logoutMutation, client]);

  // Handle authentication errors - redirect to login within 1 second
  useEffect(() => {
    if (error) {
      const isAuthError =
        error.message.includes('authenticated') ||
        error.message.includes('Unauthorized') ||
        error.message.includes('token') ||
        error.message.includes('forbidden') ||
        error.graphQLErrors?.some(e =>
          e.extensions?.code === 'UNAUTHENTICATED' ||
          e.extensions?.code === 'FORBIDDEN'
        );

      if (isAuthError) {
        const redirectTimer = setTimeout(() => {
          handleLogout();
        }, 1000);
        return () => clearTimeout(redirectTimer);
      }
    }
  }, [error, handleLogout]);

  // Handle `me` returning null (user not found/deleted)
  useEffect(() => {
    if (data && data.me === null && token) {
      const redirectTimer = setTimeout(() => {
        handleLogout();
      }, 1000);
      return () => clearTimeout(redirectTimer);
    }
  }, [data, token, handleLogout]);

  const handleAuthSuccess = async (newToken: string, user: any, isNew: boolean, requiredActions?: string[]) => {
    localStorage.setItem('token', newToken);

    // Seed cache for instant render
    client.writeQuery({
      query: GET_ME,
      data: { me: user },
    });

    setLocalUser(user);
    setToken(newToken);

    if (isNew || (requiredActions && requiredActions.includes('CHANGE_PASSWORD'))) {
      setIsNewUser(true);
    }

    await refetch().catch(e => console.warn('Background profile sync delayed', e));
  };

  const handleRetry = () => {
    setQueryTimedOut(false);
    refetch();
  };

  const activeUser = localUser || data?.me;

  // ─── RENDER STATES ──────────────────────────────────────────────

  // 1. No token → Landing page
  if (!token) {
    return <LandingPageView onAuthSuccess={handleAuthSuccess} />;
  }

  // 2. Timeout state - query took more than 10 seconds
  if (queryTimedOut && !activeUser) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', gap: '24px' }}>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '48px', maxWidth: 420, textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, margin: '0 auto 16px', borderRadius: '50%', background: 'rgba(234, 179, 8, 0.1)', border: '2px solid rgba(234, 179, 8, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '1.2rem' }}>⏱</span>
          </div>
          <h2 style={{ color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 600, marginBottom: 8 }}>Connection Timeout</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: 24 }}>
            The server did not respond within 10 seconds. This may be a network issue or the server may be temporarily unavailable.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              onClick={handleRetry}
              style={{
                padding: '10px 24px', background: 'var(--accent)', color: '#fff',
                border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
            <button
              onClick={handleLogout}
              style={{
                padding: '10px 24px', background: 'var(--bg-elevated)',
                color: 'var(--text-secondary)', border: '1px solid var(--border)',
                borderRadius: 8, fontWeight: 500, fontSize: '0.85rem', cursor: 'pointer',
              }}
            >
              Return to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Loading state (have token, no user yet, still within timeout)
  if (token && !activeUser && loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', gap: '24px', position: 'relative' }}>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          <div style={{ width: 48, height: 48, border: '4px solid rgba(99, 102, 241, 0.1)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: 'var(--text-tertiary)', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '2px', marginBottom: '8px' }}>Security Protocol</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Verifying encrypted session...</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontSize: '0.8rem' }}
        >
          Reset Connection
        </button>
      </div>
    );
  }

  // 4. Non-auth error (network issues, server errors) → show error with retry, NO redirect
  if (error && !activeUser) {
    const isAuthError =
      error.message.includes('authenticated') ||
      error.message.includes('Unauthorized') ||
      error.message.includes('token') ||
      error.message.includes('forbidden') ||
      error.graphQLErrors?.some(e =>
        e.extensions?.code === 'UNAUTHENTICATED' ||
        e.extensions?.code === 'FORBIDDEN'
      );

    // Auth errors are handled by the useEffect above (auto-redirect)
    // For non-auth errors, show retry UI without redirecting
    if (!isAuthError) {
      return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '2rem' }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '48px', maxWidth: 420, textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, margin: '0 auto 16px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', border: '2px solid rgba(239, 68, 68, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '1.2rem' }}>⚠</span>
            </div>
            <h2 style={{ color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 600, marginBottom: 8 }}>Connection Error</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: 24 }}>
              {error.message || 'Unable to connect to the server. Please check your network connection and try again.'}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={handleRetry}
                style={{
                  padding: '10px 24px', background: 'var(--accent)', color: '#fff',
                  border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Retry
              </button>
              <button
                onClick={handleLogout}
                style={{
                  padding: '10px 24px', background: 'var(--bg-elevated)',
                  color: 'var(--text-secondary)', border: '1px solid var(--border)',
                  borderRadius: 8, fontWeight: 500, fontSize: '0.85rem', cursor: 'pointer',
                }}
              >
                Return to Login
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Auth error - show brief message while redirect timer fires
    return (
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '32px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Session expired. Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // 5. Authenticated user - route to correct dashboard
  if (activeUser) {
    // Force password change if necessary
    if (isNewUser || activeUser.status === 'PENDING_VERIFICATION') {
      return (
        <PasswordChangeModal
          onSuccess={() => {
            setIsNewUser(false);
            if (activeUser) {
              setLocalUser({ ...activeUser, status: 'ACTIVE' });
            }
            refetch();
          }}
        />
      );
    }

    // Route based on hierarchy level
    const hierarchyLevel = activeUser.hierarchyLevel || 7;

    return (
      <RBACProvider user={activeUser}>
        {hierarchyLevel <= 3 ? (
          <AdminDashboard user={activeUser} onLogout={handleLogout} token={token!} />
        ) : hierarchyLevel <= 5 ? (
          <TeamManagementDashboard user={activeUser} onLogout={handleLogout} token={token!} />
        ) : (
          <EmployeeDashboard user={activeUser} onLogout={handleLogout} token={token!} />
        )}
      </RBACProvider>
    );
  }

  // 6. Fallback - no token state
  return <LandingPageView onAuthSuccess={handleAuthSuccess} />;
}

export default App;
