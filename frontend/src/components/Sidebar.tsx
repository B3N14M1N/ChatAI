import type { FC } from "react";
import type { Conversation } from "../types";
import ConversationItem from './ConversationItem';
import SidebarHeader from './SidebarHeader';
import SidebarMenu from './SidebarMenu';
import './Sidebar.css';

interface SidebarProps {
  conversations: Conversation[];
  selectedId: number | null;
  onSelect: (conv: Conversation) => void;
  onCreate: () => void;
  onDelete: (id: number) => void;
  onRename: (id: number, newTitle: string) => void;
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
  onRename,
}) => (
  <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
    <SidebarHeader collapsed={collapsed} onCreate={onCreate} onToggle={onToggle} />
    <SidebarMenu collapsed={collapsed} onCreate={onCreate} />
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
  </aside>
);

export default Sidebar;
