import { useState, useEffect } from 'react';
import { useOutletContext, useNavigate, Link } from 'react-router-dom';
import {
  Copy, Check, ChevronRight, Users, CalendarHeart, Image as ImageIcon, Radio, X, ShoppingBag, LifeBuoy, PartyPopper,
} from 'lucide-react';
import { api } from '../lib/api';
import { formatDate } from '../lib/utils';
import { getInviteBaseUrl, WEBSITE_URL } from '../lib/config';
import { eventTitle, liveLabel, daysToGo, replySummary } from '../lib/event';
import { CoupleAvatar } from '../components/Layout';
import { useToast } from '../components/ui/Toast';
import { EmptyState } from '../components/ui/EmptyState';
import { PageSkeleton } from '../components/ui/Skeleton';
import './Dashboard.css';

const WELCOME_KEY = 'aam_welcome_dismissed';

function readFlag(key) {
  try { return localStorage.getItem(key) === '1'; } catch { return false; }
}

/**
 * Home, laid out like an Instagram profile: the couple, their numbers, the
 * one next step, then "Getting ready" as Instagram's "Complete your profile"
 * cards (before going live) or guest replies (after).
 */
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
    return <div className="page-fade"><PageSkeleton stats={0} cards={2} /></div>;
  }

  // ── No invitation on this account yet ──
  if (!activeEvent) {
    return (
      <div className="page-fade home">
        <EmptyState
          icon={PartyPopper}
          title="You don’t have an invitation yet"
          action={(
            <div className="home-empty-actions">
              <a className="btn btn-primary" href={`${WEBSITE_URL}/templates`} target="_blank" rel="noreferrer">
                <ShoppingBag size={16} aria-hidden="true" /> Browse designs
              </a>
              <Link className="btn btn-secondary" to="/support"><LifeBuoy size={16} aria-hidden="true" /> Ask us for help</Link>
            </div>
          )}
        >
          Choose a design on our website — it appears here as soon as your order is complete.
          If you’ve already paid and don’t see it, message us.
        </EmptyState>
      </div>
    );
  }

  const ev = eventDetail && eventDetail.id === activeEvent.id ? eventDetail : activeEvent;
  const isLive = Boolean(activeEvent.isPublished);
  const title = eventTitle(ev);
  const fns = ev.functions || [];
  const firstFn = fns.filter(f => f.date).sort((a, b) => new Date(a.date) - new Date(b.date))[0];
  const toGo = daysToGo(ev);
  const inviteBase = getInviteBaseUrl();
  const inviteUrl = `${inviteBase}/i/${activeEvent.slug}`;
  const secondUrl = eventDetail?.pairedEvent?.slug ? `${inviteBase}/i/${eventDetail.pairedEvent.slug}` : null;
  const buildBase = `/events/${activeEvent.id}/${isLive ? 'edit' : 'generate'}`;
  const photoCount = (eventDetail?.media || []).length;

  // Where the couple is, and the one thing to do next.
  const namesDone = Boolean(ev.namesAreFrozen);
  const ceremoniesDone = fns.length > 0;
  const photosDone = photoCount > 0;
  const primary = isLive
    ? { to: `/events/${activeEvent.id}/share`, label: 'Share invitation' }
    : namesDone && ceremoniesDone
      ? { to: `${buildBase}?step=publish`, label: 'Preview & go live' }
      : { to: buildBase, label: (ev.people || []).length ? 'Continue building' : 'Start building' };

  const checklist = [
    { done: namesDone, label: 'Add your names', text: 'Exactly as they should appear.', action: 'Start', to: `${buildBase}?step=people`, icon: Users },
    { done: ceremoniesDone, label: 'Add ceremonies', text: 'Dates, times and places.', action: 'Start', to: `${buildBase}?step=functions`, icon: CalendarHeart },
    { done: photosDone, label: 'Add photos & music', text: 'Optional — makes it personal.', action: 'Start', to: `${buildBase}?step=media`, icon: ImageIcon },
    { done: isLive, label: 'Go live', text: 'Preview it, then share your link.', action: 'Go live', to: `${buildBase}?step=publish`, icon: Radio },
  ];
  const doneCount = checklist.filter(c => c.done).length;

  const replies = replySummary(stats);
  const per = stats?.perFunction || [];
  const showWelcome = !welcomeHidden && !isLive;

  return (
    <div className="page-fade home">
      {/* ── Profile ── */}
      <section className="home-profile" aria-label="Your invitation">
        <div className="home-profile-top">
          <CoupleAvatar event={ev} size={86} />
          {isLive ? (
            <div className="ig-stats home-stats">
              <div className="ig-stat"><strong>{replies.coming}</strong><span>Coming</span></div>
              <div className="ig-stat"><strong>{replies.notComing}</strong><span>Not coming</span></div>
              <div className="ig-stat"><strong>{replies.opens}</strong><span>Opened</span></div>
            </div>
          ) : (
            <div className="ig-stats home-stats">
              <div className="ig-stat"><strong>{fns.length}</strong><span>Ceremon{fns.length === 1 ? 'y' : 'ies'}</span></div>
              <div className="ig-stat"><strong>{photoCount}</strong><span>Photo{photoCount === 1 ? '' : 's'}</span></div>
              <div className="ig-stat"><strong>{doneCount}/4</strong><span>Steps</span></div>
            </div>
          )}
        </div>

        <h1 className="home-name">{title}</h1>
        <p className="home-bio">
          <span className={isLive ? 'home-live' : 'home-draft'}>{liveLabel(activeEvent)}</span>
          {activeEvent.template?.name ? ` · ${activeEvent.template.name}` : ''}
        </p>
        {firstFn?.date && (
          <p className="home-bio">
            {formatDate(firstFn.date)}{firstFn.venueName ? ` · ${firstFn.venueName}` : ''}
            {toGo && <span className="home-countdown"> · {toGo}</span>}
          </p>
        )}

        <div className="home-actions">
          <Link to={primary.to} className="btn btn-primary">{primary.label}</Link>
          {isLive
            ? <Link to={buildBase} className="btn btn-secondary">Edit invitation</Link>
            : <Link to={`/events/${activeEvent.id}/guests`} className="btn btn-secondary">Guests</Link>}
        </div>
      </section>

      {/* ── Links (live) ── */}
      {isLive && (
        <section className="home-section" aria-label="Your links">
          <ul className="ig-list">
            <li className="home-link-row">
              <span className="ig-row-text">
                <span className="home-link-label">Your link</span>
                <span className="ig-row-sub home-link-url">{inviteUrl}</span>
              </span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => copy(inviteUrl)} aria-label="Copy your link">
                <Copy size={16} aria-hidden="true" /> Copy
              </button>
            </li>
            {secondUrl && (
              <li className="home-link-row">
                <span className="ig-row-text">
                  <span className="home-link-label">Link for selected ceremonies</span>
                  <span className="ig-row-sub home-link-url">{secondUrl}</span>
                </span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => copy(secondUrl)} aria-label="Copy the link for selected ceremonies">
                  <Copy size={16} aria-hidden="true" /> Copy
                </button>
              </li>
            )}
          </ul>
        </section>
      )}

      {/* ── Getting ready — Instagram "Complete your profile" ── */}
      {!isLive && (
        <section className="home-section" aria-labelledby="ready-title">
          <div className="home-section-head">
            <div className="home-section-titles">
              <h2 className="home-section-title" id="ready-title">
                {showWelcome ? ((ev.people || []).length ? `Welcome, ${title}!` : 'Welcome to Aamantran!') : 'Getting ready'}
              </h2>
              <p className="home-section-sub">
                {showWelcome ? 'Your invitation takes about 10 minutes. ' : ''}
                <strong>{doneCount} of 4</strong> complete
              </p>
            </div>
            {showWelcome && (
              <button type="button" className="icon-btn" onClick={dismissWelcome} aria-label="Hide welcome">
                <X size={20} aria-hidden="true" />
              </button>
            )}
          </div>
          <ul className="ready-strip">
            {checklist.map(item => {
              const Icon = item.icon;
              return (
                <li key={item.label} className={`ready-card${item.done ? ' is-done' : ''}`}>
                  <span className="ready-icon" aria-hidden="true">{item.done ? <Check size={24} /> : <Icon size={24} />}</span>
                  <span className="ready-title">{item.label}</span>
                  <span className="ready-text">{item.text}</span>
                  <Link to={item.to} className={`btn btn-sm ${item.done ? 'btn-secondary' : 'btn-primary'}`}>
                    {item.done ? 'Edit' : item.action}
                    <span className="sr-only"> — {item.label}{item.done ? ' (done)' : ''}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ── Guest replies (live) ── */}
      {isLive && stats && (
        <section className="home-section" aria-labelledby="replies-title">
          <div className="home-section-head">
            <h2 className="home-section-title" id="replies-title">Guest replies</h2>
            <Link to={`/events/${activeEvent.id}/guests`} className="btn-text">See all</Link>
          </div>
          <p className="home-section-sub">
            {replies.noReply} guest{replies.noReply === 1 ? ' hasn’t' : 's haven’t'} replied yet.
          </p>
          {per.length > 0 && (
            <ul className="ig-list">
              {per.map(fn => (
                <li key={fn.id} className="home-reply-row">
                  <span className="ig-row-icon"><CalendarHeart size={24} aria-hidden="true" /></span>
                  <span className="ig-row-text">
                    <span>{fn.name}</span>
                    <span className="ig-row-sub">
                      <span className="home-live">{fn.attending} coming</span> · {fn.notAttending} not coming · {fn.pending} no reply yet
                      {fn.plusOnes ? ` · ${fn.plusOnes} extra` : ''}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ── Several invitations ── */}
      {displayEvents.length > 1 && (
        <section className="home-section" aria-labelledby="events-title">
          <h2 className="home-section-title" id="events-title">Your invitations</h2>
          <ul className="ig-list">
            {displayEvents.map(e => (
              <li key={e.id}>
                <button
                  type="button"
                  className="ig-row"
                  aria-current={activeEvent.id === e.id ? 'true' : undefined}
                  onClick={() => { setActiveEvent?.(e); navigate('/dashboard'); }}
                >
                  <CoupleAvatar event={e} size={44} />
                  <span className="ig-row-text">
                    <span className="home-link-label">{eventTitle(e)}</span>
                    <span className="ig-row-sub">{liveLabel(e)}{e.template?.name ? ` · ${e.template.name}` : ''}</span>
                  </span>
                  {activeEvent.id === e.id
                    ? <Check size={20} className="ig-row-end" aria-label="Showing" />
                    : <ChevronRight size={20} className="ig-row-end" aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
