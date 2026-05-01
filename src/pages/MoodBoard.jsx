import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import { ConfirmModal } from '../components/ui/Modal';
import './MoodBoard.css';

const CATEGORIES = ['Color Palette', 'Outfits', 'Decor', 'Flowers', 'Food', 'Jewellery', 'Pinterest', 'Other'];

const BLANK = { caption: '', category: 'Other', imageUrl: '' };

const PinterestWidget = ({ boardUrl }) => {
  useEffect(() => {
    if (!window.PinUtils) {
      const script = document.createElement('script');
      script.src = 'https://assets.pinterest.com/js/pinit.js';
      script.async = true;
      script.dataset.pinBuild = 'doBuild';
      document.body.appendChild(script);
      script.onload = () => {
        if (window.doBuild) window.doBuild();
      };
    } else {
      if (window.doBuild) window.doBuild();
    }
  }, [boardUrl]);

  return (
    <div style={{ overflow: 'hidden', borderRadius: 'var(--r-md)' }}>
      <a
        data-pin-do="embedBoard"
        data-pin-board-width="400"
        data-pin-scale-height="240"
        data-pin-scale-width="80"
        href={boardUrl}
      >
        Pinterest Board
      </a>
    </div>
  );
};

export default function MoodBoard() {
  const { id } = useParams();
  const toast = useToast();
  const [pins, setPins]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [catFilter, setCatFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState(BLANK);
  const [file, setFile]           = useState(null);
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState(null);

  useEffect(() => {
    api.moodboard.list(id)
      .then(r => setPins(r.pins || []))
      .catch(() => toast('Failed to load mood board', 'error'))
      .finally(() => setLoading(false));
  }, [id]);

  function openNew() { setForm({ ...BLANK, customCategory: '' }); setFile(null); setShowModal(true); }

  async function save() {
    if (!file && !form.imageUrl.trim()) { toast('Upload an image or enter a URL', 'error'); return; }
    setSaving(true);
    try {
      let payloadCategory = form.category;
      if (payloadCategory === 'Other' && form.customCategory?.trim()) {
        payloadCategory = form.customCategory.trim();
      }

      let payload;
      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('caption', form.caption);
        fd.append('category', payloadCategory);
        payload = fd;
      } else {
        payload = { imageUrl: form.imageUrl.trim(), caption: form.caption, category: payloadCategory };
      }
      const r = await api.moodboard.create(id, payload);
      setPins(prev => [...prev, r.pin]);
      setShowModal(false);
      toast('Pin added!', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function deletePin(pinId) {
    try {
      await api.moodboard.remove(id, pinId);
      setPins(prev => prev.filter(p => p.id !== pinId));
      setDeleting(null);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  const filtered = catFilter ? pins.filter(p => p.category === catFilter) : pins;
  const pinterestBoards = filtered.filter(p => p.category === 'Pinterest');
  const regularPins = filtered.filter(p => p.category !== 'Pinterest');

  if (loading) return <div className="loading-center"><div className="spinner spinner-lg" /></div>;

  return (
    <div className="page-fade">
      <div className="page-header">
        <div>
          <h1 className="page-title">Mood Board</h1>
          <p className="page-subtitle">Collect inspiration for your dream wedding</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Add Pin</button>
      </div>

      {/* Category filter */}
      <div className="mb-filter-row">
        <button className={`pill ${!catFilter ? 'active' : ''}`} onClick={() => setCatFilter('')}>All</button>
        {CATEGORIES.map(c => (
          <button key={c} className={`pill ${catFilter === c ? 'active' : ''}`} onClick={() => setCatFilter(c)}>{c}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state" style={{ padding: '40px 0' }}>
          <div className="empty-icon">🎨</div>
          <div className="empty-title">Your mood board is empty</div>
          <div className="empty-desc">Add images from your phone or connect a Pinterest board.</div>
        </div>
      ) : (
        <>
          {pinterestBoards.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginBottom: 24, justifyContent: 'center' }}>
              {pinterestBoards.map(pb => (
                <div key={pb.id} style={{ position: 'relative', background: 'var(--bg-surface)', padding: '36px 16px 16px', borderRadius: 'var(--r-lg)', border: '1px solid var(--border-default)' }}>
                  <button className="masonry-delete" style={{ top: 6, right: 6, background: 'var(--red)', zIndex: 10 }} onClick={() => setDeleting(pb)}>✕</button>
                  <PinterestWidget boardUrl={pb.imageUrl} />
                </div>
              ))}
            </div>
          )}

          {regularPins.length > 0 && (
            <div className="masonry-grid">
              {regularPins.map(pin => (
                <div key={pin.id} className="masonry-pin">
                  <img src={pin.imageUrl} alt={pin.caption || 'pin'} className="masonry-img" loading="lazy" />
                  <div className="masonry-overlay">
                    {pin.category && <span className="masonry-cat">{pin.category}</span>}
                    {pin.caption && <p className="masonry-caption">{pin.caption}</p>}
                    <button className="masonry-delete" onClick={() => setDeleting(pin)}>✕</button>
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
              <h2 className="modal-title">Add Pin</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            {form.category !== 'Pinterest' && (
              <div className="form-group">
                <label className="form-label">Upload Image</label>
                <input className="form-input" type="file" accept="image/*" onChange={e => { setFile(e.target.files?.[0] || null); setForm(f => ({ ...f, imageUrl: '' })); }} />
              </div>
            )}
            {!file && (
              <div className="form-group">
                <label className="form-label">{form.category === 'Pinterest' ? 'Pinterest Board URL' : 'Or Image URL'}</label>
                <input className="form-input" placeholder="https://…" value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} />
              </div>
            )}
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
                {form.category === 'Other' && (
                  <input className="form-input" style={{ marginTop: 6 }} placeholder="Category name" value={form.customCategory || ''} onChange={e => setForm(f => ({ ...f, customCategory: e.target.value }))} />
                )}
              </div>
            <div className="form-group">
              <label className="form-label">Caption (optional)</label>
              <input className="form-input" value={form.caption} onChange={e => setForm(f => ({ ...f, caption: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? <span className="btn-spinner" /> : 'Add Pin'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <ConfirmModal
          title="Remove Pin"
          message="Remove this pin from your mood board?"
          confirmText="Remove"
          onConfirm={() => deletePin(deleting.id)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
