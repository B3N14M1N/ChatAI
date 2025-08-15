import type { FC } from 'react';
import { MdLogout } from 'react-icons/md';
import './LogoutButton.css';

interface LogoutButtonProps {
  collapsed: boolean;
  onClick?: () => void;
}

const LogoutButton: FC<LogoutButtonProps> = ({ collapsed, onClick }) => {
  return (
    <button
      className={`logout-button ${collapsed ? 'collapsed' : ''}`}
      onClick={onClick}
      title="Logout"
      aria-label="Logout"
      type="button"
    >
      <span className="logout-icon" aria-hidden>
        <MdLogout size={18} />
      </span>
      {!collapsed && <span className="logout-label">Logout</span>}
    </button>
  );
};

export default LogoutButton;
