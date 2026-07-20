import React, { useState, useEffect } from 'react';

/**
 * useNetworkStatus - Detects online/offline state changes.
 * Shows a non-intrusive banner when the user loses connection.
 */
function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true);
      // Clear the "back online" message after 3 seconds
      setTimeout(() => setWasOffline(false), 3000);
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, wasOffline };
}

/**
 * NetworkStatusBar - Displays a persistent banner when offline,
 * and a brief "reconnected" banner when coming back online.
 * 
 * Place this at the top of your app layout (inside DashboardShell or main).
 */
export function NetworkStatusBar() {
  const { isOnline, wasOffline } = useNetworkStatus();

  if (isOnline && !wasOffline) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        padding: '8px 16px',
        textAlign: 'center',
        fontSize: '0.78rem',
        fontWeight: 600,
        transition: 'transform 0.3s, opacity 0.3s',
        background: isOnline ? '#10b981' : '#ef4444',
        color: '#fff',
      }}
    >
      {isOnline
        ? 'Connection restored. You are back online.'
        : 'You are offline. Some features may be unavailable until your connection is restored.'}
    </div>
  );
}
