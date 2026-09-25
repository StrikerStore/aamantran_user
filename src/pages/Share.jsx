import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { getInviteBaseUrl } from '../lib/config';
import { WhatsAppShare } from '../components/WhatsAppShare';
import { useToast } from '../components/ui/Toast';
import { QrCode } from './invite/QrCode';
import { ArrowLeft, Copy, Lock, AlertTriangle, QrCode as QrIcon, Radio } from '../components/ui/icons';
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
    api.events.get(id)
      .then(r => setEvent(r.event))
      .catch(e => setError(e?.message || 'We couldn’t open this invitation.'))
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

  function copy(url) {
    navigator.clipboard?.writeText(url)
      .then(() => toast('Link copied.', 'success'))
      .catch(() => toast('Couldn’t copy — press and hold the link to copy it.', 'error'));
  }

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
          <div className="share-state-emoji" aria-hidden="true"><AlertTriangle size={30} /></div>
          <h2>We couldn’t open this invitation</h2>
          <p>{error || 'It may have been removed.'}</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/dashboard')}>Back to Home</button>
        </div>
      </div>
    );
  }

  if (!event.isPublished) {
    return (
      <div className="page-fade share-page">
        <div className="share-state-card">
          <div className="share-state-emoji" aria-hidden="true"><Lock size={30} /></div>
          <h2>Go live first, then share</h2>
          <p>Your invitation isn’t online yet. Put it live and come back here to send it to guests.</p>
          <Link to={`/events/${event.id}/generate?step=publish`} className="btn btn-primary"><Radio size={18} aria-hidden="true" /> Preview & go live</Link>
          <Link to="/dashboard" className="share-state-back">Back to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-fade share-page">

      <div className="share-topcard">
        <button type="button" className="share-back-btn" onClick={() => navigate(-1)} aria-label="Go back">
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <div className="share-topcard-text">
          <h1>Share your invitation</h1>
          <p>Send your link on WhatsApp, or copy it anywhere.</p>
        </div>
      </div>

      <div className="share-link-card">
        <div className="share-link-row">
          <span className="share-link-label">Your link</span>
          <div className="share-link-input">
            <span>{inviteUrl}</span>
            <button type="button" onClick={() => copy(inviteUrl)}><Copy size={15} aria-hidden="true" /> Copy</button>
          </div>
        </div>
        {partialUrl && (
          <div className="share-link-row">
            <span className="share-link-label">Link for selected ceremonies</span>
            <div className="share-link-input">
              <span>{partialUrl}</span>
              <button type="button" onClick={() => copy(partialUrl)}><Copy size={15} aria-hidden="true" /> Copy</button>
            </div>
          </div>
        )}
        <details className="share-qr">
          <summary><QrIcon size={16} aria-hidden="true" /> QR code for printed cards</summary>
          <QrCode url={inviteUrl} fileName={`qr-${event.slug}.png`} />
        </details>
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
