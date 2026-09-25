import { useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { eventTitle } from '../lib/event';
import { Star, ImagePlus, Trash2, PartyPopper } from 'lucide-react';
import './Review.css';

const RATING_WORDS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

export default function Review() {
  const toast = useToast();
  const { activeEvent } = useOutletContext() || {};
  const [form, setForm] = useState({ rating: 0, reviewText: '', coupleNames: '', location: '' });
  const [hover, setHover] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const fileInputRef = useRef(null);

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  }

  function removePhoto() {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!activeEvent?.template?.id) { toast('We couldn’t find the design for this invitation. Message us from Support.', 'error'); return; }
    if (!form.rating) { toast('Choose how many stars first.', 'error'); return; }
    setSubmitting(true);
    try {
      let payload;
      if (photoFile) {
        // Send as multipart so the photo gets to the server
        const fd = new FormData();
        fd.append('templateId', activeEvent.template.id);
        fd.append('rating', String(form.rating));
        if (form.reviewText) fd.append('reviewText', form.reviewText);
        if (form.coupleNames) fd.append('coupleNames', form.coupleNames);
        if (form.location) fd.append('location', form.location);
        fd.append('couplePhoto', photoFile);
        payload = fd;
      } else {
        payload = {
          templateId: activeEvent.template.id,
          rating: form.rating,
          reviewText: form.reviewText,
          coupleNames: form.coupleNames,
          location: form.location,
        };
      }
      await api.review.submit(payload);
      setSubmitted(true);
      toast('Thank you for your review! 🎉', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="page-fade">
        <div className="review-submitted" role="status">
          <div className="review-submitted-icon" aria-hidden="true"><PartyPopper size={40} /></div>
          <h2>Thank you for your review!</h2>
          <p>It helps other couples choose their design.</p>
        </div>
      </div>
    );
  }

  const shown = hover || form.rating;

  return (
    <div className="page-fade">
      <PageHeader
        title="Leave a review"
        subtitle="Tell other couples what you thought of your design."
      />

      {!activeEvent ? (
        <div className="card">
          <EmptyState icon={Star} tone="lemon" title="Nothing to review yet">
            Once you have an invitation, you can review its design here.
          </EmptyState>
        </div>
      ) : (
        <div className="card review-card">
          <div className="review-template-info">
            <div className="review-template-label">Your design</div>
            <div className="review-template-name">{activeEvent.template?.name || eventTitle(activeEvent)}</div>
          </div>

          <form onSubmit={handleSubmit}>
            <fieldset className="form-group review-stars">
              <legend className="form-label">How many stars?</legend>
              <div className="star-row" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={form.rating === n}
                    aria-label={`${n} star${n > 1 ? 's' : ''} — ${RATING_WORDS[n]}`}
                    className={`star-btn ${n <= shown ? 'active' : ''}`}
                    onMouseEnter={() => setHover(n)}
                    onFocus={() => setHover(n)}
                    onBlur={() => setHover(0)}
                    onClick={() => setForm(f => ({ ...f, rating: n }))}
                  >
                    <Star size={30} aria-hidden="true" fill={n <= shown ? 'currentColor' : 'none'} />
                  </button>
                ))}
                {shown > 0 && <span className="rating-label" aria-hidden="true">{RATING_WORDS[shown]}</span>}
              </div>
            </fieldset>

            <div className="form-group">
              <label className="form-label" htmlFor="rev-text">What did you think? <span className="form-optional">(optional)</span></label>
              <textarea id="rev-text" className="form-textarea" rows={4}
                placeholder="What you loved, what guests said…"
                value={form.reviewText}
                onChange={e => setForm(f => ({ ...f, reviewText: e.target.value }))}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="rev-names">Your names <span className="form-optional">(optional)</span></label>
                <input id="rev-names" className="form-input" placeholder="Priya & Arjun"
                  value={form.coupleNames} onChange={e => setForm(f => ({ ...f, coupleNames: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="rev-city">Your city <span className="form-optional">(optional)</span></label>
                <input id="rev-city" className="form-input" placeholder="Mumbai"
                  value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 8 }}>
              <span className="form-label">A photo of you with your invitation <span className="form-optional">(optional)</span></span>
              <p className="form-hint" style={{ marginBottom: 10 }}>
                Hold your phone showing the invitation and take a photo together. We may show it on our website. JPG, PNG or WebP, up to 5 MB.
              </p>

              {photoPreview ? (
                <div className="review-photo">
                  <img src={photoPreview} alt="Your photo" className="review-photo-img" />
                  <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={removePhoto}>
                    <Trash2 size={15} aria-hidden="true" /> Remove photo
                  </button>
                </div>
              ) : (
                <label className="review-upload">
                  <ImagePlus size={24} aria-hidden="true" />
                  <span>Add a photo</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    className="sr-only"
                    onChange={handlePhotoChange}
                  />
                </label>
              )}
            </div>

            <button type="submit" className="btn btn-primary" disabled={submitting || !form.rating}>
              {submitting ? <span className="btn-spinner" aria-hidden="true" /> : null}
              Send review
            </button>
            {!form.rating && <div className="form-hint" style={{ marginTop: 6 }}>Choose your stars to send.</div>}
          </form>
        </div>
      )}
    </div>
  );
}
