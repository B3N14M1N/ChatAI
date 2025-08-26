import React from 'react';
import './WorkDetailsOverlay.css';
import type { Work } from '../types';
import { resolveApiUrl } from '../lib/api';

interface WorkDetailsOverlayProps {
  open: boolean;
  work: Work | null;
  onClose: () => void;
}

const WorkDetailsOverlay: React.FC<WorkDetailsOverlayProps> = ({ open, work, onClose }) => {
  if (!open || !work) return null;

  const hasImage = Boolean(work.image_url);

  return (
    <div className="details-overlay" role="dialog" aria-modal="true">
      <div className="details-card">
        <div className="details-header">
          <div className="details-title">
            <div className="title-text" title={work.title}>{work.title}</div>
            {(work.author || work.year) && (
              <div className="subtitle">
                {work.author || ''}{work.author && work.year ? ' · ' : ''}{work.year || ''}
              </div>
            )}
          </div>
        </div>
        {(work.genres?.length || work.themes?.length) ? (
          <div className="details-tags">
            {(work.genres || []).map(g => <span key={`g-${g}`} className="tag tag-genre">{g}</span>)}
            {(work.themes || []).map(t => <span key={`t-${t}`} className="tag tag-theme">{t}</span>)}
          </div>
        ) : null}
        <div className={`details-body ${hasImage ? 'two-cols' : ''}`}>
          <div className="details-text">
            <div className="full-summary">
              {work.full_summary || work.short_summary || 'No summary available.'}
            </div>
          </div>
          {hasImage && (
            <div className="details-image">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={resolveApiUrl(work.image_url!)} alt={`${work.title} cover`} />
            </div>
          )}
        </div>
        <div className="details-footer">
          <button className="btn btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
};

export default WorkDetailsOverlay;
