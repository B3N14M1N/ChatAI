import React from 'react';
import './AuthOverlay.css';

interface Props {
  children: React.ReactNode;
}

const AuthOverlay: React.FC<Props> = ({ children }) => {
  return (
    <div className="auth-overlay">
      <div className="auth-overlay__center">
        {children}
      </div>
    </div>
  );
};

export default AuthOverlay;
