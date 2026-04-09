import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { formatRelative } from '../lib/utils';
import { useToast } from '../components/ui/Toast';
import './WishManager.css';

export default function WishManager() {
  const { id } = useParams();
  const toast = useToast();
  const [wishes, setWishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState('');

  const loadWishes = useCallback(async () => {
    const r = await api.wishes.list(id);
    setWishes(r.wishes || []);
  }, [id]);

  useEffect(() => {
    setLoading(true);
    loadWishes().catch(() => toast('Failed to load wishes', 'error')).finally(() => setLoading(false));
  }, [loadWishes, toast]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return wishes;
    return wishes.filter((w) =>
      String(w.guestName || '').toLowerCase().includes(q) ||
      String(w.message || '').toLowerCase().includes(q)
    );
  }, [wishes, search]);

  async function handleToggleVisibility(wish) {
    const nextVisible = !wish.isApproved;
    setBusyId(wish.id);
    try {
      await api.wishes.visibility(id, wish.id, { visible: nextVisible });
      setWishes((prev) =>
        prev.map((w) => (w.id === wish.id ? { ...w, isApproved: nextVisible } : w))
      );
      toast(nextVisible ? 'Wish is now visible on invite' : 'Wish hidden from invite', 'success');
    } catch {
      toast('Could not update visibility', 'error');
    } finally {
      setBusyId('');
    }
  }

  async function handleDelete(wish) {
    const yes = window.confirm('Delete this guest wish permanently?');
    if (!yes) return;
    setBusyId(wish.id);
    try {
      await api.wishes.remove(id, wish.id);
      setWishes((prev) => prev.filter((w) => w.id !== wish.id));
      toast('Wish deleted', 'success');
    } catch {
      toast('Could not delete wish', 'error');
    } finally {
      setBusyId('');
    }
  }

  if (loading) return <div className="loading-center"><div className="spinner spinner-lg" /></div>;

  const visibleCount = wishes.filter((w) => w.isApproved).length;
  const hiddenCount = wishes.length - visibleCount;

  return (
    <div className="page-fade">
      <div className="page-header">
        <div>
          <h1 className="page-title">Guest Wishes</h1>
          <p className="page-subtitle">Manage wishes shown on your live invitation</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Wishes</div>
          <div className="stat-value">{wishes.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Visible</div>
          <div className="stat-value" style={{ color: 'var(--green)' }}>{visibleCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Hidden</div>
          <div className="stat-value" style={{ color: 'var(--text-muted)' }}>{hiddenCount}</div>
        </div>
      </div>

      <div className="card">
        <div className="section-header wish-controls">
          <div className="section-title">Wish Wall Messages</div>
          <input
            className="form-input"
            style={{ maxWidth: 280, marginBottom: 0 }}
            placeholder="Search by name or message..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💌</div>
            <div className="empty-title">{search ? 'No results found' : 'No wishes yet'}</div>
            <div className="empty-desc">
              Wishes submitted from the invitation page appear here for moderation.
            </div>
          </div>
        ) : (
          <div className="wish-list">
            {filtered.map((wish) => (
              <div key={wish.id} className={`wish-item ${wish.isApproved ? '' : 'hidden'}`}>
                <div className="wish-item-top">
                  <div className="wish-author">{wish.guestName || 'Guest'}</div>
                  <div className="wish-meta">
                    <span className={`badge ${wish.isApproved ? 'badge-published' : 'badge-pending'}`}>
                      {wish.isApproved ? 'Visible' : 'Hidden'}
                    </span>
                    <span className="wish-time">{formatRelative(wish.createdAt)}</span>
                  </div>
                </div>
                <div className="wish-message">"{wish.message}"</div>
                <div className="wish-actions">
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={busyId === wish.id}
                    onClick={() => handleToggleVisibility(wish)}
                  >
                    {wish.isApproved ? 'Hide' : 'Show'}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm wish-delete-btn"
                    disabled={busyId === wish.id}
                    onClick={() => handleDelete(wish)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
