import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import { ConfirmModal } from '../components/ui/Modal';
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
      .catch(() => toast('Failed to load budget', 'error'))
      .finally(() => setLoading(false));
  }, [id]);

  async function saveTotal() {
    if (!totalInput) return;
    setSavingTotal(true);
    try {
      const r = await api.budget.setTotal(id, { totalBudget: Number(totalInput) });
      setBudget(r.budget);
      toast('Budget set!', 'success');
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
    if (!form.description || !form.amount) { toast('Description and amount are required', 'error'); return; }
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
      toast(editing ? 'Updated!' : 'Added!', 'success');
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
      <div className="page-header">
        <div>
          <h1 className="page-title">Budget</h1>
          <p className="page-subtitle">Track your wedding expenses</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Add Expense</button>
      </div>

      {/* Budget setup */}
      <div className="card mb-24">
        <div className="card-title">Total Budget</div>
        <div className="budget-setup-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="budget-currency">₹</span>
            <input
              className="form-input budget-total-input"
              type="number"
              placeholder="Enter your total budget"
              value={totalInput}
              onChange={e => setTotalInput(e.target.value)}
            />
          </div>
          <button className="btn btn-primary btn-sm" onClick={saveTotal} disabled={savingTotal || !totalInput}>
            {savingTotal ? <span className="btn-spinner" /> : 'Set Budget'}
          </button>
        </div>

        {totalBudget > 0 && (
          <>
            {/* Summary */}
            <div className="budget-summary">
              <div className="budget-stat">
                <span className="budget-stat-label">Total Budget</span>
                <span className="budget-stat-val">₹{fmt(totalBudget)}</span>
              </div>
              <div className="budget-stat">
                <span className="budget-stat-label">Total Spent</span>
                <span className="budget-stat-val" style={{ color: 'var(--gold)' }}>₹{fmt(totalSpent)}</span>
              </div>
              <div className="budget-stat">
                <span className="budget-stat-label">Paid</span>
                <span className="budget-stat-val" style={{ color: 'var(--green)' }}>₹{fmt(totalPaid)}</span>
              </div>
              <div className="budget-stat">
                <span className="budget-stat-label">Pending</span>
                <span className="budget-stat-val" style={{ color: 'var(--amber)' }}>₹{fmt(totalPending)}</span>
              </div>
              <div className="budget-stat">
                <span className="budget-stat-label">Remaining</span>
                <span className="budget-stat-val" style={{ color: remaining < 0 ? 'var(--red)' : 'var(--green)' }}>
                  ₹{fmt(Math.abs(remaining))}{remaining < 0 ? ' over' : ''}
                </span>
              </div>
            </div>

            {/* Bar */}
            <div className="budget-bar-wrap">
              <div className="budget-bar">
                <div className="budget-bar-paid"  style={{ width: `${paidPct}%` }} />
                <div className="budget-bar-spent" style={{ width: `${Math.max(0, spentPct - paidPct)}%` }} />
              </div>
              <div className="budget-bar-labels">
                <span style={{ color: 'var(--green)' }}>Paid {paidPct}%</span>
                <span style={{ color: 'var(--gold)'  }}>Spent {spentPct}%</span>
                <span style={{ color: 'var(--text-muted)' }}>Remaining {100 - spentPct}%</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Category breakdown */}
      {catBreakdown.length > 0 && (
        <div className="card mb-24">
          <div className="card-title">By Category</div>
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
        <div className="card-title">Expenses</div>
        {expenses.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 0' }}>
            <div className="empty-icon">💰</div>
            <div className="empty-title">No expenses yet</div>
            <div className="empty-desc">Add your first expense to start tracking.</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Description</th><th>Category</th><th>Amount</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {expenses.map(e => (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 600 }}>{e.description}{e.vendor ? <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · {e.vendor}</span> : ''}</td>
                    <td>{e.category}</td>
                    <td style={{ fontWeight: 600 }}>₹{fmt(e.amount)}</td>
                    <td>
                      <button
                        className={`btn btn-sm ${e.paid ? 'btn-secondary' : 'btn-ghost'}`}
                        style={{ fontSize: '0.72rem', color: e.paid ? 'var(--green)' : undefined }}
                        onClick={() => togglePaid(e)}
                      >
                        {e.paid ? '✓ Paid' : 'Mark Paid'}
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(e)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setDeleting(e)}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Edit Expense' : 'Add Expense'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Description <span className="req">*</span></label>
              <input className="form-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} autoFocus />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {EXPENSE_CATS.map(c => <option key={c}>{c}</option>)}
                </select>
                {form.category === 'Other' && (
                  <input className="form-input" style={{ marginTop: 6 }} placeholder="Category name" value={form.customCategory || ''} onChange={e => setForm(f => ({ ...f, customCategory: e.target.value }))} />
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Amount (₹) <span className="req">*</span></label>
                <input className="form-input" type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Vendor</label>
                <input className="form-input" value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input className="form-input" type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
              </div>
            </div>
            <label className="form-label" style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', margin: '8px 0' }}>
              <input type="checkbox" checked={form.paid} onChange={e => setForm(f => ({ ...f, paid: e.target.checked }))} />
              Already paid
            </label>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? <span className="btn-spinner" /> : null}
                {editing ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <ConfirmModal
          title="Delete Expense"
          message={`Delete "${deleting.description}"?`}
          confirmText="Delete"
          onConfirm={() => deleteExpense(deleting.id)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
