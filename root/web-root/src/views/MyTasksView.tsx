import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';

const GET_MY_TASKS = gql`
  query GetMyTasks { getMyTasks { id projectId title description status priority assignedTo { id fullName } component startDate dueDate completedAt blockerReason createdAt } }
`;

const UPDATE_TASK_STATUS = gql`
  mutation UpdateTaskStatus($taskId: ID!, $status: TaskStatus!, $blockerReason: String, $completionNote: String) { updateTaskStatus(taskId: $taskId, status: $status, blockerReason: $blockerReason, completionNote: $completionNote) { id status } }
`;

const GET_PROJECTS = gql`query GetProjects { getProjects { id name } }`;

type Specialty = 'ALL' | 'FRONTEND' | 'BACKEND' | 'ML' | 'DEPLOYER' | 'TESTER' | 'DESIGNER' | 'QA' | 'DEVOPS' | 'GENERAL';
type StatusFilter = 'ALL' | 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED';

function daysLeft(dueDate: string): number {
  return Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function dueLabel(dueDate: string): { text: string; color: string } {
  const d = daysLeft(dueDate);
  if (d < 0) return { text: `${Math.abs(d)}d overdue`, color: '#e05252' };
  if (d === 0) return { text: 'Due today', color: '#e05252' };
  if (d <= 2) return { text: `${d}d left`, color: '#f59e0b' };
  if (d <= 7) return { text: `${d}d left`, color: '#5a5af0' };
  return { text: `${d}d left`, color: 'var(--text-tertiary)' };
}

const statusMeta: Record<string, { label: string; color: string; bg: string }> = {
  TODO: { label: 'To Do', color: 'var(--text-secondary)', bg: 'var(--bg-elevated)' },
  IN_PROGRESS: { label: 'In Progress', color: '#5a5af0', bg: 'rgba(90,90,240,0.08)' },
  BLOCKED: { label: 'Blocked', color: '#e05252', bg: 'rgba(224,82,82,0.08)' },
  COMPLETED: { label: 'Done', color: '#10b981', bg: 'rgba(16,185,129,0.08)' },
};

const priorityMeta: Record<string, { color: string }> = {
  CRITICAL: { color: '#e05252' },
  HIGH: { color: '#f59e0b' },
  MEDIUM: { color: '#5a5af0' },
  LOW: { color: 'var(--text-tertiary)' },
};

export function MyTasksView() {
  const { data, loading, refetch } = useQuery(GET_MY_TASKS, { pollInterval: 60000 });
  const { data: projData } = useQuery(GET_PROJECTS);
  const [updateStatus] = useMutation(UPDATE_TASK_STATUS, { onCompleted: () => refetch() });

  const [specialtyFilter, setSpecialtyFilter] = useState<Specialty>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [actionModal, setActionModal] = useState<{ taskId: string; action: 'complete' | 'block' } | null>(null);
  const [actionInput, setActionInput] = useState('');

  const tasks = data?.getMyTasks || [];
  const projects = projData?.getProjects || [];
  const getProjectName = (pid: string) => projects.find((p: any) => p.id === pid)?.name || '';

  // Sort: overdue first, then by nearest due date, then no-due-date last
  const sortedTasks = useMemo(() => {
    let filtered = [...tasks];
    if (specialtyFilter !== 'ALL') filtered = filtered.filter((t: any) => t.component?.toUpperCase() === specialtyFilter || (!t.component && specialtyFilter === 'GENERAL'));
    if (statusFilter !== 'ALL') filtered = filtered.filter((t: any) => t.status === statusFilter);
    return filtered.sort((a: any, b: any) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  }, [tasks, specialtyFilter, statusFilter]);

  const stats = useMemo(() => ({
    total: tasks.length,
    todo: tasks.filter((t: any) => t.status === 'TODO').length,
    inProgress: tasks.filter((t: any) => t.status === 'IN_PROGRESS').length,
    blocked: tasks.filter((t: any) => t.status === 'BLOCKED').length,
    completed: tasks.filter((t: any) => t.status === 'COMPLETED').length,
    overdue: tasks.filter((t: any) => t.dueDate && daysLeft(t.dueDate) < 0 && t.status !== 'COMPLETED').length,
  }), [tasks]);

  const handleAction = (taskId: string, action: 'start' | 'complete' | 'block' | 'reopen') => {
    if (action === 'start') {
      updateStatus({ variables: { taskId, status: 'IN_PROGRESS' } });
    } else if (action === 'complete' || action === 'block') {
      setActionModal({ taskId, action });
      setActionInput('');
    } else if (action === 'reopen') {
      updateStatus({ variables: { taskId, status: 'TODO' } });
    }
  };

  const confirmAction = () => {
    if (!actionModal) return;
    if (actionModal.action === 'complete') {
      updateStatus({ variables: { taskId: actionModal.taskId, status: 'COMPLETED', completionNote: actionInput.trim() || undefined } });
    } else if (actionModal.action === 'block') {
      if (!actionInput.trim()) return;
      updateStatus({ variables: { taskId: actionModal.taskId, status: 'BLOCKED', blockerReason: actionInput.trim() } });
    }
    setActionModal(null);
    setActionInput('');
  };

  // Specialty pills from actual task components
  const specialties = useMemo(() => {
    const set = new Set(tasks.map((t: any) => t.component?.toUpperCase()).filter(Boolean));
    return ['ALL', ...Array.from(set)] as Specialty[];
  }, [tasks]);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Hero Stats */}
      <div>
        <h1 style={{ margin: '0 0 6px', fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>My Tasks</h1>
        <p style={{ color: 'var(--text-tertiary)', margin: 0, fontSize: '0.82rem' }}>{stats.total} total · {stats.inProgress} active · {stats.overdue > 0 ? <span style={{ color: '#e05252' }}>{stats.overdue} overdue</span> : 'none overdue'}</p>
      </div>

      {/* Quick Stats Bar */}
      <div style={{ display: 'flex', gap: 10 }}>
        {[
          { label: 'To Do', val: stats.todo, color: 'var(--text-secondary)' },
          { label: 'Active', val: stats.inProgress, color: '#5a5af0' },
          { label: 'Blocked', val: stats.blocked, color: '#e05252' },
          { label: 'Done', val: stats.completed, color: '#10b981' },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 600, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Status filters */}
        {(['ALL', 'TODO', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED'] as StatusFilter[]).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} style={{
            padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 500,
            background: statusFilter === s ? 'var(--accent-dim)' : 'var(--bg-elevated)',
            color: statusFilter === s ? 'var(--accent)' : 'var(--text-tertiary)',
            transition: 'all 0.15s',
          }}>{s === 'ALL' ? 'All' : s.replace('_', ' ')}</button>
        ))}

        {/* Divider */}
        {specialties.length > 1 && <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 4px' }} />}

        {/* Specialty filters */}
        {specialties.length > 1 && specialties.map(s => (
          <button key={s} onClick={() => setSpecialtyFilter(s)} style={{
            padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 500,
            background: specialtyFilter === s ? 'rgba(16,185,129,0.1)' : 'var(--bg-elevated)',
            color: specialtyFilter === s ? '#10b981' : 'var(--text-tertiary)',
            transition: 'all 0.15s',
          }}>{s === 'ALL' ? 'All Roles' : s}</button>
        ))}
      </div>

      {/* Task List */}
      {loading && !tasks.length && <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)' }}>Loading...</div>}

      {sortedTasks.length === 0 && !loading && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '3rem', textAlign: 'center' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{tasks.length === 0 ? 'No tasks assigned to you.' : 'No tasks match current filters.'}</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sortedTasks.map((task: any) => {
          const sm = statusMeta[task.status] || statusMeta.TODO;
          const pm = priorityMeta[task.priority] || priorityMeta.LOW;
          const due = task.dueDate ? dueLabel(task.dueDate) : null;
          const isOverdue = task.dueDate && daysLeft(task.dueDate) < 0 && task.status !== 'COMPLETED';

          return (
            <div key={task.id} style={{
              background: 'var(--bg-surface)',
              border: `1px solid ${isOverdue ? 'rgba(224,82,82,0.2)' : 'var(--border)'}`,
              borderRadius: 10,
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              transition: 'border-color 0.15s',
            }}>
              {/* Status dot */}
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: sm.color, flexShrink: 0 }} />

              {/* Main content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 500, fontSize: '0.88rem', color: task.status === 'COMPLETED' ? 'var(--text-tertiary)' : 'var(--text-primary)', textDecoration: task.status === 'COMPLETED' ? 'line-through' : 'none' }}>{task.title}</span>
                  <span style={{ fontSize: '0.58rem', fontWeight: 500, color: pm.color, background: `${pm.color}12`, padding: '1px 5px', borderRadius: 3 }}>{task.priority}</span>
                  {task.component && <span style={{ fontSize: '0.58rem', fontWeight: 500, color: '#10b981', background: 'rgba(16,185,129,0.08)', padding: '1px 5px', borderRadius: 3 }}>{task.component}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                  {getProjectName(task.projectId) && <span>{getProjectName(task.projectId)}</span>}
                  {due && <span style={{ color: due.color, fontWeight: 500 }}>{due.text}</span>}
                  {task.blockerReason && task.status === 'BLOCKED' && <span style={{ color: '#e05252' }}>⚠ {task.blockerReason}</span>}
                </div>
              </div>

              {/* Action buttons - only for the assigned user */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {task.status === 'TODO' && (
                  <button onClick={() => handleAction(task.id, 'start')} style={actionBtn('#5a5af0')}>Start</button>
                )}
                {(task.status === 'TODO' || task.status === 'IN_PROGRESS') && (
                  <button onClick={() => handleAction(task.id, 'complete')} style={actionBtn('#10b981')}>Done</button>
                )}
                {task.status === 'IN_PROGRESS' && (
                  <button onClick={() => handleAction(task.id, 'block')} style={actionBtn('#e05252')}>Block</button>
                )}
                {(task.status === 'BLOCKED' || task.status === 'COMPLETED') && (
                  <button onClick={() => handleAction(task.id, 'reopen')} style={actionBtn('var(--text-secondary)')}>Reopen</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Modal for Block/Complete */}
      {actionModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '28px', maxWidth: 400, width: '100%' }}>
            <h3 style={{ color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>
              {actionModal.action === 'block' ? 'Mark as Blocked' : 'Complete Task'}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginBottom: 16 }}>
              {actionModal.action === 'block' ? 'What is blocking this task?' : 'Brief completion note (optional):'}
            </p>
            <input
              value={actionInput}
              onChange={e => setActionInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && confirmAction()}
              placeholder={actionModal.action === 'block' ? 'Describe the blocker...' : 'What was done...'}
              autoFocus
              style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.85rem', marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setActionModal(null)} style={{ padding: '8px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer' }}>Cancel</button>
              <button
                onClick={confirmAction}
                disabled={actionModal.action === 'block' && !actionInput.trim()}
                style={{ padding: '8px 16px', background: actionModal.action === 'block' ? '#ef4444' : '#10b981', border: 'none', borderRadius: 8, color: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', opacity: (actionModal.action === 'block' && !actionInput.trim()) ? 0.5 : 1 }}
              >
                {actionModal.action === 'block' ? 'Mark Blocked' : 'Complete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function actionBtn(color: string): React.CSSProperties {
  return {
    padding: '4px 10px', borderRadius: 6, border: `1px solid ${color}30`,
    background: `${color}10`, color, fontSize: '0.68rem', fontWeight: 600,
    cursor: 'pointer', transition: 'all 0.15s',
  };
}
