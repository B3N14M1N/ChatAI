import type { FC } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import './ThemeSwitcher.css';

interface ThemeSwitcherProps {
  collapsed: boolean;
}

const ThemeSwitcher: FC<ThemeSwitcherProps> = ({ collapsed }) => {
  const { theme, setTheme } = useTheme();

  const handleThemeChange = () => {
    const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'auto' : 'light';
    setTheme(nextTheme);
  };

  const getThemeIcon = () => {
    switch (theme) {
      case 'light':
        return '☀️';
      case 'dark':
        return '🌙';
      case 'auto':
        return '🔄';
    }
  };

  const getThemeLabel = () => {
    switch (theme) {
      case 'light':
        return 'Light';
      case 'dark':
        return 'Dark';
      case 'auto':
        return 'Auto';
    }
  };

  return (
    <button
      className={`theme-switcher ${collapsed ? 'collapsed' : ''}`}
      onClick={handleThemeChange}
      title={`Current theme: ${getThemeLabel()}. Click to switch.`}
    >
      <span className="theme-icon">{getThemeIcon()}</span>
      {!collapsed && (
        <span className="theme-label">{getThemeLabel()}</span>
      )}
    </button>
  );
};

export default ThemeSwitcher;
