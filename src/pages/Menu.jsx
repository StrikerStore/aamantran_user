import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { ChevronRight, LogOut } from 'lucide-react';
import { api } from '../lib/api';
import { clearToken, getUserInfo } from '../lib/auth';
import { eventTitle, eventMeta, daysToGo, replySummary } from '../lib/event';
import { buildNav, blockedReason } from '../lib/nav';
import { CoupleAvatar } from '../components/Layout';
import { useToast } from '../components/ui/Toast';
import './Menu.css';

/**
 * The phone's avatar tab, laid out like an Instagram profile: the couple, their
 * numbers, two quick actions, then every other page as a settings list.
 */
export default function Menu() {
  const navigate = useNavigate();
  const toast = useToast();
  const info = getUserInfo();
  const { activeEvent } = useOutletContext() || {};
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!activeEvent?.id || !activeEvent.isPublished) return;
    api.events.stats(activeEvent.id).then((r) => setStats(r.stats)).catch(() => {});
  }, [activeEvent?.id, activeEvent?.isPublished]);

  const nav = buildNav(activeEvent);
  const find = (key) => nav.flatMap((g) => g.items).find((i) => i.key === key);
  const live = Boolean(activeEvent?.isPublished);
  const replies = replySummary(live ? stats : null);
  const meta = [eventMeta(activeEvent), daysToGo(activeEvent)].filter(Boolean).join(' · ');

  function go(it) {
    const reason = blockedReason(it, activeEvent);
    if (reason) { toast(reason, 'info'); return; }
    navigate(it.to);
  }

  return (
    <div className="page-fade menu-page">
      <section className="menu-profile">
        <div className="menu-profile-top">
          <CoupleAvatar event={activeEvent} size={77} />
          <div className="ig-stats menu-stats">
            <div className="ig-stat"><strong>{replies.coming}</strong><span>Coming</span></div>
            <div className="ig-stat"><strong>{replies.notComing}</strong><span>Not coming</span></div>
            <div className="ig-stat"><strong>{replies.opens}</strong><span>Opened</span></div>
          </div>
        </div>
        <h1 className="menu-name">{activeEvent ? eventTitle(activeEvent) : 'No invitation yet'}</h1>
        <p className="menu-meta">
          {activeEvent ? (
            <><span className={live ? 'menu-live' : ''}>{live ? 'Live' : 'Not live yet'}</span>{meta ? ` · ${meta}` : ''}</>
          ) : 'Buy a design to get started.'}
        </p>
        {activeEvent && (
          <div className="menu-actions">
            <button type="button" className="btn btn-secondary" onClick={() => go(find('invite'))}>
              {live ? 'Edit invitation' : 'Build invitation'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => go(find('share'))}>
              Share invitation
            </button>
          </div>
        )}
      </section>

      {nav.map((group) => {
        const items = group.items.filter((i) => !i.main);
        if (!items.length) return null;
        return (
          <section key={group.section} className="menu-group">
            <h2 className="ig-list-heading is-muted">{group.section}</h2>
            <ul className="ig-list">
              {items.map((it) => {
                const Icon = it.icon;
                const reason = blockedReason(it, activeEvent);
                return (
                  <li key={it.key}>
                    <button type="button" className="ig-row" aria-disabled={reason ? true : undefined} onClick={() => go(it)}>
                      <span className="ig-row-icon"><Icon size={24} aria-hidden="true" /></span>
                      <span className="ig-row-text">{it.label}</span>
                      <ChevronRight size={20} className="ig-row-end" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <section className="menu-group">
        <h2 className="ig-list-heading is-muted">Signed in as {info?.username || 'you'}</h2>
        <ul className="ig-list">
          <li>
            <button type="button" className="ig-row is-danger" onClick={() => { clearToken(); navigate('/'); }}>
              <span className="ig-row-icon"><LogOut size={24} aria-hidden="true" /></span>
              <span className="ig-row-text">Log out</span>
            </button>
          </li>
        </ul>
      </section>
    </div>
  );
}
