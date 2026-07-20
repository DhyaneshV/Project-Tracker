import React from 'react';

/**
 * Skeleton loading components.
 * Replace "Loading..." text with layout-matching skeletons
 * to reduce perceived latency and prevent layout shift.
 */

const shimmerKeyframes = `
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
`;

// Inject shimmer animation once
if (typeof document !== 'undefined' && !document.getElementById('skeleton-styles')) {
  const style = document.createElement('style');
  style.id = 'skeleton-styles';
  style.textContent = shimmerKeyframes;
  document.head.appendChild(style);
}

const skeletonBase: React.CSSProperties = {
  background: 'linear-gradient(90deg, var(--bg-elevated) 25%, var(--bg-surface) 50%, var(--bg-elevated) 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite linear',
  borderRadius: 6,
};

export function SkeletonLine({ width = '100%', height = 14, style }: { width?: string | number; height?: number; style?: React.CSSProperties }) {
  return <div style={{ ...skeletonBase, width, height, ...style }} />;
}

export function SkeletonCircle({ size = 32 }: { size?: number }) {
  return <div style={{ ...skeletonBase, width: size, height: size, borderRadius: '50%' }} />;
}

export function SkeletonCard({ height = 80, style }: { height?: number; style?: React.CSSProperties }) {
  return <div style={{ ...skeletonBase, width: '100%', height, borderRadius: 12, ...style }} />;
}

/** Skeleton for a table row */
export function SkeletonTableRow({ columns = 6 }: { columns?: number }) {
  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} style={{ padding: '12px 14px' }}>
          <SkeletonLine width={i === 0 ? 28 : `${60 + Math.random() * 40}%`} height={12} />
        </td>
      ))}
    </tr>
  );
}

/** Full page skeleton matching the User Management table layout */
export function UserTableSkeleton() {
  return (
    <div>
      {/* Stats cards skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '2rem' }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
            <SkeletonLine width="60%" height={10} style={{ marginBottom: 8 }} />
            <SkeletonLine width="40%" height={22} />
          </div>
        ))}
      </div>

      {/* Filter bar skeleton */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
        <SkeletonLine width="240px" height={36} style={{ borderRadius: 8 }} />
        <SkeletonLine width="120px" height={36} style={{ borderRadius: 8 }} />
        <SkeletonLine width="120px" height={36} style={{ borderRadius: 8 }} />
        <SkeletonLine width="100px" height={36} style={{ borderRadius: 8 }} />
      </div>

      {/* Table skeleton */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-elevated)' }}>
              {Array.from({ length: 9 }).map((_, i) => (
                <th key={i} style={{ padding: '10px 14px' }}><SkeletonLine width="80%" height={10} /></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonTableRow key={i} columns={9} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Team view skeleton */
export function TeamSkeleton() {
  return (
    <div>
      <SkeletonLine width="200px" height={20} style={{ marginBottom: 8 }} />
      <SkeletonLine width="140px" height={12} style={{ marginBottom: 24 }} />
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <SkeletonCircle size={28} />
            <div style={{ flex: 1 }}>
              <SkeletonLine width="60%" height={12} style={{ marginBottom: 4 }} />
              <SkeletonLine width="40%" height={10} />
            </div>
            <SkeletonLine width="60px" height={18} style={{ borderRadius: 10 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Profile view skeleton */
export function ProfileSkeleton() {
  return (
    <div>
      <SkeletonLine width="160px" height={20} style={{ marginBottom: 8 }} />
      <SkeletonLine width="220px" height={12} style={{ marginBottom: 24 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <SkeletonCard height={280} />
        <SkeletonCard height={280} />
      </div>
      <SkeletonCard height={200} style={{ marginTop: 20 }} />
    </div>
  );
}
