import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import { ConfirmModal } from '../components/ui/Modal';
import './Inventory.css';

const CATEGORIES = [
  { label: 'Attire',     icon: '🎀', subs: ['Bride\'s Outfit','Groom\'s Outfit','Family','Accessories'] },
  { label: 'Jewelry',    icon: '💍', subs: ['Bridal Set','Groom\'s','Family'] },
  { label: 'Decoration', icon: '🌸', subs: ['Flowers','Lighting','Mandap','Table Decor','Entrance'] },
  { label: 'Catering',   icon: '🍽',  subs: ['Crockery','Furniture','Ingredients'] },
  { label: 'Documents',  icon: '📄', subs: ['Marriage Cert','Venue Booking','Contracts'] },
  { label: 'Gifts',      icon: '🎁', subs: ['Received','Return Gifts','Wrapping'] },
  { label: 'Other',      icon: '📦', subs: [] },
];

const STATUSES = [
  { key: 'to-buy',   label: 'To Buy',    color: 'var(--amber)' },
  { key: 'ordered',  label: 'Ordered',   color: 'var(--teal)' },
  { key: 'received', label: 'Received',  color: 'var(--green)' },
  { key: 'packed',   label: 'Packed',    color: 'var(--maroon)' },
  { key: 'at-venue', label: 'At Venue',  color: 'var(--gold)' },
  { key: 'done',     label: 'Done',      color: 'var(--text-muted)' },
];

function today() { return new Date().toISOString().slice(0, 10); }

const BLANK = { name: '', category: 'Other', subCategory: '', status: 'to-buy', location: '', quantity: 1, unit: 'pcs', assignedTo: '', vendor: '', estimatedCost: '', actualCost: '', reminderDate: '', reminderNote: '', notes: '' };

export default function Inventory() {
  const { id } = useParams();
  const toast = useToast();
  const [items, setItems]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [catFilter, setCatFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch]       = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState(BLANK);
  const [editing, setEditing]     = useState(null);
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState(null);

  useEffect(() => {
    api.inventory.list(id)
      .then(r => setItems(r.items || []))
      .catch(() => toast('Failed to load inventory', 'error'))
      .finally(() => setLoading(false));
  }, [id]);

  function openNew() { setForm(BLANK); setEditing(null); setShowModal(true); }
  function openEdit(item) { setForm({ ...item }); setEditing(item.id); setShowModal(true); }

  const selectedCat = CATEGORIES.find(c => c.label === form.category);
  const subOptions  = selectedCat?.subs || [];

  async function save() {
    if (!form.name.trim()) { toast('Name is required', 'error'); return; }
    setSaving(true);
    try {
      if (editing) {
        const r = await api.inventory.update(id, editing, form);
        setItems(prev => prev.map(x => x.id === editing ? r.item : x));
      } else {
        const r = await api.inventory.create(id, form);
        setItems(prev => [...prev, r.item]);
      }
      setShowModal(false);
      toast(editing ? 'Updated!' : 'Added!', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(itemId) {
    try {
      await api.inventory.remove(id, itemId);
      setItems(prev => prev.filter(x => x.id !== itemId));
      setDeleting(null);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  const now = today();
  const reminders = items.filter(x => x.reminderDate && x.reminderDate <= now && x.status !== 'done');

  const filtered = items.filter(x => {
    if (catFilter && x.category !== catFilter) return false;
    if (statusFilter && x.status !== statusFilter) return false;
    if (search && !x.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: items.length,
    ordered: items.filter(x => x.status === 'ordered').length,
    received: items.filter(x => x.status === 'received').length,
    packed: items.filter(x => x.status === 'packed' || x.status === 'at-venue' || x.status === 'done').length,
  };

  if (loading) return <div className="loading-center"><div className="spinner spinner-lg" /></div>;

  return (
    <div className="page-fade">
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-subtitle">Track everything you need for the wedding</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Add Item</button>
      </div>

      {reminders.length > 0 && (
        <div className="inv-alert">
          📅 {reminders.length} item{reminders.length > 1 ? 's' : ''} need your attention
        </div>
      )}

      {/* Summary */}
      <div className="inv-stats">
        <div className="inv-stat"><span className="inv-stat-val">{stats.total}</span><span>Total</span></div>
        <div className="inv-stat"><span className="inv-stat-val" style={{ color: 'var(--teal)' }}>{stats.ordered}</span><span>Ordered</span></div>
        <div className="inv-stat"><span className="inv-stat-val" style={{ color: 'var(--green)' }}>{stats.received}</span><span>Received</span></div>
        <div className="inv-stat"><span className="inv-stat-val" style={{ color: 'var(--maroon)' }}>{stats.packed}</span><span>Packed+</span></div>
      </div>

      {/* Category tabs */}
      <div className="inv-cat-tabs">
        <button className={`inv-cat-tab ${!catFilter ? 'active' : ''}`} onClick={() => setCatFilter('')}>All</button>
        {CATEGORIES.map(c => (
          <button key={c.label} className={`inv-cat-tab ${catFilter === c.label ? 'active' : ''}`} onClick={() => setCatFilter(c.label)}>
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      {/* Search + status filter */}
      <div className="inv-filter-row">
        <input className="form-input" placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 240 }} />
        <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 'auto' }}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      {/* Items grid */}
      {filtered.length === 0 ? (
        <div className="empty-state" style={{ padding: '40px 0' }}>
          <div className="empty-icon">📦</div>
          <div className="empty-title">No items found</div>
          <div className="empty-desc">Add items to track what you need for your wedding.</div>
        </div>
      ) : (
        <div className="inv-grid">
          {filtered.map(item => {
            const statusMeta = STATUSES.find(s => s.key === item.status) || STATUSES[0];
            const catMeta    = CATEGORIES.find(c => c.label === item.category);
            return (
              <div key={item.id} className="inv-card" onClick={() => openEdit(item)}>
                <div className="inv-card-top">
                  <span className="inv-card-icon">{catMeta?.icon || '📦'}</span>
                  <span className="inv-status-badge" style={{ background: `${statusMeta.color}20`, color: statusMeta.color }}>
                    {statusMeta.label}
                  </span>
                </div>
                <div className="inv-card-name">{item.name}</div>
                {item.subCategory && <div className="inv-card-sub">{item.subCategory}</div>}
                {item.location && <div className="inv-card-meta">📍 {item.location}</div>}
                {item.quantity && <div className="inv-card-meta">{item.quantity} {item.unit || 'pcs'}</div>}
                {item.reminderDate && item.reminderDate <= now && item.status !== 'done' && (
                  <div className="inv-reminder-badge">⏰ Reminder past</div>
                )}
                <button
                  className="inv-delete-btn"
                  onClick={e => { e.stopPropagation(); setDeleting(item); }}
                >✕</button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="modal-card modal-card-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Edit Item' : 'Add Item'}</h2>
              <button className="modal-close" onClick={() => !saving && setShowModal(false)}>✕</button>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Name <span className="req">*</span></label>
                <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Bridal lehenga" autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value, subCategory: '' }))}>
                  {CATEGORIES.map(c => <option key={c.label} value={c.label}>{c.icon} {c.label}</option>)}
                </select>
              </div>
              {subOptions.length > 0 && (
                <div className="form-group">
                  <label className="form-label">Sub-category</label>
                  <select className="form-select" value={form.subCategory} onChange={e => setForm(f => ({ ...f, subCategory: e.target.value }))}>
                    <option value="">— Select —</option>
                    {subOptions.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Quantity</label>
                <input className="form-input" type="number" min="1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Unit</label>
                <input className="form-input" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="pcs, sets, kg…" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Location</label>
                <input className="form-input" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Where is it stored?" />
              </div>
              <div className="form-group">
                <label className="form-label">Assigned To</label>
                <input className="form-input" value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} placeholder="Name or role" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Est. Cost (₹)</label>
                <input className="form-input" type="number" value={form.estimatedCost} onChange={e => setForm(f => ({ ...f, estimatedCost: e.target.value }))} placeholder="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Actual Cost (₹)</label>
                <input className="form-input" type="number" value={form.actualCost} onChange={e => setForm(f => ({ ...f, actualCost: e.target.value }))} placeholder="0" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Reminder Date</label>
                <input className="form-input" type="date" value={form.reminderDate} onChange={e => setForm(f => ({ ...f, reminderDate: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Reminder Note</label>
                <input className="form-input" value={form.reminderNote} onChange={e => setForm(f => ({ ...f, reminderNote: e.target.value }))} placeholder="What to check" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? <span className="btn-spinner" /> : null}
                {editing ? 'Update' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <ConfirmModal
          title="Delete Item"
          message={`Delete "${deleting.name}"?`}
          confirmText="Delete"
          onConfirm={() => deleteItem(deleting.id)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
