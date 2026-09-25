import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { shortDate } from '../lib/utils';
import { useToast } from '../components/ui/Toast';
import { ConfirmModal, Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { Plus, Pencil, Trash2, Check, Gift, PartyPopper } from 'lucide-react';
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
      .catch(() => toast('We couldn’t load your gifts. Try again.', 'error'))
      .finally(() => setLoading(false));
  }, [id]);

  function openNew()  { setForm(BLANK); setEditing(null); setShowModal(true); }
  function openEdit(g) { setForm({ ...g }); setEditing(g.id); setShowModal(true); }

  async function save() {
    if (!form.fromName.trim()) { toast('Add who the gift is from first.', 'error'); return; }
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
      toast(editing ? 'Gift saved.' : 'Gift added.', 'success');
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
        <PageHeader
          title="Gifts"
          subtitle="Note who gave what, and tick off each thank-you as you send it."
          actions={<button type="button" className="btn btn-primary" onClick={openNew}><Plus size={18} aria-hidden="true" /> Add gift</button>}
        />

        <div className="feat-stats">
          <div className="feat-stat">
            <span className="feat-stat-val">{gifts.length}</span>
            <span className="feat-stat-label">Gifts</span>
          </div>
          <div className="feat-stat">
            <span className={`feat-stat-val ${pending > 0 ? 'feat-stat-val--amber' : 'feat-stat-val--green'}`}>{pending}</span>
            <span className="feat-stat-label">Thank-yous to send</span>
          </div>
        </div>

        <div className="feat-hub">
          <div className="feat-hub-pills feat-hub-pills--wrap">
            <button type="button" aria-pressed={filter === 'all'} className={`pill ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
            <button type="button" aria-pressed={filter === 'pending'} className={`pill ${filter === 'pending' ? 'active' : ''}`} onClick={() => setFilter('pending')}>
              Thank-you not sent
              {pending > 0 && (
                <span className="gifts-pill-count">{pending}</span>
              )}
            </button>
          </div>
        </div>
      </section>

      {filtered.length === 0 ? (
        filter === 'pending' && gifts.length > 0 ? (
          <EmptyState icon={PartyPopper} tone="mint" title="Every thank-you is sent">
            You’re all caught up.
          </EmptyState>
        ) : (
          <EmptyState
            icon={Gift}
            tone="peach"
            title="No gifts noted yet"
            action={<button type="button" className="btn btn-primary" onClick={openNew}><Plus size={18} aria-hidden="true" /> Add a gift</button>}
          >
            Note each gift as it arrives, so thank-yous are easy later.
          </EmptyState>
        )
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="data-table table-stack">
              <thead>
                <tr><th>From</th><th>Gift</th><th>Received</th><th>Thank-you</th><th><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                {filtered.map(g => (
                  <tr key={g.id} className={g.thankYouSent ? 'gift-done' : ''}>
                    <td data-label="From">
                      <div style={{ fontWeight: 600 }}>{g.fromName}</div>
                      {g.fromRelation && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{g.fromRelation}</div>}
                    </td>
                    <td data-label="Gift">{g.giftDescription || '—'}</td>
                    <td data-label="Received" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{shortDate(g.receivedDate) || '—'}</td>
                    <td data-label="Thank-you">
                      <button
                        type="button"
                        className={`btn btn-sm ${g.thankYouSent ? 'btn-secondary' : 'btn-ghost'}`}
                        style={{ color: g.thankYouSent ? 'var(--green)' : undefined }}
                        aria-pressed={!!g.thankYouSent}
                        onClick={() => toggleThankYou(g)}
                      >
                        {g.thankYouSent ? <><Check size={15} aria-hidden="true" /> Sent</> : 'Mark as sent'}
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(g)} aria-label={`Edit gift from ${g.fromName}`}><Pencil size={15} aria-hidden="true" /> Edit</button>
                        <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => setDeleting(g)} aria-label={`Delete gift from ${g.fromName}`}><Trash2 size={15} aria-hidden="true" /> Delete</button>
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
        <Modal
          title={editing ? 'Edit gift' : 'Add a gift'}
          onClose={() => !saving && setShowModal(false)}
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={saving}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? <span className="btn-spinner" aria-hidden="true" /> : null}
                {editing ? 'Save changes' : 'Add gift'}
              </button>
            </>
          }
        >
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="gift-from">Who is it from?</label>
              <input id="gift-from" className="form-input" value={form.fromName} onChange={e => setForm(f => ({ ...f, fromName: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="gift-rel">How you know them <span className="form-optional">(optional)</span></label>
              <input id="gift-rel" className="form-input" placeholder="Uncle, friend…" value={form.fromRelation} onChange={e => setForm(f => ({ ...f, fromRelation: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="gift-desc">What was the gift? <span className="form-optional">(optional)</span></label>
            <input id="gift-desc" className="form-input" value={form.giftDescription} onChange={e => setForm(f => ({ ...f, giftDescription: e.target.value }))} placeholder="e.g. Silver dinner set" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="gift-date">Received on <span className="form-optional">(optional)</span></label>
              <input id="gift-date" className="form-input" type="date" value={form.receivedDate} onChange={e => setForm(f => ({ ...f, receivedDate: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="gift-val">Rough value (₹) <span className="form-optional">(optional)</span></label>
              <input id="gift-val" className="form-input" type="number" inputMode="numeric" value={form.estimatedValue} onChange={e => setForm(f => ({ ...f, estimatedValue: e.target.value }))} placeholder="0" />
            </div>
          </div>
          <label className="check-row">
            <input type="checkbox" checked={!!form.thankYouSent} onChange={e => setForm(f => ({ ...f, thankYouSent: e.target.checked }))} />
            Thank-you already sent
          </label>
        </Modal>
      )}

      {deleting && (
        <ConfirmModal
          title="Delete this gift?"
          message={`The gift from ${deleting.fromName} will be removed from your list.`}
          confirmText="Delete gift"
          onConfirm={() => deleteGift(deleting.id)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
