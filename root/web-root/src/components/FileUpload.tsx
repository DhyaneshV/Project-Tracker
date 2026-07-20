import React, { useState, useRef, useCallback } from 'react';

/**
 * FileUpload - Reusable component for uploading files via S3 presigned URLs.
 * 
 * Flow:
 * 1. User selects/drops a file
 * 2. Component calls `getUploadUrl` to get a presigned URL from the backend
 * 3. Uploads directly to S3 using the presigned URL (PUT)
 * 4. Calls `onUploadComplete` with the file metadata
 * 
 * Features:
 * - Drag and drop support
 * - Progress indicator
 * - File type and size validation
 * - Cancel upload
 */

interface FileUploadProps {
  /** Function that requests a presigned URL from the backend */
  getUploadUrl: (file: { fileName: string; mimeType: string; fileSize: number }) => Promise<{ uploadUrl: string; fileKey: string }>;
  /** Called after successful upload */
  onUploadComplete: (result: { fileKey: string; fileName: string; mimeType: string; fileSize: number }) => void;
  /** Optional: called on error */
  onError?: (error: string) => void;
  /** Accepted file types (e.g., "image/*,.pdf,.doc") */
  accept?: string;
  /** Max file size in bytes (default 10MB) */
  maxSize?: number;
  /** Label text */
  label?: string;
  /** Compact mode (no drop zone, just a button) */
  compact?: boolean;
}

export function FileUpload({ getUploadUrl, onUploadComplete, onError, accept, maxSize = 10 * 1024 * 1024, label = 'Upload file', compact = false }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleUpload = useCallback(async (file: File) => {
    setError('');

    // Validate size
    if (file.size > maxSize) {
      const msg = `File too large. Max ${formatSize(maxSize)}.`;
      setError(msg);
      onError?.(msg);
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      // 1. Get presigned URL
      const { uploadUrl, fileKey } = await getUploadUrl({
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileSize: file.size,
      });

      // 2. Upload to S3 with progress tracking
      abortRef.current = new AbortController();

      const xhr = new XMLHttpRequest();
      
      await new Promise<void>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => reject(new Error('Upload failed')));
        xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        xhr.send(file);

        // Wire up abort
        abortRef.current!.signal.addEventListener('abort', () => xhr.abort());
      });

      // 3. Notify parent
      onUploadComplete({ fileKey, fileName: file.name, mimeType: file.type, fileSize: file.size });
      setProgress(100);
    } catch (err: any) {
      if (err.message !== 'Upload cancelled') {
        const msg = err.message || 'Upload failed';
        setError(msg);
        onError?.(msg);
      }
    } finally {
      setUploading(false);
      abortRef.current = null;
    }
  }, [getUploadUrl, onUploadComplete, onError, maxSize]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = ''; // Reset so same file can be selected again
  };

  const cancelUpload = () => {
    abortRef.current?.abort();
    setUploading(false);
    setProgress(0);
  };

  if (compact) {
    return (
      <div>
        <input ref={inputRef} type="file" accept={accept} onChange={handleSelect} style={{ display: 'none' }} />
        {uploading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 4, background: 'var(--bg-elevated)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.2s' }} />
            </div>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>{progress}%</span>
            <button onClick={cancelUpload} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem' }}>✕</button>
          </div>
        ) : (
          <button onClick={() => inputRef.current?.click()} style={{ padding: '6px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer' }}>
            {label}
          </button>
        )}
        {error && <div style={{ color: '#ef4444', fontSize: '0.68rem', marginTop: 4 }}>{error}</div>}
      </div>
    );
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept={accept} onChange={handleSelect} style={{ display: 'none' }} />
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        style={{
          padding: '32px 24px',
          border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 12,
          background: dragOver ? 'rgba(90,90,240,0.04)' : 'var(--bg-elevated)',
          textAlign: 'center',
          cursor: uploading ? 'default' : 'pointer',
          transition: 'all 0.15s',
        }}
      >
        {uploading ? (
          <div>
            <div style={{ width: '100%', height: 6, background: 'var(--bg-surface)', borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.2s', borderRadius: 3 }} />
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 8 }}>Uploading... {progress}%</div>
            <button onClick={cancelUpload} style={{ padding: '5px 12px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-tertiary)', fontSize: '0.72rem', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '1.5rem', marginBottom: 8, opacity: 0.4 }}>↑</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
              Drag and drop or click to browse. Max {formatSize(maxSize)}.
            </div>
          </div>
        )}
      </div>
      {error && <div style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: 8 }}>{error}</div>}
    </div>
  );
}
