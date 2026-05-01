import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import { ConfirmModal } from '../components/ui/Modal';
import './Vendors.css';

const VENDOR_TYPES = ['Photography', 'Catering', 'Decor', 'Music', 'Attire', 'Priest', 'Transport', 'Makeup', 'Mehendi', 'Other'];
const VENDOR_STATUSES = [
  { key: 'contacted',    label: 'Contacted',    color: 'var(--text-muted)' },
  { key: 'negotiating', label: 'Negotiating',  color: 'var(--amber)' },
  { key: 'booked',      label: 'Booked',       color: 'var(--teal)' },
  { key: 'deposit-paid',label: 'Deposit Paid', color: 'var(--gold)' },
  { key: 'fully-paid',  label: 'Fully Paid',   color: 'var(--green)' },
  { key: 'cancelled',   label: 'Cancelled',    color: 'var(--red)' },
];

function fmt(n) { return Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }); }

const BLANK = { name: '', type: 'Photography', contactName: '', phone: '', email: '', website: '', packageName: '', packageCost: '', depositPaid: '', totalPaid: '', status: 'contacted', bookingDate: '', notes: '' };

export default function Vendors() {
  const { id } = useParams();
  const toast = useToast();
  const [vendors, setVendors]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState(BLANK);
  const [editing, setEditing]     = useState(null);
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState(null);

  useEffect(() => {
    api.vendors.list(id)
      .then(r => setVendors(r.vendors || []))
      .catch(() => toast('Failed to load vendors', 'error'))
      .finally(() => setLoading(false));
  }, [id]);

  function openNew()  { setForm({ ...BLANK, customType: '' }); setEditing(null); setShowModal(true); }
  function openEdit(v) {
    const isKnown = VENDOR_TYPES.includes(v.type);
    setForm({ ...v, type: isKnown ? v.type : 'Other', customType: isKnown ? '' : v.type });
    setEditing(v.id);
    setShowModal(true);
  }

  async function save() {
    if (!form.name.trim()) { toast('Vendor name is required', 'error'); return; }
    setSaving(true);
    try {
      const payload = { ...form };
      if (payload.type === 'Other' && payload.customType?.trim()) {
        payload.type = payload.customType.trim();
      }

      if (editing) {
        const r = await api.vendors.update(id, editing, payload);
        setVendors(prev => prev.map(v => v.id === editing ? r.vendor : v));
      } else {
        const r = await api.vendors.create(id, payload);
        setVendors(prev => [...prev, r.vendor]);
      }
      setShowModal(false);
      toast(editing ? 'Updated!' : 'Added!', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function deleteVendor(vid) {
    try {
      await api.vendors.remove(id, vid);
      setVendors(prev => prev.filter(v => v.id !== vid));
      setDeleting(null);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  const filtered = statusFilter ? vendors.filter(v => v.status === statusFilter) : vendors;

  if (loading) return <div className="loading-center"><div className="spinner spinner-lg" /></div>;

  return (
    <div className="page-fade">
      <div className="page-header">
        <div>
          <h1 className="page-title">Vendors</h1>
          <p className="page-subtitle">Manage your wedding service providers</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Add Vendor</button>
      </div>

      {/* Status filter */}
      <div className="vendor-filters">
        <button className={`pill ${!statusFilter ? 'active' : ''}`} onClick={() => setStatusFilter('')}>All</button>
        {VENDOR_STATUSES.map(s => (
          <button key={s.key} className={`pill ${statusFilter === s.key ? 'active' : ''}`} onClick={() => setStatusFilter(s.key)}>
            {s.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state" style={{ padding: '40px 0' }}>
          <div className="empty-icon">🤝</div>
          <div className="empty-title">No vendors yet</div>
          <div className="empty-desc">Add photographers, caterers, decorators and more.</div>
        </div>
      ) : (
        <div className="vendor-grid">
          {filtered.map(v => {
            const statusMeta = VENDOR_STATUSES.find(s => s.key === v.status) || VENDOR_STATUSES[0];
            const packageCost = Number(v.packageCost || 0);
            const totalPaid   = Number(v.totalPaid || 0);
            const payPct = packageCost ? Math.min(100, Math.round((totalPaid / packageCost) * 100)) : 0;
            return (
              <div key={v.id} className="vendor-card">
                <div className="vendor-card-header">
                  <div>
                    <div className="vendor-name">{v.name}</div>
                    <div className="vendor-type">{v.type}</div>
                  </div>
                  <span className="vendor-status" style={{ background: `${statusMeta.color}20`, color: statusMeta.color }}>
                    {statusMeta.label}
                  </span>
                </div>
                {v.contactName && <div className="vendor-contact-name">{v.contactName}</div>}
                <div className="vendor-actions-row">
                  {v.phone && <a href={`tel:${v.phone}`} className="btn btn-ghost btn-sm">📞 Call</a>}
                  {v.email && <a href={`mailto:${v.email}`} className="btn btn-ghost btn-sm">📧 Email</a>}
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(v)}>✏️ Edit</button>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)', marginLeft: 'auto' }} onClick={() => setDeleting(v)}>✕</button>
                </div>
                {packageCost > 0 && (
                  <div className="vendor-payment">
                    <div className="vendor-payment-labels">
                      <span>₹{fmt(totalPaid)} paid</span>
                      <span>of ₹{fmt(packageCost)}</span>
                    </div>
                    <div className="vendor-pay-bar-wrap">
                      <div className="vendor-pay-bar" style={{ width: `${payPct}%` }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="modal-card modal-card-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Edit Vendor' : 'Add Vendor'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Name <span className="req">*</span></label>
                <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  {VENDOR_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
                {form.type === 'Other' && (
                  <input className="form-input" style={{ marginTop: 6 }} placeholder="Type name" value={form.customType || ''} onChange={e => setForm(f => ({ ...f, customType: e.target.value }))} />
                )}
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Contact Name</label>
                <input className="form-input" value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {VENDOR_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Package Cost (₹)</label>
                <input className="form-input" type="number" value={form.packageCost} onChange={e => setForm(f => ({ ...f, packageCost: e.target.value }))} placeholder="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Total Paid (₹)</label>
                <input className="form-input" type="number" value={form.totalPaid} onChange={e => setForm(f => ({ ...f, totalPaid: e.target.value }))} placeholder="0" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? <span className="btn-spinner" /> : null}
                {editing ? 'Update' : 'Add Vendor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <ConfirmModal
          title="Remove Vendor"
          message={`Remove "${deleting.name}"?`}
          confirmText="Remove"
          onConfirm={() => deleteVendor(deleting.id)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
