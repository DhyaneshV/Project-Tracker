import React from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';

const GET_PENDING = gql`
  query GetPendingAllocations { getPendingAllocations { id projectId projectName requestedBy requestedByName requestedUserId requestedUserName requestedUserRole specialty allocation projectRole reason status createdAt } }
`;

const APPROVE = gql`mutation ApproveAllocation($requestId: ID!) { approveAllocation(requestId: $requestId) { id status } }`;
const REJECT = gql`mutation RejectAllocation($requestId: ID!, $reason: String!) { rejectAllocation(requestId: $requestId, reason: $reason) { id status } }`;

export function PendingApprovalsView() {
  const { data, loading, refetch } = useQuery(GET_PENDING, { pollInterval: 60000 });
  const [approve] = useMutation(APPROVE, { onCompleted: () => refetch() });
  const [reject] = useMutation(REJECT, { onCompleted: () => refetch() });

  const requests = data?.getPendingAllocations || [];

  const handleReject = (id: string) => {
    const reason = prompt('Reason for rejection:');
    if (reason) reject({ variables: { requestId: id, reason } });
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h1 style={{ margin: '0 0 4px', fontSize: '1.8rem', fontWeight: 800, color: '#f4f4f5' }}>Pending Approvals</h1>
        <p style={{ color: '#71717a', margin: 0, fontSize: '0.85rem' }}>{requests.length} allocation requests waiting for your approval</p>
      </div>

      {loading && !requests.length && <div style={{ textAlign: 'center', padding: '3rem', color: '#52525b' }}>Loading...</div>}

      {requests.length === 0 && !loading && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '3rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: 10 }}>✅</div>
          <div style={{ color: '#71717a', fontSize: '0.9rem' }}>No pending allocation requests. All clear!</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {requests.map((r: any) => (
          <div key={r.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 800, color: '#e4e4e7', fontSize: '1rem' }}>
                  {r.requestedUserName || 'Employee'} → {r.projectName}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#71717a', marginTop: 4 }}>
                  Requested by <span style={{ color: '#a78bfa', fontWeight: 700 }}>{r.requestedByName}</span> • {new Date(r.createdAt).toLocaleDateString()}
                </div>
              </div>
              <span style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', padding: '4px 10px', borderRadius: 6, fontSize: '0.62rem', fontWeight: 800 }}>PENDING</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px 12px', borderRadius: 8 }}>
                <div style={{ fontSize: '0.58rem', fontWeight: 700, color: '#52525b', textTransform: 'uppercase' }}>Role</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e4e4e7', marginTop: 2 }}>{r.projectRole?.replace(/_/g, ' ')}</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px 12px', borderRadius: 8 }}>
                <div style={{ fontSize: '0.58rem', fontWeight: 700, color: '#52525b', textTransform: 'uppercase' }}>Specialty</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e4e4e7', marginTop: 2 }}>{r.specialty}</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px 12px', borderRadius: 8 }}>
                <div style={{ fontSize: '0.58rem', fontWeight: 700, color: '#52525b', textTransform: 'uppercase' }}>Allocation</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#7c5cfc', marginTop: 2 }}>{r.allocation}%</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px 12px', borderRadius: 8 }}>
                <div style={{ fontSize: '0.58rem', fontWeight: 700, color: '#52525b', textTransform: 'uppercase' }}>Employee Role</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e4e4e7', marginTop: 2 }}>{r.requestedUserRole?.replace(/_/g, ' ') || '—'}</div>
              </div>
            </div>

            {r.reason && (
              <div style={{ background: 'rgba(124,92,252,0.04)', padding: '12px 14px', borderRadius: 8, borderLeft: '3px solid #7c5cfc', marginBottom: 14 }}>
                <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#7c5cfc', marginBottom: 4 }}>REASON</div>
                <div style={{ fontSize: '0.82rem', color: '#a1a1aa', lineHeight: 1.5 }}>{r.reason}</div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => approve({ variables: { requestId: r.id } })} style={{ flex: 1, padding: '10px', background: 'linear-gradient(135deg, #10b981, #34d399)', border: 'none', color: 'white', borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: '0.82rem' }}>
                ✓ Approve & Add to Project
              </button>
              <button onClick={() => handleReject(r.id)} style={{ padding: '10px 20px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: '0.82rem' }}>
                ✕ Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
