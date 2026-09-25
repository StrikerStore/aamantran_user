import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Home, Sparkles, PencilLine, Share2, Users, ListChecks, Clock3, Briefcase,
  Wallet, Package, Gift, Palette, Camera, BookOpen, LifeBuoy, Settings as SettingsIcon, Star,
  LogOut, Menu, ChevronDown, ChevronRight, Check, MoreHorizontal, ShoppingBag,
} from 'lucide-react';
import { clearToken, getUserInfo } from '../lib/auth';
import { api } from '../lib/api';
import { WEBSITE_URL } from '../lib/config';
import { eventTitle, eventMeta, liveLabel } from '../lib/event';
import { useToast } from './ui/Toast';
import { Modal } from './ui/Modal';
import './Layout.css';

const NAV_STATE_KEY = 'aam_nav_state';
const SIDEBAR_RAIL_KEY = 'aam_sidebar_rail';
const ACTIVE_EVENT_KEY = 'aam_active_event';

/** Page names for the browser tab and the desktop top bar. */
const PAGE_TITLES = [
  [/^\/dashboard/, 'Home'],
  [/\/generate$/, 'Build your invitation'],
  [/\/edit$/, 'Edit your invitation'],
  [/\/share$/, 'Share'],
  [/\/guests$/, 'Guests'],
  [/\/wishes$/, 'Wishes'],
  [/\/tasks$/, 'Tasks'],
  [/\/timeline$/, 'Day-of timeline'],
  [/\/vendors$/, 'Vendors'],
  [/\/budget$/, 'Budget'],
  [/\/inventory$/, 'Inventory'],
  [/\/gifts$/, 'Gifts'],
  [/\/moodboard$/, 'Mood board'],
  [/\/photos$/, 'Photo wall'],
  [/^\/guide/, 'Guide'],
  [/^\/support/, 'Support'],
  [/^\/settings/, 'Settings'],
  [/^\/review/, 'Leave a review'],
];

function titleFor(path) {
  return PAGE_TITLES.find(([re]) => re.test(path))?.[1] || '';
}

function readStored(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function writeStored(key, value) {
  try { localStorage.setItem(key, value); } catch { /* private mode */ }
}

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const info = getUserInfo();
  const [railCollapsed, setRailCollapsed] = useState(() => readStored(SIDEBAR_RAIL_KEY, '0') === '1');
  const [events, setEvents] = useState([]);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  // The invitation picked last (remembered across refreshes).
  const [chosenId, setChosenId] = useState(() => readStored(ACTIVE_EVENT_KEY, ''));
  const [switcherOpen, setSwitcherOpen] = useState(false);
  // Phone sheets: 'more' = planning, money & memories; 'profile' = account and help
  const [sheet, setSheet] = useState(null);
  const [switchSheet, setSwitchSheet] = useState(false);   // phone: invitation switcher as a bottom sheet
  // Phone: the top bar slides away while scrolling down and returns on scroll up.
  // Remembered per page, so it is always shown again after moving to another page.
  const [hiddenOnPath, setHiddenOnPath] = useState(null);
  // Phone: while typing, the bottom bar steps aside so the keyboard has room.
  const [typing, setTyping] = useState(false);
  const switcherRef = useRef(null);

  const [collapsed, setCollapsed] = useState(() => {
    try { return JSON.parse(readStored(NAV_STATE_KEY, '{}')); } catch { return {}; }
  });

  function toggleGroup(section) {
    setCollapsed((prev) => {
      const next = { ...prev, [section]: !prev[section] };
      writeStored(NAV_STATE_KEY, JSON.stringify(next));
      return next;
    });
  }

  function toggleRail() {
    setRailCollapsed((c) => {
      writeStored(SIDEBAR_RAIL_KEY, c ? '0' : '1');
      return !c;
    });
  }

  // The event in the address wins; otherwise the one chosen last time; otherwise the newest.
  const routeEventId = (location.pathname.match(/^\/events\/([^/]+)/) || [])[1] || null;
  const mainEvents = useMemo(() => events.filter((ev) => ev.inviteScope !== 'subset'), [events]);
  const activeEvent = useMemo(
    () => mainEvents.find((ev) => ev.id === routeEventId)
      || mainEvents.find((ev) => ev.id === chosenId)
      || mainEvents[0]
      || null,
    [mainEvents, routeEventId, chosenId],
  );

  const setActiveEvent = useCallback((ev) => {
    if (!ev?.id) return;
    setChosenId(ev.id);
    writeStored(ACTIVE_EVENT_KEY, ev.id);
  }, []);

  useEffect(() => {
    api.events.list()
      .then((r) => setEvents(r.events || []))
      .catch(() => {})
      .finally(() => setEventsLoaded(true));
  }, []);

  /** Reload the invitations (after publishing, for example, so the menu says "Edit"). */
  function refreshEvents() {
    return api.events.list().then((r) => setEvents(r.events || [])).catch(() => {});
  }

  useEffect(() => {
    function handler(e) {
      if (switcherRef.current && !switcherRef.current.contains(e.target)) setSwitcherOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Phone: top bar quick-return ──
  // One passive, frame-throttled listener. Small jitters (< 12px) are ignored so
  // the bar never flickers; near the top of the page it is always shown.
  const pathRef = useRef(location.pathname);
  const hiddenRef = useRef(null);
  useEffect(() => { pathRef.current = location.pathname; }, [location.pathname]);
  useEffect(() => { hiddenRef.current = hiddenOnPath; }, [hiddenOnPath]);
  useEffect(() => {
    const phone = window.matchMedia('(max-width: 900px)');
    let lastY = window.scrollY;
    let raf = 0;
    const set = (hide) => {
      const isHidden = hiddenRef.current === pathRef.current;
      if (hide === isHidden) return;
      hiddenRef.current = hide ? pathRef.current : null;
      setHiddenOnPath(hiddenRef.current);
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY;
        if (!phone.matches || y < 56) { set(false); lastY = y; return; }
        const delta = y - lastY;
        if (Math.abs(delta) < 12) return;
        set(delta > 0);
        lastY = y;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);

  // ── Phone: hide the bottom bar while the keyboard is up ──
  useEffect(() => {
    const TEXT_LIKE = /^(text|search|email|tel|url|number|password|date|time|datetime-local|month|week)$/;
    const isField = (el) => Boolean(el) && (
      el.tagName === 'TEXTAREA' || el.isContentEditable
      || (el.tagName === 'INPUT' && TEXT_LIKE.test(el.type || 'text'))
    );
    let timer = 0;
    const onIn = (e) => { if (isField(e.target)) { clearTimeout(timer); setTyping(true); } };
    // Wait a moment: focus often moves straight to the next field.
    const onOut = () => { clearTimeout(timer); timer = setTimeout(() => setTyping(isField(document.activeElement)), 100); };
    document.addEventListener('focusin', onIn);
    document.addEventListener('focusout', onOut);
    return () => { clearTimeout(timer); document.removeEventListener('focusin', onIn); document.removeEventListener('focusout', onOut); };
  }, []);

  // Browser tab names the page ("Guests · Aamantran").
  const pageTitle = titleFor(location.pathname);
  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} · Aamantran` : 'Aamantran';
  }, [pageTitle]);

  function handleLogout() {
    clearToken();
    navigate('/');
  }

  /** Switch event and stay on the same kind of page for the new one. */
  function selectEvent(ev) {
    setSwitcherOpen(false);
    setSwitchSheet(false);
    setActiveEvent(ev);
    const m = location.pathname.match(/^\/events\/[^/]+\/([^/]+)/);
    if (m) {
      let sub = m[1];
      if (sub === 'generate' || sub === 'edit') sub = ev.isPublished ? 'edit' : 'generate';
      if (sub === 'share' && !ev.isPublished) sub = 'generate';
      navigate(`/events/${ev.id}/${sub}`);
    }
  }

  const initial = (info?.username?.[0] || 'U').toUpperCase();
  const username = info?.username || 'You';
  const published = activeEvent?.isPublished ?? false;
  const eid = activeEvent?.id;

  function ePath(sub) { return eid ? `/events/${eid}/${sub}` : '#'; }
  const buildPath = ePath(published ? 'edit' : 'generate');

  const NAV = [
    {
      section: 'Invitation',
      items: [
        { label: 'Home', to: '/dashboard', icon: Home },
        published
          ? { label: 'Edit invitation', icon: PencilLine, to: buildPath, needsEvent: true }
          : { label: 'Build invitation', icon: Sparkles, to: buildPath, needsEvent: true },
        { label: 'Share', icon: Share2, to: ePath('share'), needsEvent: true, needsLive: true },
        { label: 'Guests & wishes', icon: Users, to: ePath('guests'), needsEvent: true },
      ],
    },
    {
      section: 'Planning',
      items: [
        { label: 'Tasks', icon: ListChecks, to: ePath('tasks'), needsEvent: true },
        { label: 'Day-of timeline', icon: Clock3, to: ePath('timeline'), needsEvent: true },
        { label: 'Vendors', icon: Briefcase, to: ePath('vendors'), needsEvent: true },
      ],
    },
    {
      section: 'Money & items',
      items: [
        { label: 'Budget', icon: Wallet, to: ePath('budget'), needsEvent: true },
        { label: 'Inventory', icon: Package, to: ePath('inventory'), needsEvent: true },
        { label: 'Gifts', icon: Gift, to: ePath('gifts'), needsEvent: true },
      ],
    },
    {
      section: 'Memories',
      items: [
        { label: 'Mood board', icon: Palette, to: ePath('moodboard'), needsEvent: true },
        { label: 'Photo wall', icon: Camera, to: ePath('photos'), needsEvent: true },
      ],
    },
    {
      section: 'Help & account',
      items: [
        { label: 'Guide', to: '/guide', icon: BookOpen },
        { label: 'Support', to: '/support', icon: LifeBuoy },
        { label: 'Settings', to: '/settings', icon: SettingsIcon },
        { label: 'Leave a review', to: '/review', icon: Star },
      ],
    },
  ];

  /** Why a menu item can't be opened yet, or null if it can. */
  function blockedReason(item) {
    if (item.needsEvent && !eid) return 'You don’t have an invitation yet';
    if (item.needsLive && !published) return 'Publish your invitation first — then you can share it';
    return null;
  }

  const path = location.pathname;
  const bottomActive = {
    home: path === '/dashboard',
    invite: /\/(generate|edit)$/.test(path),
    guests: /\/(guests|wishes)$/.test(path),
    more: !/^\/dashboard/.test(path) && !/\/(generate|edit|guests|wishes|share)$/.test(path) && !/^\/(guide|support|settings|review)/.test(path),
  };

  function renderEventList(onPick) {
    return (
      <>
        {mainEvents.map((ev) => (
          <button
            type="button"
            key={ev.id}
            className={`event-option ${activeEvent?.id === ev.id ? 'active' : ''}`}
            onClick={() => onPick(ev)}
          >
            <div className="event-option-text">
              <div className="event-option-name">{eventTitle(ev)}</div>
              <div className="event-option-sub">
                <span className={`event-dot ${ev.isPublished ? 'is-live' : ''}`} aria-hidden="true" />
                {liveLabel(ev)}{eventMeta(ev) ? ` · ${eventMeta(ev)}` : ''}
              </div>
            </div>
            {activeEvent?.id === ev.id && <Check size={16} className="event-option-check" aria-label="Selected" />}
          </button>
        ))}
        <a className="event-switcher-add" href={`${WEBSITE_URL}/templates`} target="_blank" rel="noreferrer">
          <ShoppingBag size={16} aria-hidden="true" /> Buy another design
        </a>
      </>
    );
  }

  return (
    <div className={`app-shell${railCollapsed ? ' rail' : ''}${hiddenOnPath === location.pathname && !!sheet && !switchSheet ? ' shell-top-hidden' : ''}${typing ? ' shell-typing' : ''}`}>
      {/* Sidebar (desktop) */}
      <aside className="sidebar" aria-label="Main menu">
        <div className="sidebar-logo">
          <div className="sidebar-logo-row">
            <img src="/logo.png" alt="" className="sidebar-logo-img" width="40" height="40" decoding="async" />
            <div className="logotype">Aamantran</div>
          </div>
        </div>

        {/* Event switcher */}
        <div className="sidebar-event-switcher">
          <div className="event-switcher-wrapper" ref={switcherRef}>
            <button
              type="button"
              className="event-switcher-btn"
              onClick={() => setSwitcherOpen((o) => !o)}
              aria-expanded={switcherOpen}
              aria-haspopup="listbox"
              title={railCollapsed ? (activeEvent ? eventTitle(activeEvent) : 'Your invitation') : undefined}
            >
              <span className="event-switcher-avatar" aria-hidden="true">
                {(activeEvent ? eventTitle(activeEvent) : 'A').charAt(0).toUpperCase()}
              </span>
              <span className="event-switcher-text">
                <span className="event-switcher-name">{activeEvent ? eventTitle(activeEvent) : 'No invitation yet'}</span>
                <span className="event-switcher-sub">
                  {activeEvent ? (
                    <>
                      <span className={`event-dot ${published ? 'is-live' : ''}`} aria-hidden="true" />
                      {liveLabel(activeEvent)}
                    </>
                  ) : 'Buy a design to get started'}
                </span>
              </span>
              <ChevronDown size={16} className={`event-switcher-chevron${switcherOpen ? ' open' : ''}`} aria-hidden="true" />
            </button>

            {switcherOpen && (
              <div className="event-switcher-dropdown">
                {mainEvents.length > 0 && <div className="event-switcher-heading">Your invitations</div>}
                {renderEventList(selectEvent)}
              </div>
            )}
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV.map((group) => (
            <div key={group.section} className="nav-group">
              <button
                type="button"
                className="nav-section-label nav-group-toggle"
                onClick={() => toggleGroup(group.section)}
                aria-expanded={!collapsed[group.section]}
              >
                <span className="nav-group-label-text">{group.section}</span>
                <ChevronDown size={14} className={`nav-group-chevron${collapsed[group.section] ? ' closed' : ''}`} aria-hidden="true" />
              </button>
              {(railCollapsed || !collapsed[group.section]) && group.items.map((item) => {
                const reason = blockedReason(item);
                const Icon = item.icon;
                if (reason) {
                  return (
                    <button
                      type="button"
                      key={item.label}
                      className="nav-item disabled"
                      aria-disabled="true"
                      title={reason}
                      onClick={() => toast(reason, 'info')}
                    >
                      <Icon className="nav-icon" aria-hidden="true" />
                      <span>{item.label}</span>
                    </button>
                  );
                }
                return (
                  <NavLink
                    key={item.label}
                    to={item.to}
                    title={railCollapsed ? item.label : undefined}
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  >
                    <Icon className="nav-icon" aria-hidden="true" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar" aria-hidden="true">{initial}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{username}</div>
              <div className="sidebar-user-email">{info?.email || ''}</div>
            </div>
            <button type="button" className="sidebar-logout-btn" onClick={handleLogout} aria-label="Sign out" title="Sign out">
              <LogOut size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="main">
        <header className="topbar">
          <button
            type="button"
            className="sidebar-toggle"
            onClick={toggleRail}
            aria-label={railCollapsed ? 'Show full menu' : 'Show icons only'}
            title={railCollapsed ? 'Show full menu' : 'Show icons only'}
          >
            <Menu size={18} aria-hidden="true" />
          </button>
          {pageTitle && <div className="topbar-title">{pageTitle}</div>}

          <NavLink to="/dashboard" className="topbar-mobile-brand" aria-label="Aamantran home">
            <img src="/logo.png" alt="" className="topbar-logo-img" />
            <span className="topbar-logotype">Aamantran</span>
          </NavLink>

          {/* Phone: which invitation you're looking at */}
          <div className="topbar-mobile-switcher">
            <button
              type="button"
              className="topbar-event-chip"
              onClick={() => setSwitchSheet(true)}
              aria-haspopup="dialog"
              aria-label={`${activeEvent ? eventTitle(activeEvent) : 'No invitation yet'}, ${activeEvent ? liveLabel(activeEvent) : ''}. Switch invitation`}
            >
              <span className={`event-dot ${published ? 'is-live' : ''}`} aria-hidden="true" />
              <span className="topbar-event-name">{activeEvent ? eventTitle(activeEvent) : 'No invitation yet'}</span>
              <ChevronDown size={14} className="topbar-event-chev" aria-hidden="true" />
            </button>
          </div>
          <button type="button" className="topbar-mobile-avatar" onClick={() => setSheet('profile')} aria-label="Your account and help" aria-haspopup="dialog">
            {initial}
          </button>
        </header>

        <main className="page-content" id="main">
          <Outlet context={{ activeEvent, setActiveEvent, events, setEvents, refreshEvents, eventsLoaded }} />
        </main>
      </div>

      {/* Phone: bottom menu — the four places couples use most, plus More */}
      <nav className="bottom-nav" aria-label="Main menu">
        <button
          type="button"
          className={`bottom-nav-item ${bottomActive.home ? 'active' : ''}`}
          aria-current={bottomActive.home ? 'page' : undefined}
          onClick={() => { setSheet(null); navigate('/dashboard'); }}
        >
          <Home className="bnav-icon" aria-hidden="true" />
          <span className="bnav-label">Home</span>
        </button>
        <button
          type="button"
          className={`bottom-nav-item ${bottomActive.invite ? 'active' : ''}${!eid ? ' is-locked' : ''}`}
          aria-current={bottomActive.invite ? 'page' : undefined}
          aria-disabled={!eid || undefined}
          onClick={() => (eid ? navigate(buildPath) : toast('You don’t have an invitation yet', 'info'))}
        >
          {published ? <PencilLine className="bnav-icon" aria-hidden="true" /> : <Sparkles className="bnav-icon" aria-hidden="true" />}
          <span className="bnav-label">Invite</span>
        </button>
        <button
          type="button"
          className={`bottom-nav-item bottom-nav-share ${path.endsWith('/share') ? 'active' : ''}${!eid || !published ? ' is-locked' : ''}`}
          aria-current={path.endsWith('/share') ? 'page' : undefined}
          aria-disabled={!eid || !published || undefined}
          onClick={() => {
            if (!eid) toast('You don’t have an invitation yet', 'info');
            else if (!published) toast('Publish your invitation first — then you can share it', 'info');
            else navigate(`/events/${eid}/share`);
          }}
        >
          <Share2 className="bnav-icon" aria-hidden="true" />
          <span className="bnav-label">Share</span>
        </button>
        <button
          type="button"
          className={`bottom-nav-item ${bottomActive.guests ? 'active' : ''}${!eid ? ' is-locked' : ''}`}
          aria-current={bottomActive.guests ? 'page' : undefined}
          aria-disabled={!eid || undefined}
          onClick={() => (eid ? navigate(ePath('guests')) : toast('You don’t have an invitation yet', 'info'))}
        >
          <Users className="bnav-icon" aria-hidden="true" />
          <span className="bnav-label">Guests</span>
        </button>
        <button
          type="button"
          className={`bottom-nav-item ${bottomActive.more || sheet === 'more' ? 'active' : ''}`}
          onClick={() => setSheet((o) => (o === 'more' ? null : 'more'))}
          aria-expanded={sheet === 'more'}
        >
          <MoreHorizontal className="bnav-icon" aria-hidden="true" />
          <span className="bnav-label">More</span>
        </button>
      </nav>

      {/* Phone: which invitation you're looking at — a bottom sheet */}
      {switchSheet && (
        <Modal title="Your invitations" onClose={() => setSwitchSheet(false)}>
          <div className="switch-sheet">{renderEventList(selectEvent)}</div>
        </Modal>
      )}

      {/* Phone: More (planning, money & items, memories) and Profile (account & help) */}
      {sheet && (
        <>
          <div className="bottom-sheet-overlay" onClick={() => setSheet(null)} />
          <div className="bottom-sheet" role="dialog" aria-modal="true" aria-label={sheet === 'profile' ? 'Your account and help' : 'More'}>
            <div className="bottom-sheet-handle" />
            {sheet === 'profile' && (
              <div className="more-sheet-account">
                <div className="profile-sheet-avatar" aria-hidden="true">{initial}</div>
                <div className="profile-sheet-id">
                  <div className="profile-sheet-name">{username}</div>
                  <div className="profile-sheet-email">{info?.email || ''}</div>
                </div>
              </div>
            )}
            {sheet === 'more' && <div className="bottom-sheet-title">More</div>}
            <div className="bottom-sheet-sections">
              {NAV.filter((sec) => (sheet === 'profile' ? sec.section === 'Help & account' : !['Invitation', 'Help & account'].includes(sec.section))).map((sec) => (
                <div key={sec.section} className="bottom-sheet-section">
                  <div className="bottom-sheet-section-label">{sec.section}</div>
                  <div className="bottom-sheet-section-items">
                    {sec.items.map((item) => {
                      const reason = blockedReason(item);
                      const active = item.to !== '#' && (path === item.to || path.startsWith(`${item.to}/`));
                      const Icon = item.icon;
                      return (
                        <button
                          type="button"
                          key={item.label}
                          className={`bottom-sheet-row ${active ? 'active' : ''}${reason ? ' is-locked' : ''}`}
                          aria-disabled={reason ? true : undefined}
                          onClick={() => {
                            if (reason) { toast(reason, 'info'); return; }
                            setSheet(null);
                            navigate(item.to);
                          }}
                        >
                          <span className="bottom-sheet-row-icon"><Icon size={20} aria-hidden="true" /></span>
                          <span className="bottom-sheet-row-label">{item.label}</span>
                          <ChevronRight size={18} className="bottom-sheet-row-chev" aria-hidden="true" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {sheet === 'profile' && (
                <div className="bottom-sheet-section">
                  <div className="bottom-sheet-section-items">
                    <button type="button" className="bottom-sheet-row profile-sheet-logout" onClick={() => { setSheet(null); handleLogout(); }}>
                      <span className="bottom-sheet-row-icon"><LogOut size={20} aria-hidden="true" /></span>
                      <span className="bottom-sheet-row-label">Sign out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

