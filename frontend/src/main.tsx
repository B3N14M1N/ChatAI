import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css';
import App from './App.tsx';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import { ThemeProvider } from './contexts/ThemeContext';

const isAuthed = () => !!localStorage.getItem('authToken');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          {/* Auth */}
          <Route path="/auth/login" element={<AuthPage mode="login" />} />
          <Route path="/auth/register" element={<AuthPage mode="register" />} />

          {/* Root redirect based on auth */}
          <Route path="/" element={isAuthed() ? <App /> : <Navigate to="/auth/login" replace />} />
          {/* Chat routes guarded */}
          <Route path="/conversation/:id" element={isAuthed() ? <App /> : <Navigate to="/auth/login" replace />} />
          <Route path="*" element={<Navigate to={isAuthed() ? '/' : '/auth/login'} replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>
);
