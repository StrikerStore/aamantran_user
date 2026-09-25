import { useEffect, useId, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import { cleanLinkInput } from './link';

/**
 * "Personalise your link" field with a live availability check, using the
 * exact rules publishing applies (GET /events/:id/link-available). Reports the
 * latest result through onStatus({ state, cleaned, isDefault }).
 */
export function LinkField({ eventId, base, value, onChange, onStatus, label, hint, disabled, inputRef }) {
  const id = useId();
  // Result of the last server check, for the link it was made for.
  const [checked, setChecked] = useState({ link: null, state: 'idle' });
  const seq = useRef(0);
  const onStatusRef = useRef(onStatus);
  useEffect(() => { onStatusRef.current = onStatus; }, [onStatus]);

  const link = String(value || '').replace(/-+$/, '');
  // Empty needs no server; a link not checked yet is "checking".
  const status = !link
    ? { state: 'empty', cleaned: '', isDefault: false }
    : checked.link === link ? checked : { state: 'checking', cleaned: link, isDefault: false };

  useEffect(() => {
    if (!link) { onStatusRef.current?.({ state: 'empty', cleaned: '', isDefault: false }); return undefined; }
    const mine = ++seq.current;
    const t = setTimeout(() => {
      api.events.linkAvailable(eventId, link)
        .then((r) => {
          if (mine !== seq.current) return;
          const state = r.available ? 'free' : (r.reason === 'short' ? 'short' : r.reason === 'empty' ? 'empty' : 'taken');
          const next = { link, state, cleaned: r.cleaned, isDefault: Boolean(r.isDefault) };
          setChecked(next); onStatusRef.current?.(next);
        })
        .catch(() => {
          if (mine !== seq.current) return;
          const next = { link, state: 'error', cleaned: link, isDefault: false };
          setChecked(next); onStatusRef.current?.(next);
        });
    }, 400);
    return () => clearTimeout(t);
  }, [eventId, link]);

  const shownBase = String(base || '').replace(/^https?:\/\//, '');
  const msgId = `${id}-msg`;
  const hintId = `${id}-hint`;

  return (
    <div className="form-group link-field">
      <label className="form-label" htmlFor={id}>{label}</label>
      <div className={`link-input-wrap${disabled ? ' is-disabled' : ''}${status.state === 'taken' || status.state === 'short' ? ' is-error' : ''}`}>
        <span className="link-input-prefix" aria-hidden="true">{shownBase}/i/</span>
        <input
          id={id}
          ref={inputRef}
          className="link-input"
          value={value}
          disabled={disabled}
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={60}
          aria-describedby={`${hintId} ${msgId}`}
          aria-invalid={status.state === 'taken' || status.state === 'short' ? true : undefined}
          onChange={(e) => onChange(cleanLinkInput(e.target.value))}
        />
      </div>
      {!disabled && (
        <div id={msgId} className="link-status" aria-live="polite">
          {status.state === 'checking' && <span className="form-hint"><Loader2 size={14} className="spin" aria-hidden="true" /> Checking…</span>}
          {status.state === 'free' && <span className="form-success"><CheckCircle2 size={15} aria-hidden="true" /> This link is free</span>}
          {status.state === 'taken' && <span className="form-error"><AlertCircle size={15} aria-hidden="true" /> Someone already has this link — try adding a year or a city.</span>}
          {status.state === 'short' && <span className="form-error"><AlertCircle size={15} aria-hidden="true" /> Use at least 3 letters or numbers.</span>}
          {status.state === 'empty' && <span className="form-error"><AlertCircle size={15} aria-hidden="true" /> Type a link for your guests.</span>}
          {status.state === 'error' && <span className="form-hint">We couldn’t check this link right now — you can still continue.</span>}
        </div>
      )}
      <div id={hintId} className="form-hint">{hint}</div>
    </div>
  );
}
