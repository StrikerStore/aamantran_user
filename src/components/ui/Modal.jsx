import { useEffect, useId, useRef } from 'react';
import { X, AlertTriangle } from 'lucide-react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Dialog window. Announced to screen readers as a dialog named by its title;
 * keyboard focus moves in when it opens, stays inside while open (Tab wraps),
 * and returns to whatever opened it when it closes. Esc or a click on the
 * backdrop closes it.
 */
export function Modal({ title, children, footer, onClose, size = 'md' }) {
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
        className={`modal ${size === 'lg' ? 'modal-lg' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="modal-header">
          <h2 className="modal-title" id={titleId}>{title}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

/**
 * "Are you sure?" dialog. The title states the consequence ("Delete this
 * task?") and the confirm button repeats the action ("Delete task"), so the
 * couple never has to decode a generic "OK".
 */
export function ConfirmModal({
  title, message, icon, confirmText = 'Confirm', cancelText = 'Cancel',
  confirmVariant = 'danger', loading = false, onConfirm, onCancel,
}) {
  const variantClass = confirmVariant === 'danger' ? 'btn-danger-solid' : `btn-${confirmVariant}`;
  const shownIcon = icon === undefined
    ? <AlertTriangle size={30} aria-hidden="true" />
    : (typeof icon === 'string' ? <span aria-hidden="true">{icon}</span> : icon);
  return (
    <Modal title={title} onClose={onCancel} footer={
      <>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>{cancelText}</button>
        <button type="button" className={`btn ${variantClass}`} onClick={onConfirm} disabled={loading}>
          {loading && <span className="btn-spinner" aria-hidden="true" />}
          {confirmText}
        </button>
      </>
    }>
      <div className="confirm-body">
        {shownIcon && <div className={`confirm-icon confirm-icon--${confirmVariant}`}>{shownIcon}</div>}
        <p className="confirm-message">{message}</p>
      </div>
    </Modal>
  );
}
