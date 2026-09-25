import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';

/**
 * The "i" help button. Opens on click / tap (not hover), so it works the same
 * on phones, with a keyboard and with screen readers — a "toggletip", which
 * NN/g recommends over hover tooltips for help text. Esc or a click elsewhere
 * closes it.
 *
 * @param {string} label   what the help is about, read by screen readers ("About your names")
 * @param {string} [learnMore] optional Guide anchor, e.g. "/guide#names"
 */
export function InfoTip({ label, children, learnMore, align = 'start' }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const id = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span className="infotip" ref={wrapRef}>
      <button
        type="button"
        className={`infotip-btn${open ? ' is-open' : ''}`}
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        <Info size={16} aria-hidden="true" />
      </button>
      <span id={id} role="status" className={`infotip-pop infotip-pop--${align}${open ? ' is-open' : ''}`}>
        {open && (
          <>
            <span className="infotip-text">{children}</span>
            {learnMore && (
              <Link className="infotip-more" to={learnMore} onClick={() => setOpen(false)}>Learn more</Link>
            )}
          </>
        )}
      </span>
    </span>
  );
}
