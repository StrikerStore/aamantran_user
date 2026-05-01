import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import { ConfirmModal } from '../components/ui/Modal';
import './Tasks.css';

const CATEGORIES = ['Venue', 'Catering', 'Photography', 'Attire', 'Invitations', 'Decor', 'Travel', 'Other'];
const PRIORITIES  = ['low', 'medium', 'high'];
const ASSIGNEES   = ['bride', 'groom', 'family', 'vendor'];
const STATUSES    = ['todo', 'inprogress', 'done'];

const COLUMN_META = {
  todo:       { label: 'To Do',       emoji: '📋', empty: 'Nothing here yet — add your first task!' },
  inprogress: { label: 'In Progress', emoji: '⚡', empty: 'Move a task here when you start it.' },
  done:       { label: 'Done',        emoji: '🎉', empty: 'Completed tasks will appear here.' },
};

const PRIORITY_COLOR = { high: 'var(--red)', medium: 'var(--amber)', low: 'var(--green)' };

function today() { return new Date().toISOString().slice(0, 10); }
function isOverdue(t) { return t.status !== 'done' && t.dueDate && t.dueDate < today(); }
function isDueToday(t) { return t.status !== 'done' && t.dueDate && t.dueDate === today(); }

const BLANK = { title: '', category: 'Other', dueDate: '', priority: 'medium', assignedTo: 'bride', notes: '', status: 'todo' };

export default function Tasks() {
  const { id } = useParams();
  const toast = useToast();
  const [tasks, setTasks]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState('all');
  const [catFilter, setCatFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState(BLANK);
  const [editing, setEditing]     = useState(null);
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState(null);

  useEffect(() => {
    api.tasks.list(id)
      .then(r => setTasks(r.tasks || []))
      .catch(() => toast('Failed to load tasks', 'error'))
      .finally(() => setLoading(false));
  }, [id]);

  function openNew() { setForm(BLANK); setEditing(null); setShowModal(true); }
  function openEdit(t) { setForm({ ...t }); setEditing(t.id); setShowModal(true); }

  async function save() {
    if (!form.title.trim()) { toast('Title is required', 'error'); return; }
    setSaving(true);
    try {
      if (editing) {
        const r = await api.tasks.update(id, editing, form);
        setTasks(prev => prev.map(t => t.id === editing ? r.task : t));
      } else {
        const r = await api.tasks.create(id, form);
        setTasks(prev => [...prev, r.task]);
      }
      setShowModal(false);
      toast(editing ? 'Task updated!' : 'Task added!', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function moveStatus(task, status) {
    try {
      const r = await api.tasks.update(id, task.id, { ...task, status });
      setTasks(prev => prev.map(t => t.id === task.id ? r.task : t));
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function deleteTask(taskId) {
    try {
      await api.tasks.remove(id, taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
      setDeleting(null);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  const now = today();
  const filtered = tasks.filter(t => {
    if (catFilter && t.category !== catFilter) return false;
    if (filter === 'today')    return isDueToday(t);
    if (filter === 'week')     return t.status !== 'done' && t.dueDate >= now && t.dueDate <= new Date(Date.now() + 7*86400000).toISOString().slice(0,10);
    if (filter === 'overdue')  return isOverdue(t);
    if (filter === 'done')     return t.status === 'done';
    return true;
  });

  const urgentCount = tasks.filter(t => isOverdue(t) || isDueToday(t)).length;
  const allDone = tasks.length > 0 && tasks.every(t => t.status === 'done');

  if (loading) return <div className="loading-center"><div className="spinner spinner-lg" /></div>;

  return (
    <div className="page-fade">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tasks</h1>
          <p className="page-subtitle">Keep track of everything for your big day</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Add Task</button>
      </div>

      {urgentCount > 0 && (
        <div className="tasks-alert">
          ⚠️ {urgentCount} task{urgentCount > 1 ? 's' : ''} need{urgentCount === 1 ? 's' : ''} attention today
        </div>
      )}
      {allDone && (
        <div className="tasks-allclear">You're all caught up! 🎊</div>
      )}

      {/* Filter bar */}
      <div className="tasks-filters">
        <div className="pill-group">
          {['all','today','week','overdue','done'].map(f => (
            <button key={f} className={`pill ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'today' ? 'Today' : f === 'week' ? 'This Week' : f === 'overdue' ? 'Overdue' : 'Done'}
            </button>
          ))}
        </div>
        <select className="form-select tasks-cat-select" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Kanban */}
      <div className="kanban-board">
        {STATUSES.map(status => {
          const col = filtered.filter(t => t.status === status);
          const meta = COLUMN_META[status];
          return (
            <div key={status} className="kanban-col">
              <div className="kanban-col-header">
                <span>{meta.label}</span>
                <span className="kanban-count">{col.length}</span>
              </div>
              {col.length === 0 ? (
                <div className="kanban-empty">{meta.emoji} {meta.empty}</div>
              ) : (
                col.map(task => (
                  <div
                    key={task.id}
                    className={`task-card ${task.status === 'done' ? 'done' : ''} ${isOverdue(task) ? 'overdue' : ''}`}
                    style={{ borderLeftColor: PRIORITY_COLOR[task.priority] || 'var(--border-default)' }}
                  >
                    <div className="task-card-header">
                      <span className="task-title">{task.title}</span>
                      <button className="btn btn-ghost btn-xs" onClick={() => openEdit(task)}>✏️</button>
                    </div>
                    <div className="task-meta-row">
                      {task.category && <span className="task-pill">{task.category}</span>}
                      {task.assignedTo && <span className="task-pill task-pill-maroon">{task.assignedTo}</span>}
                      {task.dueDate && (
                        <span className={`task-due ${isOverdue(task) ? 'overdue' : ''}`}>
                          📅 {task.dueDate}
                        </span>
                      )}
                    </div>
                    <div className="task-actions">
                      {task.status === 'todo' && (
                        <button className="btn btn-ghost btn-xs" onClick={() => moveStatus(task, 'inprogress')}>→ Start</button>
                      )}
                      {task.status === 'inprogress' && (
                        <button className="btn btn-ghost btn-xs" style={{ color: 'var(--green)' }} onClick={() => moveStatus(task, 'done')}>✓ Done</button>
                      )}
                      {task.status === 'done' && (
                        <button className="btn btn-ghost btn-xs" onClick={() => moveStatus(task, 'todo')}>↩ Reopen</button>
                      )}
                      <button className="btn btn-ghost btn-xs" style={{ color: 'var(--red)', marginLeft: 'auto' }} onClick={() => setDeleting(task)}>✕</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Edit Task' : 'Add Task'}</h2>
              <button className="modal-close" onClick={() => !saving && setShowModal(false)}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Title <span className="req">*</span></label>
              <input className="form-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Book photographer" autoFocus />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input className="form-input" type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Priority</label>
              <div className="pill-group">
                {PRIORITIES.map(p => (
                  <button key={p} type="button"
                    className={`pill ${form.priority === p ? 'active' : ''}`}
                    style={form.priority === p ? { background: PRIORITY_COLOR[p], borderColor: PRIORITY_COLOR[p], color: '#fff' } : {}}
                    onClick={() => setForm(f => ({ ...f, priority: p }))}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Assigned To</label>
              <div className="pill-group">
                {ASSIGNEES.map(a => (
                  <button key={a} type="button"
                    className={`pill ${form.assignedTo === a ? 'active' : ''}`}
                    onClick={() => setForm(f => ({ ...f, assignedTo: a }))}
                  >
                    {a.charAt(0).toUpperCase() + a.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional details..." rows={2} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? <span className="btn-spinner" /> : null}
                {editing ? 'Update' : 'Add Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <ConfirmModal
          title="Delete Task"
          message={`Delete "${deleting.title}"?`}
          confirmText="Delete"
          onConfirm={() => deleteTask(deleting.id)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
