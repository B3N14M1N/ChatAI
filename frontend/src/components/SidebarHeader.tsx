import type { FC } from 'react';
import { MdOutlineChevronLeft, MdOutlineChevronRight } from 'react-icons/md';
import './SidebarHeader.css';

interface SidebarHeaderProps {
  collapsed: boolean;
  onToggle: () => void;
}

const SidebarHeader: FC<SidebarHeaderProps> = ({ collapsed, onToggle }) => (
  <div className="sidebar-header">
    {!collapsed && <div className="sidebar-title" data-text="Librarian.AI">Librarian.AI</div>}
    <div className="header-actions">
      <button
        className="header-btn"
        onClick={onToggle}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <MdOutlineChevronRight size={24} /> : <MdOutlineChevronLeft size={24} />}
      </button>
    </div>
  </div>
);

export default SidebarHeader;
