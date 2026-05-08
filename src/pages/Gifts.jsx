import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import { ConfirmModal } from '../components/ui/Modal';
import './Gifts.css';

const BLANK = { fromName: '', fromRelation: '', giftDescription: '', receivedDate: '', estimatedValue: '', thankYouSent: false, notes: '' };

export default function Gifts() {
  const { id } = useParams();
  const toast = useToast();
  const [gifts, setGifts]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState(BLANK);
  const [editing, setEditing]     = useState(null);
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState(null);

  useEffect(() => {
    api.gifts.list(id)
      .then(r => setGifts(r.gifts || []))
      .catch(() => toast('Failed to load gifts', 'error'))
      .finally(() => setLoading(false));
  }, [id]);

  function openNew()  { setForm(BLANK); setEditing(null); setShowModal(true); }
  function openEdit(g) { setForm({ ...g }); setEditing(g.id); setShowModal(true); }

  async function save() {
    if (!form.fromName.trim()) { toast('Giver name is required', 'error'); return; }
    setSaving(true);
    try {
      if (editing) {
        const r = await api.gifts.update(id, editing, form);
        setGifts(prev => prev.map(g => g.id === editing ? r.gift : g));
      } else {
        const r = await api.gifts.create(id, form);
        setGifts(prev => [...prev, r.gift]);
      }
      setShowModal(false);
      toast(editing ? 'Updated!' : 'Added!', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function toggleThankYou(gift) {
    try {
      const r = await api.gifts.update(id, gift.id, { ...gift, thankYouSent: !gift.thankYouSent });
      setGifts(prev => prev.map(g => g.id === gift.id ? r.gift : g));
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function deleteGift(gid) {
    try {
      await api.gifts.remove(id, gid);
      setGifts(prev => prev.filter(g => g.id !== gid));
      setDeleting(null);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  const pending = gifts.filter(g => !g.thankYouSent).length;
  const filtered = filter === 'pending' ? gifts.filter(g => !g.thankYouSent) : gifts;

  if (loading) return <div className="loading-center"><div className="spinner spinner-lg" /></div>;

  return (
    <div className="page-fade">
      <section className="feat-shell">
        <header className="feat-head">
          <div className="feat-head-text">
            <h1 className="feat-title">Gift tracker</h1>
            <p className="feat-desc">Track gifts and thank-you messages</p>
          </div>
          <div className="feat-head-actions">
            <button type="button" className="btn btn-primary" onClick={openNew}>+ Add gift</button>
          </div>
        </header>

        <div className="feat-stats">
          <div className="feat-stat">
            <span className="feat-stat-val">{gifts.length}</span>
            <span className="feat-stat-label">Total gifts</span>
          </div>
          <div className="feat-stat">
            <span className={`feat-stat-val ${pending > 0 ? 'feat-stat-val--amber' : 'feat-stat-val--green'}`}>{pending}</span>
            <span className="feat-stat-label">Thank you pending</span>
          </div>
        </div>

        <div className="feat-hub">
          <div className="feat-hub-pills feat-hub-pills--wrap">
            <button type="button" className={`pill ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
            <button type="button" className={`pill ${filter === 'pending' ? 'active' : ''}`} onClick={() => setFilter('pending')}>
              Pending
              {pending > 0 && (
                <span className="gifts-pill-count">{pending}</span>
              )}
            </button>
          </div>
        </div>
      </section>

      {filtered.length === 0 ? (
        <div className="empty-state" style={{ padding: '40px 0' }}>
          <div className="empty-icon">🎁</div>
          <div className="empty-title">{filter === 'pending' ? 'All thank yous sent!' : 'No gifts recorded yet'}</div>
          <div className="empty-desc">{filter === 'pending' ? 'You\'re all caught up!' : 'Add gifts to track who gave what.'}</div>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>From</th><th>Gift</th><th>Date</th><th>Thank You</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map(g => (
                  <tr key={g.id} className={g.thankYouSent ? 'gift-done' : ''}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{g.fromName}</div>
                      {g.fromRelation && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{g.fromRelation}</div>}
                    </td>
                    <td>{g.giftDescription || '—'}</td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{g.receivedDate || '—'}</td>
                    <td>
                      <button
                        className={`btn btn-sm ${g.thankYouSent ? 'btn-secondary' : 'btn-ghost'}`}
                        style={{ fontSize: '0.72rem', color: g.thankYouSent ? 'var(--green)' : undefined }}
                        onClick={() => toggleThankYou(g)}
                      >
                        {g.thankYouSent ? '✓ Sent' : 'Mark Sent'}
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(g)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setDeleting(g)}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Edit Gift' : 'Add Gift'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">From <span className="req">*</span></label>
                <input className="form-input" value={form.fromName} onChange={e => setForm(f => ({ ...f, fromName: e.target.value }))} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Relation</label>
                <input className="form-input" placeholder="Uncle, Friend…" value={form.fromRelation} onChange={e => setForm(f => ({ ...f, fromRelation: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Gift Description</label>
              <input className="form-input" value={form.giftDescription} onChange={e => setForm(f => ({ ...f, giftDescription: e.target.value }))} placeholder="e.g. Silver dinner set" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Received Date</label>
                <input className="form-input" type="date" value={form.receivedDate} onChange={e => setForm(f => ({ ...f, receivedDate: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Est. Value (₹)</label>
                <input className="form-input" type="number" value={form.estimatedValue} onChange={e => setForm(f => ({ ...f, estimatedValue: e.target.value }))} placeholder="0" />
              </div>
            </div>
            <label className="form-label" style={{ display: 'flex', gap: 8, cursor: 'pointer', margin: '8px 0' }}>
              <input type="checkbox" checked={form.thankYouSent} onChange={e => setForm(f => ({ ...f, thankYouSent: e.target.checked }))} />
              Thank you already sent
            </label>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? <span className="btn-spinner" /> : null}
                {editing ? 'Update' : 'Add Gift'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <ConfirmModal
          title="Delete Gift"
          message={`Delete gift from "${deleting.fromName}"?`}
          confirmText="Delete"
          onConfirm={() => deleteGift(deleting.id)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
