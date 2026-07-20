import { describe, it, expect } from 'vitest';
import { getAvailableActions } from '../views/users/ActionDropdown';

describe('ActionDropdown RBAC - getAvailableActions', () => {
  const targetUser = {
    id: 'target-1',
    fullName: 'Target User',
    status: 'ACTIVE',
    hierarchyLevel: 5,
    department: 'ENGINEERING',
    reportingManagerId: 'manager-1',
  };

  describe('Level 1 (C-Suite)', () => {
    const caller = { id: 'caller-1', hierarchyLevel: 1, role: 'CEO', department: 'EXECUTIVE' };

    it('should return all actions for a regular target', () => {
      const actions = getAvailableActions(caller, targetUser);
      const types = actions.map(a => a.type);
      expect(types).toContain('invite');
      expect(types).toContain('promote');
      expect(types).toContain('change_role');
      expect(types).toContain('suspend');
      expect(types).toContain('drop');
      expect(types).toContain('change_manager');
      expect(types).toContain('update_status');
    });

    it('should hide Drop for Level 1 target', () => {
      const level1Target = { ...targetUser, hierarchyLevel: 1 };
      const actions = getAvailableActions(caller, level1Target);
      const types = actions.map(a => a.type);
      expect(types).not.toContain('drop');
    });

    it('should show Resend only if target is PENDING_VERIFICATION', () => {
      const pendingTarget = { ...targetUser, status: 'PENDING_VERIFICATION' };
      const actions = getAvailableActions(caller, pendingTarget);
      const types = actions.map(a => a.type);
      expect(types).toContain('resend_invitation');
    });

    it('should not show Resend for ACTIVE status', () => {
      const actions = getAvailableActions(caller, targetUser);
      const types = actions.map(a => a.type);
      expect(types).not.toContain('resend_invitation');
    });
  });

  describe('Level 2 (SVP)', () => {
    const caller = { id: 'caller-2', hierarchyLevel: 2, role: 'SVP_ENGINEERING', department: 'ENGINEERING' };

    it('should return full actions (same as Level 1 scoped to dept)', () => {
      const actions = getAvailableActions(caller, targetUser);
      const types = actions.map(a => a.type);
      expect(types).toContain('invite');
      expect(types).toContain('promote');
      expect(types).toContain('change_role');
      expect(types).toContain('suspend');
      expect(types).toContain('drop');
      expect(types).toContain('change_manager');
      expect(types).toContain('update_status');
    });

    it('should hide Drop for Level 1 target', () => {
      const level1Target = { ...targetUser, hierarchyLevel: 1 };
      const actions = getAvailableActions(caller, level1Target);
      const types = actions.map(a => a.type);
      expect(types).not.toContain('drop');
    });
  });

  describe('Level 3 (VP)', () => {
    const caller = { id: 'caller-3', hierarchyLevel: 3, role: 'VP_ENGINEERING', department: 'ENGINEERING' };

    it('should return limited actions (no Change Role, Suspend, Drop)', () => {
      const actions = getAvailableActions(caller, targetUser);
      const types = actions.map(a => a.type);
      expect(types).toContain('invite');
      expect(types).toContain('promote');
      expect(types).toContain('change_manager');
      expect(types).toContain('update_status');
      expect(types).not.toContain('change_role');
      expect(types).not.toContain('suspend');
      expect(types).not.toContain('drop');
    });

    it('VP_HR should get extra powers (Change Role, Suspend, Drop)', () => {
      const vpHrCaller = { id: 'caller-3', hierarchyLevel: 3, role: 'VP_HR', department: 'HR' };
      const actions = getAvailableActions(vpHrCaller, targetUser);
      const types = actions.map(a => a.type);
      expect(types).toContain('change_role');
      expect(types).toContain('suspend');
      expect(types).toContain('drop');
    });
  });

  describe('Level 4-5 HR', () => {
    const caller = { id: 'caller-4', hierarchyLevel: 4, role: 'HR_MANAGER', department: 'HR' };

    it('should return HR-specific actions', () => {
      const actions = getAvailableActions(caller, targetUser);
      const types = actions.map(a => a.type);
      expect(types).toContain('invite');
      expect(types).toContain('drop');
      expect(types).toContain('suspend');
      expect(types).toContain('change_manager');
      expect(types).toContain('update_status');
    });

    it('should not include promote or change_role', () => {
      const actions = getAvailableActions(caller, targetUser);
      const types = actions.map(a => a.type);
      expect(types).not.toContain('promote');
      expect(types).not.toContain('change_role');
    });

    it('should hide Drop for Level 1 target', () => {
      const level1Target = { ...targetUser, hierarchyLevel: 1 };
      const actions = getAvailableActions(caller, level1Target);
      const types = actions.map(a => a.type);
      expect(types).not.toContain('drop');
    });
  });

  describe('Level 4-5 non-HR', () => {
    const caller = { id: 'caller-5', hierarchyLevel: 5, role: 'ENGINEERING_MANAGER', department: 'ENGINEERING' };

    it('should only return Resend and Update Status', () => {
      const pendingTarget = { ...targetUser, status: 'PENDING_VERIFICATION' };
      const actions = getAvailableActions(caller, pendingTarget);
      const types = actions.map(a => a.type);
      expect(types).toContain('resend_invitation');
      expect(types).toContain('update_status');
      expect(types).not.toContain('drop');
      expect(types).not.toContain('suspend');
      expect(types).not.toContain('promote');
    });

    it('should only have update_status for ACTIVE user', () => {
      const actions = getAvailableActions(caller, targetUser);
      const types = actions.map(a => a.type);
      expect(types).toContain('update_status');
      expect(types).not.toContain('resend_invitation');
      expect(types.length).toBe(1);
    });
  });

  describe('Level 6-7 (IC)', () => {
    it('should return empty array (no actions)', () => {
      const caller = { id: 'caller-6', hierarchyLevel: 6, role: 'SENIOR_BACKEND_DEV', department: 'ENGINEERING' };
      const actions = getAvailableActions(caller, targetUser);
      expect(actions).toHaveLength(0);
    });

    it('Level 7 should return empty array', () => {
      const caller = { id: 'caller-7', hierarchyLevel: 7, role: 'JUNIOR_BACKEND_DEV', department: 'ENGINEERING' };
      const actions = getAvailableActions(caller, targetUser);
      expect(actions).toHaveLength(0);
    });
  });

  describe('Edge cases', () => {
    it('should mark Drop as danger', () => {
      const caller = { id: 'caller-1', hierarchyLevel: 1, role: 'CEO', department: 'EXECUTIVE' };
      const actions = getAvailableActions(caller, targetUser);
      const dropAction = actions.find(a => a.type === 'drop');
      expect(dropAction?.danger).toBe(true);
    });

    it('should mark Suspend as danger', () => {
      const caller = { id: 'caller-1', hierarchyLevel: 1, role: 'CEO', department: 'EXECUTIVE' };
      const actions = getAvailableActions(caller, targetUser);
      const suspendAction = actions.find(a => a.type === 'suspend');
      expect(suspendAction?.danger).toBe(true);
    });
  });
});
