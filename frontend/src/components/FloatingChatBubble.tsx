import type { FC, MouseEvent as ReactMouseEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { MdSmartToy } from 'react-icons/md';
import { useTheme } from '../contexts/ThemeContext';
import './FloatingChatBubble.css';

interface FloatingChatBubbleProps {
  pos: { x: number; y: number };
  setPos: (pos: { x: number; y: number }) => void;
  onRestore: () => void;
}

const FloatingChatBubble: FC<FloatingChatBubbleProps> = ({ pos, setPos, onRestore }) => {
  const { effectiveTheme } = useTheme();
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const didMoveRef = useRef(false);
  const suppressClickRef = useRef(false);
  const margin = 8;

  const onBubbleMouseDown = (e: ReactMouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
    setDragging(true);
    didMoveRef.current = false;
    suppressClickRef.current = false;
    window.addEventListener('mousemove', onMouseMove as any);
    window.addEventListener('mouseup', onMouseUp as any, { once: true });
  };
  const onMouseMove = (e: MouseEvent) => {
    const st = dragRef.current; if (!st) return;
    const dx = e.clientX - st.startX; const dy = e.clientY - st.startY;
    const bw = 64; const bh = 64; const vw = window.innerWidth; const vh = window.innerHeight;
    let x = st.origX + dx; let y = st.origY + dy;
    x = Math.max(margin, Math.min(vw - bw - margin, x));
    y = Math.max(margin, Math.min(vh - bh - margin, y));
    setPos({ x, y });
    if (Math.abs(dx) + Math.abs(dy) > 4) {
      didMoveRef.current = true;
    }
  };
  const onMouseUp = () => {
    dragRef.current = null;
    setDragging(false);
    window.removeEventListener('mousemove', onMouseMove as any);
    if (didMoveRef.current) {
      // Prevent the immediate click that follows mouseup after a drag
      suppressClickRef.current = true;
      // Clear on next macrotask to allow future clicks
      setTimeout(() => { suppressClickRef.current = false; }, 0);
    }
  };

  // Persist bubble position
  useEffect(() => {
  try { localStorage.setItem('chat.floating.bubble.pos', JSON.stringify(pos)); } catch {}
  }, [pos]);
  // Try to restore if App provides a default only once (App may still override)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('chat.floating.bubble.pos');
      if (raw) {
        const parsed = JSON.parse(raw) as { x: number; y: number };
  const margin = 8; const vw = window.innerWidth; const vh = window.innerHeight; const bw = 64; const bh = 64;
        const x = Math.max(margin, Math.min(vw - bw - margin, parsed.x));
        const y = Math.max(margin, Math.min(vh - bh - margin, parsed.y));
        setPos({ x, y });
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`floating-chat-bubble ${dragging ? 'dragging' : ''}`}
      data-theme={effectiveTheme}
      style={{ left: pos.x, top: pos.y }}
    >
      <button
        className="chat-bubble-btn"
        onMouseDown={onBubbleMouseDown}
        onClick={(e) => {
          if (suppressClickRef.current) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          onRestore();
        }}
        aria-label="Show chat"
        title="Show chat"
      >
        <MdSmartToy size={24} />
      </button>
    </div>
  );
};

export default FloatingChatBubble;
