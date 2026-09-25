import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../lib/api';
import { formatRelative } from '../lib/utils';
import { useToast } from '../components/ui/Toast';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { eventTitle } from '../lib/event';
import { Plus, MessageCircle, ChevronRight } from '../components/ui/icons';
import './Support.css';

/** "open" / "resolved" in words a couple understands, based on who spoke last. */
function ticketStatus(t) {
  if (t.status === 'resolved') return { label: 'Solved', cls: 'resolved' };
  const last = t.messages?.[t.messages.length - 1];
  if (last && last.senderRole !== 'user') return { label: 'We replied', cls: 'replied' };
  return { label: 'Waiting for us', cls: 'open' };
}

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

  useEffect(() => {
    api.tickets.list().then(r => setTickets(r.tickets || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function createTicket(e) {
    e.preventDefault();
    if (!newForm.subject || !newForm.message) { toast('Tell us what it’s about and what’s happening.', 'error'); return; }
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
      toast('Message sent — we’ll reply here and by email.', 'success');
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
        const apply = (t) => {
          if (!t || t.id !== id) return t;
          // Merge by id, never by count: this is what makes the sender's own
          // optimistic append safe when the poll returns that message again,
          // and it survives two messages sharing a millisecond, which a
          // `createdAt >` filter alone would skip.
          const seen = new Set((t.messages || []).map(m => m.id));
          const added = incoming.filter(m => !seen.has(m.id));
          const status = r.status ?? t.status;
          if (!added.length && status === t.status) return t; // unchanged — keep identity
          return { ...t, status, messages: [...(t.messages || []), ...added] };
        };
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
    if (!text || replying) return;
    setReplying(true);
    try {
      const r = await api.tickets.reply(viewing.id, text);
      // Append locally rather than refetching: the modal is already showing the
      // thread, and the server has told us exactly what it stored.
      const appended = { ...viewing, status: r.status ?? viewing.status, messages: [...(viewing.messages || []), r.message] };
      setViewing(appended);
      // Keep the row behind the modal in step, so the message count and the
      // status badge do not lie once the modal closes.
      setTickets(list => list.map(t => (t.id === appended.id ? appended : t)));
      setReplyText('');
      toast(r.reopened ? 'Sent — we’ve reopened this conversation.' : 'Sent.', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setReplying(false);
    }
  }

  if (loading) return <div className="loading-center"><div className="spinner spinner-lg" /></div>;

  return (
    <div className="page-fade">
      <PageHeader
        title="Support"
        subtitle="Stuck on something? Message us — a real person replies, usually within a day."
        actions={<button type="button" className="btn btn-primary" onClick={() => setShowNew(true)}><Plus size={18} aria-hidden="true" /> Message us</button>}
      />

      {tickets.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={MessageCircle}
            tone="sky"
            title="No messages yet"
            action={<button type="button" className="btn btn-primary" onClick={() => setShowNew(true)}>Message us</button>}
          >
            Ask us anything about your invitation. We’ll reply here and by email.
          </EmptyState>
        </div>
      ) : (
        <div className="card">
          <ul className="tickets-list">
            {tickets.map(t => {
              const st = ticketStatus(t);
              return (
                <li key={t.id}>
                  <button type="button" className="ticket-row" onClick={() => { setViewing(t); setReplyText(''); didInitialScroll.current = false; }}>
                    <div className="ticket-info">
                      <div className="ticket-subject">{t.subject}</div>
                      <div className="ticket-meta">
                        {t.messages?.length} message{t.messages?.length !== 1 ? 's' : ''} · {formatRelative(t.createdAt)}
                      </div>
                    </div>
                    <span className={`badge badge-ticket-${st.cls}`}>{st.label}</span>
                    <ChevronRight size={18} aria-hidden="true" className="ticket-chev" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* New ticket modal */}
      {showNew && (
        <Modal title="Message us" onClose={() => setShowNew(false)} footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setShowNew(false)}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={creating} onClick={createTicket}>
              {creating ? <span className="btn-spinner" aria-hidden="true" /> : null}
              Send message
            </button>
          </>
        }>
          <form onSubmit={createTicket}>
            <div className="form-group">
              <label className="form-label" htmlFor="sup-subject">What’s it about?</label>
              <input id="sup-subject" className="form-input" placeholder="e.g. Can’t change the ceremony date"
                value={newForm.subject} onChange={e => setNewForm(f => ({ ...f, subject: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="sup-message">Tell us what’s happening</label>
              <textarea id="sup-message" className="form-textarea" rows={4} placeholder="What did you try, and what did you expect to see?"
                value={newForm.message} onChange={e => setNewForm(f => ({ ...f, message: e.target.value }))}
              />
            </div>
            {activeEvent && (
              <label className="ticket-event-check">
                <input type="checkbox"
                  checked={newForm.relatedToEvent}
                  onChange={e => setNewForm(f => ({ ...f, relatedToEvent: e.target.checked }))}
                />
                This is about <strong>{eventTitle(activeEvent)}</strong>
              </label>
            )}
          </form>
        </Modal>
      )}

      {/* View ticket modal */}
      {viewing && (
        <Modal title={viewing.subject} onClose={() => setViewing(null)} size="full" footer={
          <button type="button" className="btn btn-secondary" onClick={() => setViewing(null)}>Close</button>
        }>
          <div className="ticket-thread" ref={threadRef}>
            {viewing.messages?.map(m => (
              <div key={m.id} className={`thread-msg ${m.senderRole}`}>
                <div className="thread-role">{m.senderRole === 'user' ? 'You' : 'Aamantran team'}</div>
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
              placeholder="Type your message"
              maxLength={5000}
              disabled={replying}
              /* Enter sends, Shift+Enter makes a new line - the convention in
                 every chat box, and this thread reads as one. */
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) sendReply(e); }}
            />
            <div className="ticket-reply-actions">
              <span className="ticket-reply-hint">
                {viewing.status === 'resolved'
                  ? 'This was marked solved — replying opens it again.'
                  : 'Press Enter to send. We’ll email you when we reply.'}
              </span>
              <button type="submit" className="btn btn-primary" disabled={replying || !replyText.trim()}>
                {replying ? 'Sending…' : 'Send'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
