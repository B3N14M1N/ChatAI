import type { FC } from "react";
import { useEffect } from 'react';
import type { Conversation } from "../types";
import ConversationItem from './ConversationItem';
import SidebarHeader from './SidebarHeader';
import SidebarMenu from './SidebarMenu';
import SidebarFooter from './SidebarFooter';
import { useAuth } from '../contexts/AuthContext';
import './Sidebar.css';
import { MdOutlineMenu } from 'react-icons/md';

interface SidebarProps {
  conversations: Conversation[];
  selectedId: number | null;
  onSelect: (conv: Conversation) => void;
  onCreate: () => void;
  onDelete: (id: number) => void;
  onRename: (id: number, newTitle: string) => void;
  collapsed: boolean;
  onToggle: () => void;
  onAccount?: () => void;
}

const Sidebar: FC<SidebarProps> = ({
  conversations,
  selectedId,
  onSelect,
  onCreate,
  onDelete,
  collapsed,
  onToggle,
  onRename,
  onAccount,
}) => (
  <>
    {/* Lock body scroll when sidebar is open on small screens */}
    {useEffect(() => {
      const shouldLock = !collapsed && typeof window !== 'undefined' && window.innerWidth <= 768;
      if (shouldLock) document.body.classList.add('sidebar-open-no-scroll');
      else document.body.classList.remove('sidebar-open-no-scroll');
      return () => { document.body.classList.remove('sidebar-open-no-scroll'); };
    }, [collapsed])}

    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <SidebarHeader collapsed={collapsed} onToggle={onToggle} />
      <SidebarMenu collapsed={collapsed} onCreate={onCreate} onAccount={onAccount} />
      <hr />
      {!collapsed && (
        <ul className="conversations-list">
          {conversations.map(conv => (
            <ConversationItem
              key={conv.id}
              conv={conv}
              selected={selectedId === conv.id}
              onSelect={onSelect}
              onDelete={onDelete}
              onRename={onRename}
            />
          ))}
        </ul>
      )}
      <SidebarFooter collapsed={collapsed} onLogout={useAuth().logout} />
    </aside>

    {/* Mobile floating open button - visible only on small screens when collapsed */}
    <button
      className="mobile-open-btn"
      aria-label="Open sidebar"
      title="Open sidebar"
      onClick={onToggle}
      style={{ display: collapsed ? undefined : 'none' }}
    >
      <MdOutlineMenu size={22} />
    </button>
  </>
);

export default Sidebar;
