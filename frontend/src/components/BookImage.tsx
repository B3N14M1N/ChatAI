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
  // Optimistic empty state after Clear
  const [forcedEmpty, setForcedEmpty] = useState(false);
  // Server-truthy flag for whether a current image exists
  const [hasCurrent, setHasCurrent] = useState<boolean | null>(null);
  // Final flag the UI uses
  const hasImage = (hasCurrent ?? Boolean(imageUrl)) && !forcedEmpty;
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versions, setVersions] = useState<Array<{ id: number; url: string; created_at: string; deleted: boolean; is_current: boolean; content_type: string }>>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [hasAnyVersions, setHasAnyVersions] = useState(false);
  // Preserve last known rendered height when an image existed (to keep history height when empty)
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [lastImageHeight, setLastImageHeight] = useState<number | null>(null);
  // When no image is selected and history is open, keep a square box (height = width)
  const [squareHeight, setSquareHeight] = useState<number | null>(null);

  // Reset optimistic empty if parent sends a new image
  useEffect(() => {
    if (imageUrl) setForcedEmpty(false);
  }, [imageUrl]);

  // Probe server to see if a current image exists (covers refresh after clear)
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetchJson<{ items: Array<{ is_current: boolean }> }>(`/works/${workId}/images?include_deleted=true`);
        if (!ignore) {
          const items = res.items || [];
          setHasCurrent(items.some(it => it.is_current));
          setHasAnyVersions(items.length > 0);
        }
      } catch (e) {
        // if probe fails, fall back to prop
        if (!ignore) setHasCurrent(null);
      }
    })();
    return () => { ignore = true; };
  }, [workId, imageUrl]);

  // Capture container height when an image is present so we can reuse it when empty
  useEffect(() => {
    if (!hasImage) return;
    const el = containerRef.current;
    if (el) setLastImageHeight(el.clientHeight);
  }, [hasImage]);

  // Enforce square height when history is open and there's no current image
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (historyOpen && !hasImage) {
      // Set initial square height
      setSquareHeight(el.clientWidth);
      // Observe width changes to update height accordingly
      const RZ: typeof ResizeObserver | undefined = (window as any).ResizeObserver;
      let ro: ResizeObserver | undefined;
      if (RZ) {
        ro = new RZ((entries: any[]) => {
          for (const entry of entries) {
            const width = entry.contentRect?.width ?? el.clientWidth;
            setSquareHeight(width);
          }
        });
        ro.observe(el);
      }
      return () => {
        if (ro) ro.disconnect();
      };
    } else {
      setSquareHeight(null);
    }
  }, [historyOpen, hasImage]);

  // Fetch versions when history opens
  useEffect(() => {
    if (!historyOpen) return;
    let ignore = false;
    (async () => {
      try {
        setLoadingHistory(true);
        const res = await fetchJson<{ items: any[] }>(`/works/${workId}/images?include_deleted=true`);
        if (!ignore) {
          const items = res.items || [];
          setVersions(items);
          setHasAnyVersions(items.length > 0);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingHistory(false);
      }
    })();
    return () => { ignore = true; };
  }, [historyOpen, workId]);

  // When empty, pre-check if any versions exist to show History button
  useEffect(() => {
    let ignore = false;
  if (hasImage) return;
    (async () => {
      try {
        const res = await fetchJson<{ items: any[] }>(`/works/${workId}/images?include_deleted=true`);
        if (!ignore) setHasAnyVersions((res.items || []).length > 0);
      } catch {
        // ignore
      }
    })();
    return () => { ignore = true; };
  }, [hasImage, workId]);

  return (
    <div
      ref={containerRef}
      style={{
        // When history is open and no image, make a square box
        height: historyOpen && !hasImage && squareHeight ? squareHeight : undefined,
        // Otherwise, keep at least the last seen image height when empty
        minHeight: !historyOpen && !hasImage && lastImageHeight ? lastImageHeight : undefined,
      }}
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
          <img className="book-image-img" src={resolveApiUrl(imageUrl!)} alt="Book cover" onLoad={() => {
            const el = containerRef.current; if (el) setLastImageHeight(el.clientHeight);
          }} />
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
              <button type="button" className="btn btn-sm btn-outline-danger" onClick={loading ? undefined : async () => {
                try {
                  await onClear?.();
                } finally {
                  setForcedEmpty(true);
                  setHasCurrent(false);
                  setHistoryOpen(false);
                }
              }} disabled={loading}>Clear</button>
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
            {hasAnyVersions && (
              <button type="button" className="btn btn-sm btn-outline-light" onClick={loading ? undefined : (() => setHistoryOpen(true))} disabled={loading}>History</button>
            )}
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
              <div key={v.id} className={"history-item" + (v.is_current ? ' current' : '')}>
                {v.is_current && <span className="history-flag current">Current</span>}
                <img src={resolveApiUrl(`/works/${workId}/images/${v.id}`)} alt="version" />
                <div className="history-actions">
                  {onSelectVersion && !v.is_current && !loading && (
                      <button type="button" className="btn btn-sm btn-outline-primary" onClick={async () => {
                        try {
                          setLoadingHistory(true);
                          // parent handler performs API call; await it
                          await onSelectVersion(v.id);
                          // re-fetch versions to refresh 'current' flags
                          const resp = await fetchJson<{ items: any[] }>(`/works/${workId}/images?include_deleted=true`);
                          const items = resp.items || [];
                          setVersions(items);
                          setHasAnyVersions(items.length > 0);
                          setForcedEmpty(false);
                        } catch (e) {
                          console.error(e);
                        } finally {
                          setLoadingHistory(false);
                        }
                      }}>Use</button>
                    )}
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
