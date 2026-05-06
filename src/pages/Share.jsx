import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { getInviteBaseUrl } from '../lib/config';
import { WhatsAppShare } from '../components/WhatsAppShare';
import { useToast } from '../components/ui/Toast';
import './Share.css';

export default function Share() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.events.get(id)
      .then(r => setEvent(r.event))
      .catch(e => setError(e?.message || 'Could not load event'))
      .finally(() => setLoading(false));
  }, [id]);

  // schemaPeopleRoles — derived from template.fieldSchema.people, same shape
  // GenerateInvitation expects.
  const schemaPeopleRoles = useMemo(() => {
    let schema = event?.template?.fieldSchema;
    if (typeof schema === 'string') {
      try { schema = JSON.parse(schema); } catch { schema = null; }
    }
    const rows = Array.isArray(schema?.people) ? schema.people : [];
    return rows
      .filter(r => r && typeof r === 'object' && r.role)
      .map(r => ({ role: String(r.role), label: String(r.label || r.role), required: Boolean(r.required) }));
  }, [event]);

  const inviteBase = getInviteBaseUrl();
  const inviteUrl  = event?.slug ? `${inviteBase}/i/${event.slug}` : '';
  const partialUrl = event?.pairedEvent?.slug ? `${inviteBase}/i/${event.pairedEvent.slug}` : null;

  if (loading) {
    return (
      <div className="page-fade share-page">
        <div className="share-skeleton" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="page-fade share-page">
        <div className="share-state-card">
          <div className="share-state-emoji">⚠️</div>
          <h2>Couldn't load event</h2>
          <p>{error || 'This event no longer exists.'}</p>
          <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
        </div>
      </div>
    );
  }

  if (!event.isPublished) {
    return (
      <div className="page-fade share-page">
        <div className="share-state-card">
          <div className="share-state-emoji">🔒</div>
          <h2>Publish first to share</h2>
          <p>Your invitation is still a draft. Publish it to generate a shareable link.</p>
          <Link to={`/events/${event.id}/generate`} className="btn btn-primary">Go to Publish</Link>
          <Link to="/dashboard" className="share-state-back">← Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-fade share-page">

      <div className="share-topcard">
        <button className="share-back-btn" onClick={() => navigate(-1)} aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div className="share-topcard-text">
          <h1>Share Your Invitation</h1>
          <p>Send a personalised message to every guest in seconds.</p>
        </div>
      </div>

      <div className="share-link-card">
        <div className="share-link-row">
          <span className="share-link-label">Full invite</span>
          <div className="share-link-input">
            <span>{inviteUrl}</span>
            <button onClick={() => { navigator.clipboard.writeText(inviteUrl); toast('Copied!', 'success'); }}>Copy</button>
          </div>
        </div>
        {partialUrl && (
          <div className="share-link-row">
            <span className="share-link-label">Partial invite</span>
            <div className="share-link-input">
              <span>{partialUrl}</span>
              <button onClick={() => { navigator.clipboard.writeText(partialUrl); toast('Copied!', 'success'); }}>Copy</button>
            </div>
          </div>
        )}
      </div>

      <WhatsAppShare
        event={event}
        people={event.people || []}
        functions={event.functions || []}
        venues={event.venues || []}
        partialUrl={partialUrl}
        eventId={event.id}
        schemaPeopleRoles={schemaPeopleRoles}
      />
    </div>
  );
}
