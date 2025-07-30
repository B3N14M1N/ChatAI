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
  const saveRename = () => {
    setEditing(false);
    if (title !== conv.title) onRename(conv.id, title.trim());
  };
  const cancelRename = () => {
    setEditing(false);
    setTitle(conv.title);
  };
  return (
    <li
      className={`conversation-item${selected ? ' selected' : ''}`}
      onClick={() => !editing && onSelect(conv)}
    >
      {editing ? (
        <input
          className="conv-input"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onClick={e => e.stopPropagation()}
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
            <button className="icon-btn" onClick={e => { e.stopPropagation(); setMenuOpen(open => !open); }}><FaEllipsisV /></button>
            {menuOpen && (
              <div className="context-menu">
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
