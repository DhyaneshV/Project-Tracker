import React, { useState } from 'react';
import { ProjectTask, TaskStatus, TaskPriority } from '@project-tracker/shared-types';

interface Props {
  tasks: ProjectTask[];
  onUpdateStatus: (taskId: string, status: TaskStatus, blockerReason?: string, completionNote?: string) => void;
  canManageAllTasks: boolean;
  currentUserId: string;
}

export function ProjectTaskBoard({ tasks, onUpdateStatus, canManageAllTasks, currentUserId }: Props) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [statusModal, setStatusModal] = useState<{ taskId: string; status: TaskStatus; title: string } | null>(null);
  const [modalInput, setModalInput] = useState('');

  const columns = [
    { title: 'TO DO', status: TaskStatus.TODO, color: 'var(--text-tertiary)' },
    { title: 'IN PROGRESS', status: TaskStatus.IN_PROGRESS, color: '#5a5af0' },
    { title: 'BLOCKED', status: TaskStatus.BLOCKED, color: '#e05252' },
    { title: 'COMPLETED', status: TaskStatus.COMPLETED, color: '#10b981' },
  ];

  const priorityColor: Record<string, string> = {
    [TaskPriority.CRITICAL]: '#e05252',
    [TaskPriority.HIGH]: '#f59e0b',
    [TaskPriority.MEDIUM]: '#5a5af0',
    [TaskPriority.LOW]: 'var(--text-tertiary)',
  };

  const handleStatusChange = (taskId: string, newStatus: TaskStatus, taskTitle: string) => {
    if (newStatus === TaskStatus.BLOCKED || newStatus === TaskStatus.COMPLETED) {
      setStatusModal({ taskId, status: newStatus, title: taskTitle });
      setModalInput('');
    } else {
      onUpdateStatus(taskId, newStatus);
    }
  };

  const confirmStatusModal = () => {
    if (!statusModal) return;
    if (statusModal.status === TaskStatus.BLOCKED) {
      if (!modalInput.trim()) return;
      onUpdateStatus(statusModal.taskId, statusModal.status, modalInput.trim());
    } else if (statusModal.status === TaskStatus.COMPLETED) {
      onUpdateStatus(statusModal.taskId, statusModal.status, undefined, modalInput.trim() || undefined);
    }
    setStatusModal(null);
    setModalInput('');
  };

  // ─── Drag and Drop Handlers ─────────────────────────────────────

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
    // Make the dragged element semi-transparent
    (e.target as HTMLElement).style.opacity = '0.5';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedTaskId(null);
    setDragOverColumn(null);
    (e.target as HTMLElement).style.opacity = '1';
  };

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(status);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === targetStatus) return;

    // Check permissions
    const assigned = (task as any).assignedTo;
    const isMe = assigned?.id === currentUserId;
    if (!canManageAllTasks && !isMe) return;

    // Handle special statuses
    if (targetStatus === TaskStatus.BLOCKED) {
      setStatusModal({ taskId, status: targetStatus, title: task.title });
      setModalInput('');
    } else if (targetStatus === TaskStatus.COMPLETED) {
      setStatusModal({ taskId, status: targetStatus, title: task.title });
      setModalInput('');
    } else {
      onUpdateStatus(taskId, targetStatus);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, minHeight: 400 }}>
      {columns.map(col => {
        const colTasks = tasks.filter(t => t.status === col.status);
        return (
          <div key={col.status} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Column header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px', marginBottom: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: col.color }} />
              <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.04em' }}>{col.title}</span>
              <span style={{ marginLeft: 'auto', fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-tertiary)', background: 'var(--bg-elevated)', padding: '1px 6px', borderRadius: 8 }}>{colTasks.length}</span>
            </div>

            {/* Column body */}
            <div
              onDragOver={(e) => handleDragOver(e, col.status)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.status)}
              style={{
                flex: 1, background: dragOverColumn === col.status ? 'rgba(90,90,240,0.04)' : 'var(--bg-raised)',
                borderRadius: 10, padding: 8,
                border: `1px solid ${dragOverColumn === col.status ? 'rgba(90,90,240,0.3)' : 'var(--border)'}`,
                display: 'flex', flexDirection: 'column', gap: 8,
                transition: 'background 0.15s, border-color 0.15s',
              }}
            >
              {colTasks.map(task => {
                const assigned = (task as any).assignedTo;
                const isMe = assigned?.id === currentUserId;
                const canUpdate = canManageAllTasks || isMe;
                const pColor = priorityColor[task.priority] || 'var(--text-tertiary)';
                const isDragging = draggedTaskId === task.id;

                return (
                  <div
                    key={task.id}
                    draggable={canUpdate}
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onDragEnd={handleDragEnd}
                    style={{
                      background: 'var(--bg-surface)',
                      border: `1px solid ${isMe ? 'rgba(90,90,240,0.2)' : 'var(--border)'}`,
                      borderRadius: 8, padding: '12px',
                      display: 'flex', flexDirection: 'column', gap: 8,
                      transition: 'border-color 0.15s, transform 0.15s, opacity 0.15s',
                      cursor: canUpdate ? 'grab' : 'default',
                      opacity: isDragging ? 0.5 : 1,
                      transform: isDragging ? 'scale(0.95)' : 'none',
                    }}
                  >
                    {/* Priority + specialty */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.6rem', fontWeight: 600, color: pColor, background: `${pColor}15`, padding: '2px 6px', borderRadius: 4 }}>{task.priority}</span>
                      {((task as any).specialty || task.component) && <span style={{ fontSize: '0.56rem', fontWeight: 500, color: '#10b981', background: 'rgba(16,185,129,0.08)', padding: '2px 5px', borderRadius: 3 }}>{(task as any).specialty || task.component}</span>}
                    </div>

                    {/* Title */}
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '0.82rem', lineHeight: 1.4 }}>{task.title}</div>

                    {/* Due date */}
                    {(task as any).dueDate && (
                      <div style={{ fontSize: '0.62rem', color: new Date((task as any).dueDate).getTime() < Date.now() ? '#e05252' : 'var(--text-tertiary)' }}>
                        {new Date((task as any).dueDate).getTime() < Date.now() ? 'Overdue' : `Due ${new Date((task as any).dueDate).toLocaleDateString('en', { month: 'short', day: 'numeric' })}`}
                      </div>
                    )}

                    {/* Assignee + status control */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 20, height: 20, borderRadius: '50%', background: isMe ? '#5a5af0' : 'var(--bg-elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.58rem', fontWeight: 600, color: isMe ? '#fff' : 'var(--text-tertiary)' }}>
                          {assigned?.fullName?.charAt(0) || '?'}
                        </div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{assigned?.fullName || 'Unassigned'}</span>
                      </div>

                      {canUpdate && (
                        <select
                          value={task.status}
                          onChange={e => handleStatusChange(task.id, e.target.value as TaskStatus, task.title)}
                          style={{ background: 'transparent', border: 'none', color: col.color, fontSize: '0.62rem', fontWeight: 600, cursor: 'pointer', outline: 'none' }}
                        >
                          {Object.values(TaskStatus).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                        </select>
                      )}
                    </div>

                    {/* Blocker reason */}
                    {task.blockerReason && task.status === TaskStatus.BLOCKED && (
                      <div style={{ padding: '6px 8px', background: 'rgba(224,82,82,0.06)', borderRadius: 6, borderLeft: '2px solid #e05252', fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        {task.blockerReason}
                      </div>
                    )}

                    {/* Dependencies */}
                    {(task as any).dependsOn && (task as any).dependsOn.length > 0 && (
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ color: '#f59e0b' }}>⤷</span> Depends on {(task as any).dependsOn.length} task{(task as any).dependsOn.length > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                );
              })}

              {colTasks.length === 0 && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: '0.72rem', opacity: 0.5 }}>—</div>
              )}
            </div>
          </div>
        );
      })}

      {/* Status Change Modal */}
      {statusModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '28px', maxWidth: 400, width: '100%' }}>
            <h3 style={{ color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>
              {statusModal.status === TaskStatus.BLOCKED ? 'Mark as Blocked' : 'Mark as Completed'}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginBottom: 16 }}>
              {statusModal.status === TaskStatus.BLOCKED 
                ? `What is blocking "${statusModal.title}"?`
                : `Completion note for "${statusModal.title}" (optional):`}
            </p>
            <input
              value={modalInput}
              onChange={e => setModalInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && confirmStatusModal()}
              placeholder={statusModal.status === TaskStatus.BLOCKED ? 'Describe the blocker...' : 'What was done...'}
              autoFocus
              style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.85rem', marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setStatusModal(null)} style={{ padding: '8px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer' }}>Cancel</button>
              <button 
                onClick={confirmStatusModal} 
                disabled={statusModal.status === TaskStatus.BLOCKED && !modalInput.trim()}
                style={{ padding: '8px 16px', background: statusModal.status === TaskStatus.BLOCKED ? '#ef4444' : '#10b981', border: 'none', borderRadius: 8, color: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', opacity: (statusModal.status === TaskStatus.BLOCKED && !modalInput.trim()) ? 0.5 : 1 }}
              >
                {statusModal.status === TaskStatus.BLOCKED ? 'Mark Blocked' : 'Complete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
