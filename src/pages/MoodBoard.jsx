import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Select } from '../components/ui/Select';
import { API_BASE } from '../lib/config';
import { useToast } from '../components/ui/Toast';
import { ConfirmModal, Modal } from '../components/ui/Modal';
import { GridSkeleton } from '../components/ui/Skeleton';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { Plus, Trash2, X, Palette, ExternalLink } from 'lucide-react';
import './MoodBoard.css';

const CATEGORIES = ['Color Palette', 'Outfits', 'Decor', 'Flowers', 'Food', 'Jewellery', 'Pinterest', 'Other'];

const BLANK = { caption: '', category: 'Other', imageUrl: '' };

/** Same breakpoint as layout mobile shell — grid taps open lightbox instead of new tab */
function useMobileMoodLayout() {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 900px)').matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
    const onChange = () => setMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return mobile;
}

let pinitLoadPromise = null;
function loadPinterestScript() {
  if (typeof window === 'undefined') return Promise.resolve();
  if (typeof window.parsePins === 'function' || (window.PinUtils && typeof window.PinUtils.build === 'function')) {
    return Promise.resolve();
  }
  if (pinitLoadPromise) return pinitLoadPromise;
  pinitLoadPromise = new Promise((resolve, reject) => {
    const prev = document.querySelector('script[src*="assets.pinterest.com/js/pinit.js"]');
    if (prev) {
      prev.addEventListener('load', () => resolve(), { once: true });
      prev.addEventListener('error', () => reject(new Error('pinit')), { once: true });
      return;
    }
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://assets.pinterest.com/js/pinit.js';
    s.dataset.pinBuild = 'parsePins';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('pinit'));
    document.body.appendChild(s);
  });
  return pinitLoadPromise;
}

function pinDoForUrl(url) {
  return String(url).toLowerCase().includes('/pin/') ? 'embedPin' : 'embedBoard';
}

/** Image / upload URLs may be relative to the API origin */
function resolvePinHref(imageUrl) {
  if (!imageUrl) return '#';
  const u = String(imageUrl).trim();
  if (/^https?:\/\//i.test(u)) return u;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const base = API_BASE ? new URL(API_BASE, origin).origin : origin;
  const path = u.startsWith('/') ? u : `/${u}`;
  return `${base}${path}`;
}

function PinterestBoardCard({ eventId, boardUrl, caption, onDelete }) {
  const [loading, setLoading] = useState(true);
  const [embedHtml, setEmbedHtml] = useState(null);
  const widgetHostRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setEmbedHtml(null);

    api.moodboard
      .pinterestOembed(eventId, boardUrl)
      .then((r) => {
        if (cancelled) return;
        setEmbedHtml(r.html || null);
      })
      .catch(() => {
        if (!cancelled) setEmbedHtml(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [eventId, boardUrl]);

  useEffect(() => {
    if (loading || embedHtml) return;
    const root = widgetHostRef.current;
    if (!root) return;

    root.innerHTML = '';
    const a = document.createElement('a');
    a.href = boardUrl;
    a.dataset.pinDo = pinDoForUrl(boardUrl);
    if (a.dataset.pinDo === 'embedBoard') {
      a.dataset.pinBoardWidth = '100%';
      a.dataset.pinScaleHeight = '280';
      a.dataset.pinScaleWidth = '80';
    }

    root.appendChild(a);

    let cancelled = false;
    loadPinterestScript().then(() => {
      if (cancelled || !widgetHostRef.current) return;
      requestAnimationFrame(() => {
        try {
          if (typeof window.parsePins === 'function') window.parsePins(widgetHostRef.current);
          else if (window.PinUtils && typeof window.PinUtils.build === 'function') {
            window.PinUtils.build(widgetHostRef.current);
          }
        } catch {
          /* Pinterest script API varies by region/version */
        }
      });
    });

    return () => {
      cancelled = true;
    };
  }, [loading, embedHtml, boardUrl]);

  return (
    <div className="mb-pinterest-card">
      <button
        type="button"
        className="masonry-delete mb-pinterest-delete"
        aria-label="Remove Pinterest board"
        title="Remove board"
        onClick={onDelete}
      >
        <Trash2 size={16} aria-hidden="true" />
      </button>

      <div className="mb-pinterest-body">
        {loading && (
          <div className="mb-pinterest-loading">
            <div className="spinner spinner-lg" />
            <p className="mb-pinterest-loading-text">Loading Pinterest preview…</p>
          </div>
        )}
        {!loading && embedHtml && (
          <div className="mb-pinterest-viewport">
            <div className="mb-pinterest-embed" dangerouslySetInnerHTML={{ __html: embedHtml }} />
          </div>
        )}
        {!loading && !embedHtml && (
          <div className="mb-pinterest-viewport mb-pinterest-viewport--widget">
            <div ref={widgetHostRef} className="mb-pinterest-widget-host" />
          </div>
        )}
      </div>

      <div className="mb-pinterest-footer">
        <div className="mb-pinterest-footer-text">
          {caption ? <p className="mb-pinterest-caption">{caption}</p> : null}
          <p className="mb-pinterest-hint">Pins load inside the preview when Pinterest allows embedding.</p>
        </div>
        <a
          className="btn btn-secondary btn-sm mb-pinterest-open"
          href={boardUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open on Pinterest <ExternalLink size={14} aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}

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
  const [pinLightbox, setPinLightbox] = useState(null);
  const isMobileMood = useMobileMoodLayout();

  useEffect(() => {
    if (!pinLightbox) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e) {
      if (e.key === 'Escape') setPinLightbox(null);
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [pinLightbox]);

  useEffect(() => {
    api.moodboard.list(id)
      .then(r => setPins(r.pins || []))
      .catch(() => toast('We couldn’t load your mood board. Try again.', 'error'))
      .finally(() => setLoading(false));
  }, [id]);

  function openNew() { setForm({ ...BLANK, customCategory: '' }); setFile(null); setShowModal(true); }
  function openNewPinterest() { setForm({ ...BLANK, category: 'Pinterest', customCategory: '' }); setFile(null); setShowModal(true); }

  async function save() {
    if (!file && !form.imageUrl.trim()) { toast('Choose a picture, or paste a link to one.', 'error'); return; }
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
      toast('Added to your mood board.', 'success');
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
  const splitBoardLayout = pinterestBoards.length > 0 && regularPins.length > 0;

  if (loading) return <div className="page-fade" style={{ paddingTop: 8 }}><GridSkeleton count={9} /></div>;

  return (
    <div className="page-fade">
      <section className="feat-shell">
        <PageHeader
          title="Mood board"
          subtitle="Collect ideas — colours, outfits, décor — in one place. Only you can see it."
          helpMore="/guide#moodboard"
          help="Add a picture from your phone or a link to one. Already saving ideas on Pinterest? Add your board and it shows here."
          actions={
            <>
              <button type="button" className="btn btn-secondary" onClick={openNewPinterest}>
                <Plus size={18} aria-hidden="true" /> Pinterest board
              </button>
              <button type="button" className="btn btn-primary" onClick={openNew}><Plus size={18} aria-hidden="true" /> Add picture</button>
            </>
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
        <EmptyState
          icon={Palette}
          tone="lemon"
          title={catFilter ? `Nothing in ${catFilter} yet` : 'Your mood board is empty'}
          action={<button type="button" className="btn btn-primary" onClick={openNew}><Plus size={18} aria-hidden="true" /> Add picture</button>}
        >
          Add pictures from your phone, or add a Pinterest board.
        </EmptyState>
      ) : (
        <div className={`mb-board-layout${splitBoardLayout ? ' mb-board-layout--split' : ''}`}>
          {pinterestBoards.length > 0 && (
            <div className="mb-pinterest-stack">
              {pinterestBoards.map(pb => (
                <PinterestBoardCard
                  key={pb.id}
                  eventId={id}
                  boardUrl={pb.imageUrl}
                  caption={pb.caption}
                  onDelete={() => setDeleting(pb)}
                />
              ))}
            </div>
          )}

          {regularPins.length > 0 && (
            <div className="masonry-grid">
              {regularPins.map(pin => {
                const inner = (
                  <div className="masonry-pin">
                    <img src={resolvePinHref(pin.imageUrl)} alt={pin.caption || 'Mood board picture'} className="masonry-img" loading="lazy" />
                    <div className="masonry-overlay">
                      {pin.category && <span className="masonry-cat">{pin.category}</span>}
                      {pin.caption && <p className="masonry-caption">{pin.caption}</p>}
                      <button
                        type="button"
                        className="masonry-delete"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDeleting(pin);
                        }}
                        aria-label="Remove picture"
                        title="Remove picture"
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                );

                if (isMobileMood) {
                  return (
                    <div
                      key={pin.id}
                      className="masonry-pin-link masonry-pin-link--tap"
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        if (e.target.closest('.masonry-delete')) return;
                        setPinLightbox(pin);
                      }}
                      onKeyDown={(e) => {
                        if (e.target.closest('.masonry-delete')) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setPinLightbox(pin);
                        }
                      }}
                    >
                      {inner}
                    </div>
                  );
                }

                return (
                  <a
                    key={pin.id}
                    className="masonry-pin-link"
                    href={resolvePinHref(pin.imageUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {inner}
                  </a>
                );
              })}
            </div>
          )}
        </div>
      )}

      {showModal && (
        <Modal
          title={form.category === 'Pinterest' ? 'Add a Pinterest board' : 'Add a picture'}
          onClose={() => !saving && setShowModal(false)}
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={saving}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? <span className="btn-spinner" aria-hidden="true" /> : null}
                {form.category === 'Pinterest' ? 'Add board' : 'Add picture'}
              </button>
            </>
          }
        >
          {form.category !== 'Pinterest' && (
            <div className="form-group">
              <label className="form-label" htmlFor="mb-file">Choose a picture</label>
              <input id="mb-file" className="form-input" type="file" accept="image/*" onChange={e => { setFile(e.target.files?.[0] || null); setForm(f => ({ ...f, imageUrl: '' })); }} />
            </div>
          )}
          {!file && (
            <div className="form-group">
              <label className="form-label" htmlFor="mb-url">{form.category === 'Pinterest' ? 'Link to your Pinterest board or pin' : 'Or paste a link to a picture'}</label>
              <input id="mb-url" className="form-input" type="url" inputMode="url" placeholder="https://…" value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} />
              {form.category === 'Pinterest' && <div className="form-hint">In Pinterest, open your board, press Share and copy the link.</div>}
            </div>
          )}
          {form.category !== 'Pinterest' && (
            <div className="form-group">
              <label className="form-label" htmlFor="mb-cat">Category</label>
              <Select id="mb-cat" className="form-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.filter(c => c !== 'Pinterest').map(c => <option key={c}>{c}</option>)}
              </Select>
              {form.category === 'Other' && (
                <input className="form-input" style={{ marginTop: 6 }} placeholder="Name the category" aria-label="Category name" value={form.customCategory || ''} onChange={e => setForm(f => ({ ...f, customCategory: e.target.value }))} />
              )}
            </div>
          )}
          <div className="form-group">
            <label className="form-label" htmlFor="mb-cap">Caption <span className="form-optional">(optional)</span></label>
            <input id="mb-cap" className="form-input" value={form.caption} onChange={e => setForm(f => ({ ...f, caption: e.target.value }))} />
          </div>
        </Modal>
      )}

      {deleting && (
        <ConfirmModal
          title={deleting.category === 'Pinterest' ? 'Remove this Pinterest board?' : 'Remove this picture?'}
          message={deleting.category === 'Pinterest' ? 'It will disappear from your mood board. Your board on Pinterest isn’t touched.' : 'It will be removed from your mood board.'}
          confirmText="Remove"
          onConfirm={() => deletePin(deleting.id)}
          onCancel={() => setDeleting(null)}
        />
      )}

      {pinLightbox && (
        <div
          className="mb-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={pinLightbox.caption || 'Pin preview'}
          onClick={() => setPinLightbox(null)}
        >
          <button
            type="button"
            className="mb-lightbox-close"
            aria-label="Close"
            onClick={(e) => {
              e.stopPropagation();
              setPinLightbox(null);
            }}
          >
            <X size={22} aria-hidden="true" />
          </button>
          <div className="mb-lightbox-inner" onClick={e => e.stopPropagation()}>
            <img
              src={resolvePinHref(pinLightbox.imageUrl)}
              alt={pinLightbox.caption || ''}
              className="mb-lightbox-img"
            />
            <div className="mb-lightbox-meta">
              {pinLightbox.category && (
                <span className="mb-lightbox-cat">{pinLightbox.category}</span>
              )}
              {pinLightbox.caption && (
                <p className="mb-lightbox-caption">{pinLightbox.caption}</p>
              )}
              <a
                className="btn btn-secondary btn-sm mb-lightbox-open"
                href={resolvePinHref(pinLightbox.imageUrl)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open original <ExternalLink size={14} aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
