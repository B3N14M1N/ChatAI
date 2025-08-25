import type { FC } from 'react';
import './BookImage.css';
import { resolveApiUrl } from '../lib/api';

export interface BookImageProps {
  imageUrl?: string | null;
  onGenerate?: () => void;
  onRegenerate?: () => void;
  onClear?: () => void;
  caption?: string;
  loading?: boolean;
}

// Reusable image slot with hover actions. Maintains aspect ratio and clamps UI.
const BookImage: FC<BookImageProps> = ({ imageUrl, onGenerate, onRegenerate, onClear, caption = 'Generate cover', loading = false }) => {
  const hasImage = Boolean(imageUrl);

  return (
    <div className="book-image">
      {hasImage ? (
        <>
          {/* Image container */}
          <img className="book-image-img" src={resolveApiUrl(imageUrl!)} alt="Book cover" />
          {/* Hover actions */}
          <div className="book-image-actions">
            <button type="button" className="btn btn-sm btn-light" onClick={loading ? undefined : onRegenerate} disabled={loading}>Regenerate</button>
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={loading ? undefined : onClear} disabled={loading}>Clear</button>
          </div>
        </>
      ) : (
        <div className="book-image-empty">
          <div className="book-image-empty-icon" aria-hidden>🖼️</div>
          <div className="book-image-empty-caption">{caption}</div>
          <button type="button" className="btn btn-sm btn-primary" onClick={loading ? undefined : onGenerate} disabled={loading}>Generate</button>
        </div>
      )}
      {loading && (
        <div className="book-image-loading" aria-live="polite" aria-busy="true">
          <div className="spinner" aria-hidden />
        </div>
      )}
    </div>
  );
};

export default BookImage;
