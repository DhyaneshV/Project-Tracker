import React, { useState } from 'react';
import { useQuery, gql } from '@apollo/client';
import { NotificationPanel } from '../views/NotificationPanel';
import { TwoFactorSetup } from '../views/users/TwoFactorSetup';

const GET_UNREAD_COUNT = gql`query GetUnreadCount { getUnreadCount }`;
const GET_NOTIF_COUNT = gql`query GetNotifCount { getUnreadNotificationCount }`;

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  badge?: number;
  section?: string;
}

interface DashboardShellProps {
  user: any;
  onLogout: () => void;
  navItems: NavItem[];
  sections: string[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  children: React.ReactNode;
}

export function DashboardShell({ user, onLogout, navItems, sections, activeTab, onTabChange, children }: DashboardShellProps) {
  const [is2FASetupOpen, setIs2FASetupOpen] = useState(false);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);

  const { data: notifCountData } = useQuery(GET_NOTIF_COUNT, { pollInterval: 60000 });
  const notifCount = notifCountData?.getUnreadNotificationCount || 0;

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
      <aside style={{
        width: 240,
        background: 'var(--bg-raised)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, background: 'var(--accent)', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: '0.85rem',
          }}>P</div>
          <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>Tracker</span>
          <button
            onClick={() => setNotifPanelOpen(true)}
            style={{ marginLeft: 'auto', position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
            aria-label="Open notifications"
          >
            <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>◎</span>
            {notifCount > 0 && (
              <span style={{
                position: 'absolute', top: 0, right: 0, width: 14, height: 14,
                borderRadius: '50%', background: '#e05252', color: '#fff',
                fontSize: '0.5rem', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {notifCount > 9 ? '9+' : notifCount}
              </span>
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '0 10px', overflowY: 'auto' }}>
          {sections.map(section => {
            const items = navItems.filter(i => i.section === section);
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
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px', borderRadius: 10, background: 'var(--bg-surface)',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-elevated)',
              border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
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
              onClick={() => setIs2FASetupOpen(true)}
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
