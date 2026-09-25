import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import { ConfirmModal, Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { toTimeInput, fromTimeInput } from './invite/time';
import { Plus, Pencil, Trash2, MapPin, User, Clock, CalendarHeart } from 'lucide-react';
import './Timeline.css';

// Times are saved as "10:30 AM"; sort by the real clock time so 9:00 comes before 10:30.
// Entries typed freely before the time picker ("after lunch") go last, in typed order.
const clockKey = (t) => toTimeInput(t) || `~${t || ''}`;
const byTime = (a, b) => clockKey(a.time).localeCompare(clockKey(b.time));

const BLANK = { time: '', title: '', location: '', responsiblePerson: '', duration: '', notes: '', sortOrder: 0 };

export default function Timeline() {
  const { id } = useParams();
  const toast = useToast();
  const [functions, setFunctions]   = useState([]);
  const [activeFn, setActiveFn]     = useState(null);
  const [entries, setEntries]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [form, setForm]             = useState(BLANK);
  const [editing, setEditing]       = useState(null);
  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState(null);

  useEffect(() => {
    api.functions.list(id)
      .then(r => {
        const fns = r.functions || [];
        setFunctions(fns);
        if (fns.length) setActiveFn(fns[0].id);
      })
      .catch(() => toast('We couldn’t load your ceremonies. Try again.', 'error'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!activeFn) return;
    api.timeline.list(id)
      .then(r => setEntries((r.entries || []).filter(e => e.functionId === activeFn)))
      .catch(() => {});
  }, [id, activeFn]);

  function openNew() { setForm({ ...BLANK, functionId: activeFn, sortOrder: entries.length }); setEditing(null); setShowModal(true); }
  function openEdit(e) { setForm({ ...e }); setEditing(e.id); setShowModal(true); }

  async function save() {
    if (!form.time || !form.title) { toast('Add a time and what happens first.', 'error'); return; }
    setSaving(true);
    try {
      if (editing) {
        const r = await api.timeline.update(id, editing, form);
        setEntries(prev => prev.map(e => e.id === editing ? r.entry : e));
      } else {
        const r = await api.timeline.create(id, { ...form, functionId: activeFn });
        setEntries(prev => [...prev, r.entry]);
      }
      setShowModal(false);
      toast(editing ? 'Saved.' : 'Added to the timeline.', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(eid) {
    try {
      await api.timeline.remove(id, eid);
      setEntries(prev => prev.filter(e => e.id !== eid));
      setDeleting(null);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  const sorted = [...entries].sort(byTime);
  const activeName = functions.find(f => f.id === activeFn)?.name || 'this ceremony';

  if (loading) return <div className="loading-center"><div className="spinner spinner-lg" /></div>;

  return (
    <div className="page-fade">
      <section className="feat-shell">
        <PageHeader
          title="Day-of timeline"
          subtitle="Plan each ceremony hour by hour, so everyone knows what happens when."
          helpMore="/guide#timeline"
          help="Pick a ceremony, then add each moment — guests arrive, pheras, dinner. They sort themselves by time. Only you see this; guests don’t."
          actions={activeFn ? <button type="button" className="btn btn-primary" onClick={openNew}><Plus size={18} aria-hidden="true" /> Add a moment</button> : null}
        />

        {functions.length > 0 && (
          <div className="feat-hub">
            <div className="feat-hub-pills feat-hub-pills--scroll timeline-fn-tabs">
              {functions.map(fn => (
                <button
                  type="button"
                  key={fn.id}
                  aria-pressed={activeFn === fn.id}
                  className={`timeline-fn-tab ${activeFn === fn.id ? 'active' : ''}`}
                  onClick={() => setActiveFn(fn.id)}
                >
                  {fn.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {functions.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={CalendarHeart}
            title="Add your ceremonies first"
            action={<Link to={`/events/${id}/generate?step=functions`} className="btn btn-primary">Add ceremonies</Link>}
          >
            Your timeline is planned per ceremony — Mehendi, Sangeet, Wedding… Add them in your invitation and they’ll show up here.
          </EmptyState>
        </div>
      ) : (
        <div className="timeline-body">
          {sorted.length === 0 ? (
            <EmptyState
              icon={Clock}
              title={`Nothing planned for ${activeName} yet`}
              action={<button type="button" className="btn btn-primary" onClick={openNew}><Plus size={18} aria-hidden="true" /> Add a moment</button>}
            >
              Add each moment of the day — when guests arrive, the rituals, food, music.
            </EmptyState>
          ) : (
            <div className="timeline-list">
              {sorted.map((entry, idx) => (
                <div key={entry.id} className="timeline-entry">
                  <div className="timeline-time-col">
                    <span className="timeline-time">{entry.time}</span>
                    {entry.duration && <span className="timeline-duration">{entry.duration}</span>}
                  </div>
                  <div className="timeline-dot-col">
                    <div className="timeline-dot" />
                    {idx < sorted.length - 1 && <div className="timeline-line" />}
                  </div>
                  <div className="timeline-content">
                    <div className="timeline-entry-header">
                      <span className="timeline-title">{entry.title}</span>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(entry)} aria-label={`Edit “${entry.title}”`}><Pencil size={15} aria-hidden="true" /> Edit</button>
                        <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => setDeleting(entry)} aria-label={`Delete “${entry.title}”`}><Trash2 size={15} aria-hidden="true" /> Delete</button>
                      </div>
                    </div>
                    {entry.location && <div className="timeline-meta"><MapPin size={14} aria-hidden="true" /> {entry.location}</div>}
                    {entry.responsiblePerson && <div className="timeline-meta"><User size={14} aria-hidden="true" /> {entry.responsiblePerson}</div>}
                    {entry.notes && <div className="timeline-notes">{entry.notes}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showModal && (
        <Modal
          title={editing ? 'Edit this moment' : `Add a moment to ${activeName}`}
          onClose={() => !saving && setShowModal(false)}
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={saving}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? <span className="btn-spinner" aria-hidden="true" /> : null}
                {editing ? 'Save changes' : 'Add moment'}
              </button>
            </>
          }
        >
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="tl-time">Time</label>
              <input
                id="tl-time"
                className="form-input"
                type="time"
                value={toTimeInput(form.time)}
                onChange={e => setForm(f => ({ ...f, time: fromTimeInput(e.target.value) }))}
              />
              {form.time && !toTimeInput(form.time) && (
                <div className="form-hint">Saved earlier as “{form.time}”. Pick a time to replace it.</div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="tl-duration">How long? <span className="form-optional">(optional)</span></label>
              <input id="tl-duration" className="form-input" placeholder="e.g. 30 mins" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="tl-title">What happens?</label>
            <input id="tl-title" className="form-input" placeholder="e.g. Guests arrive" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="tl-place">Where? <span className="form-optional">(optional)</span></label>
              <input id="tl-place" className="form-input" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Hall, garden…" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="tl-who">Who’s in charge? <span className="form-optional">(optional)</span></label>
              <input id="tl-who" className="form-input" value={form.responsiblePerson} onChange={e => setForm(f => ({ ...f, responsiblePerson: e.target.value }))} placeholder="Name or role" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="tl-notes">Notes <span className="form-optional">(optional)</span></label>
            <textarea id="tl-notes" className="form-textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
          </div>
        </Modal>
      )}

      {deleting && (
        <ConfirmModal
          title="Delete this moment?"
          message={`“${deleting.title}” will be removed from the timeline.`}
          confirmText="Delete moment"
          onConfirm={() => deleteEntry(deleting.id)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
