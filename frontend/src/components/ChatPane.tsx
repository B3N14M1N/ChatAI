import type { FC, ReactNode, MouseEvent as ReactMouseEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { MdOpenInNew, MdCloseFullscreen } from 'react-icons/md';
import './ChatPane.css';

interface ChatPaneProps {
  floatingDefault?: boolean;
  title?: string;
  children: ReactNode;
  enableFloatingToggle?: boolean; // allow hiding the pop-out control
  hideHeaderWhenDocked?: boolean; // hide header in fullscreen/docked mode
}

const ChatPane: FC<ChatPaneProps> = ({ floatingDefault = false, title = 'Chat', children, enableFloatingToggle = false, hideHeaderWhenDocked = true }) => {
  const { effectiveTheme } = useTheme();
  const [floating, setFloating] = useState(floatingDefault);
  const [pos, setPos] = useState({ x: 80, y: 80 });
  const [size, setSize] = useState({ w: 720, h: 560 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const onToggleFloating = useCallback(() => setFloating(f => !f), []);

  const onMouseDownDrag = (e: ReactMouseEvent) => {
    if (!floating) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
    window.addEventListener('mousemove', onMouseMove as any);
    window.addEventListener('mouseup', onMouseUp as any, { once: true });
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPos({ x: Math.max(0, dragRef.current.origX + dx), y: Math.max(0, dragRef.current.origY + dy) });
  };

  const onMouseUp = () => {
    dragRef.current = null;
    window.removeEventListener('mousemove', onMouseMove as any);
  };

  useEffect(() => () => {
    window.removeEventListener('mousemove', onMouseMove as any);
  }, []);

  // Resize via CSS resize handle; keep size in state on resizeend (best-effort)
  const boxRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (floating) {
        const rect = el.getBoundingClientRect();
        setSize({ w: rect.width, h: rect.height });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [floating]);

  const showHeader = floating || !hideHeaderWhenDocked ? true : false;

  return (
    <div
      className={`chat-pane ${floating ? 'floating' : 'docked'}`}
      data-theme={effectiveTheme}
      ref={boxRef}
      style={floating ? { left: pos.x, top: pos.y, width: size.w, height: size.h } : undefined}
    >
      {showHeader && (
        <div className={`chat-pane-header ${floating ? 'drag-enabled' : ''}`} onMouseDown={onMouseDownDrag}>
          <div className="chat-pane-title">{title}</div>
          {enableFloatingToggle && (
            <button className="chat-pane-action" onClick={onToggleFloating} aria-label={floating ? 'Dock' : 'Pop out'} title={floating ? 'Dock' : 'Pop out'}>
              {floating ? <MdCloseFullscreen size={18} /> : <MdOpenInNew size={18} />}
            </button>
          )}
        </div>
      )}
      <div className="chat-pane-body">
        {children}
      </div>
    </div>
  );
};

export default ChatPane;
