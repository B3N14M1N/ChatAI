import React, { useMemo, useState } from 'react';
import './AuthPage.css';
import ChatBackgroundLoop from '../components/ChatBackgroundLoop';
import AuthOverlay from '../components/AuthOverlay';
import { LuEye, LuEyeClosed } from 'react-icons/lu';
import { useAuth } from '../contexts/AuthContext';

type Mode = 'login' | 'register';

const AuthPage: React.FC<{ mode?: Mode }> = ({ mode = 'login' }) => {
  const [current, setCurrent] = useState<Mode>(mode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const auth = useAuth();

  const title = useMemo(() => (current === 'login' ? 'Welcome back' : 'Create your account'), [current]);
  const buttonLabel = useMemo(() => (current === 'login' ? 'Sign in' : 'Sign up'), [current]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (current === 'register' && password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    try {
      if (current === 'login') {
        await auth.login(email, password);
      } else {
        await auth.register(email, password, name || undefined);
      }
      window.location.href = '/';
    } catch (err) {
      console.error('Authentication error:', err);
      
      // Handle different types of errors
      let errorMessage = 'Authentication failed';
      
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      } else if (err && typeof err === 'object') {
        // Handle case where error might be an object
        errorMessage = JSON.stringify(err);
      }
      
      // Provide user-friendly messages for common errors
      if (errorMessage.includes('Incorrect username or password')) {
        errorMessage = 'Invalid email or password. Please try again.';
      } else if (errorMessage.includes('User already exists')) {
        errorMessage = 'An account with this email already exists. Please try logging in instead.';
      } else if (errorMessage.includes('validation')) {
        errorMessage = 'Please check your input and try again.';
      } else if (errorMessage.includes('Network') || errorMessage.includes('fetch')) {
        errorMessage = 'Connection error. Please check your internet connection and try again.';
      }
      
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <ChatBackgroundLoop />
      <AuthOverlay>
        <div className="auth-card" role="dialog" aria-modal="true">
          <h1 className="auth-title">{title}</h1>
          {current === 'login' ? (
            <p className="auth-subtitle">Use your credentials to continue</p>
          ) : (
            <div className="auth-subtitle auth-subtitle--register">
              <ul>
                <li>Use a valid email address.</li>
                <li>Choose a password at least 8 characters long.</li>
                <li>Include at least one number and one symbol in the password.</li>
              </ul>
            </div>
          )}
          <form className="auth-form" onSubmit={onSubmit}>
            {current === 'register' && (
              <div className="form-row">
                <label htmlFor="name">Name</label>
                <input id="name" type="text" autoComplete="name" value={name} onChange={e => setName(e.target.value)} required />
              </div>
            )}
            <div className="form-row">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="form-row">
              <label htmlFor="password">Password</label>
              <div className={`input-wrapper ${password ? 'with-toggle' : ''}`}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={current === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                {password && (
                  <button
                    type="button"
                    className="pw-toggle"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword(p => !p)}
                  >
                    {showPassword ? <LuEyeClosed size={18} /> : <LuEye size={18} />}
                  </button>
                )}
              </div>
            </div>
            {current === 'register' && (
              <div className="form-row">
                <label htmlFor="confirm">Confirm Password</label>
                <div className={`input-wrapper ${confirm ? 'with-toggle' : ''}`}>
                  <input
                    id="confirm"
                    type={showConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                  />
                  {confirm && (
                    <button
                      type="button"
                      className="pw-toggle"
                      aria-label={showConfirm ? 'Hide password' : 'Show password'}
                      aria-pressed={showConfirm}
                      onClick={() => setShowConfirm(p => !p)}
                    >
                      {showConfirm ? <LuEyeClosed size={18} /> : <LuEye size={18} />}
                    </button>
                  )}
                </div>
              </div>
            )}

            {error && <div className="auth-error" role="alert">{error}</div>}

            <button className="auth-submit" type="submit" disabled={submitting}>
              {submitting ? 'Please wait…' : buttonLabel}
            </button>
          </form>
          <div className="auth-toggle">
            {current === 'login' ? (
              <button type="button" onClick={() => setCurrent('register')} className="link-btn">No account? Create one</button>
            ) : (
              <button type="button" onClick={() => setCurrent('login')} className="link-btn">Have an account? Sign in</button>
            )}
          </div>
        </div>
      </AuthOverlay>
    </div>
  );
};

export default AuthPage;
