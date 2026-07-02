import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { saveToken, hadSession, clearToken } from '../lib/auth';
import { useToast } from '../components/ui/Toast';
import './Login.css';

const RESEND_COOLDOWN_S = 60;

function maskEmail(email) {
  const [local = '', domain = ''] = String(email).split('@');
  if (!domain) return email;
  const visible = local.length > 2 ? `${local[0]}•••${local[local.length - 1]}` : `${local[0] || ''}•••`;
  return `${visible}@${domain}`;
}

function passwordStrength(pw) {
  if (!pw) return { score: 0, label: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  if (score <= 1) return { score: 1, label: 'Weak' };
  if (score === 2) return { score: 2, label: 'Fair' };
  if (score === 3 || score === 4) return { score: 3, label: 'Good' };
  return { score: 4, label: 'Strong' };
}

function PasswordInput({ value, onChange, placeholder, autoComplete, autoFocus, onCapsLock }) {
  const [visible, setVisible] = useState(false);

  function handleKey(e) {
    if (onCapsLock && typeof e.getModifierState === 'function') {
      onCapsLock(e.getModifierState('CapsLock'));
    }
  }

  return (
    <div className="pw-field">
      <input
        className="form-input"
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        onKeyDown={handleKey}
        onKeyUp={handleKey}
        onBlur={() => onCapsLock && onCapsLock(false)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
      />
      <button
        type="button"
        className="pw-toggle"
        onClick={() => setVisible(v => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {visible ? <IconEyeOff /> : <IconEye />}
      </button>
    </div>
  );
}

const IconEye = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const IconEyeOff = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

export default function Login() {
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ username: '', password: '' });
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [capsLock, setCapsLock] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState('request');
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const resendTimerRef = useRef(null);
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

  useEffect(() => () => clearInterval(resendTimerRef.current), []);

  function startResendCooldown() {
    clearInterval(resendTimerRef.current);
    setResendIn(RESEND_COOLDOWN_S);
    resendTimerRef.current = setInterval(() => {
      setResendIn(s => {
        if (s <= 1) { clearInterval(resendTimerRef.current); return 0; }
        return s - 1;
      });
    }, 1000);
  }

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
      if (err.status === 429) {
        setError(err.message || 'Too many attempts. Please wait a few minutes and try again.');
      } else {
        setError(err.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  }

  function openRecovery() {
    setRecoveryOpen(true);
    setRecoveryStep('request');
    setRecoveryData({ email: '', code: '', username: '', resetToken: '', newPassword: '', confirmPassword: '' });
  }

  async function sendRecoveryCode() {
    setRecoveryLoading(true);
    try {
      await api.auth.requestRecoveryCode(recoveryData.email.trim());
      toast('If your email exists, a recovery code has been sent.', 'info');
      startResendCooldown();
      setRecoveryStep('verify');
      setRecoveryData(d => ({ ...d, code: '' }));
    } catch (err) {
      toast(err.message || 'Failed to send code', 'error');
    } finally {
      setRecoveryLoading(false);
    }
  }

  async function requestCode(e) {
    e.preventDefault();
    if (!recoveryData.email.trim()) { toast('Please enter your email address', 'error'); return; }
    await sendRecoveryCode();
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

  const strength = passwordStrength(recoveryData.newPassword);

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
            <PasswordInput
              value={form.password}
              onChange={e => set('password', e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              onCapsLock={setCapsLock}
            />
            {capsLock && <div className="capslock-hint">⇪ Caps Lock is on</div>}
          </div>

          <label className="keep-signed-in-label">
            <input
              type="checkbox"
              checked={keepSignedIn}
              onChange={e => setKeepSignedIn(e.target.checked)}
            />
            Keep me signed in for 7 days
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
          Need help? <a href="mailto:aamantran@plexzuu.com">Contact support</a>
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
                    autoComplete="email"
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
                <p className="login-sub" style={{ marginBottom: 14 }}>
                  We sent a 6-digit code to <strong>{maskEmail(recoveryData.email.trim())}</strong>.
                  It expires in 10 minutes.
                </p>
                <div className="form-group">
                  <label className="form-label">Recovery Code</label>
                  <input
                    className="form-input recovery-code-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoComplete="one-time-code"
                    value={recoveryData.code}
                    onChange={e => setRecoveryData(d => ({ ...d, code: e.target.value.replace(/\D/g, '') }))}
                    placeholder="6-digit code"
                    autoFocus
                  />
                </div>
                <button type="submit" className="btn btn-primary login-btn" disabled={recoveryLoading}>
                  {recoveryLoading ? <span className="btn-spinner" /> : null}
                  Verify Code
                </button>
                <div className="resend-row">
                  {resendIn > 0 ? (
                    <span className="resend-hint">Resend code in {resendIn}s</span>
                  ) : (
                    <button
                      type="button"
                      className="login-link"
                      onClick={sendRecoveryCode}
                      disabled={recoveryLoading}
                    >
                      Resend code
                    </button>
                  )}
                </div>
              </form>
            )}

            {recoveryStep === 'reset' && (
              <form onSubmit={resetPassword} className="login-form">
                <p className="login-sub" style={{ marginBottom: 14 }}>
                  Username found: <strong>{recoveryData.username || 'N/A'}</strong>
                </p>
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <PasswordInput
                    value={recoveryData.newPassword}
                    onChange={e => setRecoveryData(d => ({ ...d, newPassword: e.target.value }))}
                    placeholder="Minimum 8 characters"
                    autoComplete="new-password"
                    autoFocus
                  />
                  {recoveryData.newPassword && (
                    <div className="strength-meter" aria-live="polite">
                      <div className="strength-track">
                        <div className={`strength-fill strength-${strength.score}`} />
                      </div>
                      <span className={`strength-label strength-label-${strength.score}`}>{strength.label}</span>
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm Password</label>
                  <PasswordInput
                    value={recoveryData.confirmPassword}
                    onChange={e => setRecoveryData(d => ({ ...d, confirmPassword: e.target.value }))}
                    placeholder="Re-enter password"
                    autoComplete="new-password"
                  />
                  {recoveryData.confirmPassword && recoveryData.confirmPassword !== recoveryData.newPassword && (
                    <div className="capslock-hint">Passwords do not match</div>
                  )}
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
