import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { saveToken, hadSession, clearToken } from '../lib/auth';
import { useToast } from '../components/ui/Toast';
import './Login.css';

export default function Login() {
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ username: '', password: '' });
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recoveryStep, setRecoveryStep] = useState('request');
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryData, setRecoveryData] = useState({
    email: '',
    code: '',
    username: '',
    resetToken: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (hadSession()) {
      clearToken();
      toast('Your session expired. Please sign in again.', 'info');
    }
  }, []);

  function set(field, val) {
    setForm(f => ({ ...f, [field]: val }));
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.username || !form.password) {
      setError('Username and password are required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.auth.login(form.username.trim(), form.password, keepSignedIn);
      saveToken(res.token, keepSignedIn);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  function openRecovery() {
    setRecoveryOpen(true);
    setRecoveryStep('request');
    setRecoveryData({ email: '', code: '', username: '', resetToken: '', newPassword: '', confirmPassword: '' });
  }

  async function requestCode(e) {
    e.preventDefault();
    if (!recoveryData.email.trim()) { toast('Please enter your email address', 'error'); return; }
    setRecoveryLoading(true);
    try {
      await api.auth.requestRecoveryCode(recoveryData.email.trim());
      toast('If your email exists, a recovery code has been sent.', 'info');
      setRecoveryStep('verify');
    } catch (err) {
      toast(err.message || 'Failed to send code', 'error');
    } finally {
      setRecoveryLoading(false);
    }
  }

  async function verifyCode(e) {
    e.preventDefault();
    if (!recoveryData.code.trim()) { toast('Please enter the recovery code', 'error'); return; }
    setRecoveryLoading(true);
    try {
      const res = await api.auth.verifyRecoveryCode(recoveryData.email.trim(), recoveryData.code.trim());
      setRecoveryData(prev => ({ ...prev, username: res.username || '', resetToken: res.resetToken || '' }));
      setRecoveryStep('reset');
      toast('Code verified. You can reset your password now.', 'success');
    } catch (err) {
      toast(err.message || 'Invalid code', 'error');
    } finally {
      setRecoveryLoading(false);
    }
  }

  async function resetPassword(e) {
    e.preventDefault();
    if (recoveryData.newPassword.length < 8) { toast('Password must be at least 8 characters.', 'error'); return; }
    if (recoveryData.newPassword !== recoveryData.confirmPassword) { toast('Passwords do not match.', 'error'); return; }
    setRecoveryLoading(true);
    try {
      await api.auth.resetPasswordWithCode(recoveryData.email.trim(), recoveryData.resetToken, recoveryData.newPassword);
      toast('Password reset successful. Please sign in.', 'success');
      setRecoveryOpen(false);
      setForm(f => ({ ...f, username: recoveryData.username, password: '' }));
    } catch (err) {
      toast(err.message || 'Password reset failed', 'error');
    } finally {
      setRecoveryLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <img src="/logo.png" alt="" className="login-logo-img" width="56" height="56" decoding="async" />
          <div className="login-logotype">Aamantran</div>
          <div className="login-tagline">User Dashboard</div>
        </div>

        <h1 className="login-title">Welcome back</h1>
        <p className="login-sub">Sign in to build your wedding invitation</p>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              className="form-input"
              type="text"
              placeholder="your_username"
              value={form.username}
              onChange={e => set('username', e.target.value)}
              autoFocus
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={e => set('password', e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <label className="keep-signed-in-label">
            <input
              type="checkbox"
              checked={keepSignedIn}
              onChange={e => setKeepSignedIn(e.target.checked)}
            />
            Keep me signed in
          </label>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
            {loading ? <span className="btn-spinner" /> : null}
            Sign In
          </button>
        </form>

        <p className="login-footer">
          <button type="button" className="login-link" onClick={openRecovery}>
            Forgot username or password?
          </button>
          <br />
          Need help? <a href="mailto:support@aamantran.co">Contact support</a>
        </p>
      </div>

      {recoveryOpen && (
        <div className="recovery-overlay" onClick={() => !recoveryLoading && setRecoveryOpen(false)}>
          <div className="recovery-card" onClick={e => e.stopPropagation()}>
            <div className="recovery-card-header">
              <h2>Recover Account</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => !recoveryLoading && setRecoveryOpen(false)}
                disabled={recoveryLoading}
              >✕</button>
            </div>

            {recoveryStep === 'request' && (
              <form onSubmit={requestCode} className="login-form">
                <div className="form-group">
                  <label className="form-label">Registered Email</label>
                  <input
                    className="form-input"
                    type="email"
                    value={recoveryData.email}
                    onChange={e => setRecoveryData(d => ({ ...d, email: e.target.value }))}
                    placeholder="you@example.com"
                    autoFocus
                  />
                </div>
                <button type="submit" className="btn btn-primary login-btn" disabled={recoveryLoading}>
                  {recoveryLoading ? <span className="btn-spinner" /> : null}
                  Send Recovery Code
                </button>
              </form>
            )}

            {recoveryStep === 'verify' && (
              <form onSubmit={verifyCode} className="login-form">
                <div className="form-group">
                  <label className="form-label">Recovery Code</label>
                  <input
                    className="form-input"
                    type="text"
                    value={recoveryData.code}
                    onChange={e => setRecoveryData(d => ({ ...d, code: e.target.value }))}
                    placeholder="6-digit code"
                    autoFocus
                  />
                </div>
                <button type="submit" className="btn btn-primary login-btn" disabled={recoveryLoading}>
                  {recoveryLoading ? <span className="btn-spinner" /> : null}
                  Verify Code
                </button>
              </form>
            )}

            {recoveryStep === 'reset' && (
              <form onSubmit={resetPassword} className="login-form">
                <p className="login-sub" style={{ marginBottom: 14 }}>
                  Username found: <strong>{recoveryData.username || 'N/A'}</strong>
                </p>
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <input
                    className="form-input"
                    type="password"
                    value={recoveryData.newPassword}
                    onChange={e => setRecoveryData(d => ({ ...d, newPassword: e.target.value }))}
                    placeholder="Minimum 8 characters"
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm Password</label>
                  <input
                    className="form-input"
                    type="password"
                    value={recoveryData.confirmPassword}
                    onChange={e => setRecoveryData(d => ({ ...d, confirmPassword: e.target.value }))}
                    placeholder="Re-enter password"
                  />
                </div>
                <button type="submit" className="btn btn-primary login-btn" disabled={recoveryLoading}>
                  {recoveryLoading ? <span className="btn-spinner" /> : null}
                  Reset Password
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
