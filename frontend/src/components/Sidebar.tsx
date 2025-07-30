import type { FC } from "react";
import type { Conversation } from "../types";
import { FaPlus, FaChevronLeft, FaChevronRight, FaTrash } from 'react-icons/fa';

interface SidebarProps {
  conversations: Conversation[];
  selectedId: number | null;
  onSelect: (conv: Conversation) => void;
  onCreate: () => void;
  onDelete: (id: number) => void;
  collapsed: boolean;
  onToggle: () => void;
}

const Sidebar: FC<SidebarProps> = ({
  conversations,
  selectedId,
  onSelect,
  onCreate,
  onDelete,
  collapsed,
  onToggle,
}) => (
  <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
    <div className="sidebar-header d-flex flex-column align-items-center">
      <button
        className="btn btn-outline-light toggle-btn mb-2"
        onClick={onToggle}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <FaChevronRight /> : <FaChevronLeft />}
      </button>
      <button
        className={`btn btn-outline-light new-btn${collapsed ? ' icon-only' : ''}`}
        onClick={onCreate}
        aria-label="New conversation"
      >
        <FaPlus />
        {!collapsed && ' New'}
      </button>
    </div>
    { !collapsed && (
      <ul className="conversations-list">
        {conversations.map(conv => (
          <li
            key={conv.id}
            className={selectedId === conv.id ? "selected" : ""}
            onClick={() => onSelect(conv)}
          >
            <span className="conv-title flex-grow-1 ps-2">{conv.title}</span>
            <button
              className="btn btn-outline-danger btn-sm delete-conv-btn"
              onClick={e => { e.stopPropagation(); onDelete(conv.id); }}
              aria-label="Delete conversation"
            >
              <FaTrash />
            </button>
          </li>
        ))}
      </ul>
    )}
  </aside>
);

export default Sidebar;
