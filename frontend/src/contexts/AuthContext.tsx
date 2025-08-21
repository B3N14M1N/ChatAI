import React, { createContext, useContext, useEffect, useState } from 'react';

type User = { id?: number; email: string; display_name?: string } | null;

type AuthContextType = {
  user: User;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

import { fetchJson } from '../lib/api';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('authToken'));
  const [user, setUser] = useState<User>(() => {
    try {
      const raw = localStorage.getItem('authUser');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  useEffect(() => {
    if (token) localStorage.setItem('authToken', token);
    else localStorage.removeItem('authToken');
  }, [token]);

  useEffect(() => {
    if (user) localStorage.setItem('authUser', JSON.stringify(user));
    else localStorage.removeItem('authUser');
  }, [user]);

  const login = async (email: string, password: string) => {
    const body = { email, password };
    const data = await fetchJson(`/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setToken(data.access_token);
    // Immediately fetch user info using the fresh token (localStorage update may lag)
    const me = await fetchJson(`/users/me`, { headers: { Authorization: `Bearer ${data.access_token}` } });
    setUser({ id: me.id, email: me.email, display_name: me.display_name });
  };

  const register = async (email: string, password: string, displayName?: string) => {
    const body = { email, password, display_name: displayName };
    const data = await fetchJson(`/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setToken(data.access_token);
    const me = await fetchJson(`/users/me`, { headers: { Authorization: `Bearer ${data.access_token}` } });
    setUser({ id: me.id, email: me.email, display_name: me.display_name });
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    // keep it simple: frontend-only logout
    window.location.href = '/auth/login';
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout }}>{children}</AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export default AuthContext;
