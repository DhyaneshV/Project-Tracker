import React, { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { useFocusTrap } from '../hooks/useFocusTrap';

const GET_MY_NOTIFICATIONS = gql`
  query GetMyNotifications($limit: Int) { getMyNotifications(limit: $limit) { id userId type title message projectId projectName taskId actorName read createdAt } }
`;

const MARK_READ = gql`mutation MarkNotificationRead($notificationId: ID!, $createdAt: DateTime!) { markNotificationRead(notificationId: $notificationId, createdAt: $createdAt) }`;
const MARK_ALL_READ = gql`mutation { markAllNotificationsRead }`;

const GET_NOTIF_PREFS = gql`query { getNotificationPreferences { emailEnabled inAppEnabled taskAssigned taskStatusChanged projectUpdates teamChanges payrollUpdates securityAlerts messageNotifications } }`;
const UPDATE_NOTIF_PREFS = gql`mutation UpdateNotificationPreferences($preferences: NotificationPreferencesInput!) { updateNotificationPreferences(preferences: $preferences) { emailEnabled inAppEnabled taskAssigned taskStatusChanged projectUpdates teamChanges payrollUpdates securityAlerts messageNotifications } }`;

interface Props {
  open: boolean;
  onClose: () => void;
}

const typeIcon: Record<string, string> = {
  TASK_ASSIGNED: '◉',
  TASK_COMPLETED: '✓',
  PROJECT_UPDATE: '▸',
  MENTION: '@',
  MEMBER_ADDED: '+',
  BLOCKER: '!',
};

const typeColor: Record<string, string> = {
  TASK_ASSIGNED: '#5a5af0',
  TASK_COMPLETED: '#10b981',
  PROJECT_UPDATE: '#f59e0b',
  MENTION: '#5a5af0',
  MEMBER_ADDED: '#10b981',
  BLOCKER: '#e05252',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function NotificationPanel({ open, onClose }: Props) {
  const [showPrefs, setShowPrefs] = useState(false);
  const focusTrapRef = useFocusTrap(open, onClose);
  const { data, refetch } = useQuery(GET_MY_NOTIFICATIONS, { variables: { limit: 50 }, pollInterval: 60000, skip: !open });
  const [markRead] = useMutation(MARK_READ, { onCompleted: () => refetch() });
  const [markAllRead] = useMutation(MARK_ALL_READ, { onCompleted: () => refetch() });
  const { data: prefsData, refetch: refetchPrefs } = useQuery(GET_NOTIF_PREFS, { skip: !open || !showPrefs, errorPolicy: 'ignore' });
  const [updatePrefs] = useMutation(UPDATE_NOTIF_PREFS, { onCompleted: () => refetchPrefs() });

  const notifications = data?.getMyNotifications || [];
  const prefs = prefsData?.getNotificationPreferences;
  const unreadCount = notifications.filter((n: any) => !n.read).length;

  if (!open) return null;

  // Group by today / earlier
  const today = new Date().toDateString();
  const todayNotifs = notifications.filter((n: any) => new Date(n.createdAt).toDateString() === today);
  const earlierNotifs = notifications.filter((n: any) => new Date(n.createdAt).toDateString() !== today);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex' }} onClick={onClose} onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }} role="dialog" aria-modal="true" aria-label="Notifications">
      {/* Backdrop */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />

      {/* Panel */}
      <div ref={focusTrapRef} onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 0, right: 0, width: 380, maxWidth: '90vw', height: '100vh', background: 'var(--bg-raised)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', animation: 'slideInRight 0.2s ease' }}>
        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>Notifications</div>
            {unreadCount > 0 && <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: 2 }}>{unreadCount} unread</div>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowPrefs(!showPrefs)} style={{ padding: '5px 10px', background: showPrefs ? 'var(--accent)' : 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, color: showPrefs ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 500 }}>Settings</button>
            {!showPrefs && unreadCount > 0 && (
              <button onClick={() => markAllRead()} style={{ padding: '5px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 500 }}>Mark all read</button>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          {showPrefs ? (
            <div style={{ padding: '8px' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: 16 }}>Control which notifications you receive</p>
              {prefs ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <PrefToggle label="Email notifications" description="Receive notifications via email" checked={prefs.emailEnabled} onChange={v => updatePrefs({ variables: { preferences: { emailEnabled: v } } })} />
                  <PrefToggle label="In-app notifications" description="Show notifications in the app" checked={prefs.inAppEnabled} onChange={v => updatePrefs({ variables: { preferences: { inAppEnabled: v } } })} />
                  <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0' }} />
                  <PrefToggle label="Task assigned" description="When a task is assigned to you" checked={prefs.taskAssigned} onChange={v => updatePrefs({ variables: { preferences: { taskAssigned: v } } })} />
                  <PrefToggle label="Task status changes" description="When task status is updated" checked={prefs.taskStatusChanged} onChange={v => updatePrefs({ variables: { preferences: { taskStatusChanged: v } } })} />
                  <PrefToggle label="Project updates" description="Project milestones and progress" checked={prefs.projectUpdates} onChange={v => updatePrefs({ variables: { preferences: { projectUpdates: v } } })} />
                  <PrefToggle label="Team changes" description="When team members are added/removed" checked={prefs.teamChanges} onChange={v => updatePrefs({ variables: { preferences: { teamChanges: v } } })} />
                  <PrefToggle label="Payroll updates" description="Payroll runs and approvals" checked={prefs.payrollUpdates} onChange={v => updatePrefs({ variables: { preferences: { payrollUpdates: v } } })} />
                  <PrefToggle label="Security alerts" description="Login attempts, 2FA changes" checked={prefs.securityAlerts} onChange={v => updatePrefs({ variables: { preferences: { securityAlerts: v } } })} />
                  <PrefToggle label="Messages" description="Direct message notifications" checked={prefs.messageNotifications} onChange={v => updatePrefs({ variables: { preferences: { messageNotifications: v } } })} />
                </div>
              ) : (
                <div style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>Loading preferences...</div>
              )}
            </div>
          ) : (
          <>
          {notifications.length === 0 && (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>No notifications yet.</div>
          )}

          {todayNotifs.length > 0 && (
            <>
              <div style={{ fontSize: '0.62rem', fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', padding: '6px 8px', letterSpacing: '0.05em' }}>Today</div>
              {todayNotifs.map((n: any) => (
                <NotifItem key={n.id} notif={n} onMarkRead={() => markRead({ variables: { notificationId: n.id, createdAt: n.createdAt } })} />
              ))}
            </>
          )}

          {earlierNotifs.length > 0 && (
            <>
              <div style={{ fontSize: '0.62rem', fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', padding: '6px 8px', marginTop: 12, letterSpacing: '0.05em' }}>Earlier</div>
              {earlierNotifs.map((n: any) => (
                <NotifItem key={n.id} notif={n} onMarkRead={() => markRead({ variables: { notificationId: n.id, createdAt: n.createdAt } })} />
              ))}
            </>
          )}
          </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

function NotifItem({ notif, onMarkRead }: { notif: any; onMarkRead: () => void }) {
  const color = typeColor[notif.type] || 'var(--text-secondary)';
  const icon = typeIcon[notif.type] || '•';

  return (
    <div
      onClick={() => { if (!notif.read) onMarkRead(); }}
      style={{
        padding: '12px',
        borderRadius: 8,
        marginBottom: 4,
        background: notif.read ? 'transparent' : 'rgba(90,90,240,0.03)',
        border: `1px solid ${notif.read ? 'transparent' : 'rgba(90,90,240,0.08)'}`,
        cursor: notif.read ? 'default' : 'pointer',
        transition: 'background 0.15s',
      }}
    >
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: notif.read ? 400 : 500, color: notif.read ? 'var(--text-secondary)' : 'var(--text-primary)', lineHeight: 1.4 }}>
            {notif.title}
          </div>
          {notif.message && notif.message !== notif.title && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 2, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{notif.message}</div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
            {notif.projectName && <span style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', background: 'var(--bg-elevated)', padding: '1px 5px', borderRadius: 3 }}>{notif.projectName}</span>}
            <span style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)' }}>{timeAgo(notif.createdAt)}</span>
          </div>
        </div>
        {!notif.read && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#5a5af0', flexShrink: 0, marginTop: 4 }} />}
      </div>
    </div>
  );
}

function PrefToggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '8px 0' }}>
      <div>
        <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-primary)' }}>{label}</div>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>{description}</div>
      </div>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ accentColor: 'var(--accent)', width: 16, height: 16 }} />
    </label>
  );
}
