import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import { ConfirmModal } from '../components/ui/Modal';
import './PhotoWall.css';

const CATEGORIES = ['Ceremony', 'Reception', 'Candid', 'Family', 'Couple'];

export default function PhotoWall() {
  const { id } = useParams();
  const toast = useToast();
  const [photos, setPhotos]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [catFilter, setCatFilter] = useState('');
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting]   = useState(null);
  const [lightbox, setLightbox]   = useState(null);

  useEffect(() => {
    api.photos.list(id)
      .then(r => setPhotos(r.photos || []))
      .catch(() => toast('Failed to load photos', 'error'))
      .finally(() => setLoading(false));
  }, [id]);

  async function uploadFiles(e) {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('category', catFilter || 'Ceremony');
        const r = await api.photos.upload(id, fd);
        setPhotos(prev => [...prev, r.photo]);
      }
      toast('Uploaded!', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setUploading(false);
    }
  }

  async function deletePhoto(pid) {
    try {
      await api.photos.remove(id, pid);
      setPhotos(prev => prev.filter(p => p.id !== pid));
      setDeleting(null);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  const filtered = catFilter ? photos.filter(p => p.category === catFilter) : photos;

  if (loading) return <div className="loading-center"><div className="spinner spinner-lg" /></div>;

  return (
    <div className="page-fade">
      <div className="page-header">
        <div>
          <h1 className="page-title">Photo Wall</h1>
          <p className="page-subtitle">Your private wedding album · only you can see this</p>
        </div>
        <label className={`btn btn-primary ${uploading ? 'disabled' : ''}`} style={{ cursor: 'pointer' }}>
          {uploading ? <span className="btn-spinner" /> : null}
          {uploading ? 'Uploading…' : '+ Upload Photos'}
          <input type="file" accept="image/*" multiple hidden onChange={uploadFiles} disabled={uploading} />
        </label>
      </div>

      {/* Category filter */}
      <div className="photo-filter-row">
        <button className={`pill ${!catFilter ? 'active' : ''}`} onClick={() => setCatFilter('')}>All</button>
        {CATEGORIES.map(c => (
          <button key={c} className={`pill ${catFilter === c ? 'active' : ''}`} onClick={() => setCatFilter(c)}>{c}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state" style={{ padding: '40px 0' }}>
          <div className="empty-icon">📸</div>
          <div className="empty-title">No photos yet</div>
          <div className="empty-desc">Upload your wedding photos to create a beautiful album.</div>
        </div>
      ) : (
        <div className="masonry-grid">
          {filtered.map(photo => (
            <div key={photo.id} className="masonry-pin" onClick={() => setLightbox(photo)}>
              <img src={photo.url} alt={photo.caption || 'photo'} className="masonry-img" loading="lazy" />
              <div className="masonry-overlay">
                {photo.category && <span className="masonry-cat">{photo.category}</span>}
                {photo.caption && <p className="masonry-caption">{photo.caption}</p>}
                <button className="masonry-delete" onClick={e => { e.stopPropagation(); setDeleting(photo); }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="lightbox-overlay" onClick={() => setLightbox(null)}>
          <button className="lightbox-close" onClick={() => setLightbox(null)}>✕</button>
          <img src={lightbox.url} alt={lightbox.caption || 'photo'} className="lightbox-img" onClick={e => e.stopPropagation()} />
          {lightbox.caption && <p className="lightbox-caption">{lightbox.caption}</p>}
        </div>
      )}

      {deleting && (
        <ConfirmModal
          title="Delete Photo"
          message="Delete this photo permanently?"
          confirmText="Delete"
          onConfirm={() => deletePhoto(deleting.id)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
