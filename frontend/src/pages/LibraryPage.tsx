import type { FC } from 'react';
import { useEffect, useRef, useState } from 'react';
import FilterOverlay from '../components/FilterOverlay';
import './LibraryPage.css';
import BookImage from '../components/BookImage';
import { fetchJson, apiFetch } from '../lib/api';
import type { Work } from '../types';
import WorkWizardOverlay, { type WorkDraft } from '../components/WorkWizardOverlay';
import WorkDetailsOverlay from '../components/WorkDetailsOverlay.tsx';

export interface BookCardProps {
  title: string;
  summary: string;
  imageUrl?: string | null;
  genres?: string[];
  themes?: string[];
  loading?: boolean;
  onGenerate?: () => void;
  onRegenerate?: () => void;
  onClear?: () => void;
  onViewMore?: () => void;
  onEdit?: () => void;
}

export const BookCard: FC<BookCardProps> = ({
  title,
  summary,
  imageUrl,
  genres = [],
  themes = [],
  loading = false,
  onGenerate,
  onRegenerate,
  onClear,
  onViewMore,
  onEdit,
}) => (
  <div className="book-card">
    <div className="book-card-header fixed-h">
      <div className="book-card-header-row">
        <div className="header-spacer" />
        <h5 className="book-title centered" title={title}>
          {title}
        </h5>
        <button
          className="icon-btn edit-btn"
          type="button"
          aria-label="Edit work"
          title="Edit work"
          onClick={onEdit}
        >
          {/* simple pencil icon */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" stroke="currentColor" strokeWidth="1.5" fill="currentColor"/>
            <path d="M20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor"/>
          </svg>
        </button>
      </div>
    </div>
    <div className="book-card-body fixed-h">
      <div className="book-body-grid">
        <div className="book-summary-wrap">
          {(genres.length > 0 || themes.length > 0) && (
            <div className="book-tags">
              {genres.map(g => (
                <span key={`g-${g}`} className="tag tag-genre" title="Genre">{g}</span>
              ))}
              {themes.map(t => (
                <span key={`t-${t}`} className="tag tag-theme" title="Theme">{t}</span>
              ))}
            </div>
          )}
        </div>
        <div className="book-summary-wrap">
          <p className="book-summary justified">{summary}</p>
        </div>
        <div className="book-image-wrap">
          <BookImage
            imageUrl={imageUrl}
            onGenerate={onGenerate}
            onRegenerate={onRegenerate}
            onClear={onClear}
            loading={loading}
            caption="Generate cover"
          />
        </div>
      </div>
    </div>
    <div className="book-card-footer fixed-h">
      <div className="book-footer-right">
        <button className="btn btn-sm btn-outline-primary" type="button" onClick={onViewMore}>View more</button>
      </div>
    </div>
  </div>
);

const LibraryPage: FC = () => {
  const [works, setWorks] = useState<Work[]>([]);
  const [filtered, setFiltered] = useState<Work[]>([]);
  const [imgLoading, setImgLoading] = useState<Record<number, boolean>>({});
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Work | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<Work | null>(null);
  const [q, setQ] = useState('');
  const [genreFilters, setGenreFilters] = useState<string[]>([]);
  const [themeFilters, setThemeFilters] = useState<string[]>([]);
  const [authorFilters, setAuthorFilters] = useState<string[]>([]);
  const [yearFilters, setYearFilters] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const searchbarRef = useRef<HTMLDivElement | null>(null);
  const filterBtnRef = useRef<HTMLButtonElement | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      try {
        const data = await fetchJson<Work[]>('/works');
        if (!ignore) {
          setWorks(data);
          setFiltered(data);
        }
      } catch (e) {
        console.error(e);
      }
    };
    load();
    return () => { ignore = true; };
  }, []);

  // Listen for deletion events from the wizard to update list
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ id: number }>;
      const id = ce.detail?.id;
      if (id != null) {
        setWorks(prev => prev.filter(w => w.id !== id));
      }
    };
    window.addEventListener('work:deleted', handler as EventListener);
    return () => window.removeEventListener('work:deleted', handler as EventListener);
  }, []);

  const onAddWork = () => {
    setEditTarget(null);
    setWizardOpen(true);
  };

  const submitWizard = async (payload: WorkDraft) => {
    if (editTarget) {
      const res = await apiFetch(`/works/${editTarget.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await res.text());
      const updated: Work = await res.json();
      setWorks(prev => prev.map(w => (w.id === updated.id ? updated : w)));
  // success toast is handled inside the wizard overlay
    } else {
      const res = await apiFetch('/works', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await res.text());
      const created: Work = await res.json();
      setWorks(prev => [created, ...prev]);
  // success toast is handled inside the wizard overlay
    }
    setWizardOpen(false);
  };

  useEffect(() => {
    // Simple client-side filter for now
    const ql = q.trim().toLowerCase();
    const next = works.filter(w => {
      const matchQ = !ql || [w.title, w.author, w.short_summary, w.full_summary].some(v => (v || '').toLowerCase().includes(ql));
      const matchG = genreFilters.length === 0 || (w.genres || []).some(g => genreFilters.some(f => g.toLowerCase().includes(f.toLowerCase())));
      const matchT = themeFilters.length === 0 || (w.themes || []).some(t => themeFilters.some(f => t.toLowerCase().includes(f.toLowerCase())));
      const matchA = authorFilters.length === 0 || authorFilters.some(f => (w.author || '').toLowerCase().includes(f.toLowerCase()));
      const matchY = yearFilters.length === 0 || yearFilters.some(f => String(w.year || '').includes(f));
      return matchQ && matchG && matchT && matchA && matchY;
    });
    setFiltered(next);
  }, [q, genreFilters, themeFilters, authorFilters, yearFilters, works]);

  // anchorRect is updated when opening via button

  return (
    <div className="library-page">
      <div className="library-header">
        <div className="search-and-filters">
          <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
            <div className="library-searchbar" ref={searchbarRef} style={{ width: 'min(100%, 1200px)' }}>
              <span className="search-icon" aria-hidden />
              <input className="form-control" placeholder="Search library" value={q} onChange={e => setQ(e.target.value)} />
              <button ref={filterBtnRef} type="button" className="filter-btn" onClick={() => {
                if (filterBtnRef.current) setAnchorRect(filterBtnRef.current.getBoundingClientRect());
                setFilterOpen(v => !v);
              }} title="Filters" aria-label="Open filters" />
            </div>
          </div>
          {/* Filters row placed below the searchbar */}
          <div className="filters-below">
          {genreFilters.map((g, idx) => (
            <button key={`g-${idx}-${g}`} className="pill pill-genre removable" title="Remove genre" onClick={() => setGenreFilters(prev => prev.filter((_, i) => i !== idx))}>
              <span className="pill-text">{g}</span><span className="pill-x" />
            </button>
          ))}
          {themeFilters.map((t, idx) => (
            <button key={`t-${idx}-${t}`} className="pill pill-theme removable" title="Remove theme" onClick={() => setThemeFilters(prev => prev.filter((_, i) => i !== idx))}>
              <span className="pill-text">{t}</span><span className="pill-x" />
            </button>
          ))}
          {authorFilters.map((a, idx) => (
            <button key={`a-${idx}-${a}`} className="pill pill-author removable" title="Remove author" onClick={() => setAuthorFilters(prev => prev.filter((_, i) => i !== idx))}>
              <span className="pill-text">{a}</span><span className="pill-x" />
            </button>
          ))}
          {yearFilters.map((y, idx) => (
            <button key={`y-${idx}-${y}`} className="pill pill-year removable" title="Remove year" onClick={() => setYearFilters(prev => prev.filter((_, i) => i !== idx))}>
              <span className="pill-text">{y}</span><span className="pill-x" />
            </button>
          ))}
          </div>
        </div>
      </div>
      <div className="library-grid">
        {/* Add Work card always first */}
        <div className="book-card add-work-card">
          <div className="book-card-header fixed-h">
            <h5 className="book-title centered">Add work</h5>
          </div>
          <div className="book-card-body fixed-h">
            <div className="add-work-body">
              <button type="button" className="add-work-button" aria-label="Add work" title="Add work" onClick={onAddWork}>
                <span aria-hidden>+</span>
              </button>
            </div>
          </div>
        </div>
  {filtered.map(w => (
          <BookCard
            key={w.id}
            title={w.title}
            summary={w.short_summary || ''}
            imageUrl={w.image_url || undefined}
            genres={w.genres}
            themes={w.themes}
            loading={!!imgLoading[w.id]}
            onViewMore={() => setDetailsTarget(w)}
            onEdit={() => { setEditTarget(w); setWizardOpen(true); }}
            onGenerate={async () => {
              try {
                setImgLoading(prev => ({ ...prev, [w.id]: true }));
                const res = await apiFetch(`/works/${w.id}/image`, { method: 'POST' });
                if (!res.ok) throw new Error(await res.text());
                const updated: Work = await res.json();
                setWorks(prev => prev.map(x => x.id === w.id ? updated : x));
              } catch (e) { console.error(e); }
              finally { setImgLoading(prev => ({ ...prev, [w.id]: false })); }
            }}
            onRegenerate={async () => {
              try {
                setImgLoading(prev => ({ ...prev, [w.id]: true }));
                const res = await apiFetch(`/works/${w.id}/image`, { method: 'POST' });
                if (!res.ok) throw new Error(await res.text());
                const updated: Work = await res.json();
                setWorks(prev => prev.map(x => x.id === w.id ? updated : x));
              } catch (e) { console.error(e); }
              finally { setImgLoading(prev => ({ ...prev, [w.id]: false })); }
            }}
            onClear={async () => {
              try {
                setImgLoading(prev => ({ ...prev, [w.id]: true }));
                const res = await apiFetch(`/works/${w.id}/image`, { method: 'DELETE' });
                if (!res.ok) throw new Error(await res.text());
                const updated: Work = await res.json();
                setWorks(prev => prev.map(x => x.id === w.id ? updated : x));
              } catch (e) { console.error(e); }
              finally { setImgLoading(prev => ({ ...prev, [w.id]: false })); }
            }}
          />
        ))}
      </div>
      <WorkWizardOverlay
        open={wizardOpen}
        initialWork={editTarget}
        onClose={() => setWizardOpen(false)}
        onSubmit={submitWizard}
      />
      <WorkDetailsOverlay
        open={!!detailsTarget}
        work={detailsTarget}
        onClose={() => setDetailsTarget(null)}
      />
      {/* Filter overlay */}
      {filterOpen && (
        <FilterOverlay
          open={filterOpen}
          anchorRect={anchorRect || undefined}
          onClose={() => setFilterOpen(false)}
          onAddGenre={(val) => setGenreFilters(prev => [...prev, val])}
          onAddTheme={(val) => setThemeFilters(prev => [...prev, val])}
          onAddAuthor={(val) => setAuthorFilters(prev => [...prev, val])}
          onAddYear={(val) => setYearFilters(prev => [...prev, val])}
        />
      )}
    </div>
  );
};

export default LibraryPage;
