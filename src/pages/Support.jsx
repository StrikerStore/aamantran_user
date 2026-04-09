import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../lib/api';
import { formatRelative } from '../lib/utils';
import { useToast } from '../components/ui/Toast';
import { Modal } from '../components/ui/Modal';
import './Support.css';

export default function Support() {
  const toast = useToast();
  const { activeEvent } = useOutletContext() || {};
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ subject: '', message: '', relatedToEvent: false });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.tickets.list().then(r => setTickets(r.tickets || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function createTicket(e) {
    e.preventDefault();
    if (!newForm.subject || !newForm.message) { toast('Subject and message are required', 'error'); return; }
    setCreating(true);
    try {
      const r = await api.tickets.create({
        subject: newForm.subject,
        message: newForm.message,
        eventId: newForm.relatedToEvent && activeEvent ? activeEvent.id : undefined,
      });
      setTickets(t => [r.ticket, ...t]);
      setShowNew(false);
      setNewForm({ subject: '', message: '', relatedToEvent: false });
      toast('Ticket submitted!', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <div className="loading-center"><div className="spinner spinner-lg" /></div>;

  return (
    <div className="page-fade">
      <div className="page-header">
        <div>
          <h1 className="page-title">Support</h1>
          <p className="page-subtitle">Get help with your invitation</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ New Ticket</button>
      </div>

      {tickets.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">💬</div>
            <div className="empty-title">No support tickets</div>
            <div className="empty-desc" style={{ marginBottom: 16 }}>Need help? Open a support ticket and we'll get back to you.</div>
            <button className="btn btn-primary" onClick={() => setShowNew(true)}>Open Ticket</button>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="tickets-list">
            {tickets.map(t => (
              <div key={t.id} className="ticket-row" onClick={() => setViewing(t)}>
                <div className="ticket-info">
                  <div className="ticket-subject">{t.subject}</div>
                  <div className="ticket-meta">
                    {t.messages?.length} message{t.messages?.length !== 1 ? 's' : ''} · {formatRelative(t.createdAt)}
                  </div>
                </div>
                <span className={`badge badge-${t.status === 'open' ? 'open' : 'resolved'}`}>
                  {t.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New ticket modal */}
      {showNew && (
        <Modal title="Open Support Ticket" onClose={() => setShowNew(false)} footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowNew(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={creating} onClick={createTicket}>
              {creating ? <span className="btn-spinner" /> : null}
              Submit Ticket
            </button>
          </>
        }>
          <form onSubmit={createTicket}>
            <div className="form-group">
              <label className="form-label">Subject</label>
              <input className="form-input" placeholder="What do you need help with?"
                value={newForm.subject} onChange={e => setNewForm(f => ({ ...f, subject: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Message</label>
              <textarea className="form-textarea" rows={4} placeholder="Describe your issue in detail..."
                value={newForm.message} onChange={e => setNewForm(f => ({ ...f, message: e.target.value }))}
              />
            </div>
            {activeEvent && (
              <label className="ticket-event-check">
                <input type="checkbox"
                  checked={newForm.relatedToEvent}
                  onChange={e => setNewForm(f => ({ ...f, relatedToEvent: e.target.checked }))}
                />
                Related to event: <strong>{activeEvent.slug}</strong>
              </label>
            )}
          </form>
        </Modal>
      )}

      {/* View ticket modal */}
      {viewing && (
        <Modal title={viewing.subject} onClose={() => setViewing(null)} size="lg" footer={
          <button className="btn btn-secondary" onClick={() => setViewing(null)}>Close</button>
        }>
          <div className="ticket-thread">
            {viewing.messages?.map(m => (
              <div key={m.id} className={`thread-msg ${m.senderRole}`}>
                <div className="thread-role">{m.senderRole === 'user' ? 'You' : 'Support'}</div>
                <div className="thread-body">{m.body}</div>
                <div className="thread-time">{formatRelative(m.createdAt)}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 16 }}>
            Our team will reply via email. You can also check back here.
          </p>
        </Modal>
      )}
    </div>
  );
}
