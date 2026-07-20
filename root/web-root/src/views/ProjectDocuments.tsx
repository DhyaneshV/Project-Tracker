import React, { useState, useRef, useEffect } from 'react';

const GATEWAY = import.meta.env.VITE_API_URL || 'http://localhost:4000';

type DocType = 'SRS' | 'API_KEYS' | 'DESIGN' | 'CONTRACT' | 'ARCHITECTURE' | 'MEETING_NOTES' | 'ROADMAP' | 'CREDENTIALS' | 'DEPLOYMENT' | 'OTHER';

interface ProjectDocument {
  projectId: string; docId: string; createdAt: string; title: string;
  description?: string; type: DocType; tags: string[];
  fileKey: string; fileName: string; mimeType: string; fileSize: number;
  version: number; uploadedBy: string; updatedAt: string; restricted: boolean;
  docPassword?: string;
}

interface Props {
  projectId: string;
  token: string;
  userCategory: string;
  userId: string;
}

const TYPE_META: Record<DocType, { label: string; icon: string; color: string; bg: string }> = {
  SRS:           { label: 'SRS',           icon: '📋', color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
  API_KEYS:      { label: 'API Keys',      icon: '🔑', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  DESIGN:        { label: 'Design',        icon: '🎨', color: '#ec4899', bg: 'rgba(236,72,153,0.12)' },
  CONTRACT:      { label: 'Contract',      icon: '📝', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  ARCHITECTURE:  { label: 'Architecture',  icon: '🏗',  color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  MEETING_NOTES: { label: 'Meeting Notes', icon: '📒', color: '#06b6d4', bg: 'rgba(6,182,212,0.12)' },
  ROADMAP:       { label: 'Roadmap',       icon: '🗺',  color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  CREDENTIALS:   { label: 'Credentials',   icon: '🔒', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  DEPLOYMENT:    { label: 'Deployment',    icon: '🚀', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  OTHER:         { label: 'Other',         icon: '📎', color: 'var(--text-tertiary)', bg: 'rgba(100,116,139,0.12)' },
};

const isManager = (cat: string) => ['C_SUITE', 'SVP', 'VP', 'SENIOR_MANAGER', 'MANAGER'].includes(cat);

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ProjectDocuments({ projectId, token, userCategory, userId }: Props) {
  const [docs, setDocs] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<DocType | 'ALL'>('ALL');
  const [tagFilter, setTagFilter] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [form, setForm] = useState({ title: '', description: '', type: 'OTHER' as DocType, tags: '', version: '1', docPassword: '', passwordProtected: false });
  const fileRef = useRef<HTMLInputElement>(null);
  const auth = { Authorization: `Bearer ${token}` };

  // Password Vault state
  const [vaultOpen, setVaultOpen] = useState(false);
  const [vaultItems, setVaultItems] = useState<any[]>([]);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [showAddSecret, setShowAddSecret] = useState(false);
  const [secretForm, setSecretForm] = useState({ label: '', username: '', password: '', url: '', notes: '' });
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const canAccessVault = isManager(userCategory);

  const fetchDocs = () => {
    setLoading(true);
    const qs = typeFilter !== 'ALL' ? `?type=${typeFilter}` : '';
    fetch(`${GATEWAY}/projects/${projectId}/docs${qs}`, { headers: auth })
      .then(r => r.json())
      .then(d => { setDocs(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchDocs(); }, [projectId, typeFilter]);

  const fetchVault = () => {
    if (!canAccessVault) return;
    setVaultLoading(true);
    fetch(`${GATEWAY}/projects/${projectId}/vault`, { headers: auth })
      .then(r => r.json())
      .then(d => { setVaultItems(Array.isArray(d) ? d : []); setVaultLoading(false); })
      .catch(() => setVaultLoading(false));
  };

  useEffect(() => { if (vaultOpen) fetchVault(); }, [vaultOpen]);

  const handleAddSecret = async () => {
    if (!secretForm.label.trim()) return;
    await fetch(`${GATEWAY}/projects/${projectId}/vault`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(secretForm),
    });
    setSecretForm({ label: '', username: '', password: '', url: '', notes: '' });
    setShowAddSecret(false);
    fetchVault();
  };

  const handleDeleteSecret = async (id: string) => {
    if (!window.confirm('Delete this credential?')) return;
    await fetch(`${GATEWAY}/projects/${projectId}/vault/${id}`, { method: 'DELETE', headers: auth });
    fetchVault();
  };

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file || !form.title.trim()) { setUploadError('Title and file are required.'); return; }
    setUploading(true); setUploadError('');

    try {
      // 1. Get presigned URL
      const urlRes = await fetch(`${GATEWAY}/projects/${projectId}/docs/upload-url`, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, mimeType: file.type, fileSize: file.size, title: form.title, type: form.type, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean), description: form.description, version: parseInt(form.version) || 1 }),
      });
      const { uploadUrl, fileKey, docId } = await urlRes.json();
      if (!uploadUrl) throw new Error('Failed to get upload URL');

      // 2. Upload directly to S3
      const s3Res = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      if (!s3Res.ok) throw new Error('S3 upload failed');

      // 3. Confirm
      const confirmRes = await fetch(`${GATEWAY}/projects/${projectId}/docs/confirm`, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId, fileKey, title: form.title, description: form.description, type: form.type, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean), fileName: file.name, mimeType: file.type, fileSize: file.size, version: parseInt(form.version) || 1, docPassword: form.passwordProtected ? form.docPassword : '' }),
      });
      if (!confirmRes.ok) throw new Error('Confirm failed');

      setShowUpload(false);
      setForm({ title: '', description: '', type: 'OTHER', tags: '', version: '1', docPassword: '', passwordProtected: false });
      if (fileRef.current) fileRef.current.value = '';
      fetchDocs();
    } catch (e: any) {
      setUploadError(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: ProjectDocument) => {
    if (!window.confirm(`Delete "${doc.title}"?`)) return;
    await fetch(`${GATEWAY}/projects/${projectId}/docs/${doc.docId}`, { method: 'DELETE', headers: auth });
    fetchDocs();
  };

  // All tags across docs for filter suggestions
  const allTags = [...new Set(docs.flatMap(d => d.tags))];

  const filtered = docs.filter(d => {
    if (tagFilter && !d.tags.includes(tagFilter)) return false;
    return true;
  });

  // Count per type
  const typeCounts = docs.reduce((acc, d) => { acc[d.type] = (acc[d.type] || 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-main)' }}>Project Vault</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{docs.length} document{docs.length !== 1 ? 's' : ''} · Secure file library for this project</p>
        </div>
        <button onClick={() => setShowUpload(true)} style={{ padding: '10px 20px', background: 'var(--primary)', border: 'none', borderRadius: 10, color: 'white', fontWeight: 800, cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
          + Upload Document
        </button>
      </div>

      {/* Type filter pills */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={() => setTypeFilter('ALL')}
          style={{ padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem', background: typeFilter === 'ALL' ? 'var(--primary)' : 'rgba(255,255,255,0.05)', color: typeFilter === 'ALL' ? 'white' : 'var(--text-muted)', transition: 'all 0.15s' }}
        >
          All {docs.length > 0 && `(${docs.length})`}
        </button>
        {(Object.keys(TYPE_META) as DocType[]).filter(t => typeCounts[t]).map(t => (
          <button
            key={t}
            onClick={() => setTypeFilter(t === typeFilter ? 'ALL' : t)}
            style={{ padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem', background: typeFilter === t ? TYPE_META[t].bg : 'rgba(255,255,255,0.05)', color: typeFilter === t ? TYPE_META[t].color : 'var(--text-muted)', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <span>{TYPE_META[t].icon}</span> {TYPE_META[t].label} ({typeCounts[t]})
          </button>
        ))}
      </div>

      {/* Tag filter */}
      {allTags.length > 0 && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, marginRight: 4 }}>Tags:</span>
          {allTags.map(tag => (
            <span
              key={tag}
              onClick={() => setTagFilter(tagFilter === tag ? '' : tag)}
              style={{ padding: '3px 10px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', background: tagFilter === tag ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)', color: tagFilter === tag ? '#818cf8' : 'var(--text-muted)', border: `1px solid ${tagFilter === tag ? '#6366f1' : 'transparent'}`, transition: 'all 0.15s' }}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Document grid */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading documents...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '60px 40px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px dashed rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📂</div>
          <div style={{ color: 'var(--text-muted)', fontWeight: 700 }}>No documents yet</div>
          <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginTop: 4 }}>Upload SRS, API keys, design files and more</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {filtered.map(doc => {
            const meta = TYPE_META[doc.type] || TYPE_META.OTHER;
            const isOwner = doc.uploadedBy === userId;
            const canDelete = isOwner || isManager(userCategory);
            return (
              <div key={doc.docId} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12, transition: 'border-color 0.2s', cursor: 'default' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
              >
                {/* Type badge + icon */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8, background: meta.bg, color: meta.color, fontSize: '0.72rem', fontWeight: 800 }}>
                    {meta.icon} {meta.label}
                  </span>
                  {doc.restricted && (
                    <span style={{ fontSize: '0.68rem', padding: '3px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontWeight: 800, border: '1px solid rgba(239,68,68,0.2)' }}>🔒 RESTRICTED</span>
                  )}
                </div>

                {/* Title + description */}
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)', marginBottom: 4, lineHeight: 1.3 }}>{doc.title}</div>
                  {doc.description && <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.5 }}>{doc.description}</div>}
                </div>

                {/* Tags */}
                {doc.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {doc.tags.map(tag => (
                      <span key={tag} style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700 }}>#{tag}</span>
                    ))}
                  </div>
                )}

                {/* File info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: '1.1rem' }}>{doc.mimeType.startsWith('image/') ? '🖼' : doc.mimeType.includes('pdf') ? '📄' : doc.mimeType.includes('sheet') || doc.mimeType.includes('excel') ? '📊' : '📎'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.fileName}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{fmtSize(doc.fileSize)} · v{doc.version}</div>
                  </div>
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 4 }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{fmtDate(doc.createdAt)}</span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {doc.docPassword && <span style={{ fontSize: '0.68rem', color: '#f59e0b', fontWeight: 700 }}>🔒</span>}
                    <button
                      onClick={() => {
                        if (doc.docPassword) {
                          const input = prompt('This document is password protected.\nEnter password:');
                          if (input !== doc.docPassword) { alert('Incorrect password.'); return; }
                        }
                        window.open(`https://${import.meta.env.VITE_DOCS_BUCKET || 'project-tracker-project-docs-dev'}.s3.amazonaws.com/${doc.fileKey}`, '_blank');
                      }}
                      style={{ padding: '5px 12px', borderRadius: 7, background: 'rgba(99,102,241,0.1)', color: '#818cf8', fontSize: '0.72rem', fontWeight: 800, border: '1px solid rgba(99,102,241,0.2)', cursor: 'pointer' }}
                    >
                      Download
                    </button>
                    {canDelete && (
                      <button onClick={() => handleDelete(doc)} style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontSize: '0.72rem', fontWeight: 800, border: '1px solid rgba(239,68,68,0.15)', cursor: 'pointer' }}>
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Password Vault */}
      {canAccessVault && (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, overflow: 'hidden' }}>
          <button onClick={() => setVaultOpen(!vaultOpen)} style={{ width: '100%', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)' }}>
            <span style={{ fontSize: '1rem' }}>🔐</span>
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Password Vault</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginLeft: 4 }}>Manager access only</span>
            <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-tertiary)', transform: vaultOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
          </button>

          {vaultOpen && (
            <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{vaultItems.length} credential{vaultItems.length !== 1 ? 's' : ''} stored</span>
                <button onClick={() => setShowAddSecret(true)} style={{ padding: '6px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 500 }}>+ Add</button>
              </div>

              {vaultLoading && <div style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem', padding: 12 }}>Loading...</div>}

              {vaultItems.map((item: any) => (
                <div key={item.docId} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>{item.label}</span>
                    <button onClick={() => handleDeleteSecret(item.docId)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '0.7rem' }}>✕</button>
                  </div>
                  {item.url && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.url}</div>}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {item.username && (
                      <div style={{ background: 'var(--bg-raised)', padding: '8px 10px', borderRadius: 6, fontSize: '0.78rem' }}>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', marginBottom: 2 }}>USERNAME</div>
                        <div style={{ color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '0.8rem' }}>{item.username}</div>
                      </div>
                    )}
                    {item.password && (
                      <div style={{ background: 'var(--bg-raised)', padding: '8px 10px', borderRadius: 6, fontSize: '0.78rem' }}>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', marginBottom: 2 }}>PASSWORD</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '0.8rem' }}>{visiblePasswords.has(item.docId) ? item.password : '••••••••'}</span>
                          <button onClick={() => togglePasswordVisibility(item.docId)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '0.68rem' }}>{visiblePasswords.has(item.docId) ? 'hide' : 'show'}</button>
                        </div>
                      </div>
                    )}
                  </div>
                  {item.notes && <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>{item.notes}</div>}
                </div>
              ))}

              {/* Add Secret Form */}
              {showAddSecret && (
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input value={secretForm.label} onChange={e => setSecretForm(f => ({ ...f, label: e.target.value }))} placeholder="Label (e.g. AWS Production)" style={{ ...inputSt, fontSize: '0.82rem' }} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <input value={secretForm.username} onChange={e => setSecretForm(f => ({ ...f, username: e.target.value }))} placeholder="Username / Key" style={{ ...inputSt, fontSize: '0.82rem' }} />
                    <input value={secretForm.password} onChange={e => setSecretForm(f => ({ ...f, password: e.target.value }))} placeholder="Password / Secret" style={{ ...inputSt, fontSize: '0.82rem' }} />
                  </div>
                  <input value={secretForm.url} onChange={e => setSecretForm(f => ({ ...f, url: e.target.value }))} placeholder="URL (optional)" style={{ ...inputSt, fontSize: '0.82rem' }} />
                  <input value={secretForm.notes} onChange={e => setSecretForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes (optional)" style={{ ...inputSt, fontSize: '0.82rem' }} />
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={() => setShowAddSecret(false)} style={{ padding: '6px 14px', background: 'none', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.78rem' }}>Cancel</button>
                    <button onClick={handleAddSecret} style={{ padding: '6px 14px', background: 'var(--accent)', border: 'none', borderRadius: 7, color: '#fff', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>Save</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.85)', backdropFilter: 'blur(12px)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '2.5rem', width: 480, maxWidth: '95vw', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-main)' }}>Upload Document</h3>
              <button onClick={() => setShowUpload(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.4rem', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <FieldGroup label="Title *">
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Backend API Documentation v2" style={inputSt} />
              </FieldGroup>

              <FieldGroup label="Type *">
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as DocType }))} style={inputSt}>
                  {(Object.keys(TYPE_META) as DocType[]).map(t => (
                    <option key={t} value={t}>{TYPE_META[t].icon} {TYPE_META[t].label}</option>
                  ))}
                </select>
              </FieldGroup>

              <FieldGroup label="Description">
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief summary of this document" style={inputSt} />
              </FieldGroup>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 12 }}>
                <FieldGroup label="Tags (comma separated)">
                  <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="backend, v2, auth" style={inputSt} />
                </FieldGroup>
                <FieldGroup label="Version">
                  <input type="number" min={1} value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} style={inputSt} />
                </FieldGroup>
              </div>

              <FieldGroup label="File *">
                <div
                  onClick={() => fileRef.current?.click()}
                  style={{ ...inputSt, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', justifyContent: 'center', minHeight: 44 }}
                >
                  <span>📎</span>
                  <span style={{ fontSize: '0.85rem' }}>{fileRef.current?.files?.[0]?.name || 'Click to select file'}</span>
                </div>
                <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={() => setForm(f => ({ ...f }))} />
              </FieldGroup>

              {/* Password protection toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
                <button type="button" onClick={() => setForm(f => ({ ...f, passwordProtected: !f.passwordProtected, docPassword: '' }))} style={{ width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', background: form.passwordProtected ? '#5a5af0' : 'var(--bg-elevated)', position: 'relative', transition: 'background 0.2s' }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: form.passwordProtected ? 18 : 2, transition: 'left 0.2s' }} />
                </button>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Password protect this document</span>
              </div>
              {form.passwordProtected && (
                <input value={form.docPassword} onChange={e => setForm(f => ({ ...f, docPassword: e.target.value }))} placeholder="Enter password for this document" type="password" style={inputSt} />
              )}
            </div>

            {uploadError && <div style={{ color: '#ef4444', fontSize: '0.8rem', background: 'rgba(239,68,68,0.08)', padding: '8px 12px', borderRadius: 8 }}>{uploadError}</div>}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowUpload(false)} style={{ padding: '9px 20px', background: 'none', border: '1px solid #334155', borderRadius: 9, color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>Cancel</button>
              <button onClick={handleUpload} disabled={uploading} style={{ padding: '9px 24px', background: uploading ? '#334155' : 'var(--primary)', border: 'none', borderRadius: 9, color: 'white', cursor: uploading ? 'default' : 'pointer', fontWeight: 800, fontSize: '0.85rem' }}>
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</label>
      {children}
    </div>
  );
}

const inputSt: React.CSSProperties = {
  padding: '10px 12px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 9,
  color: '#e2e8f0', fontSize: '0.88rem', outline: 'none', width: '100%',
};
