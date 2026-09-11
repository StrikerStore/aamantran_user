import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../lib/api';
import { formatRelative } from '../lib/utils';
import { useToast } from '../components/ui/Toast';
import { Modal } from '../components/ui/Modal';
import './Support.css';

/** How often an open thread checks for new messages. */
const POLL_MS = 5000;
/** Treat the reader as "following along" within this many px of the bottom. */
const NEAR_BOTTOM_PX = 80;

export default function Support() {
  const toast = useToast();
  const { activeEvent } = useOutletContext() || {};
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ subject: '', message: '', relatedToEvent: false });
  const [creating, setCreating] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  // Poll bookkeeping: an in-flight guard and the newest message timestamp seen.
  const poll = useRef({ inFlight: false, since: null });
  const threadRef = useRef(null);
  // Whether this thread has had its one unconditional jump to the newest message.
  const didInitialScroll = useRef(false);
  // Latest open ticket id — sendReply reads this after await so a ticket switch
  // mid-flight cannot wipe the draft the user is already typing in the new thread.
  const viewingIdRef = useRef(null);
  viewingIdRef.current = viewing?.id;

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

  /**
   * Open the thread at the bottom, and keep it there while it is being followed.
   *
   * The modal itself is the scroller (`.modal` carries max-height + overflow),
   * not `.modal-body`, so the header scrolls away with the content.
   *
   * Opening on the first message meant every visit to a long thread started with
   * a scroll down past history to reach the reply box and the message you
   * actually came to read.
   */
  useEffect(() => {
    if (!viewing?.id) return;
    const box = threadRef.current?.closest('.modal');
    if (!box) return;

    if (!didInitialScroll.current) {
      didInitialScroll.current = true;
      // After paint: the thread has not been laid out yet on this tick, so
      // scrollHeight would still be the previous ticket's - or zero.
      requestAnimationFrame(() => { box.scrollTop = box.scrollHeight; });
      return;
    }

    // An arriving message only pulls the view down if the reader is already at
    // the bottom; someone scrolled up reading history is left where they are.
    const distanceFromBottom = box.scrollHeight - box.scrollTop - box.clientHeight;
    if (distanceFromBottom > NEAR_BOTTOM_PX) return;
    box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
  }, [viewing?.id, viewing?.messages?.length]);

  // Newest createdAt in a message list, as an ISO string, or `fallback`.
  function newestAt(messages, fallback = null) {
    let best = fallback ? new Date(fallback).getTime() : -Infinity;
    let iso = fallback;
    for (const m of messages || []) {
      const t = new Date(m.createdAt).getTime();
      if (t > best) { best = t; iso = m.createdAt; }
    }
    return iso;
  }

  /**
   * Append unseen messages onto a ticket without dropping ones that landed
   * while a reply POST was in flight. Merge is by id (so a poll echoing the
   * sender's own message is a no-op) and the result is ordered by createdAt
   * (so a slower poll cannot append an earlier support reply below the
   * customer's later one).
   */
  function mergeThread(ticket, { incoming = [], status } = {}) {
    if (!ticket) return ticket;
    const messages = ticket.messages || [];
    const seen = new Set(messages.map(m => m.id).filter(Boolean));
    const added = incoming.filter(m => m && m.id && !seen.has(m.id));
    const nextStatus = status ?? ticket.status;
    if (!added.length && nextStatus === ticket.status) return ticket;
    const nextMessages = added.length
      ? [...messages, ...added].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      : messages;
    return { ...ticket, status: nextStatus, messages: nextMessages };
  }

  /**
   * Keep the open thread current without a page reload.
   *
   * Deliberately keyed on the ticket ID, not the whole `viewing` object: each
   * merge produces a new object, so depending on `viewing` would tear down and
   * restart the interval on every incoming message.
   */
  useEffect(() => {
    const id = viewing?.id;
    if (!id) return;
    poll.current = { inFlight: false, since: newestAt(viewing.messages) };

    const tick = async () => {
      // A thread left open in a background tab must not poll all night.
      if (document.visibilityState !== 'visible') return;
      // A slow response must not let requests stack up behind it.
      if (poll.current.inFlight) return;
      poll.current.inFlight = true;
      try {
        const r = await api.tickets.messages(id, poll.current.since);
        const incoming = r.messages || [];
        poll.current.since = newestAt(incoming, poll.current.since);
        const apply = (t) => (t && t.id === id ? mergeThread(t, { incoming, status: r.status }) : t);
        setViewing(apply);
        setTickets(list => list.map(t => (t.id === id ? apply(t) : t)));
      } catch {
        // Transient failure; the next tick retries. Not worth a toast.
      } finally {
        poll.current.inFlight = false;
      }
    };

    tick(); // the list behind the modal may be minutes old — catch up on open
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewing?.id]);

  async function sendReply(e) {
    e.preventDefault();
    const text = replyText.trim();
    const ticketId = viewing?.id;
    if (!text || !ticketId || replying) return;
    setReplying(true);
    try {
      const r = await api.tickets.reply(ticketId, text);
      // Merge into whatever the poll wrote while this POST was in flight.
      // Spreading the `viewing` snapshot from before the await would drop a
      // support reply the poll had already applied, and because `since` had
      // already advanced past that reply, the next poll would never restore it.
      const apply = (t) => (t && t.id === ticketId
        ? mergeThread(t, { incoming: r.message ? [r.message] : [], status: r.status })
        : t);
      setViewing(apply);
      setTickets(list => list.map(t => (t.id === ticketId ? apply(t) : t)));
      if (viewingIdRef.current === ticketId) setReplyText('');
      toast(r.reopened ? 'Reply sent - ticket reopened' : 'Reply sent', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setReplying(false);
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
              <div key={t.id} className="ticket-row" onClick={() => { setViewing(t); setReplyText(''); didInitialScroll.current = false; }}>
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
          <div className="ticket-thread" ref={threadRef}>
            {viewing.messages?.map(m => (
              <div key={m.id} className={`thread-msg ${m.senderRole}`}>
                <div className="thread-role">{m.senderRole === 'user' ? 'You' : 'Support'}</div>
                <div className="thread-body">{m.body}</div>
                <div className="thread-time">{formatRelative(m.createdAt)}</div>
              </div>
            ))}
          </div>
          <form className="ticket-reply" onSubmit={sendReply}>
            <label className="ticket-reply-label" htmlFor="ticket-reply-box">Write a reply</label>
            <textarea
              id="ticket-reply-box"
              className="ticket-reply-box"
              rows={3}
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder="Type your message..."
              maxLength={5000}
              disabled={replying}
              /* Enter sends, Shift+Enter makes a new line - the convention in
                 every chat box, and this thread reads as one. */
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) sendReply(e); }}
            />
            <div className="ticket-reply-actions">
              <span className="ticket-reply-hint">
                {viewing.status === 'resolved'
                  ? 'This ticket is resolved - replying will reopen it.'
                  : "We'll also email you when support responds."}
              </span>
              <button type="submit" className="btn btn-primary" disabled={replying || !replyText.trim()}>
                {replying ? 'Sending...' : 'Send'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
