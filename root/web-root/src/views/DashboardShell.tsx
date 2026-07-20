import React, { useState } from 'react';
import { useQuery, gql } from '@apollo/client';
import { NotificationPanel } from './NotificationPanel';
import { TwoFactorSetup } from './users/TwoFactorSetup';
import { useRealtimeEvents } from '../hooks/useRealtimeEvents';

const GET_UNREAD_COUNT = gql`query GetUnreadCount { getUnreadCount }`;
const GET_NOTIF_COUNT = gql`query GetNotifCount { getUnreadNotificationCount }`;

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  badge?: number;
  section: string;
}

interface DashboardShellProps {
  user: any;
  onLogout: () => void;
  navItems: NavItem[];
  sections: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
}

export function DashboardShell({ user, onLogout, navItems, sections, activeTab, onTabChange, children }: DashboardShellProps) {
  const [is2FASetupOpen, setIs2FASetupOpen] = useState(false);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  });
  // Apply theme and comfort mode to DOM
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-mode', 'comfort');
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
  };
  const { data: unreadData } = useQuery(GET_UNREAD_COUNT, { pollInterval: 60000, errorPolicy: 'ignore' });
  const { data: notifCountData } = useQuery(GET_NOTIF_COUNT, { pollInterval: 60000, errorPolicy: 'ignore' });
  const { connected: wsConnected } = useRealtimeEvents();

  const unreadCount = unreadData?.getUnreadCount || 0;
  const notifCount = notifCountData?.getUnreadNotificationCount || 0;

  // Inject badge for messages
  const enrichedNavItems = navItems.map(item => {
    if (item.id === 'messages') return { ...item, badge: unreadCount };
    return item;
  });

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-base)' }}>
      {is2FASetupOpen && (
        <TwoFactorSetup
          onComplete={() => { setIs2FASetupOpen(false); window.location.reload(); }}
          onCancel={() => setIs2FASetupOpen(false)}
        />
      )}
      <NotificationPanel open={notifPanelOpen} onClose={() => setNotifPanelOpen(false)} />

      {/* Sidebar */}
      <aside
        role="navigation"
        aria-label="Main navigation"
        style={{
          width: 240,
          background: 'var(--bg-raised)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div style={{ padding: '20px 20px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, background: 'var(--accent)', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: '0.85rem',
          }}>P</div>
          <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>Tracker</span>
          <button
            onClick={() => setNotifPanelOpen(true)}
            aria-label="Open notifications"
            aria-expanded={notifPanelOpen}
            style={{ marginLeft: 'auto', position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>◎</span>
            {notifCount > 0 && (
              <span
                aria-label={`${notifCount} unread notifications`}
                style={{
                  position: 'absolute', top: 0, right: 0, width: 14, height: 14,
                  borderRadius: '50%', background: '#e05252', color: '#fff',
                  fontSize: '0.5rem', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >{notifCount > 9 ? '9+' : notifCount}</span>
            )}
          </button>
        </div>

        {/* Role Tier Indicator */}
        <div style={{ padding: '0 20px 14px' }}>
          {(() => {
            const level = user.hierarchyLevel || 7;
            const config = level <= 3
              ? { label: 'Executive', color: '#e05252', bg: 'rgba(224,82,82,0.08)' }
              : level <= 5
              ? { label: 'Management', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' }
              : { label: 'Individual Contributor', color: '#5a5af0', bg: 'rgba(90,90,240,0.08)' };
            return (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, background: config.bg, border: `1px solid ${config.color}20` }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: config.color }} />
                <span style={{ fontSize: '0.62rem', fontWeight: 600, color: config.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{config.label}</span>
              </div>
            );
          })()}
        </div>

        {/* Navigation Items */}
        <nav style={{ flex: 1, padding: '0 10px', overflowY: 'auto' }}>
          {sections.map(section => {
            const items = enrichedNavItems.filter(i => i.section === section);
            if (items.length === 0) return null;
            return (
              <div key={section} style={{ marginBottom: 20 }}>
                <div style={{
                  padding: '0 10px', marginBottom: 6, fontSize: '0.65rem', fontWeight: 600,
                  color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em',
                }}>{section}</div>
                {items.map(item => {
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onTabChange(item.id)}
                      aria-current={active ? 'page' : undefined}
                      style={{
                        width: '100%', padding: '8px 10px', marginBottom: 2, borderRadius: 8,
                        border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 10,
                        fontSize: '0.82rem', fontWeight: active ? 500 : 400,
                        background: active ? 'var(--bg-elevated)' : 'transparent',
                        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                        transition: 'all 0.15s',
                      }}
                    >
                      <span style={{ fontSize: '0.75rem', opacity: active ? 1 : 0.6 }}>{item.icon}</span>
                      {item.label}
                      {item.badge && item.badge > 0 ? (
                        <span style={{
                          marginLeft: 'auto', background: 'var(--accent)', color: '#fff',
                          borderRadius: 10, padding: '1px 6px', fontSize: '0.6rem', fontWeight: 600,
                        }}>{item.badge}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* User Panel */}
        <div style={{ padding: '12px', borderTop: '1px solid var(--border)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px',
            borderRadius: 10, background: 'var(--bg-surface)',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.8rem',
            }}>
              {(user.fullName || user.email || 'U').charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontWeight: 500, fontSize: '0.78rem', color: 'var(--text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {user.fullName || user.email?.split('@')[0]}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>
                {user.role?.replace(/_/g, ' ')}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              style={{
                flex: 1, padding: '6px', background: 'var(--bg-surface)',
                border: '1px solid var(--border)', borderRadius: 7,
                color: 'var(--text-secondary)', cursor: 'pointer',
                fontWeight: 500, fontSize: '0.62rem', transition: 'all 0.15s',
              }}
            >
              {theme === 'dark' ? '☀ Light' : '● Dark'}
            </button>
            <button
              onClick={() => setIs2FASetupOpen(true)}
              aria-label="Open security settings"
              style={{
                flex: 1, padding: '6px', background: 'var(--bg-surface)',
                border: '1px solid var(--border)', borderRadius: 7,
                color: 'var(--text-secondary)', cursor: 'pointer',
                fontWeight: 500, fontSize: '0.68rem', transition: 'all 0.15s',
              }}
            >
              Security
            </button>
            <button
              onClick={onLogout}
              aria-label="Logout"
              style={{
                flex: 1, padding: '6px', background: 'var(--bg-surface)',
                border: '1px solid var(--border)', borderRadius: 7,
                color: '#e05252', cursor: 'pointer',
                fontWeight: 500, fontSize: '0.68rem', transition: 'all 0.15s',
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-base)' }}>
        <div style={{ padding: '28px 36px', maxWidth: 1320, margin: '0 auto' }}>
          {children}
        </div>
      </main>
    </div>
  );
}
