import React, { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { INVITE_USER, GET_ALL_USERS } from '../api/queries';
import { UserCategory, FunctionalRole, Department } from '../types';
import { getRoleDisplayName, getDepartmentIcon } from '../utils/roleConfig';

interface InvitationWizardProps {
  onClose: () => void;
  onSuccess: () => void;
  currentUserId: string;
}

type WizardStep = 'details' | 'confirmation' | 'success';

export function InvitationWizard({ onClose, onSuccess, currentUserId }: InvitationWizardProps) {
  const [step, setStep] = useState<WizardStep>('details');
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    category: UserCategory.JUNIOR_IC,
    role: FunctionalRole.BACKEND_DEV,
    department: Department.BACKEND,
    reportingManagerId: currentUserId,
    twoFactorRequired: true,
  });
  const [invitationResult, setInvitationResult] = useState<any>(null);

  const [inviteUser, { loading }] = useMutation(INVITE_USER);

  // Get role options based on selected category
  const getRoleOptions = (category: UserCategory): FunctionalRole[] => {
    const roleMap: Record<UserCategory, FunctionalRole[]> = {
      [UserCategory.C_SUITE]: [
        FunctionalRole.CEO,
        FunctionalRole.CTO,
        FunctionalRole.CFO,
        FunctionalRole.COO,
        FunctionalRole.CHRO,
      ],
      [UserCategory.SVP]: [
        FunctionalRole.SVP_ENGINEERING,
        FunctionalRole.SVP_PRODUCT,
        FunctionalRole.SVP_OPERATIONS,
      ],
      [UserCategory.VP]: [
        FunctionalRole.VP_BACKEND,
        FunctionalRole.VP_FRONTEND,
        FunctionalRole.VP_MOBILE,
        FunctionalRole.VP_DEVOPS,
        FunctionalRole.VP_QA,
        FunctionalRole.VP_PRODUCT,
        FunctionalRole.VP_DESIGN,
        FunctionalRole.VP_DATA,
        FunctionalRole.VP_HR,
        FunctionalRole.VP_SALES,
      ],
      [UserCategory.SENIOR_MANAGER]: [
        FunctionalRole.SENIOR_ENGINEERING_MANAGER,
        FunctionalRole.SENIOR_PRODUCT_DIRECTOR,
        FunctionalRole.SENIOR_QA_DIRECTOR,
        FunctionalRole.SENIOR_DATA_DIRECTOR,
      ],
      [UserCategory.MANAGER]: [
        FunctionalRole.BACKEND_TEAM_MANAGER,
        FunctionalRole.FRONTEND_TEAM_MANAGER,
        FunctionalRole.MOBILE_TEAM_MANAGER,
        FunctionalRole.DEVOPS_TEAM_MANAGER,
        FunctionalRole.QA_TEAM_MANAGER,
        FunctionalRole.PRODUCT_TEAM_MANAGER,
        FunctionalRole.DESIGN_TEAM_MANAGER,
        FunctionalRole.DATA_TEAM_MANAGER,
        FunctionalRole.HR_TEAM_MANAGER,
        FunctionalRole.SALES_TEAM_MANAGER,
      ],
      [UserCategory.TEAM_LEAD]: [
        FunctionalRole.BACKEND_TEAM_MANAGER,
        FunctionalRole.FRONTEND_TEAM_MANAGER,
        FunctionalRole.MOBILE_TEAM_MANAGER,
        FunctionalRole.DEVOPS_TEAM_MANAGER,
        FunctionalRole.QA_TEAM_MANAGER,
        FunctionalRole.PRODUCT_TEAM_MANAGER,
        FunctionalRole.DESIGN_TEAM_MANAGER,
        FunctionalRole.DATA_TEAM_MANAGER,
      ],
      [UserCategory.SENIOR_IC]: [
        FunctionalRole.SENIOR_BACKEND_DEV,
        FunctionalRole.SENIOR_FRONTEND_DEV,
        FunctionalRole.SENIOR_MOBILE_DEV,
        FunctionalRole.SENIOR_DEVOPS_ENG,
        FunctionalRole.SENIOR_QA_ENG,
        FunctionalRole.SENIOR_DATA_ENG,
        FunctionalRole.SENIOR_DATA_SCIENTIST,
        FunctionalRole.SENIOR_DESIGNER,
        FunctionalRole.SENIOR_PRODUCT_MANAGER,
        FunctionalRole.SENIOR_HR_SPECIALIST,
        FunctionalRole.RECRUITER,
        FunctionalRole.SENIOR_SALES_EXECUTIVE,
      ],
      [UserCategory.JUNIOR_IC]: [
        FunctionalRole.BACKEND_DEV,
        FunctionalRole.FRONTEND_DEV,
        FunctionalRole.MOBILE_DEV,
        FunctionalRole.DEVOPS_ENG,
        FunctionalRole.QA_ENG,
        FunctionalRole.DATA_ANALYST,
        FunctionalRole.DATA_ENG,
        FunctionalRole.DESIGNER,
        FunctionalRole.PRODUCT_ASSOCIATE,
        FunctionalRole.HR_COORDINATOR,
        FunctionalRole.SALES_REP,
        FunctionalRole.INTERN,
      ],
    };

    return roleMap[category] || [];
  };

  const handleCategoryChange = (category: UserCategory) => {
    const roleOptions = getRoleOptions(category);
    setFormData({
      ...formData,
      category,
      role: roleOptions[0] || FunctionalRole.BACKEND_DEV,
    });
  };

  const handleSubmit = async () => {
    try {
      const result = await inviteUser({
        variables: {
          email: formData.email,
          fullName: formData.fullName,
          category: formData.category,
          role: formData.role,
          department: formData.department,
          reportingManagerId: formData.reportingManagerId,
          twoFactorRequired: formData.twoFactorRequired,
        },
      });

      setInvitationResult(result.data.inviteUser);
      setStep('success');
    } catch (err: any) {
      alert(`Failed to send invitation: ${err.message}`);
    }
  };

  const handleFinish = () => {
    onSuccess();
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        fontFamily: 'sans-serif',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '30px',
          maxWidth: '600px',
          width: '90%',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Step: User Details */}
        {step === 'details' && (
          <>
            <h2 style={{ marginTop: 0, marginBottom: '20px' }}>👥 Invite New Team Member</h2>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '14px' }}>
                Email Address *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john.doe@company.com"
                required
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '14px' }}>
                Full Name *
              </label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="John Doe"
                required
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '14px' }}>
                Department *
              </label>
              <select
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value as Department })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              >
                {Object.values(Department).map((dept) => (
                  <option key={dept} value={dept}>
                    {getDepartmentIcon(dept)} {dept}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '14px' }}>
                Hierarchy Level *
              </label>
              <select
                value={formData.category}
                onChange={(e) => handleCategoryChange(e.target.value as UserCategory)}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              >
                {Object.values(UserCategory).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '14px' }}>
                Functional Role *
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as FunctionalRole })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              >
                {getRoleOptions(formData.category).map((role) => (
                  <option key={role} value={role}>
                    {getRoleDisplayName(role)}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.twoFactorRequired}
                  onChange={(e) => setFormData({ ...formData, twoFactorRequired: e.target.checked })}
                  style={{ marginRight: '8px' }}
                />
                <span style={{ fontSize: '14px' }}>🔐 Require 2-Factor Authentication</span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={onClose}
                style={{
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => setStep('confirmation')}
                disabled={!formData.email || !formData.fullName}
                style={{
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '4px',
                  cursor: formData.email && formData.fullName ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  opacity: formData.email && formData.fullName ? 1 : 0.6,
                }}
              >
                Continue →
              </button>
            </div>
          </>
        )}

        {/* Step: Confirmation */}
        {step === 'confirmation' && (
          <>
            <h2 style={{ marginTop: 0, marginBottom: '20px' }}>✅ Confirm Invitation Details</h2>

            <div style={{
              backgroundColor: '#f8f9fa',
              padding: '20px',
              borderRadius: '8px',
              marginBottom: '20px',
            }}>
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '3px' }}>Email</div>
                <div style={{ fontSize: '16px', fontWeight: '600' }}>{formData.email}</div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '3px' }}>Full Name</div>
                <div style={{ fontSize: '16px', fontWeight: '600' }}>{formData.fullName}</div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '3px' }}>Department</div>
                <div style={{ fontSize: '16px', fontWeight: '600' }}>
                  {getDepartmentIcon(formData.department)} {formData.department}
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '3px' }}>Role</div>
                <div style={{ fontSize: '16px', fontWeight: '600' }}>{getRoleDisplayName(formData.role)}</div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '3px' }}>Hierarchy Level</div>
                <div style={{ fontSize: '16px', fontWeight: '600' }}>{formData.category}</div>
              </div>

              <div>
                <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '3px' }}>2FA Required</div>
                <div style={{ fontSize: '16px', fontWeight: '600' }}>
                  {formData.twoFactorRequired ? '🔐 Yes' : '❌ No'}
                </div>
              </div>
            </div>

            <div style={{
              backgroundColor: '#cce5ff',
              border: '1px solid #b8daff',
              padding: '15px',
              borderRadius: '4px',
              marginBottom: '20px',
              fontSize: '14px',
              color: '#004085',
            }}>
              <strong>📧 What happens next:</strong>
              <ul style={{ margin: '10px 0 0 0', paddingLeft: '20px' }}>
                <li>A secure password will be auto-generated</li>
                <li>Invitation email will be sent to {formData.email}</li>
                <li>Credentials will expire in 7 days</li>
                <li>User must change password on first login</li>
                {formData.twoFactorRequired && <li>User must set up 2FA during onboarding</li>}
              </ul>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setStep('details')}
                style={{
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                ← Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                style={{
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? 'Sending...' : '📧 Send Invitation'}
              </button>
            </div>
          </>
        )}

        {/* Step: Success */}
        {step === 'success' && invitationResult && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '60px', marginBottom: '10px' }}>✅</div>
              <h2 style={{ margin: '0 0 10px 0', color: '#28a745' }}>Invitation Sent Successfully!</h2>
              <p style={{ margin: 0, color: '#6c757d' }}>
                {invitationResult.email} has been invited to join your team.
              </p>
            </div>

            <div style={{
              backgroundColor: '#f8f9fa',
              padding: '20px',
              borderRadius: '8px',
              marginBottom: '20px',
            }}>
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '3px' }}>User ID</div>
                <div style={{ fontSize: '14px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {invitationResult.userId}
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '3px' }}>Invitation Expires</div>
                <div style={{ fontSize: '14px' }}>
                  {new Date(invitationResult.invitationExpiry).toLocaleString()}
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '3px' }}>Status</div>
                <div style={{
                  display: 'inline-block',
                  backgroundColor: '#fff3cd',
                  color: '#856404',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: '500',
                }}>
                  {invitationResult.status}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '3px' }}>Temporary Password</div>
                <div style={{
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  backgroundColor: '#fff',
                  padding: '10px',
                  borderRadius: '4px',
                  border: '1px solid #dee2e6',
                  wordBreak: 'break-all',
                }}>
                  {invitationResult.temporaryPassword}
                </div>
                <div style={{ fontSize: '12px', color: '#dc3545', marginTop: '5px' }}>
                  ⚠️ This password will only be shown once. Copy it now if needed for manual delivery.
                </div>
              </div>
            </div>

            <div style={{
              backgroundColor: '#d4edda',
              border: '1px solid #c3e6cb',
              padding: '15px',
              borderRadius: '4px',
              marginBottom: '20px',
              fontSize: '14px',
              color: '#155724',
            }}>
              <strong>✉️ Email sent to:</strong> {invitationResult.email}<br />
              The user will receive their credentials and an invitation link.
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleFinish}
                style={{
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
