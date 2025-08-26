import type { FC } from 'react';
import { useEffect, useRef, useState } from 'react';
import './BookImage.css';
import { resolveApiUrl, fetchJson } from '../lib/api';

export interface BookImageProps {
  workId: number;
  imageUrl?: string | null;
  onGenerate?: () => void;
  onRegenerate?: () => void;
  onClear?: () => void;
  onUpload?: (file: File) => void;
  onSelectVersion?: (versionId: number) => void;
  caption?: string;
  loading?: boolean;
}

// Reusable image slot with hover actions. Maintains aspect ratio and clamps UI.
const BookImage: FC<BookImageProps> = ({ workId, imageUrl, onGenerate, onRegenerate, onClear, onUpload, onSelectVersion, loading = false }) => {
  const hasImage = Boolean(imageUrl);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versions, setVersions] = useState<Array<{ id: number; url: string; created_at: string; deleted: boolean; is_current: boolean; content_type: string }>>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Fetch versions when history opens
  useEffect(() => {
    if (!historyOpen) return;
    let ignore = false;
    (async () => {
      try {
        setLoadingHistory(true);
        const res = await fetchJson<{ items: any[] }>(`/works/${workId}/images?include_deleted=true`);
        if (!ignore) setVersions(res.items || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingHistory(false);
      }
    })();
    return () => { ignore = true; };
  }, [historyOpen, workId]);

  return (
    <div
      className={"book-image" + (dragOver ? ' drag-over' : '')}
      onDragOver={(e) => { if (onUpload) { e.preventDefault(); setDragOver(true); } }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        if (!onUpload) return;
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) onUpload(file);
      }}
    >
      {hasImage ? (
        <>
          {/* Image container */}
          <img className="book-image-img" src={resolveApiUrl(imageUrl!)} alt="Book cover" />
          {/* Top-right actions */}
          {!historyOpen && (
            <div className="book-image-top-actions">
              <button type="button" className="btn btn-sm btn-light" onClick={loading ? undefined : (() => fileInputRef.current?.click())} disabled={loading}>Upload</button>
              <button type="button" className="btn btn-sm btn-light" onClick={loading ? undefined : (() => setHistoryOpen(v => !v))} disabled={loading}>History</button>
            </div>
          )}
          {/* Hover actions */}
          {!historyOpen && (
            <div className="book-image-actions">
              <button type="button" className="btn btn-sm btn-light" onClick={loading ? undefined : onRegenerate} disabled={loading}>Regenerate</button>
              <button type="button" className="btn btn-sm btn-outline-danger" onClick={loading ? undefined : onClear} disabled={loading}>Clear</button>
            </div>
          )}
        </>
      ) : (
        <div className="book-image-empty">
          <div className="book-image-empty-icon" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.25" />
              <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
              <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-sm btn-primary" onClick={loading ? undefined : onGenerate} disabled={loading}>Generate</button>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={loading ? undefined : (() => fileInputRef.current?.click())} disabled={loading}>Upload</button>
          </div>
        </div>
      )}
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && onUpload) onUpload(file);
          // reset so selecting the same file again fires change
          if (fileInputRef.current) fileInputRef.current.value = '';
        }}
      />
      {loading && (
        <div className="book-image-loading" aria-live="polite" aria-busy="true">
          <div className="spinner" aria-hidden />
        </div>
      )}

      {historyOpen && (
        <div className="book-image-history">
          <div className="history-header">
            <span>History</span>
            <button type="button" className="btn btn-sm btn-link" onClick={() => setHistoryOpen(false)}>Close</button>
          </div>
          <div className="history-list">
            {loadingHistory && <div className="history-loading">Loading…</div>}
            {!loadingHistory && versions.length === 0 && (
              <div className="history-empty">No versions yet</div>
            )}
            {!loadingHistory && versions.map(v => (
              <div key={v.id} className={"history-item" + (v.is_current ? ' current' : '') + (v.deleted ? ' deleted' : '')}>
                <img src={resolveApiUrl(`/works/${workId}/images/${v.id}`)} alt="version" />
                <div className="history-actions">
                  {onSelectVersion && !v.is_current && !loading && (
                    <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onSelectVersion(v.id)}>Use</button>
                  )}
                  {v.is_current && <span className="badge bg-primary">Current</span>}
                  {v.deleted && <span className="badge bg-secondary">Deleted</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BookImage;
