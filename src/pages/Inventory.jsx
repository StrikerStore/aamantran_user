import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useCouple } from '../lib/couple';
import { Select } from '../components/ui/Select';
import { useToast } from '../components/ui/Toast';
import { ConfirmModal, Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { Plus, Pencil, Trash2, MapPin, BellRing, Shirt, Gem, Flower2, UtensilsCrossed, FileText, Gift, Package, SearchX } from '../components/ui/icons';
import './Inventory.css';

// `label` is what is saved on the item (kept as-is so saved items still match);
// `name` is what the couple reads.
const CATEGORIES = [
  // "<couple>'s …" sub-categories are filled per event from the couple (see coupleSubs).
  { label: 'Attire',     icon: Shirt,           subs: ['Family','Accessories'], coupleSub: 'Outfit' },
  { label: 'Jewelry',    name: 'Jewellery', icon: Gem, subs: ['Family'], coupleSub: 'Jewellery' },
  { label: 'Decoration', icon: Flower2,         subs: ['Flowers','Lighting','Mandap','Table Decor','Entrance'] },
  { label: 'Catering',   icon: UtensilsCrossed, subs: ['Crockery','Furniture','Ingredients'] },
  { label: 'Documents',  icon: FileText,        subs: ['Marriage Cert','Venue Booking','Contracts'] },
  { label: 'Gifts',      icon: Gift,            subs: ['Received','Return Gifts','Wrapping'] },
  { label: 'Other',      icon: Package,         subs: [] },
];
const catName = (c) => c.name || c.label;

const STATUSES = [
  { key: 'to-buy',   label: 'To buy',    color: 'var(--amber)' },
  { key: 'ordered',  label: 'Ordered',   color: 'var(--sky-deep)' },
  { key: 'received', label: 'Received',  color: 'var(--mint-deep)' },
  { key: 'packed',   label: 'Packed',    color: 'var(--maroon)' },
  { key: 'at-venue', label: 'At venue',  color: 'var(--gold-text)' },
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
  const couple = useCouple(id);

  useEffect(() => {
    api.inventory.list(id)
      .then(r => setItems(r.items || []))
      .catch(() => toast('We couldn’t load your items. Try again.', 'error'))
      .finally(() => setLoading(false));
  }, [id]);

  function openNew() { setForm({ ...BLANK, customCategory: '' }); setEditing(null); setShowModal(true); }
  function openEdit(item) {
    const isKnown = CATEGORIES.some(c => c.label === item.category);
    setForm({ ...item, category: isKnown ? item.category : 'Other', customCategory: isKnown ? '' : item.category });
    setEditing(item.id);
    setShowModal(true);
  }

  const selectedCat = CATEGORIES.find(c => c.label === form.category);
  // "Groom's Outfit" / "Bride's Outfit" — or "Rahul's Outfit" until a role is picked.
  const coupleSubs  = selectedCat?.coupleSub ? couple.map(m => `${m.label}'s ${selectedCat.coupleSub}`) : [];
  const subOptions  = [...coupleSubs, ...(selectedCat?.subs || [])];
  // An item saved under an older name ("Bride's Outfit") keeps showing it.
  if (form.subCategory && selectedCat && !subOptions.includes(form.subCategory)) subOptions.unshift(form.subCategory);

  async function save() {
    if (!form.name.trim()) { toast('Give the item a name first.', 'error'); return; }
    setSaving(true);
    try {
      const payload = { ...form };
      if (payload.category === 'Other' && payload.customCategory?.trim()) {
        payload.category = payload.customCategory.trim();
      }
      
      if (editing) {
        const r = await api.inventory.update(id, editing, payload);
        setItems(prev => prev.map(t => t.id === editing ? r.item : t));
      } else {
        const r = await api.inventory.create(id, payload);
        setItems(prev => [...prev, r.item]);
      }
      setShowModal(false);
      toast(editing ? 'Item saved.' : 'Item added.', 'success');
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
      <section className="feat-shell">
        <PageHeader
          title="Inventory"
          subtitle="Everything you need to buy, collect and carry — and where it is."
          helpMore="/guide#inventory"
          help="Add each thing you need (outfits, jewellery, décor, documents…). Move it along from To buy → Ordered → Received → Packed → At venue. Set a reminder date to get a nudge here."
          actions={<button type="button" className="btn btn-primary" onClick={openNew}><Plus size={18} aria-hidden="true" /> Add item</button>}
        />

        {reminders.length > 0 && (
          <div className="inv-alert" role="status">
            <BellRing size={18} aria-hidden="true" /> {reminders.length} item{reminders.length > 1 ? 's have' : ' has'} a reminder due
          </div>
        )}

        <div className="feat-stats">
          <div className="feat-stat">
            <span className="feat-stat-val">{stats.total}</span>
            <span className="feat-stat-label">Total</span>
          </div>
          <div className="feat-stat">
            <span className={`feat-stat-val feat-stat-val--teal`}>{stats.ordered}</span>
            <span className="feat-stat-label">Ordered</span>
          </div>
          <div className="feat-stat">
            <span className="feat-stat-val feat-stat-val--green">{stats.received}</span>
            <span className="feat-stat-label">Received</span>
          </div>
          <div className="feat-stat">
            <span className="feat-stat-val feat-stat-val--maroon">{stats.packed}</span>
            <span className="feat-stat-label">Packed or at venue</span>
          </div>
        </div>

        <div className="feat-hub">
          <div className="feat-hub-pills feat-hub-pills--scroll">
            <button type="button" aria-pressed={!catFilter} className={`inv-cat-tab ${!catFilter ? 'active' : ''}`} onClick={() => setCatFilter('')}>All</button>
            {CATEGORIES.map(c => {
              const Icon = c.icon;
              return (
                <button type="button" key={c.label} aria-pressed={catFilter === c.label} className={`inv-cat-tab ${catFilter === c.label ? 'active' : ''}`} onClick={() => setCatFilter(c.label)}>
                  <Icon size={15} aria-hidden="true" /> {catName(c)}
                </button>
              );
            })}
          </div>
          <div className="feat-hub-tools">
            <input className="form-input" placeholder="Search items…" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search items" />
            <Select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Filter by status">
              <option value="">All statuses</option>
              {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </Select>
          </div>
        </div>
      </section>

      {/* Items grid */}
      {items.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No items yet"
          action={<button type="button" className="btn btn-primary" onClick={openNew}><Plus size={18} aria-hidden="true" /> Add your first item</button>}
        >
          Add outfits, jewellery, décor or documents so nothing gets forgotten on the day.
        </EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={SearchX}
          tone="sky"
          title="Nothing matches"
          action={<button type="button" className="btn btn-secondary" onClick={() => { setSearch(''); setCatFilter(''); setStatusFilter(''); }}>Show all items</button>}
        >
          Try another word, or clear the filters.
        </EmptyState>
      ) : (
        <div className="inv-grid">
          {filtered.map(item => {
            const statusMeta = STATUSES.find(s => s.key === item.status) || STATUSES[0];
            const catMeta    = CATEGORIES.find(c => c.label === item.category);
            const CatIcon    = catMeta?.icon || Package;
            return (
              <div key={item.id} className="inv-card">
                <div className="inv-card-top">
                  <span className="inv-card-icon" title={catMeta ? catName(catMeta) : item.category}><CatIcon size={20} aria-hidden="true" /></span>
                  <span className="inv-status-badge" style={{ background: `color-mix(in srgb, ${statusMeta.color} 14%, transparent)`, color: statusMeta.color }}>
                    {statusMeta.label}
                  </span>
                </div>
                <div className="inv-card-name">{item.name}</div>
                {item.subCategory && <div className="inv-card-sub">{item.subCategory}</div>}
                {item.location && <div className="inv-card-meta"><MapPin size={13} aria-hidden="true" /> {item.location}</div>}
                {item.quantity && <div className="inv-card-meta">{item.quantity} {item.unit || 'pcs'}</div>}
                {item.reminderDate && item.reminderDate <= now && item.status !== 'done' && (
                  <div className="inv-reminder-badge"><BellRing size={12} aria-hidden="true" /> Reminder due{item.reminderNote ? `: ${item.reminderNote}` : ''}</div>
                )}
                <div className="inv-card-actions">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(item)} aria-label={`Edit “${item.name}”`}>
                    <Pencil size={15} aria-hidden="true" /> Edit
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => setDeleting(item)} aria-label={`Delete “${item.name}”`}>
                    <Trash2 size={15} aria-hidden="true" /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / edit */}
      {showModal && (
        <Modal
          size="full"
          title={editing ? 'Edit item' : 'Add an item'}
          onClose={() => !saving && setShowModal(false)}
          primaryAction={{ label: editing ? 'Save' : 'Add item', onClick: save, loading: saving }}
        >
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="inv-name">What is it?</label>
              <input id="inv-name" className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Bridal lehenga" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="inv-status">Where is it now?</label>
              <Select id="inv-status" className="form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </Select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="inv-cat">Category</label>
              <Select id="inv-cat" className="form-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value, subCategory: '' }))}>
                {CATEGORIES.map(c => <option key={c.label} value={c.label}>{catName(c)}</option>)}
              </Select>
              {form.category === 'Other' && (
                <input className="form-input" style={{ marginTop: 6 }} placeholder="Name the category" aria-label="Category name" value={form.customCategory || ''} onChange={e => setForm(f => ({ ...f, customCategory: e.target.value }))} />
              )}
            </div>
            {subOptions.length > 0 && (
              <div className="form-group">
                <label className="form-label" htmlFor="inv-sub">Type <span className="form-optional">(optional)</span></label>
                <Select id="inv-sub" className="form-select" value={form.subCategory} onChange={e => setForm(f => ({ ...f, subCategory: e.target.value }))}>
                  <option value="">Choose…</option>
                  {subOptions.map(s => <option key={s}>{s}</option>)}
                </Select>
              </div>
            )}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="inv-qty">How many?</label>
              <input id="inv-qty" className="form-input" type="number" inputMode="numeric" min="1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="inv-unit">Counted in</label>
              <input id="inv-unit" className="form-input" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="pcs, sets, kg…" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="inv-where">Kept where? <span className="form-optional">(optional)</span></label>
              <input id="inv-where" className="form-input" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Mum’s cupboard" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="inv-who">Who’s looking after it? <span className="form-optional">(optional)</span></label>
              <input id="inv-who" className="form-input" value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} placeholder="Name or role" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="inv-est">Expected cost (₹) <span className="form-optional">(optional)</span></label>
              <input id="inv-est" className="form-input" type="number" inputMode="numeric" value={form.estimatedCost} onChange={e => setForm(f => ({ ...f, estimatedCost: e.target.value }))} placeholder="0" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="inv-act">Paid (₹) <span className="form-optional">(optional)</span></label>
              <input id="inv-act" className="form-input" type="number" inputMode="numeric" value={form.actualCost} onChange={e => setForm(f => ({ ...f, actualCost: e.target.value }))} placeholder="0" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="inv-rdate">Remind me on <span className="form-optional">(optional)</span></label>
              <input id="inv-rdate" className="form-input" type="date" value={form.reminderDate} onChange={e => setForm(f => ({ ...f, reminderDate: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="inv-rnote">Remind me to… <span className="form-optional">(optional)</span></label>
              <input id="inv-rnote" className="form-input" value={form.reminderNote} onChange={e => setForm(f => ({ ...f, reminderNote: e.target.value }))} placeholder="e.g. Collect from tailor" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="inv-notes">Notes <span className="form-optional">(optional)</span></label>
            <textarea id="inv-notes" className="form-textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
          </div>
        </Modal>
      )}

      {deleting && (
        <ConfirmModal
          title="Delete this item?"
          message={`“${deleting.name}” will be removed from your inventory.`}
          confirmText="Delete item"
          onConfirm={() => deleteItem(deleting.id)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
