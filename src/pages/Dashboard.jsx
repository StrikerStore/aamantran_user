import { useState, useEffect, useMemo } from 'react';
import { useOutletContext, useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { formatDate, countdown } from '../lib/utils';
import { getInviteBaseUrl } from '../lib/config';
import { useToast } from '../components/ui/Toast';
import './Dashboard.css';

function stripHonorifics(name) {
  if (!name) return '';
  // Strip very common honorifics so the dashboard headline reads as a name,
  // not a salutation. People can still see the full string elsewhere.
  return String(name)
    .replace(/^\s*(mr|mrs|ms|miss|sri|smt|shri|dr|prof)\.?\s+/i, '')
    .trim();
}

export default function Dashboard() {
  const navigate = useNavigate();
  const toast = useToast();
  const { activeEvent, events = [], setActiveEvent } = useOutletContext() || {};

  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [eventDetail, setEventDetail] = useState(null);
  const [loadingEvent, setLoadingEvent] = useState(false);

  const displayEvents = events.filter(ev => ev.inviteScope !== 'subset');

  useEffect(() => {
    if (!activeEvent?.id) return;
    setLoadingStats(true);
    setLoadingEvent(true);
    Promise.all([
      api.events.stats(activeEvent.id),
      api.events.get(activeEvent.id),
    ]).then(([sr, er]) => {
      setStats(sr.stats);
      setEventDetail(er.event);
    }).catch(() => {}).finally(() => {
      setLoadingStats(false);
      setLoadingEvent(false);
    });
  }, [activeEvent?.id]);

  // ── Pick the main couple from frozen names ──
  // Required-role people are the headline names per the template schema.
  // We never fall back to the slug — better to show "Your Wedding" placeholder
  // than to surface raw URL strings on the dashboard.
  const displayTitle = useMemo(() => {
    if (loadingEvent) return null;                          // suppress placeholder while loading
    if (!activeEvent?.namesAreFrozen) return 'Your Wedding';

    const people = eventDetail?.people || [];
    if (!people.length) return 'Your Wedding';

    // Try schema-required roles first (they identify the bride/groom etc.)
    let schema = eventDetail?.template?.fieldSchema;
    if (typeof schema === 'string') { try { schema = JSON.parse(schema); } catch { schema = null; } }
    const requiredRoles = (schema?.people || [])
      .filter(r => r && r.required && r.role)
      .map(r => r.role);

    let chosen = [];
    if (requiredRoles.length) {
      chosen = requiredRoles
        .map(role => people.find(p => p.role === role))
        .filter(Boolean);
    }
    if (!chosen.length) chosen = people.slice(0, 2);

    const names = chosen
      .map(p => stripHonorifics(p.name || p.displayName || ''))
      .filter(Boolean);
    return names.length ? names.join(' & ') : 'Your Wedding';
  }, [loadingEvent, activeEvent?.namesAreFrozen, eventDetail]);

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

  // ── RSVP unique counts (max across functions ≈ unique respondents) ──
  const fnAttending    = stats?.perFunction?.map(f => f.attending    || 0) ?? [];
  const fnNotAttending = stats?.perFunction?.map(f => f.notAttending || 0) ?? [];
  const fnResponded    = stats?.perFunction?.map((_, i) => (fnAttending[i] || 0) + (fnNotAttending[i] || 0)) ?? [];
  const attending      = fnAttending.length    ? Math.max(...fnAttending)    : 0;
  const declined       = fnNotAttending.length ? Math.max(...fnNotAttending) : 0;
  const responded      = fnResponded.length    ? Math.max(...fnResponded)    : 0;
  const guestCount     = stats?.guestCount ?? 0;
  const pending        = Math.max(0, guestCount - responded);
  const rsvpTotal      = responded;
  const attPct         = guestCount > 0 ? Math.round((attending / guestCount) * 100) : 0;
  const pendingPct     = guestCount > 0 ? Math.round((pending   / guestCount) * 100) : 0;
  const donutTotal     = attending + declined + pending || 1;
  const donutAttPct    = Math.round((attending / donutTotal) * 100);
  const donutDecPct    = Math.round((declined  / donutTotal) * 100);

  return (
    <div className="page-fade">

      {/* ── Hero ── */}
      <div className="dash-hero">
        <div className="dash-status-pills">
          <span className={`dash-pill ${activeEvent.isPublished ? 'pill-live' : 'pill-draft'}`}>
            <span className="pill-dot" />
            {activeEvent.isPublished ? 'Live' : 'Draft'}
          </span>
          {activeEvent.template?.name && (
            <span className="dash-pill pill-neutral">{activeEvent.template.name}</span>
          )}
        </div>

        {displayTitle === null ? (
          <div className="dash-name-skeleton" />
        ) : (
          <h1 className="dash-couple-name">{displayTitle}</h1>
        )}

        {(firstFn?.date || firstFn?.venueName) && (
          <p className="dash-event-meta">
            {[firstFn.date && formatDate(firstFn.date), firstFn.venueName].filter(Boolean).join(' · ')}
          </p>
        )}

        {/* Inline countdown — replaces the duplicate stat card */}
        {cd && !cd.past && (
          <div className="dash-cd-inline">
            <span className="dash-cd-num">{cd.days}</span><span className="dash-cd-unit">d</span>
            <span className="dash-cd-num">{cd.hours}</span><span className="dash-cd-unit">h</span>
            <span className="dash-cd-num">{cd.minutes}</span><span className="dash-cd-unit">m</span>
            <span className="dash-cd-tail">to your day</span>
          </div>
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
            <button
              className="btn btn-secondary"
              onClick={() => navigate(`/events/${activeEvent.id}/share`)}
            >
              Share
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

      {/* ── Draft prompt ── */}
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

      {/* ── Guest glance (published only) ── */}
      {activeEvent.isPublished && stats && (
        <div className="dash-glance">
          <div className="dash-glance-title">A glance at your guest list</div>
          <div className="dash-glance-row">
            <div className="glance-stat"><strong className="g-green">{attending}</strong><span>coming</span></div>
            <div className="glance-stat"><strong>{pending}</strong><span>awaiting</span></div>
            <div className="glance-stat"><strong className="g-red">{declined}</strong><span>declined</span></div>
            <div className="glance-stat"><strong>{stats.opens ?? 0}</strong><span>opens</span></div>
          </div>
        </div>
      )}

      {/* ── Stat cards (only for published) ── */}
      {activeEvent.isPublished && (
        <div className="stats-grid">

          {/* RSVPs progress */}
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

          {/* Attending donut */}
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

        </div>
      )}

      {/* ── Function Headcount ── */}
      {stats?.perFunction?.length > 0 && (
        <div className="card mb-24">
          <div className="card-title">Function Headcount</div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Function</th>
                  <th>Yes</th>
                  <th>No</th>
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

      {/* ── Your Events (multi-event only) ── */}
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
    </div>
  );
}
