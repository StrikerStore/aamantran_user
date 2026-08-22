import { Modal } from './ui/Modal';
import './NameConfirmBar.css';

/**
 * NameConfirmBar — status banner shown in the People section of the build panel.
 *
 * Confirming is no longer done here: the "Next: Venues" button owns that gate and
 * raises <ConfirmNamesModal /> itself. This component only reports the state.
 *
 * Props:
 *   event  — full event object
 *   people — current people list
 */
export function NameConfirmBar({ event, people = [] }) {
  if (!event) return null;

  if (event.namesAreFrozen) {
    return (
      <div className="name-confirm-bar frozen">
        <span className="ncb-icon">🔒</span>
        <div className="ncb-text">
          <strong>Names confirmed</strong>
          <span>Names are locked. To make changes, raise a support ticket.</span>
        </div>
      </div>
    );
  }

  const hasNames = people.length > 0;

  return (
    <div className={`name-confirm-bar ${hasNames ? 'pending' : 'empty'}`}>
      <span className="ncb-icon">{hasNames ? '⚠️' : '👤'}</span>
      <div className="ncb-text">
        <strong>{hasNames ? 'Check your names' : 'Add people first'}</strong>
        <span>
          {hasNames
            ? 'Names lock permanently when you continue to Venues.'
            : 'Fill in the names below, then continue to Venues to lock them in.'}
        </span>
      </div>
    </div>
  );
}

/**
 * ConfirmNamesModal — final read-through before names are permanently locked.
 *
 * Props:
 *   rows      — [{ key, role, name }] to display (draft values, not yet saved)
 *   loading   — disables the confirm button while saving
 *   onCancel  — close without confirming
 *   onConfirm — save people, freeze names, then advance
 */
export function ConfirmNamesModal({ rows = [], loading = false, onCancel, onConfirm }) {
  return (
    <Modal
      title="Confirm Names"
      onClose={onCancel}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onCancel}>Go back</button>
          <button className="btn btn-primary" disabled={loading} onClick={onConfirm}>
            {loading ? <span className="btn-spinner" /> : null}
            Confirm &amp; Continue
          </button>
        </>
      }
    >
      <div style={{ padding: '8px 0' }}>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.6 }}>
          You are about to confirm the following names. <strong>This cannot be undone</strong> — names will be permanently locked.
        </p>
        <div className="ncb-names-list">
          {rows.map(r => (
            <div key={r.key} className="ncb-name-row">
              <span className="ncb-name-role">{r.role}</span>
              <span className="ncb-name-value">{r.name}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '16px' }}>
          After confirmation, you can still edit all other details. To change names, raise a support ticket.
        </p>
      </div>
    </Modal>
  );
}
