import type { FC } from 'react';
import { MdAddComment, MdSearch, MdLibraryBooks } from 'react-icons/md';
import './SidebarMenu.css';

interface SidebarMenuProps {
  collapsed: boolean;
  onCreate: () => void;
}

const SidebarMenu: FC<SidebarMenuProps> = ({ collapsed, onCreate }) => (
  <ul className="sidebar-menu">
    <li className="sidebar-menu-item" onClick={onCreate}>
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

export default SidebarMenu;
