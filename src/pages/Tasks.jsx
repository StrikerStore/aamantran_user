import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { shortDate } from '../lib/utils';
import { useCouple } from '../lib/couple';
import { Select } from '../components/ui/Select';
import { useToast } from '../components/ui/Toast';
import { ConfirmModal, Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { Plus, Pencil, Trash2, CalendarDays, AlertTriangle, PartyPopper, Play, Check, RotateCcw } from 'lucide-react';
import './Tasks.css';


const CATEGORIES = ['Venue', 'Catering', 'Photography', 'Attire', 'Invitations', 'Decor', 'Travel', 'Other'];
const PRIORITIES  = ['low', 'medium', 'high'];
// person1/person2 are the couple; they are shown by the role they picked ("Groom") or their name.
const ASSIGNEES   = ['person1', 'person2', 'family', 'vendor'];
const STATUSES    = ['todo', 'inprogress', 'done'];

const COLUMN_META = {
  todo:       { label: 'To do',       empty: 'Nothing here yet — add your first task.' },
  inprogress: { label: 'In progress', empty: 'Press “Start” on a task to move it here.' },
  done:       { label: 'Done',        empty: 'Finished tasks appear here.' },
};

const PRIORITY_COLOR = { high: 'var(--red)', medium: 'var(--amber)', low: 'var(--green)' };

function today() { return new Date().toISOString().slice(0, 10); }
function isOverdue(t) { return t.status !== 'done' && t.dueDate && t.dueDate < today(); }
function isDueToday(t) { return t.status !== 'done' && t.dueDate && t.dueDate === today(); }

const BLANK = { title: '', category: 'Other', dueDate: '', priority: 'medium', assignedTo: 'person1', notes: '', status: 'todo' };

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
  const couple = useCouple(id);
  // Tasks saved before the couple became person1/person2 say "bride"/"groom" —
  // meaning whoever is the bride — so they follow the role each person picked.
  const assigneeKey = (a) => {
    if (a !== 'bride' && a !== 'groom') return a;
    return couple.find((m) => m.role.toLowerCase() === a)?.key || a;
  };
  const assigneeLabel = (a) => {
    const member = couple.find((m) => m.key === assigneeKey(a));
    if (member) return member.label;
    return a ? a.charAt(0).toUpperCase() + a.slice(1) : '';
  };

  useEffect(() => {
    api.tasks.list(id)
      .then(r => setTasks(r.tasks || []))
      .catch(() => toast('We couldn’t load your tasks. Try again.', 'error'))
      .finally(() => setLoading(false));
  }, [id]);

  function openNew() { setForm({ ...BLANK, customCategory: '' }); setEditing(null); setShowModal(true); }
  function openEdit(t) {
    const isKnown = CATEGORIES.includes(t.category);
    setForm({ ...t, assignedTo: assigneeKey(t.assignedTo), category: isKnown ? t.category : 'Other', customCategory: isKnown ? '' : t.category });
    setEditing(t.id);
    setShowModal(true);
  }

  async function save() {
    if (!form.title.trim()) { toast('Write what needs doing first.', 'error'); return; }
    setSaving(true);
    try {
      const payload = { ...form };
      if (payload.category === 'Other' && payload.customCategory?.trim()) {
        payload.category = payload.customCategory.trim();
      }
      
      if (editing) {
        const r = await api.tasks.update(id, editing, payload);
        setTasks(prev => prev.map(t => t.id === editing ? r.task : t));
      } else {
        const r = await api.tasks.create(id, payload);
        setTasks(prev => [...prev, r.task]);
      }
      setShowModal(false);
      toast(editing ? 'Task saved.' : 'Task added.', 'success');
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
  const nTodo = tasks.filter(t => t.status === 'todo').length;
  const nDoing = tasks.filter(t => t.status === 'inprogress').length;
  const nDone = tasks.filter(t => t.status === 'done').length;

  if (loading) return <div className="loading-center"><div className="spinner spinner-lg" /></div>;

  return (
    <div className="page-fade">
      <section className="feat-shell">
        <PageHeader
          title="Tasks"
          subtitle="Everything to do before the big day, in one place."
          helpMore="/guide#tasks"
          help="Add a task, give it a date and who’s doing it. Tasks move from To do → In progress → Done as you go."
          actions={<button type="button" className="btn btn-primary" onClick={openNew}><Plus size={18} aria-hidden="true" /> Add task</button>}
        />

        {urgentCount > 0 && (
          <div className="tasks-alert" role="status">
            <AlertTriangle size={18} aria-hidden="true" /> {urgentCount} task{urgentCount > 1 ? 's are' : ' is'} due today or overdue
          </div>
        )}
        {allDone && (
          <div className="tasks-allclear" role="status"><PartyPopper size={18} aria-hidden="true" /> You’re all caught up!</div>
        )}

        <div className="feat-stats">
          <div className="feat-stat">
            <span className="feat-stat-val">{tasks.length}</span>
            <span className="feat-stat-label">Total</span>
          </div>
          <div className="feat-stat">
            <span className="feat-stat-val feat-stat-val--muted">{nTodo}</span>
            <span className="feat-stat-label">To do</span>
          </div>
          <div className="feat-stat">
            <span className="feat-stat-val feat-stat-val--gold">{nDoing}</span>
            <span className="feat-stat-label">In progress</span>
          </div>
          <div className="feat-stat">
            <span className="feat-stat-val feat-stat-val--green">{nDone}</span>
            <span className="feat-stat-label">Done</span>
          </div>
          <div className="feat-stat">
            <span className={`feat-stat-val ${urgentCount ? 'feat-stat-val--amber' : ''}`}>{urgentCount}</span>
            <span className="feat-stat-label">Due now</span>
          </div>
        </div>

        <div className="feat-hub">
          <div className="feat-hub-pills feat-hub-pills--wrap">
            {['all', 'today', 'week', 'overdue', 'done'].map(f => (
              <button type="button" key={f} className={`pill ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                {f === 'all' ? 'All' : f === 'today' ? 'Today' : f === 'week' ? 'This week' : f === 'overdue' ? 'Overdue' : 'Done'}
              </button>
            ))}
          </div>
          <div className="feat-hub-tools">
            <Select className="form-select tasks-cat-select" value={catFilter} onChange={e => setCatFilter(e.target.value)} aria-label="Category">
              <option value="">All categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
        </div>
      </section>

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
                <div className="kanban-empty">{meta.empty}</div>
              ) : (
                col.map(task => (
                  <div
                    key={task.id}
                    className={`task-card ${task.status === 'done' ? 'done' : ''} ${isOverdue(task) ? 'overdue' : ''}`}
                    style={{ borderLeftColor: PRIORITY_COLOR[task.priority] || 'var(--border-default)' }}
                  >
                    <div className="task-card-header">
                      <span className="task-title">{task.title}</span>
                    </div>
                    <div className="task-meta-row">
                      {task.category && <span className="task-pill">{task.category}</span>}
                      {task.assignedTo && <span className="task-pill task-pill-maroon">{assigneeLabel(task.assignedTo)}</span>}
                      {task.dueDate && (
                        <span className={`task-due ${isOverdue(task) ? 'overdue' : ''}`}>
                          <CalendarDays size={14} aria-hidden="true" />
                          {isOverdue(task) ? 'Overdue · ' : isDueToday(task) ? 'Today · ' : ''}{shortDate(task.dueDate)}
                        </span>
                      )}
                    </div>
                    <div className="task-actions">
                      {task.status === 'todo' && (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => moveStatus(task, 'inprogress')}><Play size={15} aria-hidden="true" /> Start</button>
                      )}
                      {task.status === 'inprogress' && (
                        <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--green)' }} onClick={() => moveStatus(task, 'done')}><Check size={15} aria-hidden="true" /> Mark done</button>
                      )}
                      {task.status === 'done' && (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => moveStatus(task, 'todo')}><RotateCcw size={15} aria-hidden="true" /> Reopen</button>
                      )}
                      <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => openEdit(task)} aria-label={`Edit “${task.title}”`}>
                        <Pencil size={15} aria-hidden="true" /> Edit
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => setDeleting(task)} aria-label={`Delete “${task.title}”`}>
                        <Trash2 size={15} aria-hidden="true" /> Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>

      {/* Add / edit */}
      {showModal && (
        <Modal
          title={editing ? 'Edit task' : 'Add a task'}
          onClose={() => !saving && setShowModal(false)}
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={saving}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? <span className="btn-spinner" aria-hidden="true" /> : null}
                {editing ? 'Save changes' : 'Add task'}
              </button>
            </>
          }
        >
          <div className="form-group">
            <label className="form-label" htmlFor="task-title">What needs doing?</label>
            <input id="task-title" className="form-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Book the photographer" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="task-category">Category</label>
              <Select id="task-category" className="form-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </Select>
              {form.category === 'Other' && (
                <input className="form-input" style={{ marginTop: 6 }} placeholder="Name the category" aria-label="Category name" value={form.customCategory || ''} onChange={e => setForm(f => ({ ...f, customCategory: e.target.value }))} />
              )}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="task-due">Due date <span className="form-optional">(optional)</span></label>
              <input id="task-due" className="form-input" type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <span className="form-label" id="task-priority">How urgent?</span>
            <div className="pill-group" role="group" aria-labelledby="task-priority">
              {PRIORITIES.map(p => (
                <button key={p} type="button"
                  className={`pill ${form.priority === p ? 'active' : ''}`}
                  aria-pressed={form.priority === p}
                  onClick={() => setForm(f => ({ ...f, priority: p }))}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <span className="form-label" id="task-who">Who’s doing it?</span>
            <div className="pill-group" role="group" aria-labelledby="task-who">
              {ASSIGNEES.map(a => (
                <button key={a} type="button"
                  className={`pill ${form.assignedTo === a ? 'active' : ''}`}
                  aria-pressed={form.assignedTo === a}
                  onClick={() => setForm(f => ({ ...f, assignedTo: a }))}
                >
                  {assigneeLabel(a)}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="task-notes">Notes <span className="form-optional">(optional)</span></label>
            <textarea id="task-notes" className="form-textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Anything to remember" rows={2} />
          </div>
        </Modal>
      )}

      {deleting && (
        <ConfirmModal
          title="Delete this task?"
          message={`“${deleting.title}” will be removed.`}
          confirmText="Delete task"
          onConfirm={() => deleteTask(deleting.id)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
