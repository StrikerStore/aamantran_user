import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import { ConfirmModal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { ImagePlus, Trash2, X, Camera } from 'lucide-react';
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
      .catch(() => toast('We couldn’t load your photos. Try again.', 'error'))
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
      toast(files.length > 1 ? `${files.length} photos added.` : 'Photo added.', 'success');
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
      <section className="feat-shell">
        <PageHeader
          title="Photo wall"
          subtitle="Your private album — only you can see these photos, not your guests."
          helpMore="/guide#photos"
          help="Pick a category first (for example “Family”) and new uploads are filed under it. You can choose several photos at once."
          actions={
            <label className={`btn btn-primary ${uploading ? 'disabled' : ''}`} style={{ cursor: uploading ? 'default' : 'pointer' }}>
              {uploading ? <span className="btn-spinner" aria-hidden="true" /> : <ImagePlus size={18} aria-hidden="true" />}
              {uploading ? 'Uploading…' : 'Add photos'}
              <input type="file" accept="image/*" multiple className="sr-only" onChange={uploadFiles} disabled={uploading} />
            </label>
          }
        />

        <div className="feat-hub">
          <div className="feat-hub-pills feat-hub-pills--scroll">
            <button type="button" aria-pressed={!catFilter} className={`pill ${!catFilter ? 'active' : ''}`} onClick={() => setCatFilter('')}>All</button>
            {CATEGORIES.map(c => (
              <button type="button" key={c} aria-pressed={catFilter === c} className={`pill ${catFilter === c ? 'active' : ''}`} onClick={() => setCatFilter(c)}>{c}</button>
            ))}
          </div>
        </div>
      </section>

      {filtered.length === 0 ? (
        <EmptyState icon={Camera} tone="peach" title={catFilter ? `No ${catFilter.toLowerCase()} photos yet` : 'No photos yet'}>
          Press “Add photos” to start your album.
        </EmptyState>
      ) : (
        <div className="masonry-grid">
          {filtered.map(photo => (
            <div key={photo.id} className="masonry-pin">
              <button type="button" className="masonry-open" onClick={() => setLightbox(photo)} aria-label={`Open ${photo.caption || 'photo'}`}>
                <img src={photo.url} alt={photo.caption || ''} className="masonry-img" loading="lazy" />
              </button>
              <div className="masonry-overlay">
                {photo.category && <span className="masonry-cat">{photo.category}</span>}
                {photo.caption && <p className="masonry-caption">{photo.caption}</p>}
              </div>
              <button type="button" className="masonry-delete" onClick={() => setDeleting(photo)} aria-label="Delete photo" title="Delete photo">
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="lightbox-overlay" role="dialog" aria-modal="true" aria-label={lightbox.caption || 'Photo'} onClick={() => setLightbox(null)}>
          <button type="button" className="lightbox-close" onClick={() => setLightbox(null)} aria-label="Close"><X size={22} aria-hidden="true" /></button>
          <img src={lightbox.url} alt={lightbox.caption || 'photo'} className="lightbox-img" onClick={e => e.stopPropagation()} />
          {lightbox.caption && <p className="lightbox-caption">{lightbox.caption}</p>}
        </div>
      )}

      {deleting && (
        <ConfirmModal
          title="Delete this photo?"
          message="It will be removed from your album for good."
          confirmText="Delete photo"
          onConfirm={() => deletePhoto(deleting.id)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
