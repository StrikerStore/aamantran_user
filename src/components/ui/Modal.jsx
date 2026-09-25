import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Dialog window. Announced to screen readers as a dialog named by its title;
 * keyboard focus moves in when it opens, stays inside while open (Tab wraps),
 * and returns to whatever opened it when it closes. Esc or a click on the
 * backdrop closes it.
 */
export function Modal({ title, children, footer, onClose, size = 'md', variant }) {
  const titleId = useId();
  const boxRef = useRef(null);
  // Latest onClose without re-running the open/close effect on every render
  // (that would pull focus back to the first field while the couple types).
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const opener = document.activeElement;
    const box = boxRef.current;
    // Start on the first field if there is one, otherwise on the dialog itself.
    const first = box?.querySelector('input, select, textarea') || box;
    first?.focus({ preventScroll: true });

    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onCloseRef.current?.(); return; }
      if (e.key !== 'Tab' || !box) return;
      const items = [...box.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstItem) { e.preventDefault(); lastItem.focus(); }
      else if (!e.shiftKey && document.activeElement === lastItem) { e.preventDefault(); firstItem.focus(); }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (opener && typeof opener.focus === 'function') opener.focus({ preventScroll: true });
    };
  }, []);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div
        ref={boxRef}
        className={`modal${size === 'lg' ? ' modal-lg' : ''}${variant === 'confirm' ? ' is-confirm' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="modal-handle" aria-hidden="true" />
        <div className="modal-header">
          <h2 className="modal-title" id={titleId}>{title}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X size={24} aria-hidden="true" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

/**
 * "Are you sure?" dialog, Instagram style: the title states the consequence
 * ("Delete this task?"), the message says what happens, and the actions are
 * stacked full-width — the action itself first ("Delete task", red when it
 * destroys something), then Cancel. `icon` is accepted for older call sites
 * but not shown.
 */
export function ConfirmModal({
  title, message, confirmText = 'Confirm', cancelText = 'Cancel',
  confirmVariant = 'danger', loading = false, onConfirm, onCancel,
}) {
  return (
    <Modal title={title} onClose={onCancel} variant="confirm">
      {message && <p className="confirm-message">{message}</p>}
      <div className="confirm-actions" style={{ margin: '20px -24px -20px' }}>
        <button
          type="button"
          className={`confirm-action ${confirmVariant === 'danger' ? 'is-danger' : 'is-primary'}`}
          onClick={onConfirm}
          disabled={loading}
        >
          {loading && <span className="btn-spinner" aria-hidden="true" />}
          {confirmText}
        </button>
        <button type="button" className="confirm-action" onClick={onCancel} disabled={loading}>{cancelText}</button>
      </div>
    </Modal>
  );
}
