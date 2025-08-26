import React, { useEffect, useMemo, useState } from 'react';
import './WorkWizardOverlay.css';
import type { Work } from '../types';
import { apiFetch } from '../lib/api';
import { useNotifications } from './Notifications';

type TabKey = 'wizard' | 'json';

export interface WorkDraft {
  title: string;
  author?: string;
  year?: string;
  short_summary?: string;
  full_summary?: string;
  image_url?: string;
  genres: string[];
  themes: string[];
}

function toDraftFromWork(w?: Work | null): WorkDraft {
  if (!w) {
    return {
      title: '',
      author: '',
      year: '',
      short_summary: '',
      full_summary: '',
      image_url: '',
      genres: [],
      themes: [],
    };
  }
  return {
    title: w.title || '',
    author: w.author || '',
    year: w.year || '',
    short_summary: w.short_summary || '',
    full_summary: w.full_summary || '',
    image_url: w.image_url || '',
    genres: w.genres || [],
    themes: w.themes || [],
  };
}

function arrayFromCSV(input: string): string[] {
  return input
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

function csvFromArray(arr: string[]): string {
  return (arr || []).join(', ');
}

export interface WorkWizardOverlayProps {
  open: boolean;
  initialWork?: Work | null;
  onClose: () => void;
  onSubmit: (payload: WorkDraft) => Promise<void> | void;
}

const WorkWizardOverlay: React.FC<WorkWizardOverlayProps> = ({ open, initialWork, onClose, onSubmit }) => {
  const [active, setActive] = useState<TabKey>('wizard');
  const [draft, setDraft] = useState<WorkDraft>(() => toDraftFromWork(initialWork));
  const [genresCsv, setGenresCsv] = useState('');
  const [themesCsv, setThemesCsv] = useState('');
  const [fileTexts, setFileTexts] = useState<string[]>([]);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const isEdit = !!initialWork;
  const { notify } = useNotifications();

  useEffect(() => {
    setDraft(toDraftFromWork(initialWork));
    setGenresCsv(csvFromArray(initialWork?.genres || []));
    setThemesCsv(csvFromArray(initialWork?.themes || []));
    setFileTexts([]);
  }, [initialWork, open]);

  useEffect(() => {
    if (active === 'json') {
      // sync form -> json
      const mergedFull = [draft.full_summary || '', ...fileTexts].filter(Boolean).join('\n\n---\n');
      const payload = { ...draft, full_summary: mergedFull, genres: arrayFromCSV(genresCsv), themes: arrayFromCSV(themesCsv) };
      setJsonText(JSON.stringify(payload, null, 2));
      setJsonError(null);
    }
  }, [active, draft, genresCsv, themesCsv, fileTexts]);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const readers = Array.from(files).map(f => new Promise<string>((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ''));
      fr.readAsText(f);
    }));
    const texts = await Promise.all(readers);
    setFileTexts(prev => [...prev, ...texts]);
  };

  const payloadForSubmit = useMemo(() => {
    const mergedFull = [draft.full_summary || '', ...fileTexts].filter(Boolean).join('\n\n---\n');
    return {
      ...draft,
      full_summary: mergedFull,
      genres: arrayFromCSV(genresCsv),
      themes: arrayFromCSV(themesCsv),
    } as WorkDraft;
  }, [draft, genresCsv, themesCsv, fileTexts]);

  const submitFromWizard = async () => {
    if (!draft.title.trim()) {
      alert('Title is required');
      return;
    }
    try {
      await onSubmit(payloadForSubmit);
      notify({ kind: 'success', title: isEdit ? 'Updated' : 'Created', message: isEdit ? 'Work updated successfully' : 'Work created successfully' });
    } catch (e: any) {
      notify({ kind: 'error', title: 'Failed', message: e?.message || 'Operation failed' });
      throw e;
    }
  };

  const submitFromJson = async () => {
    try {
      const obj = JSON.parse(jsonText);
      // basic shape checks
      if (!obj.title) throw new Error('title is required');
      obj.genres = Array.isArray(obj.genres) ? obj.genres : arrayFromCSV(String(obj.genres || ''));
      obj.themes = Array.isArray(obj.themes) ? obj.themes : arrayFromCSV(String(obj.themes || ''));
      await onSubmit(obj);
      notify({ kind: 'success', title: isEdit ? 'Updated' : 'Created', message: isEdit ? 'Work updated successfully' : 'Work created successfully' });
      setJsonError(null);
    } catch (e: any) {
      setJsonError(e?.message || 'Invalid JSON');
      notify({ kind: 'error', title: 'Invalid JSON', message: e?.message || 'Invalid JSON' });
    }
  };

  const handleDelete = async () => {
    if (!initialWork) return;
    const ok = window.confirm(`Delete "${initialWork.title}"? This cannot be undone.`);
    if (!ok) return;
    try {
      const res = await apiFetch(`/works/${initialWork.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      notify({ kind: 'success', title: 'Deleted', message: 'Work deleted successfully' });
      onClose();
      // Let parent remove from list by refetching or optimistic update; simplest: emit a window event
      window.dispatchEvent(new CustomEvent('work:deleted', { detail: { id: initialWork.id } }));
    } catch (e: any) {
      notify({ kind: 'error', title: 'Delete failed', message: e?.message || 'Delete failed' });
    }
  };

  if (!open) return null;

  return (
    <div className="wizard-overlay">
      <div className="wizard-card">
        <div className="wizard-header">
          <div className="wizard-title">{isEdit ? 'Edit work' : 'Add a new work'}</div>
        </div>
        <div className="wizard-tabs">
          <button className={`tab-btn ${active==='wizard' ? 'active' : ''}`} onClick={() => setActive('wizard')}>Wizard</button>
          <button className={`tab-btn ${active==='json' ? 'active' : ''}`} onClick={() => setActive('json')}>Paste JSON</button>
        </div>
        {active === 'wizard' ? (
          <div className="wizard-body">
            <div className="grid two-cols">
              <div className="form-group">
                <label>Title *</label>
                <input className="form-control" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="The Great Novel" />
              </div>
              <div className="form-group">
                <label>Author</label>
                <input className="form-control" value={draft.author || ''} onChange={e => setDraft({ ...draft, author: e.target.value })} placeholder="Jane Doe" />
              </div>
              <div className="form-group">
                <label>Year</label>
                <input className="form-control" value={draft.year || ''} onChange={e => setDraft({ ...draft, year: e.target.value })} placeholder="1999" />
              </div>
              <div className="form-group">
                <label>Image URL</label>
                <input className="form-control" value={draft.image_url || ''} onChange={e => setDraft({ ...draft, image_url: e.target.value })} placeholder="https://..." />
              </div>
              <div className="form-group span-2">
                <label>Short summary</label>
                <textarea className="form-control" rows={3} value={draft.short_summary || ''} onChange={e => setDraft({ ...draft, short_summary: e.target.value })} />
              </div>
              <div className="form-group span-2">
                <label>Full summary</label>
                <textarea className="form-control" rows={6} value={draft.full_summary || ''} onChange={e => setDraft({ ...draft, full_summary: e.target.value })} />
                <div className="hint">You can also upload .txt files; their text will be appended below.</div>
                <input className="form-control" type="file" accept=".txt" multiple onChange={e => handleFiles(e.target.files)} />
                {fileTexts.length > 0 && (
                  <div className="file-preview">
                    <div className="file-preview-title">Attached text snippets</div>
                    <ul>
                      {fileTexts.map((t, i) => (
                        <li key={i}><code>snippet {i+1}</code> — {Math.min(60, t.length)} chars</li>
                      ))}
                    </ul>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => setFileTexts([])}>Clear attachments</button>
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>Genres (comma separated)</label>
                <input className="form-control" value={genresCsv} onChange={e => setGenresCsv(e.target.value)} placeholder="fantasy, classic" />
              </div>
              <div className="form-group">
                <label>Themes (comma separated)</label>
                <input className="form-control" value={themesCsv} onChange={e => setThemesCsv(e.target.value)} placeholder="courage, identity" />
              </div>
            </div>
          </div>
        ) : (
          <div className="wizard-body">
            <div className="form-group">
              <label>Paste JSON</label>
              <textarea className="form-control mono" rows={16} value={jsonText} onChange={e => setJsonText(e.target.value)} />
              {jsonError && <div className="error">{jsonError}</div>}
            </div>
          </div>
        )}
        <div className="wizard-footer">
          {isEdit && (
            <button className="btn btn-outline-danger me-auto" onClick={handleDelete} title="Delete work">Delete</button>
          )}
          <button className="btn btn-primary" onClick={active==='wizard' ? submitFromWizard : submitFromJson}>{isEdit ? 'Save changes' : 'Create work'}</button>
          <button className="btn btn-outline-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default WorkWizardOverlay;
