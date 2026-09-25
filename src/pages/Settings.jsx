import { useEffect, useMemo, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { getUserInfo, clearToken } from '../lib/auth';
import { formatDate } from '../lib/utils';
import { useToast } from '../components/ui/Toast';
import { ConfirmModal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import PhoneField from '../components/PhoneField';
import './Settings.css';

export default function Settings() {
  const toast = useToast();
  const info = getUserInfo();
  const { activeEvent } = useOutletContext() || {};

  // The dial code is held separately because that is how the backend stores it.
  // Sending only `phone` made the server fall back to +91 and then reject the
  // number against the Indian-mobile rule, so an international couple could not
  // save a contact number at all.
  const [profile, setProfile] = useState({ email: info?.email || '', phone: '', phoneCountryCode: '+91' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [eventExpiry, setEventExpiry] = useState(activeEvent?.expiresAt || null);
  const phoneLocked = useMemo(() => Boolean(String(profile.phone || '').trim()), [profile.phone]);
  const [showDelete, setShowDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
          // Without this a saved US number renders as 4155550123 with no +1.
          phoneCountryCode: user.phoneCountryCode || p.phoneCountryCode || '+91',
        }));
      })
      .catch(() => {});
  }, []);

  async function saveProfile(e) {
    e.preventDefault();
    if (phoneLocked) {
      toast('Your contact number can’t be changed here. Message us from Support to change it.', 'info');
      return;
    }
    if (!profile.phone?.trim()) {
      toast('Enter your contact number first.', 'error');
      return;
    }
    setSavingProfile(true);
    try {
      await api.profile.update({
        phone: profile.phone.trim(),
        phoneCountryCode: profile.phoneCountryCode,
      });
      toast('Contact number saved.', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSavingProfile(false);
    }
  }

  function askDeleteAccount(e) {
    e.preventDefault();
    if (!deletePassword.trim()) {
      toast('Enter your password to confirm.', 'error');
      return;
    }
    setConfirmDelete(true);
  }

  async function deleteAccount() {
    setDeleting(true);
    try {
      await api.profile.deleteAccount(deletePassword);
      clearToken();
      window.location.href = '/';
    } catch (err) {
      toast(err.message, 'error');
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="page-fade">
      <PageHeader title="Settings" subtitle="Your account details and how long your invitation stays online." />

      <div className="settings-grid">
        {/* Account */}
        <div className="card">
          <h2 className="card-title">Your account</h2>
          <form onSubmit={saveProfile}>
            <div className="form-group">
              <label className="form-label" htmlFor="set-username">Username</label>
              <input id="set-username" className="form-input" value={info?.username || ''} disabled />
              <div className="form-hint">Your username can’t be changed.</div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="set-email">Email</label>
              <input id="set-email" className="form-input" type="email" value={profile.email} disabled />
              <div className="form-hint">To change your email, <Link to="/support">message us</Link>.</div>
            </div>
            <div className="form-group">
              <label className="form-label">Contact number</label>
              <PhoneField
                countryCode={profile.phoneCountryCode}
                number={profile.phone}
                placeholder="9876543210"
                disabled={phoneLocked}
                onChange={({ countryCode, number }) =>
                  setProfile(f => ({ ...f, phoneCountryCode: countryCode, phone: number }))
                }
              />
              <div className="form-hint">
                {phoneLocked
                  ? <>Saved. To change it, <Link to="/support">message us</Link>.</>
                  : 'We only use this to reach you about your invitation. Once saved, you’ll need to message us to change it.'}
              </div>
            </div>
            {!phoneLocked && (
              <button type="submit" className="btn btn-primary" disabled={savingProfile}>
                {savingProfile ? <span className="btn-spinner" aria-hidden="true" /> : null}
                Save contact number
              </button>
            )}
          </form>
        </div>

        {/* Expiry */}
        {activeEvent && (
          <div className="card">
            <h2 className="card-title">How long your invitation stays online</h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: 16 }}>
              Your invitation stays online until 6 months after your last ceremony.
            </p>
            <div className="form-group">
              <label className="form-label" htmlFor="set-expiry">Online until</label>
              <input
                id="set-expiry"
                className="form-input"
                value={eventExpiry ? formatDate(eventExpiry) : 'Worked out when you go live, from your ceremony dates'}
                disabled
              />
            </div>
            <div className="publish-note">
              Need it online for longer? <Link to="/support">Message us</Link>.
            </div>
          </div>
        )}

        {/* Delete account (DPDP right to erasure) */}
        <div className="card">
          <h2 className="card-title">Delete your account</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: 16 }}>
            This deletes your account and everything in it for good — invitations, guest lists,
            replies, photos and profile. Guests will no longer be able to open your invitation.
            Payment records are kept without your name, as tax law requires.
          </p>
          {!showDelete ? (
            <button type="button" className="btn btn-danger" onClick={() => setShowDelete(true)}>
              Delete my account
            </button>
          ) : (
            <form onSubmit={askDeleteAccount}>
              <div className="form-group">
                <label className="form-label" htmlFor="set-del-pass">Type your password to confirm</label>
                <input
                  id="set-del-pass"
                  className="form-input"
                  type="password"
                  autoComplete="current-password"
                  value={deletePassword}
                  onChange={e => setDeletePassword(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="submit" className="btn btn-danger-solid" disabled={deleting}>
                  Delete my account
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowDelete(false); setDeletePassword(''); }} disabled={deleting}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {confirmDelete && (
        <ConfirmModal
          title="Delete your account for good?"
          message="Your invitations, guest lists, replies and photos will be deleted, and guests won’t be able to open your invitation. This can’t be undone."
          confirmText="Delete my account"
          cancelText="Keep my account"
          loading={deleting}
          onConfirm={deleteAccount}
          onCancel={() => !deleting && setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
