import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { formatRelative } from '../lib/utils';
import { useToast } from '../components/ui/Toast';
import { ConfirmModal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { Eye, EyeOff, Trash2, Heart, SearchX, Search } from 'lucide-react';
import './WishManager.css';

export default function WishManager() {
  const { id } = useParams();
  const toast = useToast();
  const [wishes, setWishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState('');
  const [deleting, setDeleting] = useState(null);

  const loadWishes = useCallback(async () => {
    const r = await api.wishes.list(id);
    setWishes(r.wishes || []);
  }, [id]);

  useEffect(() => {
    setLoading(true);
    loadWishes().catch(() => toast('We couldn’t load your wishes. Try again.', 'error')).finally(() => setLoading(false));
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
      toast(nextVisible ? 'Guests can now see this wish.' : 'Hidden — guests won’t see this wish.', 'success');
    } catch {
      toast('We couldn’t change that. Try again.', 'error');
    } finally {
      setBusyId('');
    }
  }

  async function handleDelete(wish) {
    setDeleting(null);
    setBusyId(wish.id);
    try {
      await api.wishes.remove(id, wish.id);
      setWishes((prev) => prev.filter((w) => w.id !== wish.id));
      toast('Wish deleted.', 'success');
    } catch {
      toast('We couldn’t delete that wish. Try again.', 'error');
    } finally {
      setBusyId('');
    }
  }

  if (loading) return <div className="loading-center"><div className="spinner spinner-lg" /></div>;

  const visibleCount = wishes.filter((w) => w.isApproved).length;
  const hiddenCount = wishes.length - visibleCount;

  return (
    <div className="page-fade">
      <PageHeader
        title="Wishes"
        subtitle="Messages guests leave on your invitation. Choose which wishes guests can see."
        helpMore="/guide#wishes"
        help="New wishes show on your invitation straight away. Press “Hide from guests” on any wish you’d rather keep private — you’ll still see it here. “Delete” removes it for good."
      />

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">All wishes</div>
          <div className="stat-value">{wishes.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Guests can see</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{visibleCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Hidden</div>
          <div className="stat-value" style={{ color: 'var(--text-2)' }}>{hiddenCount}</div>
        </div>
      </div>

      <div className="card">
        <div className="section-header wish-controls">
          <h2 className="section-title">Messages from guests</h2>
          {wishes.length > 0 && (
            <div className="search-field" style={{ maxWidth: 300, width: '100%' }}>
              <Search size={16} aria-hidden="true" className="search-field-icon" />
              <input
                className="form-input"
                type="search"
                style={{ marginBottom: 0 }}
                placeholder="Search by name or message"
                aria-label="Search wishes"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}
        </div>

        {filtered.length === 0 ? (
          search ? (
            <EmptyState
              icon={SearchX}
              tone="sky"
              title="No wishes match"
              action={<button type="button" className="btn btn-secondary" onClick={() => setSearch('')}>Show all wishes</button>}
            >
              Try another name or word.
            </EmptyState>
          ) : (
            <EmptyState icon={Heart} title="No wishes yet">
              When guests leave a message on your invitation, it appears here.
            </EmptyState>
          )
        ) : (
          <div className="wish-list">
            {filtered.map((wish) => (
              <div key={wish.id} className={`wish-item ${wish.isApproved ? '' : 'hidden'}`}>
                <div className="wish-item-top">
                  <div className="wish-author">{wish.guestName || 'Guest'}</div>
                  <div className="wish-meta">
                    <span className={`badge ${wish.isApproved ? 'badge-published' : 'badge-pending'}`}>
                      {wish.isApproved ? 'Guests can see' : 'Hidden'}
                    </span>
                    <span className="wish-time">{formatRelative(wish.createdAt)}</span>
                  </div>
                </div>
                <div className="wish-message">“{wish.message}”</div>
                <div className="wish-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={busyId === wish.id}
                    onClick={() => handleToggleVisibility(wish)}
                  >
                    {wish.isApproved
                      ? <><EyeOff size={15} aria-hidden="true" /> Hide from guests</>
                      : <><Eye size={15} aria-hidden="true" /> Show to guests</>}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm wish-delete-btn"
                    disabled={busyId === wish.id}
                    onClick={() => setDeleting(wish)}
                  >
                    <Trash2 size={15} aria-hidden="true" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {deleting && (
        <ConfirmModal
          title="Delete this wish?"
          message={`The message from ${deleting.guestName || 'this guest'} will be deleted for good. To keep it but stop guests seeing it, use “Hide from guests” instead.`}
          confirmText="Delete wish"
          onConfirm={() => handleDelete(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
