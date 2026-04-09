import { useState } from 'react';
import { api } from '../lib/api';
import { useToast } from './ui/Toast';
import { Modal } from './ui/Modal';
import './NameConfirmBar.css';

/**
 * NameConfirmBar — shown in People section of Generate/Edit invitation forms.
 *
 * Props:
 *   event       — full event object
 *   onConfirmed — callback when names are confirmed (receives updated event)
 *   people      — current people list
 */
export function NameConfirmBar({ event, onConfirmed, people = [] }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);

  if (!event) return null;

  const frozen = event.namesAreFrozen;
  const hasNames = people.length > 0;

  if (frozen) {
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

  return (
    <>
      <div className={`name-confirm-bar ${hasNames ? 'pending' : 'empty'}`}>
        <span className="ncb-icon">{hasNames ? '⚠️' : '👤'}</span>
        <div className="ncb-text">
          <strong>{hasNames ? 'Confirm your names' : 'Add people first'}</strong>
          <span>
            {hasNames
              ? 'Once confirmed, names are permanently locked. Publishing requires confirmation.'
              : 'Add at least one person before confirming names.'}
          </span>
        </div>
        <button
          className="btn btn-primary btn-sm"
          disabled={!hasNames}
          onClick={() => setShowDialog(true)}
        >
          Confirm Names
        </button>
      </div>

      {showDialog && (
        <Modal
          title="Confirm Names"
          onClose={() => setShowDialog(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowDialog(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={loading} onClick={handleConfirm}>
                {loading ? <span className="btn-spinner" /> : null}
                Yes, Confirm Names
              </button>
            </>
          }
        >
          <div style={{ padding: '8px 0' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.6 }}>
              You are about to confirm the following names. <strong>This cannot be undone</strong> — names will be permanently locked.
            </p>
            <div className="ncb-names-list">
              {people.map(p => (
                <div key={p.id} className="ncb-name-row">
                  <span className="ncb-name-role">{p.role}</span>
                  <span className="ncb-name-value">{p.name}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '16px' }}>
              After confirmation, you can still edit all other details. To change names, raise a support ticket.
            </p>
          </div>
        </Modal>
      )}
    </>
  );

  async function handleConfirm() {
    setLoading(true);
    try {
      await api.events.confirmNames(event.id);
      toast('Names confirmed and locked!', 'success');
      setShowDialog(false);
      onConfirmed?.({ ...event, namesAreFrozen: true });
    } catch (err) {
      toast(err.message || 'Failed to confirm names', 'error');
    } finally {
      setLoading(false);
    }
  }
}
