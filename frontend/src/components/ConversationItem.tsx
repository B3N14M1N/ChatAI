import { useState, useRef, useEffect, type FC } from "react";
import type { Conversation } from "../types";
import { FaEllipsisV, FaCheck, FaTimes } from 'react-icons/fa';
import "./ConversationItem.css";

interface ConversationItemProps {
  conv: Conversation;
  selected: boolean;
  onSelect: (conv: Conversation) => void;
  onDelete: (id: number) => void;
  onRename: (id: number, newTitle: string) => void;
}

const ConversationItem: FC<ConversationItemProps> = ({ conv, selected, onSelect, onDelete, onRename }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(conv.title);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement | null>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // Close when another conversation's menu opens
  useEffect(() => {
    const otherOpened = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail !== conv.id) setMenuOpen(false);
    };
    window.addEventListener('conversation-menu-opened', otherOpened as EventListener);
    return () => window.removeEventListener('conversation-menu-opened', otherOpened as EventListener);
  }, [conv.id]);

  // Close on scroll/resize and ensure menu is positioned as fixed overlay
  useEffect(() => {
    if (!menuOpen) return;
    const updatePos = () => {
      const btn = menuBtnRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      // place menu below the button, align right edge with button right
      const right = Math.max(8, window.innerWidth - rect.right);
      const top = rect.bottom + 6; // 6px gap
      setMenuStyle({ position: 'fixed', top: `${top}px`, right: `${right}px` });
    };
    updatePos();
    const onScroll = () => setMenuOpen(false);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', updatePos);
    window.addEventListener('orientationchange', updatePos);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('orientationchange', updatePos);
    };
  }, [menuOpen]);
  const saveRename = () => {
    setEditing(false);
    if (title !== conv.title) onRename(conv.id, title.trim());
  };
  const cancelRename = () => {
    setEditing(false);
    setTitle(conv.title);
  };

  // focus the input when entering edit mode and select text
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);
  return (
    <li
      className={`conversation-item${selected ? ' selected' : ''}`}
      onClick={() => !editing && onSelect(conv)}
    >
      {editing ? (
        <input
          ref={el => { inputRef.current = el; }}
          className="conv-input"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onClick={e => e.stopPropagation()}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); saveRename(); }
            if (e.key === 'Escape') { e.preventDefault(); cancelRename(); }
          }}
        />
      ) : (
        <span className="conv-title">{conv.title}</span>
      )}
      <div className="actions" ref={menuRef}>
        {editing ? (
          <>
            <button className="icon-btn" onClick={e => { e.stopPropagation(); saveRename(); }}><FaCheck /></button>
            <button className="icon-btn" onClick={e => { e.stopPropagation(); cancelRename(); }}><FaTimes /></button>
          </>
        ) : (
          <>
            <button ref={el => { menuBtnRef.current = el; }} className="icon-btn" onClick={e => { e.stopPropagation(); setMenuOpen(open => {
                const next = !open;
                if (next) {
                  // notify other items to close
                  window.dispatchEvent(new CustomEvent('conversation-menu-opened', { detail: conv.id }));
                }
                return next;
              }); }}><FaEllipsisV /></button>
            {menuOpen && (
              <div className="context-menu" ref={menuRef} style={menuStyle}>
                <button onClick={e => { e.stopPropagation(); setEditing(true); setMenuOpen(false); }}>Rename</button>
                <button className="delete" onClick={e => { e.stopPropagation(); onDelete(conv.id); setMenuOpen(false); }}>Delete</button>
              </div>
            )}
          </>
        )}
      </div>
    </li>
  );
};
export default ConversationItem;
