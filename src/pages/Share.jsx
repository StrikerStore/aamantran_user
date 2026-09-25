import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { getInviteBaseUrl } from '../lib/config';
import { WhatsAppShare } from '../components/WhatsAppShare';
import { useToast } from '../components/ui/Toast';
import { QrCode } from './invite/QrCode';
import { Copy, Lock, AlertTriangle, QrCode as QrIcon, Link2 } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
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
          <div className="empty-icon" aria-hidden="true"><AlertTriangle size={32} strokeWidth={1.5} /></div>
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
          <div className="empty-icon" aria-hidden="true"><Lock size={32} strokeWidth={1.5} /></div>
          <h2>Go live first, then share</h2>
          <p>Your invitation isn’t online yet. Put it live and come back here to send it to guests.</p>
          <Link to={`/events/${event.id}/generate?step=publish`} className="btn btn-primary">Preview & go live</Link>
          <Link to="/dashboard" className="share-state-back">Back to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-fade share-page">

      <PageHeader title="Share your invitation" subtitle="Send your link on WhatsApp, or copy it anywhere." />

      <ul className="ig-list share-links">
        <li className="share-link-row">
          <span className="ig-row-icon"><Link2 size={24} aria-hidden="true" /></span>
          <span className="ig-row-text">
            <span className="share-link-label">Your link</span>
            <span className="ig-row-sub share-link-url">{inviteUrl}</span>
          </span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => copy(inviteUrl)} aria-label="Copy your link">
            <Copy size={16} aria-hidden="true" /> Copy
          </button>
        </li>
        {partialUrl && (
          <li className="share-link-row">
            <span className="ig-row-icon"><Link2 size={24} aria-hidden="true" /></span>
            <span className="ig-row-text">
              <span className="share-link-label">Link for selected ceremonies</span>
              <span className="ig-row-sub share-link-url">{partialUrl}</span>
            </span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => copy(partialUrl)} aria-label="Copy the link for selected ceremonies">
              <Copy size={16} aria-hidden="true" /> Copy
            </button>
          </li>
        )}
      </ul>
      <details className="share-qr">
        <summary>
          <span className="ig-row-icon"><QrIcon size={24} aria-hidden="true" /></span>
          <span className="ig-row-text">QR code for printed cards</span>
        </summary>
        <QrCode url={inviteUrl} fileName={`qr-${event.slug}.png`} />
      </details>

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
