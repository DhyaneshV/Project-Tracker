import React, { useState, useMemo } from 'react';
import { useQuery, gql } from '@apollo/client';

const GET_PROJECTS = gql`query { getProjects { id name status startDate targetEndDate } }`;
const GET_PROJECT_TASKS = gql`
  query GetProjectTasks($projectId: ID!) {
    getProjectTasks(projectId: $projectId) { id title status priority startDate dueDate completedAt assignedTo { fullName } }
  }
`;

/**
 * GanttTimelineView - Project timeline visualization
 * Shows tasks as horizontal bars on a time axis.
 * Color-coded by status. Supports project selection.
 */
export function GanttTimelineView() {
  const [selectedProject, setSelectedProject] = useState<string>('');
  const { data: projectsData } = useQuery(GET_PROJECTS);
  const { data: tasksData, loading } = useQuery(GET_PROJECT_TASKS, {
    variables: { projectId: selectedProject },
    skip: !selectedProject,
    fetchPolicy: 'cache-and-network',
  });

  const projects = projectsData?.getProjects || [];
  const tasks = (tasksData?.getProjectTasks || []).filter((t: any) => t.startDate || t.dueDate);

  // Calculate timeline bounds
  const { startDate, endDate, totalDays } = useMemo(() => {
    if (tasks.length === 0) return { startDate: new Date(), endDate: new Date(), totalDays: 30 };
    const dates = tasks.flatMap((t: any) => [t.startDate, t.dueDate].filter(Boolean)).map((d: string) => new Date(d).getTime());
    const min = Math.min(...dates);
    const max = Math.max(...dates);
    const pad = 2 * 86400000; // 2 day padding
    const s = new Date(min - pad);
    const e = new Date(max + pad);
    return { startDate: s, endDate: e, totalDays: Math.max(7, Math.ceil((e.getTime() - s.getTime()) / 86400000)) };
  }, [tasks]);

  const getBarPosition = (start: string | null, end: string | null) => {
    const s = start ? new Date(start).getTime() : startDate.getTime();
    const e = end ? new Date(end).getTime() : s + 3 * 86400000; // default 3-day width
    const leftPct = ((s - startDate.getTime()) / (endDate.getTime() - startDate.getTime())) * 100;
    const widthPct = ((e - s) / (endDate.getTime() - startDate.getTime())) * 100;
    return { left: `${Math.max(0, leftPct)}%`, width: `${Math.max(1, widthPct)}%` };
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'DONE': case 'COMPLETED': return '#10b981';
      case 'IN_PROGRESS': return '#5a5af0';
      case 'IN_REVIEW': return '#8b5cf6';
      case 'BLOCKED': return '#ef4444';
      case 'TODO': return '#6b7280';
      default: return '#94a3b8';
    }
  };

  // Generate month markers
  const monthMarkers = useMemo(() => {
    const markers: { label: string; left: string }[] = [];
    const cur = new Date(startDate);
    cur.setDate(1);
    cur.setMonth(cur.getMonth() + 1);
    while (cur < endDate) {
      const pct = ((cur.getTime() - startDate.getTime()) / (endDate.getTime() - startDate.getTime())) * 100;
      markers.push({ label: cur.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), left: `${pct}%` });
      cur.setMonth(cur.getMonth() + 1);
    }
    return markers;
  }, [startDate, endDate]);

  // Week markers
  const weekMarkers = useMemo(() => {
    const markers: string[] = [];
    const cur = new Date(startDate);
    const dayOfWeek = cur.getDay();
    cur.setDate(cur.getDate() + (7 - dayOfWeek)); // next Monday
    while (cur < endDate) {
      const pct = ((cur.getTime() - startDate.getTime()) / (endDate.getTime() - startDate.getTime())) * 100;
      markers.push(`${pct}%`);
      cur.setDate(cur.getDate() + 7);
    }
    return markers;
  }, [startDate, endDate]);

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Timeline</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 4 }}>Project task timeline / Gantt view</p>
        </div>
        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          style={{ padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.82rem' }}
        >
          <option value="">Select project</option>
          {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {!selectedProject && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12, opacity: 0.3 }}>▤</div>
          <div style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>Select a project to view its timeline</div>
        </div>
      )}

      {selectedProject && loading && (
        <div style={{ color: 'var(--text-secondary)', padding: 20 }}>Loading timeline...</div>
      )}

      {selectedProject && !loading && tasks.length === 0 && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 48, textAlign: 'center' }}>
          <div style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>No tasks with dates found for this project</div>
        </div>
      )}

      {selectedProject && !loading && tasks.length > 0 && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          {/* Header with time axis */}
          <div style={{ position: 'relative', height: 32, borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
            {monthMarkers.map((m, i) => (
              <div key={i} style={{ position: 'absolute', left: m.left, top: 0, height: '100%', borderLeft: '1px solid var(--border)', display: 'flex', alignItems: 'center', paddingLeft: 6 }}>
                <span style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>{m.label}</span>
              </div>
            ))}
          </div>

          {/* Task rows */}
          <div style={{ maxHeight: 500, overflowY: 'auto' }}>
            {tasks.map((task: any) => {
              const pos = getBarPosition(task.startDate, task.dueDate);
              return (
                <div key={task.id} style={{ display: 'flex', borderBottom: '1px solid var(--border)', minHeight: 40 }}>
                  {/* Task label */}
                  <div style={{ width: 200, flexShrink: 0, padding: '8px 12px', borderRight: '1px solid var(--border)', overflow: 'hidden' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={task.title}>{task.title}</div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)' }}>{task.assignedTo?.fullName || 'Unassigned'}</div>
                  </div>

                  {/* Bar area */}
                  <div style={{ flex: 1, position: 'relative', padding: '6px 0' }}>
                    {/* Week grid lines */}
                    {weekMarkers.map((left, i) => (
                      <div key={i} style={{ position: 'absolute', left, top: 0, bottom: 0, borderLeft: '1px dashed var(--border)', opacity: 0.5 }} />
                    ))}
                    {/* Task bar */}
                    <div
                      title={`${task.title} (${task.status})\n${task.startDate ? new Date(task.startDate).toLocaleDateString() : '?'} → ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '?'}`}
                      style={{
                        position: 'absolute', top: 8, left: pos.left, width: pos.width,
                        height: 22, borderRadius: 4,
                        background: statusColor(task.status),
                        opacity: task.status === 'DONE' || task.status === 'COMPLETED' ? 0.6 : 0.85,
                        minWidth: 6,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[['TODO', '#6b7280'], ['IN_PROGRESS', '#5a5af0'], ['IN_REVIEW', '#8b5cf6'], ['BLOCKED', '#ef4444'], ['DONE', '#10b981']].map(([label, color]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 12, height: 8, borderRadius: 2, background: color as string }} />
                <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>{(label as string).replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
