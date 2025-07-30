import type { FC } from "react";
import type { Conversation } from "../types";
import { FaPlus, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import ConversationItem from './ConversationItem';
import './Sidebar.css';

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
          <ConversationItem
            key={conv.id}
            conv={conv}
            selected={selectedId === conv.id}
            onSelect={onSelect}
            onDelete={onDelete}
          />
        ))}
      </ul>
    )}
  </aside>
);

export default Sidebar;
