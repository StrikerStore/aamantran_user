import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { clearToken, getUserInfo } from '../lib/auth';
import { api } from '../lib/api';
import './Layout.css';

// NAV is built dynamically in the component based on activeEvent.isPublished

export function Layout() {
  const navigate = useNavigate();
  const info = getUserInfo();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [events, setEvents] = useState([]);
  const [activeEvent, setActiveEvent] = useState(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherRef = useRef(null);

  useEffect(() => {
    api.events.list()
      .then(r => {
        const all = r.events || [];
        setEvents(all);
        if (all.length && !activeEvent) {
          // Default to the first non-subset event (representative of each invitation)
          const first = all.find(ev => ev.inviteScope !== 'subset') || all[0];
          setActiveEvent(first);
        }
      })
      .catch(() => {});
  }, []);

  // Close switcher on outside click
  useEffect(() => {
    function handler(e) {
      if (switcherRef.current && !switcherRef.current.contains(e.target)) {
        setSwitcherOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleLogout() {
    clearToken();
    navigate('/');
  }

  function selectEvent(ev) {
    setActiveEvent(ev);
    setSwitcherOpen(false);
  }

  const initial  = (info?.username?.[0] || 'U').toUpperCase();
  const username = info?.username || 'User';
  const published = activeEvent?.isPublished ?? false;

  // Build nav dynamically: Generate only before publish, Edit only after publish
  const NAV = [
    {
      section: 'Overview',
      items: [{ label: 'Dashboard', to: '/dashboard', icon: IconGrid, scope: 'account' }],
    },
    {
      section: 'Invitation',
      items: [
        ...(!published
          ? [{ label: 'Generate', icon: IconSparkle, scope: 'event', subPath: 'generate' }]
          : [{ label: 'Edit',     icon: IconEdit,    scope: 'event', subPath: 'edit' }]
        ),
        { label: 'Guests', icon: IconUsers, scope: 'event', subPath: 'guests' },
        { label: 'Wishes', icon: IconMessage, scope: 'event', subPath: 'wishes' },
      ],
    },
    {
      section: 'Account',
      items: [
        { label: 'Settings', to: '/settings', icon: IconSettings, scope: 'account' },
        { label: 'Support',  to: '/support',  icon: IconMail,     scope: 'account' },
        { label: 'Review',   to: '/review',   icon: IconStar,     scope: 'account' },
      ],
    },
  ];

  function getNavTo(item) {
    if (item.scope === 'account') return item.to;
    if (!activeEvent) return '#';
    return `/events/${activeEvent.id}/${item.subPath}`;
  }

  return (
    <div className="app-shell">
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
            <div key={group.section}>
              <div className="nav-section-label">{group.section}</div>
              {group.items.map(item => {
                const to = getNavTo(item);
                const disabled = item.scope === 'event' && !activeEvent;
                return (
                  <NavLink
                    key={item.label}
                    to={to}
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
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle sidebar">
            <IconMenu />
          </button>
          <div className="topbar-title" />
          <div className="topbar-actions" />
        </header>

        <main className="page-content page-fade">
          <Outlet context={{ activeEvent, setActiveEvent, events, setEvents }} />
        </main>
      </div>
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
function IconLogout() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>;
}
