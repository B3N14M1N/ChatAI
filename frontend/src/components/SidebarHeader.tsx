import type { FC } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
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
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <FiChevronRight size={24} /> : <FiChevronLeft size={24} />}
      </button>
    </div>
  </div>
);

export default SidebarHeader;
