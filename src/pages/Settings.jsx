import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../lib/api';
import { getUserInfo } from '../lib/auth';
import { formatDate } from '../lib/utils';
import { useToast } from '../components/ui/Toast';
import './Settings.css';

export default function Settings() {
  const toast = useToast();
  const info = getUserInfo();
  const { activeEvent } = useOutletContext() || {};

  const [profile, setProfile] = useState({ email: info?.email || '', phone: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [eventExpiry, setEventExpiry] = useState(activeEvent?.expiresAt || null);
  const phoneLocked = useMemo(() => Boolean(String(profile.phone || '').trim()), [profile.phone]);

  useEffect(() => {
    setEventExpiry(activeEvent?.expiresAt || null);
    if (!activeEvent?.id) return;
    api.events.get(activeEvent.id)
      .then(r => setEventExpiry(r?.event?.expiresAt || null))
      .catch(() => {});
  }, [activeEvent?.id, activeEvent?.expiresAt]);

  useEffect(() => {
    api.auth.me()
      .then(r => {
        const user = r?.user || {};
        setProfile(p => ({
          ...p,
          email: user.email || p.email || '',
          phone: user.phone || p.phone || '',
        }));
      })
      .catch(() => {});
  }, []);

  async function saveProfile(e) {
    e.preventDefault();
    if (phoneLocked) {
      toast('Contact number cannot be changed once filled. Raise a support ticket if needed.', 'info');
      return;
    }
    if (!profile.phone?.trim()) {
      toast('Please enter a contact number', 'error');
      return;
    }
    setSavingProfile(true);
    try {
      await api.profile.update({ phone: profile.phone.trim() });
      toast('Contact number saved!', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <div className="page-fade">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your account and invitation settings</p>
        </div>
      </div>

      <div className="settings-grid">
        {/* Account */}
        <div className="card">
          <div className="card-title">Account</div>
          <form onSubmit={saveProfile}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input className="form-input" value={info?.username || ''} disabled />
              <div className="form-hint">Username cannot be changed.</div>
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={profile.email} disabled />
              <div className="form-hint">Email cannot be changed. Raise a support ticket if needed.</div>
            </div>
            <div className="form-group">
              <label className="form-label">Contact Number</label>
              <input
                className="form-input"
                type="tel"
                placeholder="+91 9876543210"
                value={profile.phone}
                disabled={phoneLocked}
                onChange={e => setProfile(f => ({ ...f, phone: e.target.value }))}
              />
              <div className="form-hint">
                {phoneLocked
                  ? 'Contact number is locked after being filled. To change it, please raise a support ticket.'
                  : 'You can add your contact number once.'}
              </div>
            </div>
            {!phoneLocked && (
              <button type="submit" className="btn btn-primary" disabled={savingProfile}>
                {savingProfile ? <span className="btn-spinner" /> : null}
                Save Contact Number
              </button>
            )}
          </form>
        </div>

        {/* Expiry */}
        {activeEvent && (
          <div className="card">
            <div className="card-title">Invitation Expiry</div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 16 }}>
              Expiry is auto-calculated as 6 months after your latest function date.
            </p>
            <div className="form-group">
              <label className="form-label">Expires On</label>
              <input
                className="form-input"
                value={eventExpiry ? formatDate(eventExpiry) : 'Set at publish time after adding functions'}
                disabled
              />
            </div>
            <div className="publish-note">
              To increase the expiration date, please raise a support ticket.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
