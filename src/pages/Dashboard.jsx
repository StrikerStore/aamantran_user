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

  // Hide paired subset duplicates in dashboard list.
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

  const cd = eventDetail?.functions?.[0]?.date ? countdown(eventDetail.functions[0].date) : null;
  const inviteBase  = getInviteBaseUrl();
  const inviteUrl   = `${inviteBase}/i/${activeEvent.slug}`;
  const pairedEvent = eventDetail?.pairedEvent;
  const partialUrl  = pairedEvent ? `${inviteBase}/i/${pairedEvent.slug}` : null;

  return (
    <div className="page-fade">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">{activeEvent.slug} · {activeEvent.community} {activeEvent.eventType}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
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

      {/* Status banner */}
      {!activeEvent.isPublished && (
        <div className="dashboard-banner">
          <span>Your invitation is a <strong>Draft</strong>.</span>
          {!activeEvent.namesAreFrozen && (
            <span> Confirm your names to unlock publishing.</span>
          )}
          <Link to={`/events/${activeEvent.id}/generate`} className="banner-link">Complete it →</Link>
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Invitation Opens</div>
          <div className="stat-value">{loadingStats ? '—' : (stats?.opens ?? 0)}</div>
          <div className="stat-sub">total views</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">RSVPs</div>
          <div className="stat-value">{loadingStats ? '—' : (stats?.rsvpCount ?? 0)}</div>
          <div className="stat-sub">confirmed attending</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Guests</div>
          <div className="stat-value">{loadingStats ? '—' : (stats?.guestCount ?? 0)}</div>
          <div className="stat-sub">in guest list</div>
        </div>
        <div className="stat-card stat-card-countdown">
          {cd ? (
            <>
              <div className="stat-label">Countdown</div>
              <div className="stat-value countdown-val">
                {cd.past ? 'Done!' : `${cd.days}`}
              </div>
              <div className="stat-sub">{cd.past ? 'event has passed' : `days · ${cd.hours}h ${cd.minutes}m`}</div>
            </>
          ) : (
            <>
              <div className="stat-label">Event Date</div>
              <div className="stat-value" style={{ fontSize: '1.1rem' }}>—</div>
              <div className="stat-sub">add a ceremony</div>
            </>
          )}
        </div>
      </div>

      {/* What's Next — for unpublished events */}
      {!activeEvent.isPublished && eventDetail && (
        <div className="card mb-24 whats-next-card">
          <div className="card-title">What's Next</div>
          <div className="whats-next-steps">
            <div className={`whats-next-step ${true ? 'done' : ''}`}>
              <span className="wn-icon">✓</span>
              <span className="wn-label">Event created</span>
            </div>
            <div className={`whats-next-step ${(eventDetail.people?.length > 0) ? 'done' : ''}`}>
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

      {/* RSVP donut — for published events with RSVPs */}
      {activeEvent.isPublished && stats && (stats.rsvpCount ?? 0) > 0 && (() => {
        const attending = stats.perFunction?.reduce((s, f) => s + (f.attending || 0), 0) ?? 0;
        const declined  = stats.perFunction?.reduce((s, f) => s + (f.notAttending || 0), 0) ?? 0;
        const pending   = Math.max(0, (stats.rsvpCount ?? 0) - attending - declined);
        const total     = attending + declined + pending || 1;
        const attPct    = Math.round((attending / total) * 100);
        const decPct    = Math.round((declined  / total) * 100);
        return (
          <div className="card mb-24">
            <div className="card-title">RSVP Summary</div>
            <div className="rsvp-donut-row">
              <div
                className="rsvp-donut"
                style={{
                  background: `conic-gradient(
                    var(--green) 0% ${attPct}%,
                    var(--red)   ${attPct}% ${attPct + decPct}%,
                    var(--bg-overlay) ${attPct + decPct}% 100%
                  )`,
                }}
              />
              <div className="rsvp-legend">
                <div className="rsvp-legend-item"><span style={{ color: 'var(--green)' }}>●</span> Attending ({attending})</div>
                <div className="rsvp-legend-item"><span style={{ color: 'var(--red)' }}>●</span> Not attending ({declined})</div>
                <div className="rsvp-legend-item"><span style={{ color: 'var(--text-muted)' }}>●</span> Pending ({pending})</div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Per-function headcount */}
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

      {/* Event info card */}
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
          {activeEvent.isPublished && (
            <>
              <div className="detail-item detail-link-row">
                <span className="detail-label">Full Invite</span>
                <div className="invite-link-wrap">
                  <a href={inviteUrl} target="_blank" rel="noreferrer" className="invite-link">{inviteUrl}</a>
                  <button className="btn btn-ghost btn-sm" onClick={() => { navigator.clipboard.writeText(inviteUrl); toast('Copied!', 'success'); }}>Copy</button>
                </div>
              </div>
              {partialUrl && (
                <div className="detail-item detail-link-row">
                  <span className="detail-label">Partial Invite</span>
                  <div className="invite-link-wrap">
                    <a href={partialUrl} target="_blank" rel="noreferrer" className="invite-link">{partialUrl}</a>
                    <button className="btn btn-ghost btn-sm" onClick={() => { navigator.clipboard.writeText(partialUrl); toast('Copied!', 'success'); }}>Copy</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* All events */}
      {displayEvents.length > 1 && (
        <div className="card mb-24">
          <div className="card-title">Your Events</div>
          {displayEvents.map(ev => (
            <div key={ev.id} className={`event-row ${activeEvent.id === ev.id ? 'active' : ''}`} onClick={() => setActiveEvent?.(ev)}>
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

      {/* WhatsApp Share (only when published, triggered by button) */}
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
