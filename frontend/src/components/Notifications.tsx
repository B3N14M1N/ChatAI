import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import './Notifications.css';

export type NoticeKind = 'success' | 'error';

export interface Notice {
  id: string;
  kind: NoticeKind;
  title?: string;
  message: string;
  durationMs?: number; // auto-hide after this time; default 4000
}

interface NotificationsCtx {
  notify: (msg: Omit<Notice, 'id'>) => void;
  dismiss: (id: string) => void;
}

const Ctx = createContext<NotificationsCtx | undefined>(undefined);

export const useNotifications = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
};

export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<Notice[]>([]);
  const timers = useRef(new Map<string, number>());

  const dismiss = useCallback((id: string) => {
    setItems(prev => prev.filter(n => n.id !== id));
    const t = timers.current.get(id);
    if (t) window.clearTimeout(t);
    timers.current.delete(id);
  }, []);

  const notify = useCallback((msg: Omit<Notice, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    const duration = msg.durationMs ?? 4000;
    const item: Notice = { id, ...msg, durationMs: duration };
    setItems(prev => [item, ...prev]);
    // setup auto-dismiss
    const handle = window.setTimeout(() => dismiss(id), duration);
    timers.current.set(id, handle);
  }, [dismiss]);

  // Cleanup timers
  useEffect(() => () => { timers.current.forEach(t => window.clearTimeout(t)); timers.current.clear(); }, []);

  const value = useMemo(() => ({ notify, dismiss }), [notify, dismiss]);

  // Split by kind: success left, error right
  const left = items.filter(i => i.kind !== 'error');
  const right = items.filter(i => i.kind === 'error');

  return (
    <Ctx.Provider value={value}>
      {children}
      <NotificationsOverlay side="left" items={left} onDismiss={dismiss} />
      <NotificationsOverlay side="right" items={right} onDismiss={dismiss} />
    </Ctx.Provider>
  );
};

const NotificationsOverlay = ({ side, items, onDismiss }: { side: 'left' | 'right'; items: Notice[]; onDismiss: (id: string) => void; }) => {
  return (
    <div className={side === 'left' ? 'notifications-overlay-left' : 'notifications-overlay-right'} role="region" aria-live="polite" aria-atomic="true">
      {items.map(n => (
        <NotificationItem key={n.id} n={n} side={side} onClose={() => onDismiss(n.id)} />
      ))}
    </div>
  );
};

const NotificationItem = ({ n, side, onClose }: { n: Notice; side: 'left' | 'right'; onClose: () => void }) => {
  // progress animation duration equals remaining time
  const barRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number } | null>(null);

  // Drag handlers with clamped bounds to keep on-screen
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const handleDown = (e: MouseEvent) => {
      // Only start if header area clicked
      const target = e.target as HTMLElement;
      if (!target.closest('.notification-inner')) return;
      setDragging(true);
      const rect = el.getBoundingClientRect();
      const startX = e.clientX;
      const startY = e.clientY;
      const offsetX = startX - rect.left;
      const offsetY = startY - rect.top;

      const move = (ev: MouseEvent) => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const width = rect.width;
        const height = rect.height + 3; // include progress bar
        let left = ev.clientX - offsetX;
        let top = ev.clientY - offsetY;
        // clamp within viewport with 8px margin
        const margin = 8;
        left = Math.max(margin, Math.min(vw - width - margin, left));
        top = Math.max(margin, Math.min(vh - height - margin, top));
        // Respect side anchoring by setting left or right
        if (side === 'left') setPos({ top, left });
        else setPos({ top, right: Math.max(margin, vw - width - left) });
      };
      const up = () => {
        setDragging(false);
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    };
    el.addEventListener('mousedown', handleDown);
    return () => el.removeEventListener('mousedown', handleDown);
  }, [side]);
  useEffect(() => {
    if (!barRef.current) return;
    const dur = (n.durationMs ?? 4000) / 1000;
    barRef.current.style.animationDuration = `${dur}s`;
    barRef.current.classList.add('animated');
  return () => { if (barRef.current) { barRef.current.classList.remove('animated'); } };
  }, [n.durationMs]);

  const icon = n.kind === 'error' ? '⛔' : '✅';

  return (
    <div
      ref={cardRef}
      className={`notification-card ${n.kind} ${dragging ? 'dragging' : ''} ${pos ? 'fixed' : ''}`}
      role="status"
      aria-live="polite"
      style={pos ? { top: pos.top, left: pos.left, right: pos.right } as React.CSSProperties : undefined}
    >
      <div className="notification-inner">
        <div className="notification-icon" aria-hidden>{icon}</div>
        <div className="notification-content">
          {n.title && <p className="notification-title">{n.title}</p>}
          <p className="notification-message">{n.message}</p>
        </div>
        <button className="notification-close" aria-label="Dismiss" onClick={onClose}>✕</button>
      </div>
      <div ref={barRef} className="notification-progress" />
    </div>
  );
};
