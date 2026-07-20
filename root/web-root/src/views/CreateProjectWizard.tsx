import React, { useState, useMemo, useEffect } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { ProjectCategory, FunctionalRole } from '@project-tracker/shared-types';

interface Props {
  users: any[];
  onInvite: (data: any) => Promise<any>;
  onClose: () => void;
}

export function CreateProjectWizard({ users, onInvite, onClose }: Props) {
  const focusTrapRef = useFocusTrap(true, onClose);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: ProjectCategory.INTERNAL,
    startDate: new Date().toISOString().split('T')[0],
    targetEndDate: '',
    estimatedDays: 14, // Default to 2 weeks
    budgetUSD: 0,
    maxTeamSize: 10,
    projectLeadId: '',
    viceTeamLeaderId: ''
  });

  // Smart Sync: Update End Date when Duration changes
  useEffect(() => {
      if (formData.startDate && formData.estimatedDays > 0) {
          const start = new Date(formData.startDate);
          const end = new Date(start);
          end.setDate(start.getDate() + formData.estimatedDays);
          const endStr = end.toISOString().split('T')[0];
          if (formData.targetEndDate !== endStr) {
              setFormData(prev => ({ ...prev, targetEndDate: endStr }));
          }
      }
  }, [formData.startDate, formData.estimatedDays]);

  // Smart Sync: Update Duration when End Date is changed manually
  const handleEndDateChange = (newEnd: string) => {
      if (formData.startDate && newEnd) {
          const start = new Date(formData.startDate);
          const end = new Date(newEnd);
          const diffTime = end.getTime() - start.getTime();
          const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          setFormData(prev => ({ 
              ...prev, 
              targetEndDate: newEnd, 
              estimatedDays: days > 0 ? days : 0 
          }));
      }
  };

  const managersAndTLs = useMemo(() => {
      // Project leads can be anyone from MANAGER level and below (TEAM_LEAD, senior ICs)
      return users.filter(u => 
        u.category === 'MANAGER' || u.category === 'TEAM_LEAD' || 
        u.category === 'SENIOR_IC' || u.category === 'C_SUITE' ||
        u.category === 'VP' || u.category === 'SVP' || u.category === 'SENIOR_MANAGER'
      );
  }, [users]);

  // Validation feedback per step
  const getValidationErrors = () => {
      const errors: string[] = [];
      if (step === 1) {
          if (!formData.name) errors.push('Mission title is required.');
          if (!formData.description) errors.push('Operational description is required.');
      }
      if (step === 2) {
          if (!formData.targetEndDate) errors.push('Target end date is required.');
          if (formData.estimatedDays <= 0) errors.push('Timeline must be in the future.');
          if (formData.maxTeamSize < 1) errors.push('Team capacity must be at least 1.');
      }
      if (step === 3) {
          // Project lead is optional - defaults to creator if not specified
      }
      return errors;
  };

  const validationErrors = getValidationErrors();
  const isStepValid = validationErrors.length === 0;

  const handleNext = () => {
      if (isStepValid) setStep(s => s + 1);
      else setError(validationErrors[0]);
  };

  const handleBack = () => {
      setError(null);
      setStep(s => s - 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
          ...formData,
          startDate: new Date(formData.startDate).toISOString(),
          targetEndDate: new Date(formData.targetEndDate).toISOString(),
          budgetUSD: parseFloat(formData.budgetUSD.toString())
      };
      
      await onInvite(payload);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Mission initialization failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(2, 6, 23, 0.98)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(20px)' }}>
      <div ref={focusTrapRef} role="dialog" aria-modal="true" aria-label="Create Project" style={{ background: 'var(--bg-surface)', padding: '4rem', borderRadius: '40px', width: '650px', border: '1px solid var(--border)', boxShadow: '0 50px 100px -20px rgba(0,0,0,0.7)' }}>
        
        {/* Progress System */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '3rem' }}>
            {[1, 2, 3, 4].map(i => (
                <div key={i} style={{ flex: 1, position: 'relative' }}>
                    <div style={{ height: '4px', borderRadius: '2px', backgroundColor: i <= step ? '#6366f1' : 'var(--border)', transition: 'all 0.4s' }} />
                    {i === step && <div style={{ position: 'absolute', top: '-10px', right: 0, width: '4px', height: '4px', backgroundColor: '#6366f1', borderRadius: '50%', boxShadow: '0 0 10px #6366f1' }} />}
                </div>
            ))}
        </div>

        {step === 1 && (
            <div className="fade-in">
                <h2 style={titleStyle}>Mission Identity</h2>
                <p style={subtitleStyle}>Define the tactical code name and strategic scope of this new initiative.</p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div>
                        <label style={labelStyle}>Operational Code Name</label>
                        <input 
                            value={formData.name} 
                            onChange={e => { setFormData({...formData, name: e.target.value}); setError(null); }}
                            style={inputStyle} placeholder="e.g. PROJECT AURORA" 
                        />
                    </div>
                    <div>
                        <label style={labelStyle}>Strategic Category</label>
                        <select 
                            value={formData.category}
                            onChange={e => setFormData({...formData, category: e.target.value as any})}
                            style={inputStyle}
                        >
                            {Object.values(ProjectCategory).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={labelStyle}>Executive Briefing</label>
                        <textarea 
                            value={formData.description}
                            onChange={e => { setFormData({...formData, description: e.target.value}); setError(null); }}
                            style={{ ...inputStyle, height: '120px', resize: 'none' }} 
                            placeholder="Provide a high-level summary of objectives..."
                        />
                    </div>
                </div>
            </div>
        )}

        {step === 2 && (
            <div className="fade-in">
                <h2 style={titleStyle}>Temporal & Logistics</h2>
                <p style={subtitleStyle}>Establish the mission window and resource allocation parameters.</p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <div>
                            <label style={labelStyle}>Deployment Start</label>
                            <input type="date" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Target Completion</label>
                            <input type="date" value={formData.targetEndDate} onChange={e => handleEndDateChange(e.target.value)} style={inputStyle} />
                        </div>
                    </div>

                    <div style={{ backgroundColor: 'rgba(99, 102, 241, 0.05)', padding: '1.5rem', borderRadius: '20px', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <label style={{ ...labelStyle, marginBottom: 0 }}>Mission Duration (Days)</label>
                            <span style={{ fontSize: '1.25rem', fontWeight: '900', color: formData.estimatedDays > 0 ? '#6366f1' : '#ef4444' }}>{formData.estimatedDays}</span>
                        </div>
                        <input 
                            type="range" min="1" max="365" 
                            value={formData.estimatedDays} 
                            onChange={e => setFormData({...formData, estimatedDays: parseInt(e.target.value)})}
                            style={{ width: '100%', accentColor: '#6366f1', cursor: 'pointer' }}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <div>
                            <label style={labelStyle}>Budget Cap (USD)</label>
                            <input type="number" value={formData.budgetUSD} onChange={e => setFormData({...formData, budgetUSD: parseFloat(e.target.value) || 0})} style={inputStyle} placeholder="0.00" />
                        </div>
                        <div>
                            <label style={labelStyle}>Max Team Capacity</label>
                            <input type="number" value={formData.maxTeamSize} onChange={e => setFormData({...formData, maxTeamSize: parseInt(e.target.value) || 1})} style={inputStyle} />
                        </div>
                    </div>
                </div>
            </div>
        )}

        {step === 3 && (
            <div className="fade-in">
                <h2 style={titleStyle}>Command Structure</h2>
                <p style={subtitleStyle}>Authorize the leadership hierarchy responsible for tactical execution.</p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div>
                        <label style={labelStyle}>Primary Team Leader (Command)</label>
                        <select value={formData.projectLeadId} onChange={e => { setFormData({...formData, projectLeadId: e.target.value}); setError(null); }} style={inputStyle}>
                            <option value="">Authorize Leader...</option>
                            {managersAndTLs.map(u => <option key={u.id} value={u.id}>{u.fullName.toUpperCase()} — {u.role}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={labelStyle}>Vice Team Leader (Advisory)</label>
                        <select value={formData.viceTeamLeaderId} onChange={e => setFormData({...formData, viceTeamLeaderId: e.target.value})} style={inputStyle}>
                            <option value="">None Assigned</option>
                            {managersAndTLs.filter(u => u.id !== formData.projectLeadId).map(u => <option key={u.id} value={u.id}>{u.fullName.toUpperCase()} — {u.role}</option>)}
                        </select>
                    </div>
                    <div style={{ padding: '1rem', backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: '12px', border: '1px solid rgba(99, 102, 241, 0.2)', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                        🛡️ Only personnel with <strong>MANAGER</strong> or <strong>TEAM_LEADER</strong> clearance can be assigned to project command roles.
                    </div>
                </div>
            </div>
        )}

        {step === 4 && (
            <div className="fade-in">
                <h2 style={titleStyle}>Operational Review</h2>
                <p style={subtitleStyle}>Final validation of mission parameters before organizational commitment.</p>
                
                <div style={{ background: 'var(--bg-base)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <SummaryRow label="Mission" value={formData.name} />
                    <SummaryRow label="Strategic Group" value={formData.category} />
                    <SummaryRow label="Timeline" value={`${formData.startDate} → ${formData.targetEndDate} (${formData.estimatedDays} Days)`} />
                    <SummaryRow label="Resources" value={`$${formData.budgetUSD.toLocaleString()} / ${formData.maxTeamSize} operative`} />
                    <SummaryRow label="Command" value={users.find(u => u.id === formData.projectLeadId)?.fullName || 'UNAUTHORIZED'} />
                </div>
            </div>
        )}

        {error && (
            <div style={{ marginTop: '2rem', color: '#ef4444', fontSize: '0.85rem', textAlign: 'center', backgroundColor: 'rgba(239, 68, 68, 0.08)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)', fontWeight: '700' }}>
                ⚠️ {error.toUpperCase()}
            </div>
        )}

        <div style={{ display: 'flex', gap: '1.5rem', marginTop: '4rem', justifyContent: 'space-between' }}>
            <button 
                onClick={step === 1 ? onClose : handleBack} 
                style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontWeight: '800', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}
            >
                {step === 1 ? 'Abort' : 'Go Back'}
            </button>
            <button 
                onClick={step === 4 ? handleSubmit : handleNext}
                disabled={loading}
                style={{ 
                    padding: '1.25rem 3rem', backgroundColor: '#6366f1', color: 'white', border: 'none', borderRadius: '20px', 
                    fontWeight: '900', cursor: 'pointer', boxShadow: '0 10px 20px -5px rgba(99, 102, 241, 0.5)', transition: 'all 0.2s',
                    fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '1px'
                }}
                onMouseOver={e => !loading && (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseOut={e => !loading && (e.currentTarget.style.transform = 'translateY(0)')}
            >
                {loading ? 'Processing...' : step === 4 ? 'Commit & Launch' : 'Continue'}
            </button>
        </div>
      </div>
      <style>{`
        .fade-in { animation: fadeIn 0.4s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

const SummaryRow = ({ label, value }: { label: string; value: string }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
        <span style={{ color: '#475569', fontWeight: '800', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '1px' }}>{label}</span>
        <span style={{ color: '#f8fafc', fontWeight: '700' }}>{value}</span>
    </div>
);

const titleStyle: React.CSSProperties = { fontSize: '2rem', fontWeight: '900', color: '#f8fafc', marginBottom: '0.5rem', letterSpacing: '-1px' };
const subtitleStyle: React.CSSProperties = { color: 'var(--text-tertiary)', fontSize: '1rem', marginBottom: '3rem', lineHeight: '1.5' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '1px' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '16px', borderRadius: '16px', background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'white', outline: 'none', fontSize: '1rem', transition: 'border-color 0.2s' };
