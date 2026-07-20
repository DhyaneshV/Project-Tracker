import React, { Component, ErrorInfo } from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary - Catches React render errors and shows a recovery UI.
 * Prevents the entire app from crashing when a single component fails.
 * 
 * Logs error details to console for debugging.
 * In production, this could send to an error reporting service (Sentry, etc.)
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    
    // TODO: Send to error reporting service in production
    // e.g., Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--bg-base)', padding: '2rem',
        }}>
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16,
            padding: '48px 40px', maxWidth: 480, width: '100%', textAlign: 'center',
          }}>
            <div style={{
              width: 56, height: 56, margin: '0 auto 20px', borderRadius: '50%',
              background: 'rgba(239,68,68,0.1)', border: '2px solid rgba(239,68,68,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: '1.5rem' }}>!</span>
            </div>

            <h1 style={{ color: 'var(--text-primary)', fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px' }}>
              Something went wrong
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6, margin: '0 0 24px' }}>
              An unexpected error occurred. This has been logged for investigation. You can try recovering or reload the page.
            </p>

            {this.state.error && (
              <details style={{ textAlign: 'left', marginBottom: 24, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                <summary style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}>
                  Technical Details
                </summary>
                <pre style={{ color: '#ef4444', fontSize: '0.7rem', marginTop: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace' }}>
                  {this.state.error.message}
                </pre>
              </details>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={this.handleReset}
                style={{
                  flex: 1, padding: '12px', background: 'var(--accent)', color: '#fff',
                  border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                }}
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                style={{
                  flex: 1, padding: '12px', background: 'var(--bg-elevated)',
                  color: 'var(--text-secondary)', border: '1px solid var(--border)',
                  borderRadius: 8, fontWeight: 500, fontSize: '0.85rem', cursor: 'pointer',
                }}
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
