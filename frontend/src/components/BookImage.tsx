import type { FC } from 'react';
import './BookImage.css';

export interface BookImageProps {
  imageUrl?: string | null;
  onGenerate?: () => void;
  onRegenerate?: () => void;
  onClear?: () => void;
  caption?: string;
}

// Reusable image slot with hover actions. Maintains aspect ratio and clamps UI.
const BookImage: FC<BookImageProps> = ({ imageUrl, onGenerate, onRegenerate, onClear, caption = 'Generate cover' }) => {
  const hasImage = Boolean(imageUrl);

  return (
    <div className="book-image">
      {hasImage ? (
        <>
          {/* Image container */}
          <img className="book-image-img" src={imageUrl!} alt="Book cover" />
          {/* Hover actions */}
          <div className="book-image-actions">
            <button type="button" className="btn btn-sm btn-light" onClick={onRegenerate}>Regenerate</button>
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={onClear}>Clear</button>
          </div>
        </>
      ) : (
        <div className="book-image-empty">
          <div className="book-image-empty-icon" aria-hidden>🖼️</div>
          <div className="book-image-empty-caption">{caption}</div>
          <button type="button" className="btn btn-sm btn-primary" onClick={onGenerate}>Generate</button>
        </div>
      )}
    </div>
  );
};

export default BookImage;
