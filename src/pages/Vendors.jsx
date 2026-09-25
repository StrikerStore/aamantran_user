import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Select } from '../components/ui/Select';
import { useToast } from '../components/ui/Toast';
import { ConfirmModal, Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { Plus, Pencil, Trash2, Phone, Mail, Handshake, Filter } from 'lucide-react';
import './Vendors.css';

const VENDOR_TYPES = ['Photography', 'Catering', 'Decor', 'Music', 'Attire', 'Priest', 'Transport', 'Makeup', 'Mehendi', 'Other'];
const VENDOR_STATUSES = [
  { key: 'contacted',    label: 'Contacted',    color: 'var(--text-muted)' },
  { key: 'negotiating', label: 'Negotiating',  color: 'var(--amber)' },
  { key: 'booked',      label: 'Booked',       color: 'var(--sky-deep)' },
  { key: 'deposit-paid',label: 'Advance paid', color: 'var(--gold-text)' },
  { key: 'fully-paid',  label: 'Fully paid',   color: 'var(--mint-deep)' },
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
      .catch(() => toast('We couldn’t load your vendors. Try again.', 'error'))
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
    if (!form.name.trim()) { toast('Add the vendor’s name first.', 'error'); return; }
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
      toast(editing ? 'Vendor saved.' : 'Vendor added.', 'success');
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
  const nBooked = vendors.filter(v => ['booked', 'deposit-paid', 'fully-paid'].includes(v.status)).length;
  const nPipeline = vendors.filter(v => ['contacted', 'negotiating'].includes(v.status)).length;

  if (loading) return <div className="loading-center"><div className="spinner spinner-lg" /></div>;

  return (
    <div className="page-fade">
      <section className="feat-shell">
        <PageHeader
          title="Vendors"
          subtitle="Photographers, caterers, decorators — who you’ve spoken to and what you’ve paid."
          helpMore="/guide#vendors"
          help="Add each vendor you talk to, then update where things stand: Contacted → Negotiating → Booked → Advance paid → Fully paid. Call or email them straight from their card."
          actions={<button type="button" className="btn btn-primary" onClick={openNew}><Plus size={18} aria-hidden="true" /> Add vendor</button>}
        />

        <div className="feat-stats">
          <div className="feat-stat">
            <span className="feat-stat-val">{vendors.length}</span>
            <span className="feat-stat-label">Vendors</span>
          </div>
          <div className="feat-stat">
            <span className="feat-stat-val feat-stat-val--teal">{nBooked}</span>
            <span className="feat-stat-label">Booked</span>
          </div>
          <div className="feat-stat">
            <span className="feat-stat-val feat-stat-val--amber">{nPipeline}</span>
            <span className="feat-stat-label">In talks</span>
          </div>
        </div>

        <div className="feat-hub">
          <div className="feat-hub-pills feat-hub-pills--scroll">
            <button type="button" aria-pressed={!statusFilter} className={`pill ${!statusFilter ? 'active' : ''}`} onClick={() => setStatusFilter('')}>All</button>
            {VENDOR_STATUSES.map(s => (
              <button type="button" key={s.key} aria-pressed={statusFilter === s.key} className={`pill ${statusFilter === s.key ? 'active' : ''}`} onClick={() => setStatusFilter(s.key)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {filtered.length === 0 ? (
        vendors.length === 0 ? (
          <EmptyState
            icon={Handshake}
            title="No vendors yet"
            action={<button type="button" className="btn btn-primary" onClick={openNew}><Plus size={18} aria-hidden="true" /> Add your first vendor</button>}
          >
            Add photographers, caterers, decorators and more to keep their numbers and payments in one place.
          </EmptyState>
        ) : (
          <EmptyState
            icon={Filter}
            tone="sky"
            title="No vendors with this status"
            action={<button type="button" className="btn btn-secondary" onClick={() => setStatusFilter('')}>Show all vendors</button>}
          />
        )
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
                  <span className="vendor-status" style={{ background: `color-mix(in srgb, ${statusMeta.color} 14%, transparent)`, color: statusMeta.color }}>
                    {statusMeta.label}
                  </span>
                </div>
                {v.contactName && <div className="vendor-contact-name">{v.contactName}</div>}
                <div className="vendor-actions-row">
                  {v.phone && <a href={`tel:${v.phone}`} className="btn btn-ghost btn-sm"><Phone size={15} aria-hidden="true" /> Call</a>}
                  {v.email && <a href={`mailto:${v.email}`} className="btn btn-ghost btn-sm"><Mail size={15} aria-hidden="true" /> Email</a>}
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(v)} aria-label={`Edit ${v.name}`}><Pencil size={15} aria-hidden="true" /> Edit</button>
                  <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--red)', marginLeft: 'auto' }} onClick={() => setDeleting(v)} aria-label={`Delete ${v.name}`}><Trash2 size={15} aria-hidden="true" /> Delete</button>
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

      {showModal && (
        <Modal
          size="full"
          title={editing ? 'Edit vendor' : 'Add a vendor'}
          onClose={() => !saving && setShowModal(false)}
          primaryAction={{ label: editing ? 'Save' : 'Add vendor', onClick: save, loading: saving }}
        >
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="v-name">Business name</label>
              <input id="v-name" className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Pixel Studio" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="v-type">What do they do?</label>
              <Select id="v-type" className="form-select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {VENDOR_TYPES.map(t => <option key={t}>{t}</option>)}
              </Select>
              {form.type === 'Other' && (
                <input className="form-input" style={{ marginTop: 6 }} placeholder="e.g. Florist" aria-label="What they do" value={form.customType || ''} onChange={e => setForm(f => ({ ...f, customType: e.target.value }))} />
              )}
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="v-contact">Person to talk to <span className="form-optional">(optional)</span></label>
              <input id="v-contact" className="form-input" value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="v-phone">Phone <span className="form-optional">(optional)</span></label>
              <input id="v-phone" className="form-input" type="tel" inputMode="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="v-email">Email <span className="form-optional">(optional)</span></label>
              <input id="v-email" className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="v-status">Where things stand</label>
              <Select id="v-status" className="form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {VENDOR_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </Select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="v-cost">Total price (₹) <span className="form-optional">(optional)</span></label>
              <input id="v-cost" className="form-input" type="number" inputMode="numeric" value={form.packageCost} onChange={e => setForm(f => ({ ...f, packageCost: e.target.value }))} placeholder="0" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="v-paid">Paid so far (₹) <span className="form-optional">(optional)</span></label>
              <input id="v-paid" className="form-input" type="number" inputMode="numeric" value={form.totalPaid} onChange={e => setForm(f => ({ ...f, totalPaid: e.target.value }))} placeholder="0" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="v-notes">Notes <span className="form-optional">(optional)</span></label>
            <textarea id="v-notes" className="form-textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
          </div>
        </Modal>
      )}

      {deleting && (
        <ConfirmModal
          title="Delete this vendor?"
          message={`${deleting.name} and their details will be deleted.`}
          confirmText="Delete vendor"
          onConfirm={() => deleteVendor(deleting.id)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
