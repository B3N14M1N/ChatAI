import type { FC } from 'react';
import { useState, useRef, useEffect } from 'react';
import './FilterOverlay.css';

interface Props {
  open: boolean;
  anchorRect?: DOMRect | null;
  onClose: () => void;
  onAddGenre: (val: string) => void;
  onAddTheme: (val: string) => void;
  onAddAuthor: (val: string) => void;
  onAddYear: (val: string) => void;
}

const FilterOverlay: FC<Props> = ({ open, anchorRect, onClose, onAddGenre, onAddTheme, onAddAuthor, onAddYear }) => {
  const [genre, setGenre] = useState('');
  const [theme, setTheme] = useState('');
  const [author, setAuthor] = useState('');
  const [year, setYear] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent | MouseEvent) => {
      const el = rootRef.current;
      if (!el) return;
      const target = e.target as Node | null;
      if (target && !el.contains(target)) {
        onClose();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const width = 300;
  const style: React.CSSProperties = anchorRect
    ? { top: Math.round(anchorRect.bottom + 6), left: Math.round(anchorRect.right - width), width }
    : { top: 120, left: 120, width };

  return (
    <div ref={rootRef} className="filter-overlay" style={style} role="dialog" aria-modal>
      <button className="overlay-close-btn" aria-label="Close" title="Close" onClick={onClose} />
      <div className="filter-row">
        <label>Genre</label>
        <div className="input-add">
          <input value={genre} onChange={e => setGenre(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && genre.trim()) { onAddGenre(genre.trim()); setGenre(''); } }} />
          <button type="button" className="add-btn" onClick={() => { if (genre.trim()) { onAddGenre(genre.trim()); setGenre(''); } }}>Add</button>
        </div>
      </div>
      <div className="filter-row">
        <label>Theme</label>
        <div className="input-add">
          <input value={theme} onChange={e => setTheme(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && theme.trim()) { onAddTheme(theme.trim()); setTheme(''); } }} />
          <button type="button" className="add-btn" onClick={() => { if (theme.trim()) { onAddTheme(theme.trim()); setTheme(''); } }}>Add</button>
        </div>
      </div>
      <div className="filter-row">
        <label>Author</label>
        <div className="input-add">
          <input value={author} onChange={e => setAuthor(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && author.trim()) { onAddAuthor(author.trim()); setAuthor(''); } }} />
          <button type="button" className="add-btn" onClick={() => { if (author.trim()) { onAddAuthor(author.trim()); setAuthor(''); } }}>Add</button>
        </div>
      </div>
      <div className="filter-row">
        <label>Year</label>
        <div className="input-add">
          <input value={year} onChange={e => setYear(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && year.trim()) { onAddYear(year.trim()); setYear(''); } }} />
          <button type="button" className="add-btn" onClick={() => { if (year.trim()) { onAddYear(year.trim()); setYear(''); } }}>Add</button>
        </div>
      </div>
    </div>
  );
};

export default FilterOverlay;
