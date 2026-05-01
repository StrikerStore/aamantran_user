import { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { api } from '../lib/api';
import { slugify } from '../lib/utils';
import { useToast } from '../components/ui/Toast';
import './Onboarding.css';

const EVENT_TYPES = [
  'Wedding', 'Engagement', 'Reception', 'Sangeet', 'Mehendi',
  'Haldi', 'Tilak', 'Roka', 'Birthday', 'Anniversary', 'Other',
];

const COMMUNITIES = [
  'Hindu', 'Muslim', 'Christian', 'Sikh', 'Jain', 'Buddhist',
  'Parsi', 'Jewish', 'Other',
];

export default function Onboarding() {
  const navigate = useNavigate();
  const toast = useToast();
  const outletCtx = useOutletContext() || {};

  const [payments, setPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [form, setForm] = useState({
    paymentId: '',
    community: '',
    eventType: 'Wedding',
    slug: '',
  });
  const [slugSuggestion, setSlugSuggestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Fetch user's me info to get unlinked payments
    api.auth.me().then(r => {
      // Payments that have no eventId yet are "unlinked"
      // We'll use the events list + compare with total payments
      // Actually /me doesn't return payments — just list events for now
      setLoadingPayments(false);
    }).catch(() => setLoadingPayments(false));
  }, []);

  function set(field, val) {
    setForm(f => {
      const next = { ...f, [field]: val };
      if (field === 'community' || field === 'eventType') {
        const auto = slugify(`${next.community}-${next.eventType}-${new Date().getFullYear()}`);
        setSlugSuggestion(auto);
        if (!f.slug) next.slug = auto;
      }
      return next;
    });
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.paymentId) { setError('Enter your Payment / Order ID.'); return; }
    if (!form.community) { setError('Select your community.'); return; }
    if (!form.eventType) { setError('Select event type.'); return; }
    if (!form.slug)      { setError('Enter an invitation URL slug.'); return; }

    setLoading(true);
    setError('');
    try {
      const res = await api.events.create({
        paymentId: form.paymentId.trim(),
        community: form.community,
        eventType: form.eventType,
        slug: slugify(form.slug),
      });
      toast('Event created!', 'success');
      if (outletCtx.setEvents) {
        outletCtx.setEvents(prev => [res.event, ...prev]);
        outletCtx.setActiveEvent?.(res.event);
      }
      navigate(`/events/${res.event.id}/generate`);
    } catch (err) {
      setError(err.message || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="onboarding-page page-fade">
      <div className="onboarding-card">
        <div className="onboarding-header">
          <div className="onboarding-step">Step 1 of 2</div>
          <h1 className="page-title">Set Up Your Event</h1>
          <p className="page-subtitle">Link your purchase and create your event to start building your invitation.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Community / Religion</label>
              <select className="form-select" value={form.community} onChange={e => set('community', e.target.value)} autoFocus>
                <option value="">Select...</option>
                {COMMUNITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Event Type</label>
              <select className="form-select" value={form.eventType} onChange={e => set('eventType', e.target.value)}>
                {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Invitation URL Slug</label>
            <div className="slug-input-wrap">
              <span className="slug-prefix">aamantran.co/i/</span>
              <input
                className="form-input slug-input"
                placeholder={slugSuggestion || 'e.g. priya-arjun-2026'}
                value={form.slug}
                onChange={e => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
              />
            </div>
            <div className="form-hint">This will be your invitation link. Only lowercase letters, numbers, and hyphens.</div>
          </div>

          <div className="form-group">
            <label className="form-label">Order Activation Code</label>
            <input
              className="form-input"
              placeholder="e.g. pay_PNnvGxxxxxxxx"
              value={form.paymentId}
              onChange={e => set('paymentId', e.target.value)}
            />
            <div className="form-hint">Find this in your purchase confirmation email or Razorpay receipt.</div>
          </div>

          {error && <div className="onboarding-error">{error}</div>}

          <button type="submit" className="btn btn-primary onboarding-btn" disabled={loading}>
            {loading ? <span className="btn-spinner" /> : null}
            Create Event & Start Building →
          </button>
        </form>
      </div>
    </div>
  );
}
