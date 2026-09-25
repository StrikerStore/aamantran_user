import { useState, useRef, useEffect, Children } from 'react';
import './Select.css';

/**
 * Clay-styled drop-in replacement for a native <select>.
 * Accepts the same shape: value, onChange (receives { target: { value } }),
 * and <option> children — so existing call sites swap in unchanged.
 * Values are compared/emitted as strings, matching native select behavior.
 */
export function Select({ value, onChange, children, className = '', style, disabled, required, id, 'aria-label': ariaLabel, autoFocus }) {
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef(null);
  const listRef = useRef(null);

  const options = [];
  Children.forEach(children, child => {
    if (!child || child.type !== 'option') return;
    options.push({
      value: String(child.props.value ?? child.props.children ?? ''),
      label: child.props.children,
      disabled: !!child.props.disabled,
    });
  });

  const currentValue = String(value ?? '');
  const current = options.find(o => o.value === currentValue);
  // form-select is a 100%-width control
  const fullWidth = /form-select|form-input/.test(className);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open || highlight < 0 || !listRef.current) return;
    const el = listRef.current.children[highlight];
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [open, highlight]);

  function toggle() {
    if (disabled) return;
    if (!open && wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect();
      setOpenUp(window.innerHeight - rect.bottom < 290 && rect.top > 290);
      setHighlight(options.findIndex(o => o.value === currentValue));
    }
    setOpen(o => !o);
  }

  function pick(opt) {
    if (opt.disabled) return;
    setOpen(false);
    if (opt.value !== currentValue) onChange?.({ target: { value: opt.value } });
  }

  function onTriggerKeyDown(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { toggle(); return; }
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      let i = highlight;
      for (let step = 0; step < options.length; step++) {
        i = (i + dir + options.length) % options.length;
        if (!options[i].disabled) break;
      }
      setHighlight(i);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (open && highlight >= 0 && options[highlight]) pick(options[highlight]);
      else toggle();
    }
  }

  return (
    <div
      className="clay-select"
      ref={wrapRef}
      style={{ display: fullWidth ? 'block' : 'inline-block', width: fullWidth ? '100%' : undefined, ...style }}
    >
      <button
        type="button"
        id={id}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        className={`clay-select-trigger ${className}`}
        onClick={toggle}
        onKeyDown={onTriggerKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="clay-select-label">{current ? current.label : ' '}</span>
      </button>

      {/* Invisible native mirror keeps HTML form `required` validation working */}
      {required && (
        <select
          value={currentValue}
          onChange={() => {}}
          required
          tabIndex={-1}
          aria-hidden="true"
          className="clay-select-native-mirror"
        >
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.value}</option>
          ))}
        </select>
      )}

      {open && (
        <ul className={`clay-select-popup${openUp ? ' up' : ''}`} role="listbox" ref={listRef}>
          {options.map((o, i) => (
            <li
              key={`${o.value}-${i}`}
              role="option"
              aria-selected={o.value === currentValue}
              className={
                'clay-select-option' +
                (o.value === currentValue ? ' selected' : '') +
                (i === highlight ? ' highlight' : '') +
                (o.disabled ? ' disabled' : '')
              }
              onMouseEnter={() => setHighlight(i)}
              onClick={() => pick(o)}
            >
              <span className="clay-select-check">{o.value === currentValue ? '✓' : ''}</span>
              <span className="clay-select-option-label">{o.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
