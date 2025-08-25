import type { FC } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import Tabs from '../components/Tabs.tsx';
import ProfileTab from './profile/ProfileTab.tsx';
import DashboardTab from './profile/DashboardTab.tsx';
import './ProfilePage.css';

const ProfilePage: FC = () => {
  const { effectiveTheme } = useTheme();
  return (
    <div data-theme={effectiveTheme} className="profile-page">
      <Tabs
        items={[
          { id: 'profile', label: 'Profile', render: () => <ProfileTab /> },
          { id: 'dashboard', label: 'Dashboard', render: () => <DashboardTab /> },
        ]}
      />
    </div>
  );
};

export default ProfilePage;
