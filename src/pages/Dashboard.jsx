import { useState, useEffect } from 'react';
import { useOutletContext, useNavigate, Link } from 'react-router-dom';
import {
  Copy, Share2, PencilLine, Sparkles, Eye, Check, ChevronRight, Users, CalendarHeart, Image as ImageIcon,
  Radio, X, ShoppingBag, LifeBuoy, PartyPopper,
} from 'lucide-react';
import { api } from '../lib/api';
import { formatDate, countdown } from '../lib/utils';
import { getInviteBaseUrl, WEBSITE_URL } from '../lib/config';
import { eventTitle, liveLabel } from '../lib/event';
import { useToast } from '../components/ui/Toast';
import { EmptyState } from '../components/ui/EmptyState';
import { PageSkeleton } from '../components/ui/Skeleton';
import './Dashboard.css';

const WELCOME_KEY = 'aam_welcome_dismissed';

function readFlag(key) {
  try { return localStorage.getItem(key) === '1'; } catch { return false; }
}

/** "123 days to go" / "Tomorrow" / "Today" */
function countdownText(date) {
  const cd = countdown(date);
  if (!cd || cd.past) return '';
  if (cd.days === 0) return 'Today';
  if (cd.days === 1) return 'Tomorrow';
  return `${cd.days} days to go`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const toast = useToast();
  const { activeEvent, events = [], setActiveEvent, eventsLoaded = true } = useOutletContext() || {};

  const [stats, setStats] = useState(null);
  const [eventDetail, setEventDetail] = useState(null);
  const [welcomeHidden, setWelcomeHidden] = useState(() => readFlag(WELCOME_KEY));

  const displayEvents = events.filter(ev => ev.inviteScope !== 'subset');

  useEffect(() => {
    if (!activeEvent?.id) return;
    let live = true;
    Promise.all([
      api.events.stats(activeEvent.id).catch(() => ({ stats: null })),
      api.events.get(activeEvent.id),
    ]).then(([sr, er]) => {
      if (!live) return;
      setStats(sr.stats);
      setEventDetail(er.event);
    }).catch(() => {});
    return () => { live = false; };
  }, [activeEvent?.id]);

  function copy(url) {
    navigator.clipboard?.writeText(url)
      .then(() => toast('Link copied.', 'success'))
      .catch(() => toast('Couldn’t copy — press and hold the link to copy it.', 'error'));
  }

  function dismissWelcome() {
    setWelcomeHidden(true);
    try { localStorage.setItem(WELCOME_KEY, '1'); } catch { /* private mode */ }
  }

  if (!eventsLoaded) {
    return <div className="page-fade" style={{ paddingTop: 8 }}><PageSkeleton stats={0} cards={2} /></div>;
  }

  // ── No invitation on this account yet ──
  if (!activeEvent) {
    return (
      <div className="page-fade">
        <div className="card">
          <EmptyState
            icon={PartyPopper}
            title="You don’t have an invitation yet"
            action={(
              <div className="empty-actions">
                <a className="btn btn-primary" href={`${WEBSITE_URL}/templates`} target="_blank" rel="noreferrer">
                  <ShoppingBag size={18} aria-hidden="true" /> Browse designs
                </a>
                <Link className="btn btn-secondary" to="/support"><LifeBuoy size={18} aria-hidden="true" /> Ask us for help</Link>
              </div>
            )}
          >
            Choose a design on our website — it appears here as soon as your order is complete.
            If you’ve already paid and don’t see it, message us.
          </EmptyState>
        </div>
      </div>
    );
  }

  const ev = eventDetail && eventDetail.id === activeEvent.id ? eventDetail : activeEvent;
  const isLive = Boolean(activeEvent.isPublished);
  const title = eventTitle(ev);
  const firstFn = (ev.functions || []).filter(f => f.date).sort((a, b) => new Date(a.date) - new Date(b.date))[0];
  const cdText = firstFn?.date ? countdownText(firstFn.date) : '';
  const inviteBase = getInviteBaseUrl();
  const inviteUrl = `${inviteBase}/i/${activeEvent.slug}`;
  const secondUrl = eventDetail?.pairedEvent?.slug ? `${inviteBase}/i/${eventDetail.pairedEvent.slug}` : null;
  const buildBase = `/events/${activeEvent.id}/${isLive ? 'edit' : 'generate'}`;

  // Where the couple is, and the one thing to do next.
  const namesDone = Boolean(ev.namesAreFrozen);
  const ceremoniesDone = (ev.functions || []).length > 0;
  const photosDone = (eventDetail?.media || []).length > 0;
  const primary = isLive
    ? { to: `/events/${activeEvent.id}/share`, label: 'Share your invitation', icon: Share2 }
    : namesDone && ceremoniesDone
      ? { to: `${buildBase}?step=publish`, label: 'Preview & go live', icon: Radio }
      : { to: buildBase, label: (ev.people || []).length ? 'Continue building' : 'Start building', icon: Sparkles };
  const PrimaryIcon = primary.icon;

  const checklist = [
    { done: namesDone, label: 'Add your names', to: `${buildBase}?step=people`, icon: Users },
    { done: ceremoniesDone, label: 'Add your ceremonies', to: `${buildBase}?step=functions`, icon: CalendarHeart },
    { done: photosDone, label: 'Add photos & music', to: `${buildBase}?step=media`, icon: ImageIcon, optional: true },
    { done: isLive, label: 'Preview and go live', to: `${buildBase}?step=publish`, icon: Radio },
  ];

  // ── Guest replies (one set of numbers, one set of words) ──
  const per = stats?.perFunction || [];
  const coming = per.length ? Math.max(...per.map(f => f.attending || 0)) : 0;
  const notComing = per.length ? Math.max(...per.map(f => f.notAttending || 0)) : 0;
  const replied = per.length ? Math.max(...per.map(f => (f.attending || 0) + (f.notAttending || 0))) : 0;
  const guestCount = stats?.guestCount ?? 0;
  const noReply = Math.max(0, guestCount - replied);

  const showWelcome = !welcomeHidden && !isLive;

  return (
    <div className="page-fade">

      {/* ── First visit ── */}
      {showWelcome && (
        <section className="welcome-card" aria-labelledby="welcome-title">
          <button type="button" className="welcome-close" onClick={dismissWelcome} aria-label="Hide welcome">
            <X size={18} aria-hidden="true" />
          </button>
          <h2 className="welcome-title" id="welcome-title">
            {(ev.people || []).length ? `Welcome, ${title}!` : 'Welcome to Aamantran!'}
          </h2>
          <p className="welcome-sub">
            Your invitation takes about 10 minutes.
            <span className="welcome-sub-desktop"> Here’s how it works:</span>
            <span className="welcome-sub-phone"> {checklist.filter(c => c.done).length} of {checklist.length} done — see “Getting ready” below.</span>
          </p>
          <ol className="welcome-steps">
            <li><span className="welcome-num">1</span><span><strong>Add your names</strong> — exactly as they should appear.</span></li>
            <li><span className="welcome-num">2</span><span><strong>Add ceremonies & photos</strong> — dates, places and pictures.</span></li>
            <li><span className="welcome-num">3</span><span><strong>Preview and go live</strong> — then share your link on WhatsApp.</span></li>
          </ol>
          <div className="welcome-actions">
            <Link className="btn btn-primary" to={buildBase}><Sparkles size={18} aria-hidden="true" /> Start building</Link>
            <button type="button" className="btn btn-ghost" onClick={dismissWelcome}>I’ll look around first</button>
          </div>
        </section>
      )}

      {/* ── Hero ── */}
      <section className="dash-hero" aria-label="Your invitation">
        <div className="dash-status-pills">
          <span className={`dash-pill ${isLive ? 'pill-live' : 'pill-draft'}`}>
            <span className="pill-dot" aria-hidden="true" />
            {liveLabel(activeEvent)}
          </span>
          {activeEvent.template?.name && <span className="dash-pill pill-neutral">{activeEvent.template.name}</span>}
        </div>

        <h1 className="dash-couple-name">{title}</h1>

        {(firstFn?.date || firstFn?.venueName) && (
          <p className="dash-event-meta">
            {[firstFn.date && formatDate(firstFn.date), firstFn.venueName].filter(Boolean).join(' · ')}
            {cdText && <span className="dash-countdown"> · {cdText}</span>}
          </p>
        )}

        {isLive && (
          <div className="dash-links">
            <div className="dash-url-bar">
              <span className="dash-url-label">Your link</span>
              <span className="dash-url-text">{inviteUrl}</span>
              <button type="button" className="dash-copy-btn" onClick={() => copy(inviteUrl)} aria-label="Copy your link">
                <Copy size={16} aria-hidden="true" /> Copy
              </button>
            </div>
            {secondUrl && (
              <div className="dash-url-bar">
                <span className="dash-url-label">Selected ceremonies</span>
                <span className="dash-url-text">{secondUrl}</span>
                <button type="button" className="dash-copy-btn" onClick={() => copy(secondUrl)} aria-label="Copy the link for selected ceremonies">
                  <Copy size={16} aria-hidden="true" /> Copy
                </button>
              </div>
            )}
          </div>
        )}

        <div className="dash-hero-actions">
          <Link to={primary.to} className="btn btn-primary">
            <PrimaryIcon size={18} aria-hidden="true" /> {primary.label}
          </Link>
          {isLive && (
            <Link to={buildBase} className="btn btn-secondary">
              <PencilLine size={18} aria-hidden="true" /> Edit invitation
            </Link>
          )}
        </div>
      </section>

      {/* ── Getting ready (not live yet) ── */}
      {!isLive && eventDetail && (
        <section className="card mb-24" aria-labelledby="ready-title">
          <h2 className="card-title" id="ready-title">Getting ready</h2>
          <ul className="ready-list">
            {checklist.map(item => {
              const Icon = item.icon;
              return (
                <li key={item.label}>
                  <Link to={item.to} className={`ready-item${item.done ? ' is-done' : ''}`}>
                    <span className="ready-icon" aria-hidden="true">{item.done ? <Check size={16} /> : <Icon size={16} />}</span>
                    <span className="ready-label">
                      {item.label}
                      {item.optional && !item.done && <span className="ready-optional"> — optional</span>}
                      <span className="sr-only">{item.done ? ' (done)' : ' (to do)'}</span>
                    </span>
                    {!item.done && <ChevronRight size={18} className="ready-chev" aria-hidden="true" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ── Guest replies (live) ── */}
      {isLive && stats && (
        <section className="card mb-24" aria-labelledby="replies-title">
          <div className="card-head-row">
            <h2 className="card-title" id="replies-title">Guest replies</h2>
            <Link to={`/events/${activeEvent.id}/guests`} className="btn btn-ghost btn-sm">See all guests <ChevronRight size={16} aria-hidden="true" /></Link>
          </div>
          <div className="reply-stats">
            <div className="reply-stat"><strong className="g-green">{coming}</strong><span>Coming</span></div>
            <div className="reply-stat"><strong className="g-red">{notComing}</strong><span>Not coming</span></div>
            <div className="reply-stat"><strong>{noReply}</strong><span>No reply yet</span></div>
            <div className="reply-stat"><strong>{stats.opens ?? 0}</strong><span>Opened</span></div>
          </div>
          {per.length > 1 && (
            <ul className="reply-rows" aria-label="Replies by ceremony">
              {per.map(fn => (
                <li key={fn.id} className="reply-row">
                  <span className="reply-row-name">{fn.name}</span>
                  <span className="reply-row-counts">
                    <span className="g-green">{fn.attending} coming</span> · <span className="g-red">{fn.notAttending} not coming</span> · {fn.pending} no reply yet
                    {fn.plusOnes ? ` · ${fn.plusOnes} extra` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {per.length > 1 && (
            <div className="table-wrap reply-table" style={{ marginTop: 16 }}>
              <table className="data-table">
                <caption className="sr-only">Replies by ceremony</caption>
                <thead>
                  <tr>
                    <th scope="col">Ceremony</th>
                    <th scope="col">Coming</th>
                    <th scope="col">Not coming</th>
                    <th scope="col">No reply yet</th>
                    <th scope="col">Extra guests</th>
                  </tr>
                </thead>
                <tbody>
                  {per.map(fn => (
                    <tr key={fn.id}>
                      <th scope="row" style={{ fontWeight: 700, textAlign: 'left' }}>{fn.name}</th>
                      <td className="g-green">{fn.attending}</td>
                      <td className="g-red">{fn.notAttending}</td>
                      <td>{fn.pending}</td>
                      <td>{fn.plusOnes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── Several invitations ── */}
      {displayEvents.length > 1 && (
        <section className="card mb-24" aria-labelledby="events-title">
          <h2 className="card-title" id="events-title">Your invitations</h2>
          <div className="event-cards">
            {displayEvents.map(e => (
              <button
                type="button"
                key={e.id}
                className={`event-card ${activeEvent.id === e.id ? 'active' : ''}`}
                onClick={() => { setActiveEvent?.(e); navigate('/dashboard'); }}
              >
                <span className="event-card-name">{eventTitle(e)}</span>
                <span className="event-card-meta">
                  <span className={`event-dot ${e.isPublished ? 'is-live' : ''}`} aria-hidden="true" />
                  {liveLabel(e)}{e.template?.name ? ` · ${e.template.name}` : ''}
                </span>
                {activeEvent.id === e.id ? <span className="event-card-current">Showing</span> : <span className="event-card-open">Open <Eye size={14} aria-hidden="true" /></span>}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
