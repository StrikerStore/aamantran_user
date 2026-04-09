import { useState } from 'react';
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

  async function handleSubmit(e) {
    e.preventDefault();
    if (!activeEvent?.template?.id) { toast('No template associated with this event', 'error'); return; }
    if (!form.rating) { toast('Please select a rating', 'error'); return; }
    setSubmitting(true);
    try {
      await api.review.submit({
        templateId: activeEvent.template.id,
        rating: form.rating,
        reviewText: form.reviewText,
        coupleNames: form.coupleNames,
        location: form.location,
      });
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
