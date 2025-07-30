import type { FC } from 'react';
import { MdChevronLeft, MdChevronRight } from 'react-icons/md';
import './SidebarHeader.css';

interface SidebarHeaderProps {
  collapsed: boolean;
  onToggle: () => void;
}

const SidebarHeader: FC<SidebarHeaderProps> = ({ collapsed, onToggle }) => (
  <div className="sidebar-header">
    {!collapsed && <div className="sidebar-title">My GPT</div>}
    <div className="header-actions">
      <button
        className="header-btn"
        onClick={onToggle}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <MdChevronRight size={20} /> : <MdChevronLeft size={20} />}
      </button>
    </div>
  </div>
);

export default SidebarHeader;
