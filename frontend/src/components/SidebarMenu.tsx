import type { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdAddComment, MdSearch, MdLibraryBooks, MdAccountCircle } from 'react-icons/md';
import './SidebarMenu.css';

interface SidebarMenuProps {
  collapsed: boolean;
  onCreate: () => void;
  onAccount?: () => void;
}

const SidebarMenu: FC<SidebarMenuProps> = ({ collapsed, onCreate, onAccount }) => {
  const navigate = useNavigate();
  const goAccount = () => onAccount ? onAccount() : navigate('/account');
  return (
  <ul className="sidebar-menu">
    <li
      className="sidebar-menu-item"
      onClick={goAccount}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') goAccount(); }}
    >
      <MdAccountCircle size={24} />{!collapsed && <span>Account</span>}
    </li>

    <li className="sidebar-menu-item" onClick={onCreate} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onCreate(); }}>
      <MdAddComment size={24} />{!collapsed && <span>New chat</span>}
    </li>

    <li className="sidebar-menu-item disabled">
      <MdSearch size={24} />{!collapsed && <span>Search chats</span>}
    </li>
    <li className="sidebar-menu-item disabled">
      <MdLibraryBooks size={24} />{!collapsed && <span>Library</span>}
    </li>
  </ul>
  );
};

export default SidebarMenu;
