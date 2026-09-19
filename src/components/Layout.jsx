import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { clearToken, getUserInfo } from '../lib/auth';
import { api } from '../lib/api';
import './Layout.css';

const NAV_STATE_KEY = 'aam_nav_state';
const SIDEBAR_RAIL_KEY = 'aam_sidebar_rail';
const EVENT_ROUTE_RE = /^\/events\/([^/]+)(?:\/([^/]+))?/;
const EVENT_SECTIONS = new Set([
  'generate',
  'edit',
  'guests',
  'wishes',
  'tasks',
  'inventory',
  'budget',
  'vendors',
  'timeline',
  'moodboard',
  'gifts',
  'photos',
  'share',
]);

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const info = getUserInfo();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(() => localStorage.getItem(SIDEBAR_RAIL_KEY) === '1');
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [mobileSwitcherOpen, setMobileSwitcherOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const switcherRef = useRef(null);
  const mobileSwitcherRef = useRef(null);

  // Collapsible sidebar group state — persisted to localStorage
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(NAV_STATE_KEY) || '{}');
    } catch { return {}; }
  });

  function toggleGroup(section) {
    setCollapsed(prev => {
      const next = { ...prev, [section]: !prev[section] };
      localStorage.setItem(NAV_STATE_KEY, JSON.stringify(next));
      return next;
    });
  }

  // One button, two behaviors: slides the drawer on mobile, collapses to an
  // icon rail on desktop (persisted).
  function handleNavToggle() {
    if (window.matchMedia('(max-width: 900px)').matches) {
      setSidebarOpen(o => !o);
    } else {
      setRailCollapsed(c => {
        const next = !c;
        localStorage.setItem(SIDEBAR_RAIL_KEY, next ? '1' : '0');
        return next;
      });
    }
  }

  useEffect(() => {
    api.events.list()
      .then(r => {
        const all = r.events || [];
        setEvents(all);
        setSelectedEventId(prev => prev || String((all.find(ev => ev.inviteScope !== 'subset') || all[0])?.id || ''));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handler(e) {
      if (switcherRef.current && !switcherRef.current.contains(e.target)) {
        setSwitcherOpen(false);
      }
      if (mobileSwitcherRef.current && !mobileSwitcherRef.current.contains(e.target)) {
        setMobileSwitcherOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleLogout() {
    clearToken();
    navigate('/');
  }

  const eventRouteMatch = location.pathname.match(EVENT_ROUTE_RE);
  const routeEventId = eventRouteMatch ? decodeURIComponent(eventRouteMatch[1]) : '';
  const routeSection = eventRouteMatch ? eventRouteMatch[2] : '';
  const routeEvent = routeEventId ? events.find(ev => String(ev.id) === routeEventId) || null : null;
  const fallbackEvent = events.find(ev => String(ev.id) === selectedEventId)
    || events.find(ev => ev.inviteScope !== 'subset')
    || events[0]
    || null;
  const activeEvent = routeEventId ? routeEvent : fallbackEvent;

  function setActiveEvent(ev) {
    setSelectedEventId(ev?.id ? String(ev.id) : '');
  }

  function selectEvent(ev) {
    setSelectedEventId(String(ev.id));
    setSwitcherOpen(false);
    setMobileSwitcherOpen(false);
    if (routeSection && EVENT_SECTIONS.has(routeSection)) {
      navigate(`/events/${ev.id}/${routeSection}`);
    }
  }

  const initial  = (info?.username?.[0] || 'U').toUpperCase();
  const username = info?.username || 'User';
  const published = activeEvent?.isPublished ?? false;
  const eid = activeEvent?.id;

  function ePath(sub) { return eid ? `/events/${eid}/${sub}` : '#'; }

  const NAV = [
    {
      section: 'Overview',
      items: [{ label: 'Dashboard', to: '/dashboard', icon: IconGrid }],
    },
    {
      section: 'Invitation',
      items: [
        ...(!published
          ? [{ label: 'Build', icon: IconSparkle, to: ePath('generate'), disabled: !eid }]
          : [{ label: 'Edit',  icon: IconEdit,    to: ePath('edit'),     disabled: !eid }]
        ),
        { label: 'Guests', icon: IconUsers,   to: ePath('guests'),  disabled: !eid },
        { label: 'Wishes', icon: IconMessage, to: ePath('wishes'),  disabled: !eid },
      ],
    },
    {
      section: 'Planning',
      items: [
        { label: 'Tasks',     icon: IconCheckSquare, to: ePath('tasks'),     disabled: !eid },
        { label: 'Vendors',   icon: IconBriefcase,   to: ePath('vendors'),   disabled: !eid },
        { label: 'Timeline',  icon: IconClock,       to: ePath('timeline'),  disabled: !eid },
      ],
    },
    {
      section: 'Finance & Inventory',
      items: [
        { label: 'Inventory', icon: IconBox,       to: ePath('inventory'), disabled: !eid },
        { label: 'Budget',    icon: IconDollarSign, to: ePath('budget'),   disabled: !eid },
        { label: 'Gifts',     icon: IconGift,       to: ePath('gifts'),    disabled: !eid },
      ],
    },
    {
      section: 'Memories',
      items: [
        { label: 'Mood Board',  icon: IconHeart,  to: ePath('moodboard'), disabled: !eid },
        { label: 'Photo Wall',  icon: IconCamera, to: ePath('photos'),    disabled: !eid },
      ],
    },
    {
      section: 'Account',
      items: [
        { label: 'Guide',    to: '/guide',    icon: IconBook },
        { label: 'Settings', to: '/settings', icon: IconSettings },
        { label: 'Support',  to: '/support',  icon: IconMail },
        { label: 'Review',   to: '/review',   icon: IconStar },
      ],
    },
  ];

  // Determine which bottom tab is active
  const path = location.pathname;
  const bottomActive = {
    home:   path === '/dashboard',
    invite: eid && (path.includes('/generate') || path.includes('/edit') || path.includes('/guests') || path.includes('/wishes')),
    items:  eid && (path.includes('/inventory')),
    more:   path.includes('/tasks') || path.includes('/vendors') || path.includes('/timeline')
            || path.includes('/budget') || path.includes('/gifts')
            || path.includes('/moodboard') || path.includes('/photos')
            || path.includes('/settings') || path.includes('/support') || path.includes('/review') || path.includes('/guide'),
  };

  // More sheet — every sidebar destination so nothing is hidden on mobile.
  const MORE_SECTIONS = [
    {
      title: 'Invitation',
      items: [
        { label: 'Guests',  icon: '👥', to: ePath('guests'),  needsEvent: true },
        { label: 'Wishes',  icon: '💬', to: ePath('wishes'),  needsEvent: true },
      ],
    },
    {
      title: 'Planning',
      items: [
        { label: 'Tasks',    icon: '✅', to: ePath('tasks'),    needsEvent: true },
        { label: 'Vendors',  icon: '🤝', to: ePath('vendors'),  needsEvent: true },
        { label: 'Timeline', icon: '🕐', to: ePath('timeline'), needsEvent: true },
      ],
    },
    {
      title: 'Finance & Inventory',
      items: [
        { label: 'Budget', icon: '💰', to: ePath('budget'), needsEvent: true },
        { label: 'Gifts',  icon: '🎁', to: ePath('gifts'),  needsEvent: true },
      ],
    },
    {
      title: 'Memories',
      items: [
        { label: 'Mood Board', icon: '🎨', to: ePath('moodboard'), needsEvent: true },
        { label: 'Photo Wall', icon: '📸', to: ePath('photos'),    needsEvent: true },
      ],
    },
    {
      title: 'Help',
      items: [
        { label: 'Feature Guide', icon: '📖', to: '/guide' },
        { label: 'Leave a Review', icon: '⭐', to: '/review' },
      ],
    },
  ];

  return (
    <div className={`app-shell${railCollapsed ? ' rail' : ''}`}>
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-row">
            <img src="/logo.png" alt="" className="sidebar-logo-img" width="40" height="40" decoding="async" />
            <div className="logotype">Aamantran</div>
          </div>
          <div className="user-badge">User Dashboard</div>
        </div>

        {/* Event Switcher */}
        <div className="sidebar-event-switcher">
          <div className="event-switcher-wrapper" ref={switcherRef}>
            <button className="event-switcher-btn" onClick={() => setSwitcherOpen(o => !o)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="event-switcher-name">
                  {activeEvent ? (activeEvent.slug || 'My Event') : 'No event yet'}
                </div>
                <div className="event-switcher-sub">
                  {activeEvent ? (activeEvent.isPublished ? 'Published' : 'Draft') : 'Set up an event'}
                </div>
              </div>
              <span className="event-switcher-chevron">{switcherOpen ? '▲' : '▼'}</span>
            </button>

            {switcherOpen && (
              <div className="event-switcher-dropdown">
                {events.filter(ev => ev.inviteScope !== 'subset').map(ev => (
                  <div
                    key={ev.id}
                    className={`event-option ${activeEvent?.id === ev.id ? 'active' : ''}`}
                    onClick={() => selectEvent(ev)}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="event-option-name">
                        {ev.slug || 'My Event'}
                        {ev.invitePairId && <span className="event-badge-paired"> Full + Partial</span>}
                      </div>
                      <div className="event-option-sub">{ev.isPublished ? 'Published' : 'Draft'}</div>
                    </div>
                    {activeEvent?.id === ev.id && <span className="event-option-check">✓</span>}
                  </div>
                ))}
                <div className="event-switcher-add" onClick={() => { setSwitcherOpen(false); navigate('/onboarding'); }}>
                  <span>＋</span> Set Up New Event
                </div>
              </div>
            )}
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV.map(group => (
            <div key={group.section} className="nav-group">
              <button
                className="nav-section-label nav-group-toggle"
                onClick={() => toggleGroup(group.section)}
                aria-expanded={!collapsed[group.section]}
              >
                <span className="nav-group-label-text">{group.section}</span>
                <IconChevron className={`nav-group-chevron${collapsed[group.section] ? ' closed' : ''}`} />
              </button>
              {(railCollapsed || !collapsed[group.section]) && group.items.map(item => {
                const to = item.to;
                const disabled = item.disabled;
                return (
                  <NavLink
                    key={item.label}
                    to={to}
                    title={item.label}
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
                    onClick={(e) => { if (disabled) e.preventDefault(); else setSidebarOpen(false); }}
                    style={disabled ? { opacity: 0.4, pointerEvents: 'none' } : {}}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{initial}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{username}</div>
              <div className="sidebar-user-email">{info?.email || ''}</div>
            </div>
            <button className="sidebar-logout-btn" onClick={handleLogout} title="Sign out">
              <IconLogout />
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className="main">
        <header className="topbar">
          <button className="sidebar-toggle" onClick={handleNavToggle} aria-label="Toggle sidebar" title="Collapse menu">
            <IconMenu />
          </button>
          <div className="topbar-mobile-brand">
            <img src="/logo.png" alt="" className="topbar-logo-img" />
            <span className="topbar-logotype">Aamantran</span>
          </div>
          <div className="topbar-mobile-switcher" ref={mobileSwitcherRef}>
            <button
              className="topbar-event-chip"
              onClick={() => setMobileSwitcherOpen(o => !o)}
              disabled={!events.length}
            >
              <span className="topbar-event-name">
                {activeEvent ? (activeEvent.slug || 'My Event') : 'No event'}
              </span>
              <span className="topbar-event-chev">{mobileSwitcherOpen ? '▲' : '▼'}</span>
            </button>
            {mobileSwitcherOpen && (
              <div className="topbar-event-dropdown">
                {events.filter(ev => ev.inviteScope !== 'subset').map(ev => (
                  <div
                    key={ev.id}
                    className={`event-option ${activeEvent?.id === ev.id ? 'active' : ''}`}
                    onClick={() => { selectEvent(ev); setMobileSwitcherOpen(false); }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="event-option-name">
                        {ev.slug || 'My Event'}
                        {ev.invitePairId && <span className="event-badge-paired"> Full + Partial</span>}
                      </div>
                      <div className="event-option-sub">{ev.isPublished ? 'Published' : 'Draft'}</div>
                    </div>
                    {activeEvent?.id === ev.id && <span className="event-option-check">✓</span>}
                  </div>
                ))}
                <div className="event-switcher-add" onClick={() => { setMobileSwitcherOpen(false); navigate('/onboarding'); }}>
                  <span>＋</span> Set Up New Event
                </div>
              </div>
            )}
          </div>
          <div className="topbar-actions">
            <button
              className="topbar-mobile-avatar"
              onClick={() => setProfileOpen(true)}
              aria-label="Open profile menu"
            >
              {initial}
            </button>
          </div>
        </header>

        <main className="page-content page-fade">
          <Outlet context={{ activeEvent, setActiveEvent, events, setEvents }} />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="bottom-nav">
        <button
          className={`bottom-nav-item ${bottomActive.home ? 'active' : ''}`}
          onClick={() => navigate('/dashboard')}
          aria-label="Home"
        >
          <BNavIconHome />
          <span>Home</span>
        </button>
        <button
          className={`bottom-nav-item ${bottomActive.invite ? 'active' : ''}`}
          onClick={() => navigate(ePath(published ? 'edit' : 'generate'))}
          disabled={!eid}
          aria-label="Invite"
        >
          <BNavIconInvite />
          <span>Invite</span>
        </button>
        <button
          className={`bottom-nav-item bottom-nav-share ${path.endsWith('/share') ? 'active' : ''}`}
          onClick={() => eid && published && navigate(`/events/${eid}/share`)}
          disabled={!eid || !published}
          aria-label="Share invitation"
        >
          <span className="bnav-fab"><BNavIconShare /></span>
          <span>Share</span>
        </button>
        <button
          className={`bottom-nav-item ${bottomActive.items ? 'active' : ''}`}
          onClick={() => navigate(ePath('inventory'))}
          disabled={!eid}
          aria-label="Items"
        >
          <BNavIconItems />
          <span>Items</span>
        </button>
        <button
          className={`bottom-nav-item ${bottomActive.more || moreOpen ? 'active' : ''}`}
          onClick={() => setMoreOpen(o => !o)}
          aria-label="More"
        >
          <BNavIconMore />
          <span>More</span>
        </button>
      </nav>

      {/* Profile bottom sheet (mobile — accessed by tapping the avatar) */}
      {profileOpen && (
        <>
          <div className="bottom-sheet-overlay" onClick={() => setProfileOpen(false)} />
          <div className="profile-sheet">
            <div className="bottom-sheet-handle" />
            <div className="profile-sheet-head">
              <div className="profile-sheet-avatar">{initial}</div>
              <div className="profile-sheet-id">
                <div className="profile-sheet-name">{username}</div>
                <div className="profile-sheet-email">{info?.email || ''}</div>
              </div>
            </div>
            <div className="profile-sheet-actions">
              <button
                className="profile-sheet-row"
                onClick={() => { setProfileOpen(false); navigate('/settings'); }}
              >
                <span className="ps-icon">⚙️</span>
                <span className="ps-label">Settings</span>
                <span className="ps-chev">›</span>
              </button>
              <button
                className="profile-sheet-row"
                onClick={() => { setProfileOpen(false); navigate('/guide'); }}
              >
                <span className="ps-icon">📖</span>
                <span className="ps-label">Feature Guide</span>
                <span className="ps-chev">›</span>
              </button>
              <button
                className="profile-sheet-row"
                onClick={() => { setProfileOpen(false); navigate('/support'); }}
              >
                <span className="ps-icon">💬</span>
                <span className="ps-label">Support</span>
                <span className="ps-chev">›</span>
              </button>
              <button
                className="profile-sheet-row profile-sheet-logout"
                onClick={() => { setProfileOpen(false); handleLogout(); }}
              >
                <span className="ps-icon">🚪</span>
                <span className="ps-label">Sign out</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* More bottom sheet */}
      {moreOpen && (
        <>
          <div className="bottom-sheet-overlay" onClick={() => setMoreOpen(false)} />
          <div className="bottom-sheet">
            <div className="bottom-sheet-handle" />
            <div className="bottom-sheet-title">More</div>
            <div className="bottom-sheet-sections">
              {MORE_SECTIONS.map(sec => (
                <div key={sec.title} className="bottom-sheet-section">
                  <div className="bottom-sheet-section-label">{sec.title}</div>
                  <div className="bottom-sheet-section-items">
                    {sec.items.map(item => {
                      const disabled = item.needsEvent && !eid;
                      const active = path === item.to || (item.to !== '#' && path.startsWith(item.to + '/'));
                      return (
                        <button
                          key={item.label}
                          className={`bottom-sheet-row ${active ? 'active' : ''}`}
                          onClick={() => { if (!disabled) { setMoreOpen(false); navigate(item.to); } }}
                          disabled={disabled}
                        >
                          <span className="bottom-sheet-row-icon">{item.icon}</span>
                          <span className="bottom-sheet-row-label">{item.label}</span>
                          <span className="bottom-sheet-row-chev">›</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ── SVG Icons ── */
function IconGrid() {
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>;
}
function IconSparkle() {
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z"/></svg>;
}
function IconEdit() {
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
}
function IconUsers() {
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>;
}
function IconMessage() {
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>;
}
function IconSettings() {
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>;
}
function IconMail() {
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>;
}
function IconStar() {
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
}
function IconMenu() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>;
}
function IconChevron({ className }) {
  return <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>;
}
function IconLogout() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>;
}
function IconCheckSquare() {
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>;
}
function IconBriefcase() {
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>;
}
function IconClock() {
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
}
function IconBox() {
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>;
}
function IconDollarSign() {
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>;
}
function IconGift() {
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>;
}
function IconHeart() {
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>;
}
function IconCamera() {
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>;
}
function IconBook() {
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>;
}

/* ── Bottom-nav icons (larger stroke, optimised for thumb-targets) ── */
function BNavIconHome() {
  return <svg className="bnav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V9.5"/></svg>;
}
function BNavIconInvite() {
  return <svg className="bnav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/><path d="M12 13v6"/></svg>;
}
function BNavIconShare() {
  return <svg className="bnav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>;
}
function BNavIconItems() {
  return <svg className="bnav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>;
}
function BNavIconMore() {
  return <svg className="bnav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>;
}
