import React, { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';

const GET_ALL_SALARY_STRUCTURES = gql`
  query { getAllSalaryStructures { userId basicPay hraPercentage conveyanceAllowance medicalAllowance specialAllowance pfEnabled esiEnabled ptEnabled tdsPercentage effectiveFrom } }
`;
const GET_ALL_USERS = gql`
  query { getAllUsers { id fullName role department } }
`;
const SET_SALARY_STRUCTURE = gql`
  mutation SetSalaryStructure($userId: ID!, $basicPay: Float!, $hraPercentage: Float, $conveyanceAllowance: Float, $medicalAllowance: Float, $specialAllowance: Float, $pfEnabled: Boolean, $esiEnabled: Boolean, $ptEnabled: Boolean, $tdsPercentage: Float) {
    setSalaryStructure(userId: $userId, basicPay: $basicPay, hraPercentage: $hraPercentage, conveyanceAllowance: $conveyanceAllowance, medicalAllowance: $medicalAllowance, specialAllowance: $specialAllowance, pfEnabled: $pfEnabled, esiEnabled: $esiEnabled, ptEnabled: $ptEnabled, tdsPercentage: $tdsPercentage) { userId basicPay }
  }
`;
const RUN_PAYROLL = gql`
  mutation RunPayroll($month: String!, $totalWorkingDays: Int!) {
    runPayroll(month: $month, totalWorkingDays: $totalWorkingDays) { runId month status totalEmployees totalGross totalDeductions totalNet createdAt }
  }
`;
const APPROVE_PAYROLL = gql`
  mutation ApprovePayroll($runId: ID!) {
    approvePayroll(runId: $runId) { runId status approvedBy approvedAt }
  }
`;
const GET_PAYROLL_HISTORY = gql`
  query { getPayrollHistory { runId month status totalEmployees totalGross totalDeductions totalNet createdBy approvedBy createdAt approvedAt } }
`;

function fmt(n: number): string { return '₹' + n.toLocaleString('en-IN'); }

export function PayrollView() {
  const [tab, setTab] = useState<'structures' | 'run' | 'history'>('structures');

  return (
    <div className="animate-fade-in">
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 6px', color: 'var(--text-primary)' }}>Payroll Management</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.82rem' }}>Salary structures, payroll runs, and history</p>

      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        {(['structures', 'run', 'history'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 20px', background: 'none', border: 'none',
            borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
            color: tab === t ? 'var(--accent)' : 'var(--text-tertiary)',
            fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            {t === 'structures' ? 'Salary Structures' : t === 'run' ? 'Run Payroll' : 'History'}
          </button>
        ))}
      </div>

      {tab === 'structures' && <SalaryStructuresTab />}
      {tab === 'run' && <RunPayrollTab />}
      {tab === 'history' && <PayrollHistoryTab />}
    </div>
  );
}

function SalaryStructuresTab() {
  const [showForm, setShowForm] = useState(false);
  const { data: structData, loading, refetch } = useQuery(GET_ALL_SALARY_STRUCTURES);
  const { data: usersData } = useQuery(GET_ALL_USERS);
  const [form, setForm] = useState({ userId: '', basicPay: 0, hraPercentage: 40, conveyanceAllowance: 1600, medicalAllowance: 1250, specialAllowance: 0, pfEnabled: true, esiEnabled: false, ptEnabled: true, tdsPercentage: 0 });
  const [setSalary, { loading: saving }] = useMutation(SET_SALARY_STRUCTURE, { onCompleted: () => { setShowForm(false); refetch(); } });

  const structures = structData?.getAllSalaryStructures || [];
  const users = usersData?.getAllUsers || [];
  const getName = (id: string) => users.find((u: any) => u.id === id)?.fullName || id;

  if (loading) return <div style={{ color: 'var(--text-secondary)' }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>{structures.length} configured</span>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
          {showForm ? 'Cancel' : 'Set Salary'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <Label>Employee</Label>
              <select value={form.userId} onChange={e => setForm({ ...form, userId: e.target.value })} style={inputStyle}>
                <option value="">Select employee</option>
                {users.map((u: any) => <option key={u.id} value={u.id}>{u.fullName} - {u.department}</option>)}
              </select>
            </div>
            <Field label="Basic Pay" value={form.basicPay} onChange={v => setForm({ ...form, basicPay: +v })} />
            <Field label="HRA %" value={form.hraPercentage} onChange={v => setForm({ ...form, hraPercentage: +v })} />
            <Field label="Conveyance" value={form.conveyanceAllowance} onChange={v => setForm({ ...form, conveyanceAllowance: +v })} />
            <Field label="Medical" value={form.medicalAllowance} onChange={v => setForm({ ...form, medicalAllowance: +v })} />
            <Field label="Special Allow." value={form.specialAllowance} onChange={v => setForm({ ...form, specialAllowance: +v })} />
            <Field label="TDS %" value={form.tdsPercentage} onChange={v => setForm({ ...form, tdsPercentage: +v })} />
            <div style={{ gridColumn: '1/-1', display: 'flex', gap: 16, alignItems: 'center' }}>
              <Toggle label="PF" checked={form.pfEnabled} onChange={v => setForm({ ...form, pfEnabled: v })} />
              <Toggle label="ESI" checked={form.esiEnabled} onChange={v => setForm({ ...form, esiEnabled: v })} />
              <Toggle label="PT" checked={form.ptEnabled} onChange={v => setForm({ ...form, ptEnabled: v })} />
            </div>
          </div>
          <div style={{ textAlign: 'right', marginTop: 16 }}>
            <button disabled={saving || !form.userId} onClick={() => setSalary({ variables: form })} style={{ padding: '8px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.78rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.5 : 1 }}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-elevated)' }}>
              <th style={thStyle}>Employee</th><th style={thStyle}>Basic</th><th style={thStyle}>HRA%</th>
              <th style={thStyle}>Conv.</th><th style={thStyle}>Medical</th><th style={thStyle}>Special</th>
              <th style={thStyle}>PF/ESI/PT</th><th style={thStyle}>TDS%</th>
            </tr>
          </thead>
          <tbody>
            {structures.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)' }}>No salary structures configured</td></tr>}
            {structures.map((s: any) => (
              <tr key={s.userId} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={tdStyle}>{getName(s.userId)}</td>
                <td style={tdStyle}>{fmt(s.basicPay)}</td>
                <td style={tdStyle}>{s.hraPercentage}%</td>
                <td style={tdStyle}>{fmt(s.conveyanceAllowance)}</td>
                <td style={tdStyle}>{fmt(s.medicalAllowance)}</td>
                <td style={tdStyle}>{fmt(s.specialAllowance)}</td>
                <td style={tdStyle}>{[s.pfEnabled && 'PF', s.esiEnabled && 'ESI', s.ptEnabled && 'PT'].filter(Boolean).join(', ') || '—'}</td>
                <td style={tdStyle}>{s.tdsPercentage}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RunPayrollTab() {
  const [month, setMonth] = useState('');
  const [workingDays, setWorkingDays] = useState(22);
  const [result, setResult] = useState<any>(null);

  const [runPayroll, { loading }] = useMutation(RUN_PAYROLL, { onCompleted: d => setResult(d.runPayroll) });
  const [approvePayroll, { loading: approving }] = useMutation(APPROVE_PAYROLL, { onCompleted: d => setResult((r: any) => ({ ...r, status: d.approvePayroll.status })) });

  return (
    <div>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
          <div>
            <Label>Month (YYYY-MM)</Label>
            <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <Label>Working Days</Label>
            <input type="number" value={workingDays} onChange={e => setWorkingDays(+e.target.value)} style={{ ...inputStyle, width: 80 }} />
          </div>
          <button disabled={loading || !month} onClick={() => runPayroll({ variables: { month, totalWorkingDays: workingDays } })} style={{ padding: '8px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.78rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1 }}>
            {loading ? 'Running...' : 'Run Payroll'}
          </button>
        </div>
      </div>

      {result && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginTop: 20 }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 16px' }}>Payroll Result</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <Stat label="Month" value={result.month} />
            <Stat label="Status" value={result.status} badge />
            <Stat label="Employees" value={result.totalEmployees} />
            <Stat label="Created" value={new Date(result.createdAt).toLocaleDateString()} />
            <Stat label="Gross" value={fmt(result.totalGross)} />
            <Stat label="Deductions" value={fmt(result.totalDeductions)} />
            <Stat label="Net Pay" value={fmt(result.totalNet)} />
          </div>
          {(result.status === 'DRAFT' || result.status === 'PENDING_APPROVAL') && (
            <button disabled={approving} onClick={() => approvePayroll({ variables: { runId: result.runId } })} style={{ marginTop: 16, padding: '8px 20px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.78rem', fontWeight: 600, cursor: approving ? 'not-allowed' : 'pointer', opacity: approving ? 0.5 : 1 }}>
              {approving ? 'Approving...' : 'Approve Payroll'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PayrollHistoryTab() {
  const { data, loading } = useQuery(GET_PAYROLL_HISTORY);
  if (loading) return <div style={{ color: 'var(--text-secondary)' }}>Loading...</div>;

  const history = [...(data?.getPayrollHistory || [])].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (history.length === 0) return <div style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 40 }}>No payroll history</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {history.map((run: any) => (
        <div key={run.runId} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{run.month}</span>
              <StatusBadge status={run.status} />
            </div>
            <span style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem' }}>{new Date(run.createdAt).toLocaleDateString()}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <MiniStat label="Employees" value={run.totalEmployees} />
            <MiniStat label="Gross" value={fmt(run.totalGross)} />
            <MiniStat label="Deductions" value={fmt(run.totalDeductions)} />
            <MiniStat label="Net Pay" value={fmt(run.totalNet)} />
          </div>
          {(run.createdBy || run.approvedBy) && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', gap: 16 }}>
              {run.createdBy && <span style={{ color: 'var(--text-tertiary)', fontSize: '0.68rem' }}>Created: {run.createdBy}</span>}
              {run.approvedBy && <span style={{ color: 'var(--text-tertiary)', fontSize: '0.68rem' }}>Approved: {run.approvedBy}</span>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── HELPER COMPONENTS ──────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>{children}</div>;
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <input type="number" value={value} onChange={e => onChange(e.target.value)} style={inputStyle} />
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
      <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{label}</span>
    </label>
  );
}

function Stat({ label, value, badge }: { label: string; value: any; badge?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      {badge ? <StatusBadge status={value} /> : <div style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)' }}>{value}</div>}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div style={{ color: 'var(--text-tertiary)', fontSize: '0.65rem' }}>{label}</div>
      <div style={{ color: 'var(--text-primary)', fontSize: '0.82rem', fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = { DRAFT: '#eab308', PENDING_APPROVAL: '#f97316', APPROVED: '#22c55e', PAID: '#3b82f6' };
  const c = colors[status] || '#94a3b8';
  return <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.65rem', fontWeight: 700, background: `${c}18`, color: c }}>{status?.replace(/_/g, ' ')}</span>;
}

const thStyle: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', color: 'var(--text-tertiary)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid var(--border)' };
const tdStyle: React.CSSProperties = { padding: '10px 12px', color: 'var(--text-primary)' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', fontSize: '0.78rem' };
