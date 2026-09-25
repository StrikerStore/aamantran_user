import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Select } from '../components/ui/Select';
import { useToast } from '../components/ui/Toast';
import { ConfirmModal, Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { Plus, Pencil, Trash2, Check, Wallet } from 'lucide-react';
import './Budget.css';

const EXPENSE_CATS = ['Venue', 'Catering', 'Photography', 'Attire', 'Decor', 'Music', 'Transport', 'Jewellery', 'Invitations', 'Other'];

const BLANK_EXPENSE = { description: '', category: 'Other', vendor: '', amount: '', paid: false, dueDate: '', notes: '' };

function fmt(n) { return Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }); }

export default function Budget() {
  const { id } = useParams();
  const toast = useToast();
  const [budget, setBudget]         = useState(null);
  const [totalInput, setTotalInput] = useState('');
  const [expenses, setExpenses]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [form, setForm]             = useState(BLANK_EXPENSE);
  const [editing, setEditing]       = useState(null);
  const [saving, setSaving]         = useState(false);
  const [savingTotal, setSavingTotal] = useState(false);
  const [deleting, setDeleting]     = useState(null);

  useEffect(() => {
    Promise.all([api.budget.get(id), api.budget.listExpenses(id)])
      .then(([br, er]) => {
        setBudget(br.budget);
        setTotalInput(br.budget?.totalBudget ? String(br.budget.totalBudget) : '');
        setExpenses(er.expenses || []);
      })
      .catch(() => toast('We couldn’t load your budget. Try again.', 'error'))
      .finally(() => setLoading(false));
  }, [id]);

  async function saveTotal() {
    if (!totalInput) return;
    setSavingTotal(true);
    try {
      const r = await api.budget.setTotal(id, { totalBudget: Number(totalInput) });
      setBudget(r.budget);
      toast('Budget saved.', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSavingTotal(false);
    }
  }

  function openNew()  { setForm({ ...BLANK_EXPENSE, customCategory: '' }); setEditing(null); setShowModal(true); }
  function openEdit(e) {
    const isKnown = EXPENSE_CATS.includes(e.category);
    setForm({ ...e, category: isKnown ? e.category : 'Other', customCategory: isKnown ? '' : e.category });
    setEditing(e.id);
    setShowModal(true);
  }

  async function save() {
    if (!form.description || !form.amount) { toast('Add what it’s for and the amount first.', 'error'); return; }
    setSaving(true);
    try {
      const payload = { ...form };
      if (payload.category === 'Other' && payload.customCategory?.trim()) {
        payload.category = payload.customCategory.trim();
      }

      if (editing) {
        const r = await api.budget.updateExpense(id, editing, payload);
        setExpenses(prev => prev.map(x => x.id === editing ? r.expense : x));
      } else {
        const r = await api.budget.addExpense(id, payload);
        setExpenses(prev => [...prev, r.expense]);
      }
      setShowModal(false);
      toast(editing ? 'Expense saved.' : 'Expense added.', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function togglePaid(expense) {
    try {
      const r = await api.budget.updateExpense(id, expense.id, { ...expense, paid: !expense.paid });
      setExpenses(prev => prev.map(x => x.id === expense.id ? r.expense : x));
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function deleteExpense(eid) {
    try {
      await api.budget.removeExpense(id, eid);
      setExpenses(prev => prev.filter(x => x.id !== eid));
      setDeleting(null);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  const totalBudget = Number(budget?.totalBudget || 0);
  const totalSpent  = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalPaid   = expenses.filter(e => e.paid).reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalPending = totalSpent - totalPaid;
  const remaining   = totalBudget - totalSpent;
  const spentPct    = totalBudget ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 0;
  const paidPct     = totalBudget ? Math.min(100, Math.round((totalPaid  / totalBudget) * 100)) : 0;

  // Category breakdown
  const catBreakdown = EXPENSE_CATS.map(cat => {
    const catExp = expenses.filter(e => e.category === cat);
    const catTotal = catExp.reduce((s, e) => s + Number(e.amount || 0), 0);
    return { cat, total: catTotal, count: catExp.length };
  }).filter(x => x.total > 0);

  if (loading) return <div className="loading-center"><div className="spinner spinner-lg" /></div>;

  return (
    <div className="page-fade">
      <section className="feat-shell">
        <PageHeader
          title="Budget"
          subtitle="Set what you want to spend, then add each expense as you book it."
          helpMore="/guide#budget"
          help="“Booked” is everything you’ve added. “Paid” is what’s already paid; “Still to pay” is the rest. Tap “Mark paid” when you pay a bill."
          actions={<button type="button" className="btn btn-primary" onClick={openNew}><Plus size={18} aria-hidden="true" /> Add expense</button>}
        />
      </section>

      {/* Budget setup */}
      <div className="card mb-24">
        <h2 className="card-title"><label htmlFor="budget-total">Your total budget</label></h2>
        <div className="budget-setup-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="budget-currency" aria-hidden="true">₹</span>
            <input
              id="budget-total"
              className="form-input budget-total-input"
              type="number"
              inputMode="numeric"
              placeholder="e.g. 500000"
              value={totalInput}
              onChange={e => setTotalInput(e.target.value)}
            />
          </div>
          <button type="button" className="btn btn-primary" onClick={saveTotal} disabled={savingTotal || !totalInput}>
            {savingTotal ? <span className="btn-spinner" aria-hidden="true" /> : null}
            {totalBudget > 0 ? 'Update budget' : 'Save budget'}
          </button>
        </div>

        {totalBudget > 0 && (
          <>
            {/* Summary */}
            <div className="budget-summary">
              <div className="budget-stat">
                <span className="budget-stat-label">Budget</span>
                <span className="budget-stat-val">₹{fmt(totalBudget)}</span>
              </div>
              <div className="budget-stat">
                <span className="budget-stat-label">Booked</span>
                <span className="budget-stat-val" style={{ color: 'var(--gold-text)' }}>₹{fmt(totalSpent)}</span>
              </div>
              <div className="budget-stat">
                <span className="budget-stat-label">Paid</span>
                <span className="budget-stat-val" style={{ color: 'var(--green)' }}>₹{fmt(totalPaid)}</span>
              </div>
              <div className="budget-stat">
                <span className="budget-stat-label">Still to pay</span>
                <span className="budget-stat-val" style={{ color: 'var(--amber)' }}>₹{fmt(totalPending)}</span>
              </div>
              <div className="budget-stat">
                <span className="budget-stat-label">{remaining < 0 ? 'Over budget' : 'Left in budget'}</span>
                <span className="budget-stat-val" style={{ color: remaining < 0 ? 'var(--red)' : 'var(--green)' }}>
                  ₹{fmt(Math.abs(remaining))}
                </span>
              </div>
            </div>

            {/* Bar */}
            <div className="budget-bar-wrap">
              <div className="budget-bar" role="img" aria-label={`Paid ${paidPct}%, booked ${spentPct}% of your budget`}>
                <div className="budget-bar-paid"  style={{ width: `${paidPct}%` }} />
                <div className="budget-bar-spent" style={{ width: `${Math.max(0, spentPct - paidPct)}%` }} />
              </div>
              <div className="budget-bar-labels">
                <span style={{ color: 'var(--green)' }}>Paid {paidPct}%</span>
                <span style={{ color: 'var(--gold-text)' }}>Booked {spentPct}%</span>
                <span style={{ color: 'var(--text-muted)' }}>Left {100 - spentPct}%</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Category breakdown */}
      {catBreakdown.length > 0 && (
        <div className="card mb-24">
          <h2 className="card-title">By category</h2>
          {catBreakdown.map(({ cat, total }) => (
            <div key={cat} className="budget-cat-row">
              <span className="budget-cat-name">{cat}</span>
              <div className="budget-cat-bar-wrap">
                <div className="budget-cat-bar" style={{ width: `${totalSpent ? Math.round((total/totalSpent)*100) : 0}%` }} />
              </div>
              <span className="budget-cat-amt">₹{fmt(total)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Expense list */}
      <div className="card">
        <h2 className="card-title">Expenses</h2>
        {expenses.length === 0 ? (
          <EmptyState
            icon={Wallet}
            tone="mint"
            title="No expenses yet"
            action={<button type="button" className="btn btn-primary" onClick={openNew}><Plus size={18} aria-hidden="true" /> Add your first expense</button>}
          >
            Add each booking — venue, caterer, outfits — to see where the money goes.
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="data-table table-stack">
              <thead>
                <tr><th>What for</th><th>Category</th><th>Amount</th><th>Paid?</th><th><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                {expenses.map(e => (
                  <tr key={e.id}>
                    <td data-label="What for" style={{ fontWeight: 600 }}>{e.description}{e.vendor ? <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · {e.vendor}</span> : ''}</td>
                    <td data-label="Category">{e.category}</td>
                    <td data-label="Amount" style={{ fontWeight: 600 }}>₹{fmt(e.amount)}</td>
                    <td data-label="Paid?">
                      <button
                        type="button"
                        className={`btn btn-sm ${e.paid ? 'btn-secondary' : 'btn-ghost'}`}
                        style={{ color: e.paid ? 'var(--green)' : undefined }}
                        aria-pressed={!!e.paid}
                        onClick={() => togglePaid(e)}
                      >
                        {e.paid ? <><Check size={15} aria-hidden="true" /> Paid</> : 'Mark paid'}
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(e)} aria-label={`Edit “${e.description}”`}><Pencil size={15} aria-hidden="true" /> Edit</button>
                        <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => setDeleting(e)} aria-label={`Delete “${e.description}”`}><Trash2 size={15} aria-hidden="true" /> Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <Modal
          title={editing ? 'Edit expense' : 'Add an expense'}
          onClose={() => !saving && setShowModal(false)}
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={saving}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? <span className="btn-spinner" aria-hidden="true" /> : null}
                {editing ? 'Save changes' : 'Add expense'}
              </button>
            </>
          }
        >
          <div className="form-group">
            <label className="form-label" htmlFor="exp-desc">What is it for?</label>
            <input id="exp-desc" className="form-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Photographer advance" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="exp-cat">Category</label>
              <Select id="exp-cat" className="form-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {EXPENSE_CATS.map(c => <option key={c}>{c}</option>)}
              </Select>
              {form.category === 'Other' && (
                <input className="form-input" style={{ marginTop: 6 }} placeholder="Name the category" aria-label="Category name" value={form.customCategory || ''} onChange={e => setForm(f => ({ ...f, customCategory: e.target.value }))} />
              )}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="exp-amt">Amount (₹)</label>
              <input id="exp-amt" className="form-input" type="number" inputMode="numeric" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="exp-vendor">Paid to <span className="form-optional">(optional)</span></label>
              <input id="exp-vendor" className="form-input" value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} placeholder="Vendor or shop" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="exp-due">Pay by <span className="form-optional">(optional)</span></label>
              <input id="exp-due" className="form-input" type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
            </div>
          </div>
          <label className="check-row">
            <input type="checkbox" checked={!!form.paid} onChange={e => setForm(f => ({ ...f, paid: e.target.checked }))} />
            Already paid
          </label>
        </Modal>
      )}

      {deleting && (
        <ConfirmModal
          title="Delete this expense?"
          message={`“${deleting.description}” (₹${fmt(deleting.amount)}) will be removed from your budget.`}
          confirmText="Delete expense"
          onConfirm={() => deleteExpense(deleting.id)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
