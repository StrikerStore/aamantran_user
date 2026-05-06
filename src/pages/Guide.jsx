import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import './Guide.css';

const SECTIONS = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: '🚀',
    items: [
      {
        title: 'Set up your event',
        body: 'Create your first event from the Login → Onboarding flow. Pick the community, event type, and add the people whose names will appear on the invitation. You can have multiple events at once and switch between them anytime.',
      },
      {
        title: 'Confirm names (Freeze)',
        body: 'Before publishing, you must confirm (freeze) the names of the people on the invitation. Once frozen, the names appear permanently on the dashboard and the printed/digital invitation. Frozen names cannot be edited without re-opening the freeze.',
      },
      {
        title: 'Build & publish',
        body: 'Open Invite → Build to lay out your invitation pages. Pick a template, customise the cover, add ceremony details and gallery. When ready, publish to lock in a shareable URL.',
      },
    ],
  },
  {
    id: 'invitation',
    title: 'Invitation',
    icon: '💌',
    items: [
      {
        title: 'Edit pages',
        body: 'After publishing, use Edit Invitation to tweak content — wording, images, gallery, ceremony cards. Changes go live immediately to anyone holding your invitation link.',
      },
      {
        title: 'Guests',
        body: 'Manage your guest list, group guests by family, and track who has been sent the invitation. Each guest gets a unique RSVP link tied to their identity.',
      },
      {
        title: 'Wishes',
        body: 'Guests can leave wishes/blessings on your invitation page. Read, approve, and feature them on a public wishes wall.',
      },
      {
        title: 'Share',
        body: 'Tap Share from the bottom nav or dashboard to send the invitation link via WhatsApp. Personalised messages are pre-filled with each guest’s name.',
      },
    ],
  },
  {
    id: 'planning',
    title: 'Planning',
    icon: '📋',
    items: [
      {
        title: 'Tasks',
        body: 'A wedding to-do list. Add tasks with due dates, mark them done, and group them by category (catering, decor, attire, etc.).',
      },
      {
        title: 'Vendors',
        body: 'Track all your vendors in one place — caterer, decorator, photographer. Save contact info, contracts, and deposit/payment status.',
      },
      {
        title: 'Timeline',
        body: 'A day-by-day timeline of ceremonies and events. Useful for sharing with family and vendors so everyone knows the schedule.',
      },
    ],
  },
  {
    id: 'finance',
    title: 'Finance & Inventory',
    icon: '💰',
    items: [
      {
        title: 'Inventory',
        body: 'Track items needed for the wedding — clothing, jewelry, decor pieces, return gifts. Add quantities, sources, and statuses (planned, purchased, received).',
      },
      {
        title: 'Budget',
        body: 'Set a total budget and break it down by category. Log expenses as they happen to see how much is committed vs. remaining.',
      },
      {
        title: 'Gifts',
        body: 'A registry/tracker for gifts received. Note who gave what so you can write thank-you notes after the wedding.',
      },
    ],
  },
  {
    id: 'memories',
    title: 'Memories',
    icon: '💝',
    items: [
      {
        title: 'Mood Board',
        body: 'Pin photos, colors, and inspiration to a single board. Share with family and vendors to align on the look-and-feel.',
      },
      {
        title: 'Photo Wall',
        body: 'After the wedding, guests can upload photos. Build a shared album that grows in real time during the celebration.',
      },
    ],
  },
  {
    id: 'account',
    title: 'Account',
    icon: '⚙️',
    items: [
      {
        title: 'Settings',
        body: 'Update your contact info, change password, and view your event’s expiry date.',
      },
      {
        title: 'Support',
        body: 'Reach out to the Aamantran team for help. We respond within one business day.',
      },
      {
        title: 'Review',
        body: 'Tell us how we’re doing — your feedback shapes what we build next.',
      },
    ],
  },
];

export default function Guide() {
  const { activeEvent } = useOutletContext() || {};
  const [openId, setOpenId] = useState('getting-started');

  return (
    <div className="page-fade guide-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Feature Guide</h1>
          <p className="page-subtitle">Learn what every feature does and how to use it.</p>
        </div>
      </div>

      <div className="guide-grid">
        {SECTIONS.map(sec => (
          <div key={sec.id} className={`guide-section ${openId === sec.id ? 'open' : ''}`}>
            <button
              type="button"
              className="guide-section-head"
              onClick={() => setOpenId(openId === sec.id ? null : sec.id)}
            >
              <span className="guide-section-icon">{sec.icon}</span>
              <span className="guide-section-title">{sec.title}</span>
              <span className="guide-section-chevron">{openId === sec.id ? '−' : '+'}</span>
            </button>
            {openId === sec.id && (
              <div className="guide-section-body">
                {sec.items.map(it => (
                  <div key={it.title} className="guide-item">
                    <div className="guide-item-title">{it.title}</div>
                    <div className="guide-item-body">{it.body}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="guide-cta-card">
        <div className="guide-cta-title">Still stuck?</div>
        <p className="guide-cta-body">Our team is happy to walk you through any feature in person.</p>
        <Link to="/support" className="btn btn-primary">Contact Support</Link>
      </div>
    </div>
  );
}
