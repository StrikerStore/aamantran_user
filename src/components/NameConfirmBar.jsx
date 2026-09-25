import { Modal } from './ui/Modal';
import { Lock, AlertTriangle, UserPlus, PencilLine } from './ui/icons';
import './NameConfirmBar.css';

/**
 * NameConfirmBar — status banner shown in the People section of the build panel.
 *
 * Confirming is no longer done here: the Names step's "Save & continue" owns that gate and
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
        <span className="ncb-icon" aria-hidden="true"><Lock size={20} /></span>
        <div className="ncb-text">
          <strong>Names confirmed</strong>
          <span>The main names are locked. To change them, message us from Support. Family names stay editable.</span>
        </div>
      </div>
    );
  }

  const hasNames = people.length > 0;

  return (
    <div className={`name-confirm-bar ${hasNames ? 'pending' : 'empty'}`}>
      <span className="ncb-icon" aria-hidden="true">{hasNames ? <AlertTriangle size={20} /> : <UserPlus size={20} />}</span>
      <div className="ncb-text">
        <strong>{hasNames ? 'Check your names' : 'Add people first'}</strong>
        <span>
          {hasNames
            ? 'The main names are locked when you continue — check the spelling first.'
            : 'Fill in the names below, then continue.'}
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
      title="Are these names right?"
      onClose={onCancel}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onCancel}>Let me check</button>
          <button className="btn btn-primary" disabled={loading} onClick={onConfirm}>
            {loading ? <span className="btn-spinner" /> : null}
            Yes, continue
          </button>
        </>
      }
    >
      <div style={{ padding: '8px 0' }}>
        <p className="ncb-modal-intro">
          {lockedRows.length > 0 ? (
            <>The main names are locked once you continue. <strong>You can’t change them yourself afterwards.</strong></>
          ) : (
            <>You are about to confirm the following names.</>
          )}
        </p>

        {lockedRows.length > 0 && (
          <>
            <div className="ncb-group-head locked">
              <span className="ncb-group-icon" aria-hidden="true"><Lock size={15} /></span>
              <span>These get locked</span>
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
              <span className="ncb-group-icon" aria-hidden="true"><PencilLine size={15} /></span>
              <span>You can still change these</span>
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
            ? 'Need to change a locked name later? Message us from Support. Everything else stays editable.'
            : 'After confirmation, you can still edit all other details.'}
        </p>
      </div>
    </Modal>
  );
}
