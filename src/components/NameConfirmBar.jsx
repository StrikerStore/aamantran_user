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
          <span>The main names are locked — raise a support ticket to change those. The rest stay editable.</span>
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
            ? 'The main names lock permanently when you continue to Venues.'
            : 'Fill in the names below, then continue to Venues to lock the main names in.'}
        </span>
      </div>
    </div>
  );
}

/**
 * ConfirmNamesModal — final read-through before the main names are locked.
 *
 * Only rows flagged `locked` (the template's required roles) freeze on confirm;
 * everything else stays editable, so the two are listed separately rather than
 * presenting the whole list as permanent.
 *
 * Props:
 *   rows      — [{ key, role, name, locked }] to display (drafts, not yet saved)
 *   loading   — disables the confirm button while saving
 *   onCancel  — close without confirming
 *   onConfirm — save people, freeze names, then advance
 */
export function ConfirmNamesModal({ rows = [], loading = false, onCancel, onConfirm }) {
  const lockedRows   = rows.filter(r => r.locked);
  const editableRows = rows.filter(r => !r.locked);

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
        <p className="ncb-modal-intro">
          {lockedRows.length > 0 ? (
            <>Only the main names below get locked. <strong>This cannot be undone.</strong></>
          ) : (
            <>You are about to confirm the following names.</>
          )}
        </p>

        {lockedRows.length > 0 && (
          <>
            <div className="ncb-group-head locked">
              <span className="ncb-group-icon">🔒</span>
              <span>Locked permanently</span>
            </div>
            <div className="ncb-names-list locked">
              {lockedRows.map(r => (
                <div key={r.key} className="ncb-name-row">
                  <span className="ncb-name-role">{r.role}</span>
                  <span className="ncb-name-value">{r.name}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {editableRows.length > 0 && (
          <>
            <div className="ncb-group-head">
              <span className="ncb-group-icon">✏️</span>
              <span>You can still change these later</span>
            </div>
            <div className="ncb-names-list">
              {editableRows.map(r => (
                <div key={r.key} className="ncb-name-row">
                  <span className="ncb-name-role">{r.role}</span>
                  <span className="ncb-name-value">{r.name}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <p className="ncb-modal-note">
          {lockedRows.length > 0
            ? 'To change a locked name afterwards, raise a support ticket. Every other name and detail stays editable.'
            : 'After confirmation, you can still edit all other details.'}
        </p>
      </div>
    </Modal>
  );
}
