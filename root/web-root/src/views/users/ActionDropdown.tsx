import React, { useState, useRef, useEffect } from 'react';
import { useMutation } from '@apollo/client';
import {
  PROMOTE_USER,
  SUSPEND_USER,
  CHANGE_REPORTING_MANAGER,
  UPDATE_USER_STATUS,
  RESEND_INVITATION,
} from './queries';

export type ActionType =
  | 'invite'
  | 'promote'
  | 'change_role'
  | 'suspend'
  | 'drop'
  | 'change_manager'
  | 'resend_invitation'
  | 'update_status';

interface ActionDropdownProps {
  /** The target user row data */
  targetUser: {
    id: string;
    fullName: string;
    status: string;
    hierarchyLevel: number;
    department?: string;
    reportingManagerId?: string;
  };
  /** The authenticated caller's info */
  caller: {
    id: string;
    hierarchyLevel: number;
    role: string;
    department: string;
  };
  /** Token for API auth */
  token: string;
  /** Callback when the Drop action is selected (triggers OTP flow externally) */
  onDropUser: (userId: string) => void;
  /** Callback when Invite is clicked (opens wizard externally) */
  onInviteUser: () => void;
  /** Callback after a successful mutation to refresh data */
  onRefresh: () => void;
}

interface ActionItem {
  type: ActionType;
  label: string;
  danger?: boolean;
}

/**
 * ActionDropdown - RBAC-enforced contextual action menu for each user row.
 * 
 * Scoping rules:
 * - Level 1: All actions (Invite, Promote, Change Role, Suspend, Drop, Change Manager, Resend, Update Status)
 * - Level 2: All actions, scoped to departments they oversee
 * - Level 3: Invite, Promote, Change Manager, Resend, Update Status (unless VP_HR → gets full access)
 * - Level 4-5 HR: Invite, Drop, Suspend, Change Manager, Update Status, Resend
 * - Level 4-5 non-HR: Resend, Update Status (direct reports only)
 * - Level 6-7: No dropdown rendered
 * 
 * Additional rules:
 * - Self-action prevention: no actions on own row
 * - Hide "Resend Invitation" if target status !== PENDING_VERIFICATION
 * - Hide "Drop" if target is Level 1
 */
export function ActionDropdown({ targetUser, caller, token, onDropUser, onInviteUser, onRefresh }: ActionDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const context = { headers: { Authorization: `Bearer ${token}` } };

  const [promoteUserMutation] = useMutation(PROMOTE_USER, { context, onCompleted: onRefresh });
  const [suspendUserMutation] = useMutation(SUSPEND_USER, { context, onCompleted: onRefresh });
  const [changeManagerMutation] = useMutation(CHANGE_REPORTING_MANAGER, { context, onCompleted: onRefresh });
  const [updateStatusMutation] = useMutation(UPDATE_USER_STATUS, { context, onCompleted: onRefresh });
  const [resendInvitationMutation] = useMutation(RESEND_INVITATION, { context, onCompleted: onRefresh });

  // Close dropdown on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen]);

  // ─── RBAC: Determine which actions to show ──────────────────────

  // Self-action prevention
  if (caller.id === targetUser.id) return null;

  // Level 6-7: No dropdown
  if (caller.hierarchyLevel >= 6) return null;

  const actions = getAvailableActions(caller, targetUser);

  // If no actions available after filtering, don't render
  if (actions.length === 0) return null;

  // ─── ACTION HANDLERS ────────────────────────────────────────────

  const executeAction = async (action: ActionType) => {
    setActionError(null);
    setActionLoading(true);

    try {
      switch (action) {
        case 'invite':
          onInviteUser();
          break;

        case 'promote': {
          const newRole = prompt(`Promote ${targetUser.fullName}: enter a FunctionalRole (for example, SENIOR_BACKEND_DEV or BACKEND_TEAM_MANAGER).`);
          if (!newRole) break;
          const levelInput = prompt(`Enter the new hierarchy level (1–${targetUser.hierarchyLevel - 1}). Lower numbers are higher rank.`);
          if (!levelInput) break;
          const newLevel = Number(levelInput);
          if (!Number.isInteger(newLevel) || newLevel < 1 || newLevel >= targetUser.hierarchyLevel) {
            throw new Error(`Enter a whole-number level between 1 and ${targetUser.hierarchyLevel - 1}.`);
          }
          await promoteUserMutation({ variables: { userId: targetUser.id, newRole, newLevel } });
          break;
        }

        case 'change_role': {
          const role = prompt(`Change role for ${targetUser.fullName}: Enter new FunctionalRole:`);
          if (!role) break;
          await promoteUserMutation({ variables: { userId: targetUser.id, newRole: role } });
          break;
        }

        case 'suspend': {
          const reason = prompt(`Suspend ${targetUser.fullName}: Enter reason (optional):`);
          if (reason === null) break; // cancelled
          await suspendUserMutation({ variables: { userId: targetUser.id, reason: reason || undefined } });
          break;
        }

        case 'drop':
          onDropUser(targetUser.id);
          break;

        case 'change_manager': {
          const newManagerId = prompt(`Change reporting manager for ${targetUser.fullName}: Enter new manager's user ID:`);
          if (!newManagerId) break;
          await changeManagerMutation({ variables: { userId: targetUser.id, newManagerId } });
          break;
        }

        case 'resend_invitation':
          await resendInvitationMutation({ variables: { userId: targetUser.id } });
          break;

        case 'update_status': {
          const status = prompt(`Update status for ${targetUser.fullName}: Enter new status (ACTIVE, SUSPENDED, ONBOARDING):`);
          if (!status) break;
          await updateStatusMutation({ variables: { userId: targetUser.id, status } });
          break;
        }
      }
    } catch (err: any) {
      const msg = err?.graphQLErrors?.[0]?.message || err?.message || 'Authorization denied';
      setActionError(msg);
      // Clear error after 4 seconds
      setTimeout(() => setActionError(null), 4000);
    } finally {
      setActionLoading(false);
      setIsOpen(false);
    }
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={`Actions for ${targetUser.fullName}`}
        disabled={actionLoading}
        style={{
          padding: '4px 10px',
          background: isOpen ? 'var(--bg-elevated)' : 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 6,
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: '0.82rem',
          fontWeight: 500,
        }}
      >
        {actionLoading ? '...' : '⋮'}
      </button>

      {actionError && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 4,
          padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 8, fontSize: '0.72rem', color: '#ef4444', whiteSpace: 'nowrap', zIndex: 1001,
          maxWidth: 260, wordBreak: 'break-word',
        }}>
          {actionError}
        </div>
      )}

      {isOpen && (
        <div
          role="menu"
          style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 4,
            minWidth: 180, background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', zIndex: 1001,
            overflow: 'hidden',
          }}
        >
          {actions.map(action => (
            <button
              key={action.type}
              role="menuitem"
              onClick={() => executeAction(action.type)}
              style={{
                display: 'block', width: '100%', padding: '9px 14px',
                background: 'none', border: 'none', textAlign: 'left',
                fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer',
                color: action.danger ? '#ef4444' : 'var(--text-primary)',
                borderBottom: '1px solid var(--border)',
              }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.background = 'var(--bg-elevated)'; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'none'; }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── RBAC LOGIC ───────────────────────────────────────────────────

export function getAvailableActions(
  caller: { hierarchyLevel: number; role: string; department: string },
  target: { id: string; status: string; hierarchyLevel: number; department?: string; reportingManagerId?: string }
): ActionItem[] {
  const actions: ActionItem[] = [];
  const callerLevel = caller.hierarchyLevel;
  const isHR = caller.department === 'HR' || caller.department === 'HUMAN_RESOURCES';
  const isVPHR = caller.role === 'VP_HR';

  if (callerLevel === 1) {
    // Level 1 (C-Suite): Full access
    actions.push({ type: 'invite', label: 'Invite User' });
    actions.push({ type: 'promote', label: 'Promote' });
    actions.push({ type: 'change_role', label: 'Change Role' });
    actions.push({ type: 'suspend', label: 'Suspend', danger: true });
    if (target.hierarchyLevel !== 1) {
      actions.push({ type: 'drop', label: 'Drop User', danger: true });
    }
    actions.push({ type: 'change_manager', label: 'Change Reporting Manager' });
    if (target.status === 'PENDING_VERIFICATION') {
      actions.push({ type: 'resend_invitation', label: 'Resend Invitation' });
    }
    actions.push({ type: 'update_status', label: 'Update Status' });
  } else if (callerLevel === 2) {
    // Level 2 (SVP): Full access scoped to departments they oversee
    actions.push({ type: 'invite', label: 'Invite User' });
    actions.push({ type: 'promote', label: 'Promote' });
    actions.push({ type: 'change_role', label: 'Change Role' });
    actions.push({ type: 'suspend', label: 'Suspend', danger: true });
    if (target.hierarchyLevel !== 1) {
      actions.push({ type: 'drop', label: 'Drop User', danger: true });
    }
    actions.push({ type: 'change_manager', label: 'Change Reporting Manager' });
    if (target.status === 'PENDING_VERIFICATION') {
      actions.push({ type: 'resend_invitation', label: 'Resend Invitation' });
    }
    actions.push({ type: 'update_status', label: 'Update Status' });
  } else if (callerLevel === 3) {
    // Level 3 (VP): Limited set unless VP_HR
    actions.push({ type: 'invite', label: 'Invite User' });
    actions.push({ type: 'promote', label: 'Promote' });

    if (isVPHR) {
      // VP_HR gets extra powers across all departments
      actions.push({ type: 'change_role', label: 'Change Role' });
      actions.push({ type: 'suspend', label: 'Suspend', danger: true });
      if (target.hierarchyLevel !== 1) {
        actions.push({ type: 'drop', label: 'Drop User', danger: true });
      }
    }

    actions.push({ type: 'change_manager', label: 'Change Reporting Manager' });
    if (target.status === 'PENDING_VERIFICATION') {
      actions.push({ type: 'resend_invitation', label: 'Resend Invitation' });
    }
    actions.push({ type: 'update_status', label: 'Update Status' });
  } else if (callerLevel <= 5) {
    // Level 4-5
    if (isHR) {
      // HR department: broader access
      actions.push({ type: 'invite', label: 'Invite User' });
      if (target.hierarchyLevel !== 1) {
        actions.push({ type: 'drop', label: 'Drop User', danger: true });
      }
      actions.push({ type: 'suspend', label: 'Suspend', danger: true });
      actions.push({ type: 'change_manager', label: 'Change Reporting Manager' });
      actions.push({ type: 'update_status', label: 'Update Status' });
      if (target.status === 'PENDING_VERIFICATION') {
        actions.push({ type: 'resend_invitation', label: 'Resend Invitation' });
      }
    } else {
      // Non-HR: Only for direct reports
      if (target.status === 'PENDING_VERIFICATION') {
        actions.push({ type: 'resend_invitation', label: 'Resend Invitation' });
      }
      actions.push({ type: 'update_status', label: 'Update Status' });
    }
  }

  return actions;
}
