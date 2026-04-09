import { useEffect } from 'react';

export function Modal({ title, children, footer, onClose, size = 'md' }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={`modal ${size === 'lg' ? 'modal-lg' : ''}`}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmModal({ title, message, icon = '⚠️', confirmText = 'Confirm', confirmVariant = 'danger', onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={onCancel} footer={
      <>
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button className={`btn btn-${confirmVariant}`} onClick={onConfirm}>{confirmText}</button>
      </>
    }>
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>{icon}</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>{message}</p>
      </div>
    </Modal>
  );
}
