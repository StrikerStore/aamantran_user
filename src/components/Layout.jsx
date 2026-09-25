import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronLeft, Check, Menu as MenuIcon, LogOut, ShoppingBag, CircleHelp, Eye } from 'lucide-react';
import { clearToken } from '../lib/auth';
import { api } from '../lib/api';
import { WEBSITE_URL } from '../lib/config';
import { eventTitle, eventMeta, liveLabel, coupleInitials } from '../lib/event';
import { buildNav, blockedReason, titleFor, isMainTab, isFlowPage } from '../lib/nav';
import { useToast } from './ui/Toast';
import { Modal } from './ui/Modal';
import './Layout.css';

const ACTIVE_EVENT_KEY = 'aam_active_event';

function readStored(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function writeStored(key, value) {
  try { localStorage.setItem(key, value); } catch { /* private mode */ }
}

/** The couple's round avatar; a story-style ring when the invitation is live. */
export function CoupleAvatar({ event, size = 24, ring = true }) {
  const avatar = (
    <span className="ig-avatar" style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.36)) }} aria-hidden="true">
      {coupleInitials(event)}
    </span>
  );
  if (!ring) return avatar;
  return <span className={`ig-avatar-ring${event?.isPublished ? ' is-live' : ''}`}>{avatar}</span>;
}

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [events, setEvents] = useState([]);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  // The invitation picked last (remembered across refreshes).
  const [chosenId, setChosenId] = useState(() => readStored(ACTIVE_EVENT_KEY, ''));
  const [switcherOpen, setSwitcherOpen] = useState(false);   // desktop popover
  const [switchSheet, setSwitchSheet] = useState(false);     // phone bottom sheet
  const [moreOpen, setMoreOpen] = useState(false);           // desktop "More" popover
  const switcherRef = useRef(null);
  const moreRef = useRef(null);

  // The event in the address wins; otherwise the one chosen last time; otherwise the newest.
  const path = location.pathname;
  const routeEventId = (path.match(/^\/events\/([^/]+)/) || [])[1] || null;
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

  /** Reload the invitations (after going live, for example, so the menu says "Edit"). */
  function refreshEvents() {
    return api.events.list().then((r) => setEvents(r.events || [])).catch(() => {});
  }

  // Close desktop popovers on an outside click or Esc.
  useEffect(() => {
    if (!switcherOpen && !moreOpen) return undefined;
    const onDown = (e) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target)) setSwitcherOpen(false);
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') { setSwitcherOpen(false); setMoreOpen(false); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [switcherOpen, moreOpen]);

  const pageTitle = titleFor(path);
  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} · Aamantran` : 'Aamantran';
  }, [pageTitle]);

  function handleLogout() {
    clearToken();
    navigate('/');
  }

  /** Switch invitation and stay on the same kind of page for the new one. */
  function selectEvent(ev) {
    setSwitcherOpen(false);
    setSwitchSheet(false);
    setActiveEvent(ev);
    const m = path.match(/^\/events\/[^/]+\/([^/]+)/);
    if (m) {
      let sub = m[1];
      if (sub === 'generate' || sub === 'edit') sub = ev.isPublished ? 'edit' : 'generate';
      if (sub === 'share' && !ev.isPublished) sub = 'generate';
      navigate(`/events/${ev.id}/${sub}`);
    }
  }

  async function openPreview() {
    if (!activeEvent?.id) return;
    try {
      const r = await api.events.previewToken(activeEvent.id);
      window.open(r.previewUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast(err.message || 'We couldn’t open the preview. Try again.', 'error');
    }
  }

  function goBack() {
    // Back inside the app when there is somewhere to go back to; otherwise to the Menu.
    if (location.key !== 'default') navigate(-1);
    else navigate('/menu');
  }

  const nav = buildNav(activeEvent);
  const allItems = nav.flatMap((g) => g.items);
  const item = (key) => allItems.find((i) => i.key === key);
  const isActive = (it) => it.to !== '#' && (path === it.to || path.startsWith(`${it.to}/`)
    || (it.key === 'invite' && isFlowPage(path)));

  /** Follow a nav item, or say why it can't open yet. */
  function go(it) {
    const reason = blockedReason(it, activeEvent);
    if (reason) { toast(reason, 'info'); return; }
    setMoreOpen(false);
    navigate(it.to);
  }

  const title = activeEvent ? eventTitle(activeEvent) : 'Aamantran';
  const mainTab = isMainTab(path);
  const flow = isFlowPage(path);

  function renderEventList() {
    return (
      <div className="switch-list">
        {mainEvents.map((ev) => (
          <button type="button" key={ev.id} className="ig-row switch-row" onClick={() => selectEvent(ev)}>
            <CoupleAvatar event={ev} size={40} />
            <span className="ig-row-text">
              <span className="switch-name">{eventTitle(ev)}</span>
              <span className="ig-row-sub">{liveLabel(ev)}{eventMeta(ev) ? ` · ${eventMeta(ev)}` : ''}</span>
            </span>
            {activeEvent?.id === ev.id && <Check size={20} className="ig-row-end" aria-label="Selected" />}
          </button>
        ))}
        <a className="ig-row switch-row switch-buy" href={`${WEBSITE_URL}/templates`} target="_blank" rel="noreferrer">
          <span className="switch-buy-icon" aria-hidden="true"><ShoppingBag size={20} /></span>
          <span className="ig-row-text">Buy another design</span>
        </a>
      </div>
    );
  }

  /** One rail / tab item. */
  function renderNavButton(it, variant) {
    const Icon = it.icon;
    const active = isActive(it);
    const reason = blockedReason(it, activeEvent);
    const label = variant === 'tab' ? it.short || it.label : it.label;
    const showTabLabel = variant === 'tab' && (it.key === 'invite' || it.key === 'share');
    return (
      <button
        key={it.key}
        type="button"
        className={`${variant}-item${active ? ' active' : ''}${reason ? ' is-locked' : ''}`}
        aria-current={active ? 'page' : undefined}
        aria-disabled={reason ? true : undefined}
        aria-label={variant === 'tab' ? label : undefined}
        title={reason || (variant === 'rail' ? it.label : undefined)}
        onClick={() => go(it)}
      >
        <Icon size={24} strokeWidth={active ? 2.5 : 2} fill={active && it.key !== 'invite' ? 'currentColor' : 'none'} aria-hidden="true" />
        {variant === 'rail' && <span className="rail-label">{it.label}</span>}
        {showTabLabel && <span className="tab-label" aria-hidden="true">{label}</span>}
      </button>
    );
  }

  const moreItems = nav.flatMap((g) => g.items.filter((i) => !i.main && !i.rail).map((i) => ({ ...i, section: g.section })));

  return (
    <div className={`app-shell${flow ? ' is-flow' : ''}${mainTab ? '' : ' is-subpage'}`}>
      {/* ── Desktop: Instagram-web rail ── */}
      <aside className="rail" aria-label="Main menu">
        <NavLink to="/dashboard" className="rail-logo" aria-label="Aamantran home">
          <img src="/logo.png" alt="" width="28" height="28" decoding="async" />
          <span className="rail-wordmark">Aamantran</span>
        </NavLink>

        <div className="rail-switcher" ref={switcherRef}>
          <button
            type="button"
            className="rail-item rail-switch-btn"
            onClick={() => setSwitcherOpen((o) => !o)}
            aria-expanded={switcherOpen}
            aria-haspopup="true"
            title={title}
          >
            {activeEvent ? <CoupleAvatar event={activeEvent} size={24} /> : <CoupleAvatar event={null} size={24} ring={false} />}
            <span className="rail-label rail-switch-name">{title}</span>
            <ChevronDown size={16} className="rail-label rail-switch-chev" aria-hidden="true" />
          </button>
          {switcherOpen && (
            <div className="popover rail-popover">
              <div className="popover-title">Your invitations</div>
              {renderEventList()}
            </div>
          )}
        </div>

        <nav className="rail-nav">
          {allItems.filter((i) => i.main || i.rail).map((it) => renderNavButton(it, 'rail'))}
        </nav>

        <div className="rail-more" ref={moreRef}>
          {moreOpen && (
            <div className="popover rail-more-popover" role="menu">
              {nav.filter((g) => g.items.some((i) => !i.main && !i.rail)).map((g) => (
                <div key={g.section} className="popover-group">
                  <div className="popover-group-title">{g.section}</div>
                  {g.items.filter((i) => !i.main && !i.rail).map((it) => {
                    const Icon = it.icon;
                    return (
                      <button type="button" role="menuitem" key={it.key} className={`popover-row${isActive(it) ? ' active' : ''}`} onClick={() => go(it)}>
                        <Icon size={20} aria-hidden="true" /> {it.label}
                      </button>
                    );
                  })}
                </div>
              ))}
              <div className="popover-group">
                <button type="button" role="menuitem" className="popover-row is-danger" onClick={handleLogout}>
                  <LogOut size={20} aria-hidden="true" /> Log out
                </button>
              </div>
            </div>
          )}
          <button
            type="button"
            className={`rail-item${moreOpen || moreItems.some(isActive) ? ' active' : ''}`}
            onClick={() => setMoreOpen((o) => !o)}
            aria-expanded={moreOpen}
            aria-haspopup="menu"
            title="More"
          >
            <MenuIcon size={24} strokeWidth={moreOpen ? 2.5 : 2} aria-hidden="true" />
            <span className="rail-label">More</span>
          </button>
        </div>
      </aside>

      <div className="main">
        {/* ── Phone: top bar ── */}
        <header className="topbar">
          {mainTab ? (
            <>
              <button
                type="button"
                className="topbar-switch"
                onClick={() => setSwitchSheet(true)}
                aria-haspopup="dialog"
                aria-label={`${title}. Switch invitation`}
              >
                <span className="topbar-switch-name">{title}</span>
                <ChevronDown size={20} strokeWidth={2.5} aria-hidden="true" />
              </button>
              <div className="topbar-actions">
                {activeEvent && (
                  <button type="button" className="icon-btn" onClick={openPreview} aria-label="Preview your invitation" title="Preview">
                    <Eye size={24} aria-hidden="true" />
                  </button>
                )}
                <button type="button" className="icon-btn" onClick={() => navigate('/guide')} aria-label="Help guide" title="Help">
                  <CircleHelp size={24} aria-hidden="true" />
                </button>
              </div>
            </>
          ) : (
            <>
              <button type="button" className="icon-btn" onClick={goBack} aria-label="Back">
                <ChevronLeft size={28} aria-hidden="true" />
              </button>
              <div className="topbar-title">{pageTitle}</div>
              <span className="topbar-spacer" aria-hidden="true" />
            </>
          )}
        </header>

        <main className="page-content" id="main">
          <Outlet context={{ activeEvent, setActiveEvent, events, setEvents, refreshEvents, eventsLoaded }} />
        </main>
      </div>

      {/* ── Phone: Instagram tab bar ── */}
      <nav className="tabbar" aria-label="Main menu">
        {['home', 'invite', 'share', 'guests'].map((k) => renderNavButton(item(k), 'tab'))}
        <button
          type="button"
          className={`tab-item tab-profile${path === '/menu' ? ' active' : ''}`}
          aria-current={path === '/menu' ? 'page' : undefined}
          aria-label="Menu"
          onClick={() => navigate('/menu')}
        >
          <CoupleAvatar event={activeEvent} size={26} ring={false} />
        </button>
      </nav>

      {/* ── Phone: invitation switcher (Instagram account switcher) ── */}
      {switchSheet && (
        <Modal title="Your invitations" onClose={() => setSwitchSheet(false)}>
          {renderEventList()}
        </Modal>
      )}
    </div>
  );
}
