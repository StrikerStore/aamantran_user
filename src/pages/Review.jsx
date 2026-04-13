import { useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import './Review.css';

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
    if (!activeEvent?.template?.id) { toast('No template associated with this event', 'error'); return; }
    if (!form.rating) { toast('Please select a rating', 'error'); return; }
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
      toast('Review submitted! Thank you 🎉', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="page-fade">
        <div className="review-submitted">
          <div className="review-submitted-icon">🎉</div>
          <h2>Thank you for your review!</h2>
          <p>Your feedback helps other couples find the perfect template.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-fade">
      <div className="page-header">
        <div>
          <h1 className="page-title">Leave a Review</h1>
          <p className="page-subtitle">Share your experience with the template</p>
        </div>
      </div>

      {!activeEvent ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">⭐</div>
            <div className="empty-title">No event selected</div>
            <div className="empty-desc">Select an event from the sidebar to leave a review.</div>
          </div>
        </div>
      ) : (
        <div className="card review-card">
          <div className="review-template-info">
            <div className="review-template-label">Reviewing</div>
            <div className="review-template-name">{activeEvent.template?.name || 'Your Template'}</div>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Star rating */}
            <div className="form-group">
              <label className="form-label">Your Rating</label>
              <div className="star-row">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    className={`star-btn ${n <= (hover || form.rating) ? 'active' : ''}`}
                    onMouseEnter={() => setHover(n)}
                    onMouseLeave={() => setHover(0)}
                    onClick={() => setForm(f => ({ ...f, rating: n }))}
                  >
                    ★
                  </button>
                ))}
                {form.rating > 0 && (
                  <span className="rating-label">
                    {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][form.rating]}
                  </span>
                )}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Couple Names (optional)</label>
                <input className="form-input" placeholder="Priya & Arjun"
                  value={form.coupleNames} onChange={e => setForm(f => ({ ...f, coupleNames: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Location (optional)</label>
                <input className="form-input" placeholder="Mumbai, India"
                  value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Review</label>
              <textarea className="form-textarea" rows={4}
                placeholder="Share your experience with this template — what you loved, what you used it for..."
                value={form.reviewText}
                onChange={e => setForm(f => ({ ...f, reviewText: e.target.value }))}
              />
            </div>

            {/* Couple photo upload — optional */}
            <div className="form-group" style={{ marginTop: 8 }}>
              <label className="form-label">
                📸 Couple Photo with Invite in Hand
                <span className="form-hint-inline" style={{ marginLeft: 6 }}>(optional)</span>
              </label>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.5 }}>
                Upload a photo of you holding the invite on your device — it'll appear on our website as a real-couple card flip! Max 5 MB.
              </p>

              {photoPreview ? (
                <div style={{ position: 'relative', display: 'inline-block', marginBottom: 12 }}>
                  <img
                    src={photoPreview}
                    alt="Preview"
                    style={{ width: 180, height: 180, objectFit: 'cover', borderRadius: 12, border: '2px solid var(--border-subtle)' }}
                  />
                  <button
                    type="button"
                    onClick={removePhoto}
                    style={{
                      position: 'absolute', top: -8, right: -8,
                      background: 'var(--red, #c0392b)', color: '#fff',
                      border: 'none', borderRadius: '50%', width: 24, height: 24,
                      cursor: 'pointer', fontSize: '0.75rem', lineHeight: '24px', textAlign: 'center',
                    }}
                    title="Remove photo"
                  >✕</button>
                </div>
              ) : (
                <label
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    border: '2px dashed var(--border-subtle)', borderRadius: 10,
                    padding: '14px 18px', cursor: 'pointer',
                    background: 'var(--bg-elevated)', color: 'var(--text-secondary)',
                    fontSize: '0.85rem', transition: 'border-color 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
                >
                  <span style={{ fontSize: '1.4rem' }}>🖼️</span>
                  <span>Click to upload a photo (JPG, PNG, WebP — max 5 MB)</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    style={{ display: 'none' }}
                    onChange={handlePhotoChange}
                  />
                </label>
              )}
            </div>

            <button type="submit" className="btn btn-primary" disabled={submitting || !form.rating}>
              {submitting ? <span className="btn-spinner" /> : '⭐'}
              Submit Review
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
