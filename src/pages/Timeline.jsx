import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import { ConfirmModal } from '../components/ui/Modal';
import './Timeline.css';

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
      .catch(() => toast('Failed to load ceremonies', 'error'))
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
    if (!form.time || !form.title) { toast('Time and title are required', 'error'); return; }
    setSaving(true);
    try {
      if (editing) {
        const r = await api.timeline.update(id, editing, form);
        setEntries(prev => prev.map(e => e.id === editing ? r.entry : e));
      } else {
        const r = await api.timeline.create(id, { ...form, functionId: activeFn });
        setEntries(prev => [...prev, r.entry].sort((a, b) => a.time.localeCompare(b.time)));
      }
      setShowModal(false);
      toast(editing ? 'Updated!' : 'Added!', 'success');
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

  const sorted = [...entries].sort((a, b) => a.time.localeCompare(b.time));

  if (loading) return <div className="loading-center"><div className="spinner spinner-lg" /></div>;

  return (
    <div className="page-fade">
      <div className="page-header">
        <div>
          <h1 className="page-title">Day-of Timeline</h1>
          <p className="page-subtitle">Plan your ceremony schedule hour by hour</p>
        </div>
        {activeFn && <button className="btn btn-primary" onClick={openNew}>+ Add Entry</button>}
      </div>

      {functions.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ padding: '32px 0' }}>
            <div className="empty-icon">🕐</div>
            <div className="empty-title">No ceremonies added yet</div>
            <div className="empty-desc">Add ceremonies in the Build Invitation section first.</div>
          </div>
        </div>
      ) : (
        <>
          {/* Function selector */}
          <div className="timeline-fn-tabs">
            {functions.map(fn => (
              <button
                key={fn.id}
                className={`timeline-fn-tab ${activeFn === fn.id ? 'active' : ''}`}
                onClick={() => setActiveFn(fn.id)}
              >
                {fn.name}
              </button>
            ))}
          </div>

          {sorted.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 0' }}>
              <div className="empty-icon">📋</div>
              <div className="empty-title">No entries for this ceremony</div>
              <div className="empty-desc">Add schedule entries to plan the day.</div>
            </div>
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
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(entry)}>✏️</button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => setDeleting(entry)}>✕</button>
                      </div>
                    </div>
                    {entry.location && <div className="timeline-meta">📍 {entry.location}</div>}
                    {entry.responsiblePerson && <div className="timeline-meta">👤 {entry.responsiblePerson}</div>}
                    {entry.notes && <div className="timeline-notes">{entry.notes}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Edit Entry' : 'Add Entry'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Time <span className="req">*</span></label>
                <input className="form-input" placeholder="e.g. 10:30 AM" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Duration</label>
                <input className="form-input" placeholder="e.g. 30 mins" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Title <span className="req">*</span></label>
              <input className="form-input" placeholder="e.g. Guests arrive" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Location</label>
                <input className="form-input" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Hall, Garden…" />
              </div>
              <div className="form-group">
                <label className="form-label">Responsible Person</label>
                <input className="form-input" value={form.responsiblePerson} onChange={e => setForm(f => ({ ...f, responsiblePerson: e.target.value }))} placeholder="Name or role" />
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
                {editing ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <ConfirmModal
          title="Delete Entry"
          message={`Delete "${deleting.title}"?`}
          confirmText="Delete"
          onConfirm={() => deleteEntry(deleting.id)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
