import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { formatDate, formatRelative } from '../lib/utils';
import { API_BASE } from '../lib/config';
import { getToken } from '../lib/auth';
import { useToast } from '../components/ui/Toast';
import './GuestManager.css';

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
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const filtered = guests.filter(g =>
    !search || g.name?.toLowerCase().includes(search.toLowerCase()) ||
    g.phone?.includes(search) || g.email?.toLowerCase().includes(search.toLowerCase())
  );

  async function handleExport() {
    const token = getToken();
    const url = `${API_BASE}/api/user/events/${id}/guests/export`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) { toast('Export failed', 'error'); return; }
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
      <div className="page-header">
        <div>
          <h1 className="page-title">Guest Manager</h1>
          <p className="page-subtitle">{guests.length} guests registered</p>
        </div>
        <button className="btn btn-secondary" onClick={handleExport}>
          ⬇ Export CSV
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total Guests</div>
            <div className="stat-value">{stats.guestCount}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">RSVPs Attending</div>
            <div className="stat-value" style={{ color: 'var(--green)' }}>{stats.rsvpCount}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Invitation Opens</div>
            <div className="stat-value">{stats.opens}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Functions Tracked</div>
            <div className="stat-value">{stats.perFunction?.length || 0}</div>
          </div>
        </div>
      )}

      {/* Per-function breakdown */}
      {stats?.perFunction?.length > 0 && (
        <div className="card mb-24">
          <div className="card-title">Function Headcount</div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Function</th>
                  <th>Attending</th>
                  <th>Not Attending</th>
                  <th>Pending</th>
                  <th>+1s</th>
                </tr>
              </thead>
              <tbody>
                {stats.perFunction.map(fn => (
                  <tr key={fn.id}>
                    <td style={{ fontWeight: 600 }}>{fn.name}</td>
                    <td style={{ color: 'var(--green)' }}>{fn.attending}</td>
                    <td style={{ color: 'var(--red)' }}>{fn.notAttending}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{fn.pending}</td>
                    <td>{fn.plusOnes}</td>
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
          <div className="section-title">Guest List</div>
          <input
            className="form-input"
            style={{ maxWidth: 240, marginBottom: 0 }}
            placeholder="Search guests..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🎟️</div>
            <div className="empty-title">{search ? 'No results' : 'No guests yet'}</div>
            <div className="empty-desc">Guests appear here when they open or RSVP to your invitation.</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Side</th>
                  <th>RSVPs</th>
                  <th>First Seen</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(g => (
                  <tr key={g.id}>
                    <td style={{ fontWeight: 600 }}>{g.name}</td>
                    <td>
                      {g.phone && <div style={{ fontSize: '0.8rem' }}>{g.phone}</div>}
                      {g.email && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{g.email}</div>}
                    </td>
                    <td>{g.side || '—'}</td>
                    <td>
                      {g.rsvps?.length > 0 ? (
                        <div className="rsvp-chips">
                          {g.rsvps.map(r => (
                            <span key={r.id} className={`rsvp-chip ${r.attending === true ? 'yes' : r.attending === false ? 'no' : 'pending'}`}>
                              {r.function?.name}: {r.attending === true ? 'Yes' : r.attending === false ? 'No' : 'Pending'}
                              {r.attending && r.plusCount > 0 ? ` +${r.plusCount}` : ''}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No RSVP</span>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{formatRelative(g.createdAt)}</td>
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
