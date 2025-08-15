import type { FC } from 'react';
import ThemeSwitcher from './ThemeSwitcher';
import './SidebarFooter.css';

interface SidebarFooterProps {
  collapsed: boolean;
}

const SidebarFooter: FC<SidebarFooterProps> = ({ collapsed }) => {
  return (
    <footer className={`sidebar-footer ${collapsed ? 'collapsed' : ''}`}>
      <ThemeSwitcher collapsed={collapsed} />
    </footer>
  );
};

export default SidebarFooter;
