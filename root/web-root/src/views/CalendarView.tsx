import React from 'react';
import { useQuery, gql } from '@apollo/client';

const GET_DEADLINES = gql`
  query GetUpcomingDeadlines { getUpcomingDeadlines { id projectId projectName type title dueDate daysLeft status priority } }
`;

export function CalendarView() {
  const { data, loading } = useQuery(GET_DEADLINES, { pollInterval: 60000 });
  const deadlines = data?.getUpcomingDeadlines || [];

  const getUrgencyColor = (daysLeft: number) => {
    if (daysLeft < 0) return '#e05252';
    if (daysLeft <= 3) return '#f59e0b';
    if (daysLeft <= 7) return '#5a5af0';
    return '#10b981';
  };

  const grouped = {
    overdue: deadlines.filter((d: any) => d.daysLeft < 0),
    thisWeek: deadlines.filter((d: any) => d.daysLeft >= 0 && d.daysLeft <= 7),
    nextWeek: deadlines.filter((d: any) => d.daysLeft > 7 && d.daysLeft <= 14),
    later: deadlines.filter((d: any) => d.daysLeft > 14),
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>Calendar & Deadlines</h1>
        <p style={{ color: 'var(--text-tertiary)', margin: 0, fontSize: '0.85rem' }}>{deadlines.length} upcoming deadlines</p>
      </div>

      {loading && !deadlines.length && <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)' }}>Loading deadlines...</div>}

      {deadlines.length === 0 && !loading && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '3rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.25rem', marginBottom: 10, color: 'var(--text-secondary)' }}>--</div>
          <div style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>No upcoming deadlines within 30 days. All clear!</div>
        </div>
      )}

      {grouped.overdue.length > 0 && <DeadlineSection title="Overdue" items={grouped.overdue} getColor={getUrgencyColor} />}
      {grouped.thisWeek.length > 0 && <DeadlineSection title="This Week" items={grouped.thisWeek} getColor={getUrgencyColor} />}
      {grouped.nextWeek.length > 0 && <DeadlineSection title="Next Week" items={grouped.nextWeek} getColor={getUrgencyColor} />}
      {grouped.later.length > 0 && <DeadlineSection title="Later" items={grouped.later} getColor={getUrgencyColor} />}
    </div>
  );
}

function DeadlineSection({ title, items, getColor }: { title: string; items: any[]; getColor: (d: number) => string }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((d: any) => {
          const color = getColor(d.daysLeft);
          return (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, border: `1px solid ${color}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: '0.6rem', fontWeight: 600, color }}>{new Date(d.dueDate).toLocaleDateString('en', { month: 'short' })}</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color }}>{new Date(d.dueDate).getDate()}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.88rem' }}>{d.title}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 500, color: 'var(--text-secondary)', background: 'var(--bg-raised)', padding: '2px 6px', borderRadius: 4 }}>{d.projectName}</span>
                  <span style={{ fontSize: '0.65rem', fontWeight: 500, color: 'var(--text-tertiary)' }}>{d.type === 'TASK_DEADLINE' ? 'Task' : 'Project'}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color }}>
                  {d.daysLeft < 0 ? `${Math.abs(d.daysLeft)}d overdue` : d.daysLeft === 0 ? 'Today' : `${d.daysLeft}d left`}
                </div>
                {d.priority && <div style={{ fontSize: '0.6rem', fontWeight: 500, color: 'var(--text-tertiary)', marginTop: 2 }}>{d.priority}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
