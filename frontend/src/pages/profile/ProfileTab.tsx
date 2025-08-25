import type { FC } from 'react';
import { useEffect, useState } from 'react';
import { MdEdit, MdCheck, MdClose, MdLockReset } from 'react-icons/md';
import { fetchJson, apiFetch } from '../../lib/api';
import { useNotifications } from '../../components/Notifications';

interface Me {
  id: number;
  email: string;
  display_name?: string | null;
  created_at: string;
}

const ProfileTab: FC = () => {
  const [me, setMe] = useState<Me | null>(null);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [editingEmail, setEditingEmail] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editingPwd, setEditingPwd] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const { notify } = useNotifications();

  useEffect(() => {
    fetchJson<Me>('/users/me').then(data => {
      setMe(data);
      setEmail(data.email);
      setDisplayName(data.display_name ?? '');
    }).catch(console.error);
  }, []);

  const saveField = async (payload: Partial<Pick<Me, 'email' | 'display_name'>>): Promise<boolean> => {
    try {
      const res = await apiFetch('/users/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const text = await res.text();
        let msg = text;
        try {
          const j = JSON.parse(text);
          msg = j.detail ?? j.message ?? text;
        } catch {}
        notify({ kind: 'error', title: 'Update failed', message: msg });
        return false;
      }
      const updated = await res.json();
      setMe(updated);
      const what = payload.display_name !== undefined ? 'Display name' : payload.email !== undefined ? 'Email' : 'Profile';
      notify({ kind: 'success', title: 'Saved', message: `${what} updated.` });
      return true;
    } catch (err: any) {
      const msg = typeof err?.message === 'string' ? err.message : 'Update failed';
      notify({ kind: 'error', title: 'Update failed', message: msg });
      console.error(err);
      return false;
    }
  };

  const onChangePassword = async () => {
    if (passwords.next !== passwords.confirm) {
      notify({ kind: 'error', title: 'Password', message: 'Passwords do not match' });
      return;
    }
    try {
      const res = await apiFetch('/users/me/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: passwords.current, new_password: passwords.next })
      });
      if (!res.ok) {
        const text = await res.text();
        let msg = text;
        try {
          const j = JSON.parse(text);
          msg = j.detail ?? j.message ?? text;
        } catch {}
        notify({ kind: 'error', title: 'Password', message: msg });
        return;
      }
      setPasswords({ current: '', next: '', confirm: '' });
      setEditingPwd(false);
      notify({ kind: 'success', title: 'Password', message: 'Password updated.' });
    } catch (err: any) {
      const msg = typeof err?.message === 'string' ? err.message : 'Failed to update password';
      notify({ kind: 'error', title: 'Password', message: msg });
      console.error(err);
    }
  };

  return (
    <div className="container profile-tab" style={{ paddingTop: 8 }}>
      <h5 className="mb-2 text-center">Account</h5>
      <p className="text-muted text-center">Manage your profile details.</p>
  {/* Notifications are shown globally via overlay */}

      <div className="profile-content">
        {/* Display Name */}
        <div className="profile-card">
          <div className="profile-card-header">
            <label className="form-label m-0">Display name</label>
            {!editingName ? (
              <button type="button" className="icon-btn" onClick={() => setEditingName(true)} aria-label="Edit name"><MdEdit /></button>
            ) : (
              <div className="profile-actions">
                <button type="button" className="icon-btn primary" onClick={async () => { const ok = await saveField({ display_name: displayName }); if (ok) setEditingName(false); }} aria-label="Save name"><MdCheck /></button>
                <button type="button" className="icon-btn" onClick={() => { setEditingName(false); setDisplayName(me?.display_name ?? ''); }} aria-label="Cancel"><MdClose /></button>
              </div>
            )}
          </div>
          <div className="profile-card-body">
            {!editingName ? (
              <div className="profile-card-value">{displayName || '—'}</div>
            ) : (
              <input className="form-control" type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} />
            )}
          </div>
        </div>

        {/* Email */}
        <div className="profile-card">
          <div className="profile-card-header">
            <label className="form-label m-0">Email</label>
            {!editingEmail ? (
              <button type="button" className="icon-btn" onClick={() => setEditingEmail(true)} aria-label="Edit email"><MdEdit /></button>
            ) : (
              <div className="profile-actions">
                <button type="button" className="icon-btn primary" onClick={async () => { const ok = await saveField({ email }); if (ok) setEditingEmail(false); }} aria-label="Save email"><MdCheck /></button>
                <button type="button" className="icon-btn" onClick={() => { setEditingEmail(false); setEmail(me?.email ?? ''); }} aria-label="Cancel"><MdClose /></button>
              </div>
            )}
          </div>
          <div className="profile-card-body">
            {!editingEmail ? (
              <div className="profile-card-value">{email}</div>
            ) : (
              <input className="form-control" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            )}
          </div>
        </div>

        {/* Created at */}
        <div className="profile-card">
          <div className="profile-card-header">
            <label className="form-label m-0">Created at</label>
          </div>
          <div className="profile-card-body">
            <input className="form-control" type="text" value={me?.created_at ?? ''} readOnly />
          </div>
        </div>

        {/* Password */}
        <div className="profile-card">
          <div className="profile-card-header">
            <label className="form-label m-0">Password</label>
            {!editingPwd ? (
              <button type="button" className="icon-btn" onClick={() => setEditingPwd(true)} aria-label="Change password"><MdLockReset /></button>
            ) : (
              <div className="profile-actions">
                <button type="button" className="icon-btn primary" onClick={onChangePassword} aria-label="Save password"><MdCheck /></button>
                <button type="button" className="icon-btn" onClick={() => { setEditingPwd(false); setPasswords({ current: '', next: '', confirm: '' }); }} aria-label="Cancel"><MdClose /></button>
              </div>
            )}
          </div>
          <div className="profile-card-body">
            {!editingPwd ? (
              <div className="profile-card-value">••••••••</div>
            ) : (
              <div className="profile-password-fields">
                <input className="form-control" type="password" placeholder="Current password" value={passwords.current} onChange={e => setPasswords({ ...passwords, current: e.target.value })} />
                <input className="form-control" type="password" placeholder="New password" value={passwords.next} onChange={e => setPasswords({ ...passwords, next: e.target.value })} />
                <input className="form-control" type="password" placeholder="Confirm new password" value={passwords.confirm} onChange={e => setPasswords({ ...passwords, confirm: e.target.value })} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileTab;
