import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { formatRelative } from '../lib/utils';
import { API_BASE } from '../lib/config';
import { getToken } from '../lib/auth';
import { useToast } from '../components/ui/Toast';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { Download, Users, SearchX, Search } from '../components/ui/icons';
import './GuestManager.css';

function rsvpFullTitle(r) {
  const fn = r.function?.name || 'Ceremony';
  const status = r.attending === true ? 'Coming' : r.attending === false ? 'Not coming' : 'No reply yet';
  const plus = r.attending === true && r.plusCount > 0 ? ` (+${r.plusCount})` : '';
  return `${fn}: ${status}${plus}`;
}

/** One-line chip text; full sentence in title tooltip */
function rsvpCompactLabel(r) {
  const raw = (r.function?.name || 'Ceremony').trim();
  const short = raw.length > 18 ? `${raw.slice(0, 16)}…` : raw;
  const sym = r.attending === true ? '✓' : r.attending === false ? '✗' : '○';
  const plus = r.attending === true && r.plusCount > 0 ? `+${r.plusCount}` : '';
  return `${short} ${sym}${plus ? ` ${plus}` : ''}`;
}

export default function GuestManager() {
  const { id } = useParams();
  const toast = useToast();
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState(null);

  useEffect(() => {
    Promise.all([
      api.guests.list(id),
      api.events.stats(id),
    ]).then(([gr, sr]) => {
      setGuests(gr.guests || []);
      setStats(sr.stats);
    }).catch(() => toast('We couldn’t load your guests. Try again.', 'error')).finally(() => setLoading(false));
  }, [id, toast]);

  const filtered = guests.filter(g =>
    !search || g.name?.toLowerCase().includes(search.toLowerCase()) ||
    g.phone?.includes(search) || g.email?.toLowerCase().includes(search.toLowerCase())
  );

  async function handleExport() {
    const token = getToken();
    const url = `${API_BASE}/api/user/events/${id}/guests/export`;
    let res;
    try {
      res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    } catch {
      res = null;
    }
    if (!res?.ok) { toast('We couldn’t download the list. Try again.', 'error'); return; }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `guests-${id}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (loading) return <div className="loading-center"><div className="spinner spinner-lg" /></div>;

  return (
    <div className="page-fade">
      <PageHeader
        title="Guests"
        subtitle="Guests appear here when they open your invitation or reply."
        helpMore="/guide#guests"
        help="There’s nothing to type in: when a guest opens your invitation and enters their name, or replies to say if they’re coming, they’re added here automatically. Download the list to open it in Excel or Google Sheets."
        actions={guests.length > 0 ? (
          <button type="button" className="btn btn-secondary" onClick={handleExport}>
            <Download size={18} aria-hidden="true" /> Download list
          </button>
        ) : null}
      />

      {/* Stats */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Guests</div>
            <div className="stat-value">{stats.guestCount}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Coming</div>
            <div className="stat-value" style={{ color: 'var(--green)' }}>{stats.rsvpCount}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Times opened</div>
            <div className="stat-value">{stats.opens}</div>
          </div>
        </div>
      )}

      {/* Per-ceremony replies */}
      {stats?.perFunction?.length > 0 && (
        <div className="card mb-24">
          <h2 className="card-title">Replies by ceremony</h2>
          <div className="table-wrap">
            <table className="data-table table-stack">
              <thead>
                <tr>
                  <th>Ceremony</th>
                  <th>Coming</th>
                  <th>Not coming</th>
                  <th>No reply yet</th>
                  <th>Bringing extra</th>
                </tr>
              </thead>
              <tbody>
                {stats.perFunction.map(fn => (
                  <tr key={fn.id}>
                    <td data-label="Ceremony" style={{ fontWeight: 600 }}>{fn.name}</td>
                    <td data-label="Coming" style={{ color: 'var(--green)' }}>{fn.attending}</td>
                    <td data-label="Not coming" style={{ color: 'var(--red)' }}>{fn.notAttending}</td>
                    <td data-label="No reply yet" style={{ color: 'var(--text-muted)' }}>{fn.pending}</td>
                    <td data-label="Bringing extra">{fn.plusOnes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Guest list */}
      <div className="card">
        <div className="section-header" style={{ marginBottom: 16 }}>
          <h2 className="section-title">Guest list <span className="section-count">{guests.length}</span></h2>
          {guests.length > 0 && (
            <div className="search-field" style={{ maxWidth: 280, width: '100%' }}>
              <Search size={16} aria-hidden="true" className="search-field-icon" />
              <input
                className="form-input"
                type="search"
                style={{ marginBottom: 0 }}
                placeholder="Search by name, phone or email"
                aria-label="Search guests"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          )}
        </div>

        {filtered.length === 0 ? (
          search ? (
            <EmptyState
              icon={SearchX}
              tone="sky"
              title="No guests match"
              action={<button type="button" className="btn btn-secondary" onClick={() => setSearch('')}>Show all guests</button>}
            >
              Try another name, number or email.
            </EmptyState>
          ) : (
            <EmptyState icon={Users} title="No guests yet">
              Share your invitation — guests appear here as soon as they open it or reply.
            </EmptyState>
          )
        ) : (
          <div className="table-wrap">
            <table className="data-table table-stack">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Side</th>
                  <th>Replies</th>
                  <th>First seen</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(g => (
                  <tr key={g.id}>
                    <td data-label="Name" style={{ fontWeight: 600 }}>{g.name}</td>
                    <td data-label="Contact">
                      {g.phone && <div style={{ fontSize: '0.8rem' }}>{g.phone}</div>}
                      {g.email && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{g.email}</div>}
                    </td>
                    <td data-label="Side">{g.side || '—'}</td>
                    <td data-label="Replies" className="guest-col-rsvp">
                      {g.rsvps?.length > 0 ? (
                        <div className="rsvp-chips">
                          {g.rsvps.map(r => (
                            <span
                              key={r.id}
                              className={`rsvp-chip ${r.attending === true ? 'yes' : r.attending === false ? 'no' : 'pending'}`}
                              title={rsvpFullTitle(r)}
                            >
                              {rsvpCompactLabel(r)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="guest-rsvp-empty">No reply yet</span>
                      )}
                    </td>
                    <td data-label="First seen" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{formatRelative(g.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
