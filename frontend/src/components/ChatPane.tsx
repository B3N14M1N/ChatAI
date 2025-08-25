import type { FC, ReactNode, MouseEvent as ReactMouseEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { MdOpenInNew, MdAutorenew } from 'react-icons/md';
import { LuDock, LuMinus } from 'react-icons/lu';
import './ChatPane.css';

interface ChatPaneProps {
  floatingDefault?: boolean;
  title?: string;
  children: ReactNode;
  enableFloatingToggle?: boolean; // allow hiding the pop-out control
  hideHeaderWhenDocked?: boolean; // hide header in fullscreen/docked mode
  initialSize?: { w: number; h: number };
  initialPos?: { x: number; y: number };
  onRequestDock?: () => void; // called when user requests fullscreen/dock from floating mode
  minimized?: boolean;
  onRequestMinimize?: () => void;
  onRequestRestore?: () => void;
  onRequestClear?: () => void; // create new chat / clear current
}

const ChatPane: FC<ChatPaneProps> = ({ floatingDefault = false, title = 'Chat', children, enableFloatingToggle = false, hideHeaderWhenDocked = true, initialSize, initialPos, onRequestDock, minimized = false, onRequestMinimize, onRequestRestore, onRequestClear }) => {
  const { effectiveTheme } = useTheme();
  const [floating, setFloating] = useState(floatingDefault);
  const readStored = <T,>(k: string): T | null => {
    try { const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) as T : null; } catch { return null; }
  };
  const storedPos = readStored<{ x: number; y: number }>('chat.floating.pos');
  const storedSize = readStored<{ w: number; h: number }>('chat.floating.size');
  const [pos, setPos] = useState({ x: storedPos?.x ?? initialPos?.x ?? 80, y: storedPos?.y ?? initialPos?.y ?? 80 });
  const [size, setSize] = useState({ w: storedSize?.w ?? initialSize?.w ?? 720, h: storedSize?.h ?? initialSize?.h ?? 560 });
  const DOCK_THRESHOLD = 40; // pixels from top (shared)
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number; startedInDockZone?: boolean } | null>(null);
  const rafRef = useRef<number | null>(null);
  const latestPosRef = useRef<{ x: number; y: number }>({ x: pos.x, y: pos.y });
  const [dockPreview, setDockPreview] = useState(false);
  const [dockAnimating, setDockAnimating] = useState(false);
  const resizeRef = useRef<{
    dir: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    startXPos: number;
    startYPos: number;
  } | null>(null);

  const onToggleFloating = useCallback(() => {
    setFloating(prev => {
      if (prev && onRequestDock) {
        // Going from floating -> docked, let parent handle navigation to full chat
        onRequestDock();
        return prev; // keep state until route changes
      }
      return !prev;
    });
  }, [onRequestDock]);

  const onMouseDownDrag = (e: ReactMouseEvent) => {
    if (!floating) return;
  // determine whether the drag started within the dock zone (top area)
  const el = boxRef.current;
  const rect = el ? el.getBoundingClientRect() : ({ top: pos.y } as any);
  const startedInDockZone = (rect.top <= DOCK_THRESHOLD) || (pos.y <= DOCK_THRESHOLD);
  dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y, startedInDockZone };
  window.addEventListener('mousemove', onMouseMove as any);
  // attach both mouseup and pointerup to improve capture when releasing outside the window
  window.addEventListener('mouseup', onMouseUp as any, { once: true });
  window.addEventListener('pointerup', onMouseUp as any, { once: true });
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const el = boxRef.current;
    const rect = el ? el.getBoundingClientRect() : ({ width: size.w, height: size.h, top: pos.y } as any);
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x = dragRef.current.origX + dx;
    let y = dragRef.current.origY + dy;
    x = Math.max(margin, Math.min(vw - rect.width - margin, x));
    y = Math.max(margin, Math.min(vh - rect.height - margin, y));

    // Store latest position and throttle DOM updates via requestAnimationFrame
    latestPosRef.current = { x, y };
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        setPos({ x: latestPosRef.current.x, y: latestPosRef.current.y });

        // Compute nearTop and only preview docking if the drag started outside the dock zone
        const el2 = boxRef.current;
        const rect2 = el2 ? el2.getBoundingClientRect() : ({ top: latestPosRef.current.y } as any);
        const nearTop = (latestPosRef.current.y <= DOCK_THRESHOLD) || (rect2.top <= DOCK_THRESHOLD);
        const startedInDock = !!dragRef.current?.startedInDockZone;
        // Only show preview when approaching from below (not when started inside the dock zone)
        setDockPreview(Boolean(!startedInDock && nearTop));
      });
    }
  };

  const onMouseUp = () => {
    // capture start info before clearing
    const startedInDock = !!dragRef.current?.startedInDockZone;
    window.removeEventListener('mousemove', onMouseMove as any);
    // cancel any pending RAF and apply last known pos
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      setPos({ x: latestPosRef.current.x, y: latestPosRef.current.y });
    }

    // Recompute nearTop live (avoid stale closure)
    const el = boxRef.current;
    const rect = el ? el.getBoundingClientRect() : ({ top: latestPosRef.current.y, height: size.h } as any);
    const nearTopLive = (rect.top <= DOCK_THRESHOLD) || (latestPosRef.current.y <= DOCK_THRESHOLD);

    // Only dock if we approached from outside the dock zone (prevents immediate re-dock when starting inside)
    if (!startedInDock && nearTopLive && onRequestDock) {
      setDockPreview(false);
      setDockAnimating(true);
      setTimeout(() => {
        setDockAnimating(false);
        onRequestDock();
      }, 180);
    } else {
      setDockPreview(false);
    }
    // finally clear
    dragRef.current = null;
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
        // clamp position to keep within viewport
        const margin = 8;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        setPos(prev => ({
          x: Math.max(margin, Math.min(vw - rect.width - margin, prev.x)),
          y: Math.max(margin, Math.min(vh - rect.height - margin, prev.y)),
        }));
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [floating]);

  // Persist pos/size to localStorage whenever they change
  useEffect(() => {
    try { localStorage.setItem('chat.floating.pos', JSON.stringify(pos)); } catch {}
  }, [pos]);
  useEffect(() => {
    try { localStorage.setItem('chat.floating.size', JSON.stringify(size)); } catch {}
  }, [size]);

  // On first mount, clamp stored values to viewport
  useEffect(() => {
    const margin = 8;
    const vw = window.innerWidth; const vh = window.innerHeight;
    setPos(prev => ({ x: Math.max(margin, Math.min(vw - size.w - margin, prev.x)), y: Math.max(margin, Math.min(vh - size.h - margin, prev.y)) }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clamp when window resizes
  useEffect(() => {
    const onResize = () => {
      if (!floating) return;
      const el = boxRef.current;
      const rect = el ? el.getBoundingClientRect() : { width: size.w, height: size.h } as DOMRect as any;
      const margin = 8;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      setPos(prev => ({
        x: Math.max(margin, Math.min(vw - rect.width - margin, prev.x)),
        y: Math.max(margin, Math.min(vh - rect.height - margin, prev.y)),
      }));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [floating, size.w, size.h]);

  // Custom resize from edges/corners
  const MIN_W = 400;
  const MIN_H = 470;
  const margin = 8;
  const startResize = (dir: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw', e: ReactMouseEvent) => {
    if (!floating) return;
    e.preventDefault();
    resizeRef.current = {
      dir,
      startX: e.clientX,
      startY: e.clientY,
      startW: size.w,
      startH: size.h,
      startXPos: pos.x,
      startYPos: pos.y,
    };
    window.addEventListener('mousemove', onMouseMoveResize as any);
    window.addEventListener('mouseup', onMouseUpResize as any, { once: true });
  };

  const onMouseMoveResize = (e: MouseEvent) => {
    const st = resizeRef.current; if (!st) return;
    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;
    const vw = window.innerWidth; const vh = window.innerHeight;
    let newW = st.startW; let newH = st.startH; let newX = st.startXPos; let newY = st.startYPos;

    const applyEast = () => { newW = Math.max(MIN_W, Math.min(st.startW + dx, vw - margin - st.startXPos)); };
    const applySouth = () => { newH = Math.max(MIN_H, Math.min(st.startH + dy, vh - margin - st.startYPos)); };
    const applyWest = () => {
      // Positive dx moves the west edge right (reduce width), negative dx moves it left.
      // Clamp so: newW >= MIN_W and newX >= margin.
      const maxPosShift = st.startW - MIN_W; // cannot reduce width below MIN_W
      const maxNegShift = -(st.startXPos - margin); // cannot move left edge past margin
      const shift = Math.max(Math.min(dx, maxPosShift), maxNegShift);
      newX = st.startXPos + shift;
      newW = st.startW - shift;
    };
    const applyNorth = () => {
      // Similar logic for north edge: clamp height and top position.
      const maxPosShift = st.startH - MIN_H;
      const maxNegShift = -(st.startYPos - margin);
      const shift = Math.max(Math.min(dy, maxPosShift), maxNegShift);
      newY = st.startYPos + shift;
      newH = st.startH - shift;
    };

    switch (st.dir) {
      case 'e': applyEast(); break;
      case 's': applySouth(); break;
      case 'w': applyWest(); break;
      case 'n': applyNorth(); break;
      case 'ne': applyNorth(); applyEast(); break;
      case 'nw': applyNorth(); applyWest(); break;
      case 'se': applySouth(); applyEast(); break;
      case 'sw': applySouth(); applyWest(); break;
    }

    // Final clamp to keep within viewport margins on all sides
    if (newX < margin) {
      // If we somehow crossed margin, adjust width if resizing west; else snap x
      const overflow = margin - newX;
      newX = margin;
      if (st.dir.includes('w')) newW = Math.max(MIN_W, newW - overflow);
    }
    if (newY < margin) {
      const overflow = margin - newY;
      newY = margin;
      if (st.dir.includes('n')) newH = Math.max(MIN_H, newH - overflow);
    }
    if (newX + newW > vw - margin) newW = Math.max(MIN_W, vw - margin - newX);
    if (newY + newH > vh - margin) newH = Math.max(MIN_H, vh - margin - newY);

    setPos({ x: newX, y: newY });
    setSize({ w: newW, h: newH });
  };

  const onMouseUpResize = () => {
    resizeRef.current = null;
    window.removeEventListener('mousemove', onMouseMoveResize as any);
  };


  const showHeader = minimized ? false : (floating || !hideHeaderWhenDocked);

  return (
    <div
  className={`chat-pane ${floating ? 'floating' : 'docked'} ${minimized ? 'minimized' : ''} ${dockPreview ? 'docking-preview' : ''} ${dockAnimating ? 'docking-animate' : ''}`}
      data-theme={effectiveTheme}
      ref={boxRef}
  style={floating ? ({ left: pos.x, top: pos.y, width: size.w, height: size.h }) : undefined}
    >
      {showHeader && (
        <div className={`chat-pane-header ${floating ? 'drag-enabled' : ''}`} onMouseDown={onMouseDownDrag}>
          <div className="chat-pane-title">{title}</div>
          <div className="chat-pane-actions">
            {enableFloatingToggle && (
              <button className="chat-pane-action" onClick={onToggleFloating} aria-label={floating ? 'Dock' : 'Pop out'} title={floating ? 'Dock' : 'Pop out'}>
                {floating ? <LuDock size={18} /> : <MdOpenInNew size={18} />}
              </button>
            )}
            {/* Clear / new chat button */}
            <button
              className="chat-pane-action"
              onClick={() => onRequestClear && onRequestClear()}
              aria-label="New chat"
              title="Start new chat"
            >
              <MdAutorenew size={18} />
            </button>
            {floating && (
              <button
                className="chat-pane-action"
                onClick={() => (minimized ? onRequestRestore && onRequestRestore() : onRequestMinimize && onRequestMinimize())}
                aria-label={minimized ? 'Restore chat' : 'Minimize chat'}
                title={minimized ? 'Restore chat' : 'Minimize chat'}
              >
                <LuMinus size={18} />
              </button>
            )}
          </div>
        </div>
      )}
      <div className="chat-pane-body">
        {children}
      </div>
  {floating && (
        <>
          <div className="resize-handle n" onMouseDown={(e) => startResize('n', e)} />
          <div className="resize-handle s" onMouseDown={(e) => startResize('s', e)} />
          <div className="resize-handle e" onMouseDown={(e) => startResize('e', e)} />
          <div className="resize-handle w" onMouseDown={(e) => startResize('w', e)} />
          <div className="resize-handle ne" onMouseDown={(e) => startResize('ne', e)} />
          <div className="resize-handle nw" onMouseDown={(e) => startResize('nw', e)} />
          <div className="resize-handle se" onMouseDown={(e) => startResize('se', e)} />
          <div className="resize-handle sw" onMouseDown={(e) => startResize('sw', e)} />
        </>
      )}
    </div>
  );
};

export default ChatPane;
