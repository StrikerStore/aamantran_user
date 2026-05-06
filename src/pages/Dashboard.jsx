import { useState, useEffect } from 'react';
import { useOutletContext, useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { formatDate, countdown } from '../lib/utils';
import { getInviteBaseUrl } from '../lib/config';
import { WhatsAppShare } from '../components/WhatsAppShare';
import { useToast } from '../components/ui/Toast';
import './Dashboard.css';

export default function Dashboard() {
  const navigate = useNavigate();
  const toast = useToast();
  const { activeEvent, events = [], setActiveEvent } = useOutletContext() || {};

  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [eventDetail, setEventDetail] = useState(null);

  const displayEvents = events.filter(ev => ev.inviteScope !== 'subset');

  useEffect(() => {
    if (!activeEvent?.id) return;
    setLoadingStats(true);
    Promise.all([
      api.events.stats(activeEvent.id),
      api.events.get(activeEvent.id),
    ]).then(([sr, er]) => {
      setStats(sr.stats);
      setEventDetail(er.event);
    }).catch(() => {}).finally(() => setLoadingStats(false));
  }, [activeEvent?.id]);

  if (!activeEvent) {
    return (
      <div className="page-fade">
        <div className="page-header">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Manage your wedding invitation</p>
          </div>
        </div>
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">🎊</div>
            <div className="empty-title">No events yet</div>
            <div className="empty-desc" style={{ marginBottom: 20 }}>Set up your first event to start building your invitation.</div>
            <button className="btn btn-primary" onClick={() => navigate('/onboarding')}>Set Up Event</button>
          </div>
        </div>
      </div>
    );
  }

  const firstFn = eventDetail?.functions?.[0];
  const cd = firstFn?.date ? countdown(firstFn.date) : null;
  const inviteBase = getInviteBaseUrl();
  const inviteUrl = `${inviteBase}/i/${activeEvent.slug}`;
  const pairedEvent = eventDetail?.pairedEvent;
  const partialUrl = pairedEvent ? `${inviteBase}/i/${pairedEvent.slug}` : null;

  // Derive couple names from people or slug
  const people = eventDetail?.people;
  let coupleNames = activeEvent.slug
    ?.split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ') || 'Your Event';
  if (people?.length) {
    const names = people
      .slice(0, 2)
      .map(p => p.displayName || p.name || [p.firstName, p.lastName].filter(Boolean).join(' '))
      .filter(Boolean);
    if (names.length) coupleNames = names.join(' & ');
  }

  // RSVP breakdown
  const attending  = stats?.perFunction?.reduce((s, f) => s + (f.attending || 0), 0) ?? 0;
  const declined   = stats?.perFunction?.reduce((s, f) => s + (f.notAttending || 0), 0) ?? 0;
  const rsvpTotal  = stats?.rsvpCount ?? 0;
  const pending    = Math.max(0, rsvpTotal - attending - declined);
  const guestCount = stats?.guestCount ?? 0;
  const attPct     = guestCount > 0 ? Math.round((attending / guestCount) * 100) : 0;
  const pendingPct = guestCount > 0 ? Math.round((pending  / guestCount) * 100) : 0;
  const donutTotal = attending + declined + pending || 1;
  const donutAttPct = Math.round((attending / donutTotal) * 100);
  const donutDecPct = Math.round((declined  / donutTotal) * 100);

  return (
    <div className="page-fade">

      {/* ── Hero card ── */}
      <div className="dash-hero">
        <div className="dash-hero-main">
          <div className="dash-status-pills">
            <span className={`dash-pill ${activeEvent.isPublished ? 'pill-live' : 'pill-draft'}`}>
              <span className="pill-dot" />
              {activeEvent.isPublished ? 'Live' : 'Draft'}
            </span>
            {activeEvent.template?.name && (
              <span className="dash-pill pill-neutral">{activeEvent.template.name}</span>
            )}
            {firstFn?.date && (
              <span className="dash-pill pill-neutral">📅 {formatDate(firstFn.date)}</span>
            )}
          </div>

          <h1 className="dash-couple-name">{coupleNames}</h1>

          {(firstFn?.date || firstFn?.venue) && (
            <p className="dash-event-meta">
              {[firstFn.date && formatDate(firstFn.date), firstFn.venue].filter(Boolean).join(' · ')}
            </p>
          )}

          {activeEvent.isPublished && (
            <div className="dash-url-bar">
              <span className="dash-url-text">{inviteUrl}</span>
              <button
                className="dash-copy-btn"
                onClick={() => { navigator.clipboard.writeText(inviteUrl); toast('Copied!', 'success'); }}
              >
                Copy
              </button>
            </div>
          )}

          <div className="dash-hero-actions">
            {activeEvent.isPublished && (
              <button className="btn btn-secondary" onClick={() => setShowShare(s => !s)}>
                📱 Share
              </button>
            )}
            <Link
              to={`/events/${activeEvent.id}/${activeEvent.isPublished ? 'edit' : 'generate'}`}
              className="btn btn-primary"
            >
              {activeEvent.isPublished ? 'Edit Invitation' : 'Build Invitation'}
            </Link>
          </div>
        </div>

        {cd && !cd.past && (
          <div className="dash-countdown">
            <p className="dash-cd-label">Countdown to the day</p>
            <div className="dash-cd-nums">
              <div className="dash-cd-unit">
                <span className="dash-cd-num">{cd.days}</span>
                <small>days</small>
              </div>
              <span className="dash-cd-sep">·</span>
              <div className="dash-cd-unit">
                <span className="dash-cd-num">{cd.hours}</span>
                <small>hrs</small>
              </div>
              <span className="dash-cd-sep">·</span>
              <div className="dash-cd-unit">
                <span className="dash-cd-num">{cd.minutes}</span>
                <small>min</small>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Draft banner ── */}
      {!activeEvent.isPublished && (
        <div className="dashboard-banner">
          <span>Your invitation is a <strong>Draft</strong>.</span>
          {!activeEvent.namesAreFrozen && <span> Confirm your names to unlock publishing.</span>}
          <Link to={`/events/${activeEvent.id}/generate`} className="banner-link">Complete it →</Link>
        </div>
      )}

      {/* ── Guest glance ── */}
      {activeEvent.isPublished && stats && (
        <div className="dash-glance">
          <span className="dash-glance-title">A glance at your guest list</span>
          <div className="dash-glance-row">
            <span className="glance-chip chip-green"><strong>{attending}</strong> coming</span>
            <span className="glance-dot">·</span>
            <span className="glance-chip chip-muted"><strong>{pending}</strong> awaiting reply</span>
            <span className="glance-dot">·</span>
            <span className="glance-chip chip-red"><strong>{declined}</strong> sends apologies</span>
            <span className="glance-dot">·</span>
            <span className="glance-chip chip-muted"><strong>{stats.opens ?? 0}</strong> yet to open</span>
          </div>
        </div>
      )}

      {/* ── What's Next (draft only) ── */}
      {!activeEvent.isPublished && eventDetail && (
        <div className="card mb-24 whats-next-card">
          <div className="card-title">What's Next</div>
          <div className="whats-next-steps">
            <div className="whats-next-step done">
              <span className="wn-icon">✓</span>
              <span className="wn-label">Event created</span>
            </div>
            <div className={`whats-next-step ${eventDetail.people?.length > 0 ? 'done' : ''}`}>
              <span className="wn-icon">{eventDetail.people?.length > 0 ? '✓' : '○'}</span>
              <span className="wn-label">People & names added</span>
              {!(eventDetail.people?.length > 0) && (
                <Link to={`/events/${activeEvent.id}/generate`} className="wn-cta">Do it →</Link>
              )}
            </div>
            <div className={`whats-next-step ${activeEvent.namesAreFrozen ? 'done' : ''}`}>
              <span className="wn-icon">{activeEvent.namesAreFrozen ? '✓' : '○'}</span>
              <span className="wn-label">Names confirmed</span>
              {!activeEvent.namesAreFrozen && (
                <Link to={`/events/${activeEvent.id}/generate`} className="wn-cta">Do it →</Link>
              )}
            </div>
            <div className="whats-next-step">
              <span className="wn-icon">○</span>
              <span className="wn-label">Publish invitation</span>
              <Link to={`/events/${activeEvent.id}/generate`} className="wn-cta">Do it →</Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="stats-grid">

        {/* Opens */}
        <div className="stat-card">
          <div className="stat-card-hd">
            <span className="stat-label">Pages Open</span>
            {activeEvent.isPublished && <span className="stat-tag">since launch</span>}
          </div>
          <div className="stat-value">{loadingStats ? '—' : (stats?.opens ?? 0)}</div>
          <div className="stat-sub">to your day</div>
        </div>

        {/* RSVPs */}
        <div className="stat-card">
          <div className="stat-card-hd">
            <span className="stat-label">RSVPs</span>
          </div>
          <div className="stat-rsvp-main">
            <span className="stat-value">{loadingStats ? '—' : rsvpTotal}</span>
            {guestCount > 0 && <span className="stat-rsvp-of">of {guestCount} invited</span>}
          </div>
          {guestCount > 0 && stats && (
            <div className="stat-prog-track">
              <div className="stat-prog-fill fill-attending" style={{ width: `${attPct}%` }} />
              <div className="stat-prog-fill fill-pending"   style={{ width: `${pendingPct}%` }} />
            </div>
          )}
        </div>

        {/* Attending */}
        <div className="stat-card">
          <div className="stat-card-hd">
            <span className="stat-label">Attending</span>
            {stats && rsvpTotal > 0 && <span className="stat-tag">{attPct}%</span>}
          </div>
          <div className="stat-donut-row">
            <div
              className="rsvp-donut stat-donut-sm"
              style={{
                background: rsvpTotal > 0
                  ? `conic-gradient(
                      var(--green) 0% ${donutAttPct}%,
                      var(--red)   ${donutAttPct}% ${donutAttPct + donutDecPct}%,
                      var(--bg-overlay) ${donutAttPct + donutDecPct}% 100%
                    )`
                  : 'var(--bg-overlay)',
              }}
            />
            <div>
              <div className="stat-value">{attending}</div>
              <div className="stat-sub">confirmed</div>
            </div>
          </div>
        </div>

        {/* Countdown / Guests */}
        <div className="stat-card stat-card-countdown">
          <div className="stat-card-hd">
            <span className="stat-label">{cd ? 'Countdown' : 'Guests'}</span>
          </div>
          {cd ? (
            <>
              <div className="stat-value countdown-val">{cd.past ? 'Done!' : `${cd.days}`}</div>
              <div className="stat-sub">{cd.past ? 'event has passed' : `days · ${cd.hours}h ${cd.minutes}m`}</div>
            </>
          ) : (
            <>
              <div className="stat-value">{loadingStats ? '—' : guestCount}</div>
              <div className="stat-sub">in guest list</div>
            </>
          )}
        </div>
      </div>

      {/* ── Function Headcount ── */}
      {stats?.perFunction?.length > 0 && (
        <div className="card mb-24">
          <div className="card-title">Function Headcount</div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Function</th>
                  <th>Attending</th>
                  <th>Not Attending</th>
                  <th>Pending</th>
                  <th>+1s</th>
                </tr>
              </thead>
              <tbody>
                {stats.perFunction.map(fn => (
                  <tr key={fn.id}>
                    <td style={{ fontWeight: 600 }}>{fn.name}</td>
                    <td style={{ color: 'var(--green)' }}>{fn.attending}</td>
                    <td style={{ color: 'var(--red)' }}>{fn.notAttending}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{fn.pending}</td>
                    <td>{fn.plusOnes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Invitation Details ── */}
      <div className="card mb-24">
        <div className="card-title">Invitation Details</div>
        <div className="detail-grid">
          <div className="detail-item">
            <span className="detail-label">Status</span>
            <span className={`badge ${activeEvent.isPublished ? 'badge-published' : 'badge-draft'}`}>
              {activeEvent.isPublished ? 'Published' : 'Draft'}
            </span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Names Confirmed</span>
            <span className={`badge ${activeEvent.namesAreFrozen ? 'badge-frozen' : 'badge-pending'}`}>
              {activeEvent.namesAreFrozen ? '🔒 Confirmed' : 'Not yet'}
            </span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Template</span>
            <span>{activeEvent.template?.name || '—'}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Language</span>
            <span>{activeEvent.language || 'en'}</span>
          </div>
          {activeEvent.isPublished && partialUrl && (
            <div className="detail-item detail-link-row">
              <span className="detail-label">Partial Invite</span>
              <div className="invite-link-wrap">
                <a href={partialUrl} target="_blank" rel="noreferrer" className="invite-link">{partialUrl}</a>
                <button className="btn btn-ghost btn-sm" onClick={() => { navigator.clipboard.writeText(partialUrl); toast('Copied!', 'success'); }}>Copy</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Your Events (multi-event) ── */}
      {displayEvents.length > 1 && (
        <div className="card mb-24">
          <div className="card-title">Your Events</div>
          {displayEvents.map(ev => (
            <div
              key={ev.id}
              className={`event-row ${activeEvent.id === ev.id ? 'active' : ''}`}
              onClick={() => setActiveEvent?.(ev)}
            >
              <div className="event-row-info">
                <div className="event-row-name">{ev.slug}</div>
                <div className="event-row-meta">{ev.community} {ev.eventType} · {formatDate(ev.createdAt)}</div>
              </div>
              <span className={`badge ${ev.isPublished ? 'badge-published' : 'badge-draft'}`}>
                {ev.isPublished ? 'Published' : 'Draft'}
              </span>
              <Link to={`/events/${ev.id}/generate`} className="btn btn-secondary btn-sm" onClick={e => e.stopPropagation()}>
                Open →
              </Link>
            </div>
          ))}
        </div>
      )}

      {showShare && activeEvent.isPublished && eventDetail && (
        <WhatsAppShare
          event={eventDetail}
          people={eventDetail.people || []}
          functions={eventDetail.functions || []}
          partialUrl={partialUrl}
        />
      )}
    </div>
  );
}
