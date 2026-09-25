import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Rocket, Share2, Users, ClipboardList, Wallet, Camera, UserCog,
  ChevronDown, Search, MessageCircle, SearchX,
} from '../components/ui/icons';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import './Guide.css';

/*
 * Written for couples using Aamantran for the first time. Every answer
 * describes what the dashboard really does today — keep it that way when a
 * feature changes. Item ids are link targets: an "i" help's "Learn more"
 * points to /guide#<id>.
 */
const SECTIONS = [
  {
    id: 'getting-started',
    title: 'Making your invitation',
    icon: Rocket,
    items: [
      {
        id: 'start',
        title: 'Where do I start?',
        body: 'Your invitation is created as soon as you buy a design. Open Home and press “Continue building”. The builder walks you through a few short steps and saves as you move between them. Most couples finish in about 10 minutes.',
      },
      {
        id: 'names',
        title: 'Names — and why they lock',
        body: 'Type each name exactly as it should appear on your invitation. Choose “Groom” or “Bride” for each of you so wording like “Son of” and “Daughter of” comes out right. Once you continue, the couple’s names are locked so a mistake can’t slip onto a shared invitation — please check the spelling. Need a change later? Message us from Support.',
      },
      {
        id: 'ceremonies',
        title: 'Ceremonies and venues',
        body: 'Add every event guests are invited to — Haldi, Mehendi, Sangeet, Wedding, Reception… Give each a date, a start time and a venue. To add a venue, pick “+ Add a new venue” from the venue list inside the ceremony.',
      },
      {
        id: 'selected-ceremonies',
        title: 'Some guests are only invited to a few ceremonies',
        body: 'Turn on “Some guests are only invited to a few ceremonies” in the Ceremonies step, then tick the ceremonies those guests should see. You get a second link that shows only those ceremonies. Send your main link to everyone else.',
      },
      {
        id: 'photos-music',
        title: 'Photos, music and special details',
        body: 'Each design has its own places for photos and music — the builder shows how many photos fit and which shape looks best. Some designs also ask for special details, like a story or a hashtag. These are all optional.',
      },
      {
        id: 'guest-features',
        title: 'Guest features',
        body: 'Choose what guests can do on your invitation: reply to say if they’re coming, and leave you a wish. Designs that don’t use a feature don’t show it.',
      },
      {
        id: 'your-link',
        title: 'Personalise your link',
        body: 'In “Preview & go live” you can change your invitation link to something personal, like …/i/jasleen-prabhjeet. You can do the same for the link for selected ceremonies. We check straight away whether the link is free. Only letters, numbers and dashes are used.',
      },
      {
        id: 'go-live',
        title: 'Going live — and editing afterwards',
        body: 'Press “Go live” when the checklist looks good. Your link starts working for guests straight away. You can keep editing: changes you save show to guests immediately. Editing a live invitation opens an overview — press Edit on the part you want to change.',
      },
      {
        id: 'offline',
        title: 'Taking your invitation offline',
        body: 'At the bottom of “Preview & go live” there’s “Take invitation offline”. Guests who open either of your links will see a “not available” page. You can put it back online anytime.',
      },
    ],
  },
  {
    id: 'sharing',
    title: 'Sharing',
    icon: Share2,
    items: [
      {
        id: 'share',
        title: 'Sending your invitation on WhatsApp',
        body: 'Open Share. A message with your names, date and link is written for you — edit it however you like. On a phone, “Share” opens your phone’s share menu so you can pick WhatsApp; on a computer, “Open WhatsApp” opens WhatsApp Web. You can also add a photo to send with the message.',
      },
      {
        id: 'qr',
        title: 'QR code for printed cards',
        body: 'Share and “Preview & go live” both have a QR code of your link. Download it and add it to printed cards — guests scan it with their phone camera to open your invitation.',
      },
    ],
  },
  {
    id: 'guests',
    title: 'Guests and wishes',
    icon: Users,
    items: [
      {
        id: 'guests',
        title: 'Where do guests come from?',
        body: 'You don’t need to type anyone in. When a guest opens your invitation and enters their name, or replies, they appear in Guests automatically. Each ceremony shows who’s coming, who isn’t, and who hasn’t replied yet. Press “Download list” to open it in Excel or Google Sheets.',
      },
      {
        id: 'wishes',
        title: 'Choosing which wishes guests can see',
        body: 'Wishes guests leave show on your invitation straight away. In Wishes, press “Hide from guests” on any you’d rather keep private — you’ll still see it. “Delete” removes a wish for good.',
      },
    ],
  },
  {
    id: 'planning',
    title: 'Planning',
    icon: ClipboardList,
    items: [
      {
        id: 'tasks',
        title: 'Tasks',
        body: 'A to-do list for the big day. Give each task a date and who’s doing it. Press Start when you begin and “Mark done” when it’s finished. Tasks due today or overdue are flagged at the top.',
      },
      {
        id: 'timeline',
        title: 'Day-of timeline',
        body: 'Plan each ceremony hour by hour — guests arrive, rituals, dinner. Moments sort themselves by time. Only you see the timeline; guests don’t.',
      },
      {
        id: 'vendors',
        title: 'Vendors',
        body: 'Keep your photographer, caterer, decorator and others in one place, with their number, price and what you’ve paid. Call or email them straight from their card.',
      },
    ],
  },
  {
    id: 'money',
    title: 'Money and items',
    icon: Wallet,
    items: [
      {
        id: 'budget',
        title: 'Budget',
        body: 'Set your total budget, then add each expense as you book it. You’ll see what’s booked, what’s paid, what’s still to pay and what’s left. Press “Mark paid” when you pay a bill.',
      },
      {
        id: 'inventory',
        title: 'Inventory',
        body: 'List the things you need — outfits, jewellery, décor, documents — and move each along from To buy to At venue. Add a reminder date and you’ll get a nudge at the top of the page.',
      },
      {
        id: 'gifts',
        title: 'Gifts',
        body: 'Note who gave what as gifts arrive, and tick off each thank-you as you send it.',
      },
    ],
  },
  {
    id: 'memories',
    title: 'Memories',
    icon: Camera,
    items: [
      {
        id: 'moodboard',
        title: 'Mood board',
        body: 'Collect ideas for colours, outfits and décor. Add pictures from your phone or a link, or add a Pinterest board. Only you can see it.',
      },
      {
        id: 'photos',
        title: 'Photo wall',
        body: 'Your private album. Add photos and file them by category — Ceremony, Family, Couple… Guests can’t see it.',
      },
    ],
  },
  {
    id: 'account',
    title: 'Your account',
    icon: UserCog,
    items: [
      {
        id: 'several',
        title: 'More than one invitation',
        body: 'Bought another design, for example for an engagement? Switch between your invitations from the list at the top of the menu. Each one has its own guests, planning and link.',
      },
      {
        id: 'online-until',
        title: 'How long does my invitation stay online?',
        body: 'Until 6 months after your last ceremony. You can see the date in Settings. Need longer? Message us.',
      },
      {
        id: 'settings',
        title: 'Settings',
        body: 'See your username and email, add a contact number, and delete your account if you ever want to.',
      },
      {
        id: 'support',
        title: 'Getting help',
        body: 'Open Support and press “Message us”. A real person replies, usually within a day — you’ll see the reply in Support and get an email.',
      },
    ],
  },
];

const norm = (t) => t.toLowerCase().replace(/[’']/g, '');

export default function Guide() {
  const { hash } = useLocation();
  const target = hash.replace('#', '');
  const targetSection = SECTIONS.find(sec => sec.id === target || sec.items.some(it => it.id === target));
  const [openIds, setOpenIds] = useState(() => new Set([targetSection?.id || 'getting-started']));
  const [query, setQuery] = useState('');

  // "Learn more" from an "i" help lands on its answer, opened and in view.
  useEffect(() => {
    if (!target) return;
    const el = document.getElementById(target);
    if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [target]);

  const q = norm(query.trim());
  const results = useMemo(() => {
    if (!q) return SECTIONS;
    return SECTIONS
      .map(sec => ({ ...sec, items: sec.items.filter(it => norm(`${it.title} ${it.body}`).includes(q)) }))
      .filter(sec => sec.items.length > 0);
  }, [q]);

  function toggle(id) {
    setOpenIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="page-fade guide-page">
      <PageHeader
        title="Help guide"
        subtitle="Short answers about everything in your dashboard."
      />

      <div className="search-field guide-search">
        <Search size={16} aria-hidden="true" className="search-field-icon" />
        <input
          className="form-input"
          type="search"
          placeholder="Search, e.g. “link” or “wishes”"
          aria-label="Search the help guide"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      {results.length === 0 ? (
        <EmptyState
          icon={SearchX}
          tone="sky"
          title="No answers match"
          action={<Link to="/support" className="btn btn-primary"><MessageCircle size={18} aria-hidden="true" /> Message us</Link>}
        >
          Try another word — or ask us directly.
        </EmptyState>
      ) : (
        <div className="guide-grid">
          {results.map(sec => {
            const open = q ? true : openIds.has(sec.id);
            const Icon = sec.icon;
            const bodyId = `guide-body-${sec.id}`;
            return (
              <section key={sec.id} id={sec.id} className={`guide-section ${open ? 'open' : ''}`}>
                <h2 className="guide-section-h">
                  <button
                    type="button"
                    className="guide-section-head"
                    aria-expanded={open}
                    aria-controls={bodyId}
                    onClick={() => toggle(sec.id)}
                    disabled={!!q}
                  >
                    <span className="guide-section-icon" aria-hidden="true"><Icon size={20} /></span>
                    <span className="guide-section-title">{sec.title}</span>
                    {!q && <ChevronDown size={20} aria-hidden="true" className="guide-section-chevron" />}
                  </button>
                </h2>
                {open && (
                  <div className="guide-section-body" id={bodyId}>
                    {sec.items.map(it => (
                      <div key={it.id} id={it.id} className={`guide-item ${target === it.id ? 'is-target' : ''}`}>
                        <h3 className="guide-item-title">{it.title}</h3>
                        <p className="guide-item-body">{it.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <div className="guide-cta-card">
        <div className="guide-cta-title">Still need help?</div>
        <p className="guide-cta-body">Message us — a real person replies, usually within a day.</p>
        <Link to="/support" className="btn btn-primary"><MessageCircle size={18} aria-hidden="true" /> Message us</Link>
      </div>
    </div>
  );
}
