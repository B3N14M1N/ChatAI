import type { FC } from 'react';
import ThemeSwitcher from './ThemeSwitcher';
import LogoutButton from './LogoutButton';
import './SidebarFooter.css';

interface SidebarFooterProps {
  collapsed: boolean;
  onLogout?: () => void;
}

const SidebarFooter: FC<SidebarFooterProps> = ({ collapsed, onLogout }) => {
  return (
    <footer className={`sidebar-footer ${collapsed ? 'collapsed' : ''}`}>
      <ThemeSwitcher collapsed={collapsed} />
      <LogoutButton collapsed={collapsed} onClick={onLogout} />
    </footer>
  );
};

export default SidebarFooter;
