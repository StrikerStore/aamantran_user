import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Select } from '../components/ui/Select';
import { API_BASE } from '../lib/config';
import { useToast } from '../components/ui/Toast';
import { ConfirmModal } from '../components/ui/Modal';
import { GridSkeleton } from '../components/ui/Skeleton';
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

function pinDoForUrl(url) {
  return String(url).toLowerCase().includes('/pin/') ? 'embedPin' : 'embedBoard';
}

function normalizePinterestUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:') return '';
    if (host === 'pin.it' || host === 'pinterest.com' || host.endsWith('.pinterest.com')) {
      return url.toString();
    }
  } catch {
    // Invalid user input should stay inert.
  }
  return '';
}

function escapeHtmlAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function pinterestSrcDoc({ embedHtml, boardUrl }) {
  const body = embedHtml || `
    <a
      data-pin-do="${pinDoForUrl(boardUrl)}"
      data-pin-board-width="100%"
      data-pin-scale-height="280"
      data-pin-scale-width="80"
      href="${escapeHtmlAttr(boardUrl)}"
    ></a>
    <script async defer src="https://assets.pinterest.com/js/pinit.js"></script>
  `;

  return `<!doctype html>
<html>
  <head>
    <base target="_blank">
    <style>
      html, body {
        margin: 0;
        min-height: 100%;
        background: transparent;
        color: #5f4b32;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      body {
        display: flex;
        justify-content: center;
        align-items: flex-start;
        overflow: hidden;
      }
      img, iframe, span, div {
        max-width: 100%;
      }
    </style>
  </head>
  <body>${body}</body>
</html>`;
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
  const validBoardUrl = normalizePinterestUrl(boardUrl);
  const [embedResult, setEmbedResult] = useState({ url: '', html: null });

  useEffect(() => {
    if (!validBoardUrl) return;

    let cancelled = false;

    api.moodboard
      .pinterestOembed(eventId, validBoardUrl)
      .then((r) => {
        if (cancelled) return;
        setEmbedResult({ url: validBoardUrl, html: r.html || null });
      })
      .catch(() => {
        if (!cancelled) setEmbedResult({ url: validBoardUrl, html: null });
      });

    return () => {
      cancelled = true;
    };
  }, [eventId, validBoardUrl]);

  const loading = Boolean(validBoardUrl) && embedResult.url !== validBoardUrl;
  const embedHtml = !loading && embedResult.url === validBoardUrl ? embedResult.html : null;
  const previewSrcDoc = validBoardUrl ? pinterestSrcDoc({ embedHtml, boardUrl: validBoardUrl }) : '';

  return (
    <div className="mb-pinterest-card">
      <button
        type="button"
        className="masonry-delete mb-pinterest-delete"
        aria-label="Remove Pinterest board"
        onClick={onDelete}
      >
        ✕
      </button>

      <div className="mb-pinterest-body">
        {loading && (
          <div className="mb-pinterest-loading">
            <div className="spinner spinner-lg" />
            <p className="mb-pinterest-loading-text">Loading Pinterest preview…</p>
          </div>
        )}
        {!loading && validBoardUrl && (
          <div className="mb-pinterest-viewport">
            <iframe
              className="mb-pinterest-embed"
              title={caption || 'Pinterest preview'}
              srcDoc={previewSrcDoc}
              sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
            />
          </div>
        )}
        {!loading && !validBoardUrl && (
          <div className="mb-pinterest-viewport">
            <div className="mb-pinterest-invalid">
              This saved Pinterest URL is invalid and was not loaded.
            </div>
          </div>
        )}
      </div>

      <div className="mb-pinterest-footer">
        <div className="mb-pinterest-footer-text">
          {caption ? <p className="mb-pinterest-caption">{caption}</p> : null}
          <p className="mb-pinterest-hint">Pins load inside the preview when Pinterest allows embedding.</p>
        </div>
        {validBoardUrl && (
          <a
            className="btn btn-secondary btn-sm mb-pinterest-open"
            href={validBoardUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open on Pinterest ↗
          </a>
        )}
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
      .catch(() => toast('Failed to load mood board', 'error'))
      .finally(() => setLoading(false));
  }, [id]);

  function openNew() { setForm({ ...BLANK, customCategory: '' }); setFile(null); setShowModal(true); }
  function openNewPinterest() { setForm({ ...BLANK, category: 'Pinterest', customCategory: '' }); setFile(null); setShowModal(true); }

  async function save() {
    if (!file && !form.imageUrl.trim()) { toast('Upload an image or enter a URL', 'error'); return; }
    setSaving(true);
    try {
      let payloadCategory = form.category;
      if (payloadCategory === 'Other' && form.customCategory?.trim()) {
        payloadCategory = form.customCategory.trim();
      }
      const imageUrl = form.imageUrl.trim();
      if (payloadCategory === 'Pinterest' && !normalizePinterestUrl(imageUrl)) {
        toast('Enter a valid HTTPS Pinterest board or pin URL', 'error');
        return;
      }

      let payload;
      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('caption', form.caption);
        fd.append('category', payloadCategory);
        payload = fd;
      } else {
        payload = { imageUrl, caption: form.caption, category: payloadCategory };
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
  const splitBoardLayout = pinterestBoards.length > 0 && regularPins.length > 0;

  if (loading) return <div className="page-fade" style={{ paddingTop: 8 }}><GridSkeleton count={9} /></div>;

  return (
    <div className="page-fade">
      <section className="feat-shell">
        <header className="feat-head">
          <div className="feat-head-text">
            <h1 className="feat-title">Mood board</h1>
            <p className="feat-desc">Collect inspiration for your dream wedding</p>
          </div>
          <div className="feat-head-actions">
            <button type="button" className="btn btn-ghost" style={{ border: '1px solid var(--gold)', color: 'var(--gold)' }} onClick={openNewPinterest}>
              + Pinterest board
            </button>
            <button type="button" className="btn btn-primary" onClick={openNew}>+ Add pin</button>
          </div>
        </header>

        <div className="feat-hub">
          <div className="feat-hub-pills feat-hub-pills--scroll">
            <button type="button" className={`pill ${!catFilter ? 'active' : ''}`} onClick={() => setCatFilter('')}>All</button>
            {CATEGORIES.map(c => (
              <button type="button" key={c} className={`pill ${catFilter === c ? 'active' : ''}`} onClick={() => setCatFilter(c)}>{c}</button>
            ))}
          </div>
        </div>
      </section>

      {filtered.length === 0 ? (
        <div className="empty-state" style={{ padding: '40px 0' }}>
          <div className="empty-icon">🎨</div>
          <div className="empty-title">Your mood board is empty</div>
          <div className="empty-desc">Add images from your phone or connect a Pinterest board.</div>
        </div>
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
                    <img src={resolvePinHref(pin.imageUrl)} alt={pin.caption || 'pin'} className="masonry-img" loading="lazy" />
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
                      >
                        ✕
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
        <div className="modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add Pin</h2>
              <button type="button" className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            {form.category !== 'Pinterest' && (
              <div className="form-group">
                <label className="form-label">Upload Image</label>
                <input className="form-input" type="file" accept="image/*" onChange={e => { setFile(e.target.files?.[0] || null); setForm(f => ({ ...f, imageUrl: '' })); }} />
              </div>
            )}
            {!file && (
              <div className="form-group">
                <label className="form-label">{form.category === 'Pinterest' ? 'Pinterest board or pin URL' : 'Or Image URL'}</label>
                <input className="form-input" placeholder="https://…" value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} />
              </div>
            )}
              <div className="form-group">
                <label className="form-label">Category</label>
                <Select className="form-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </Select>
                {form.category === 'Other' && (
                  <input className="form-input" style={{ marginTop: 6 }} placeholder="Category name" value={form.customCategory || ''} onChange={e => setForm(f => ({ ...f, customCategory: e.target.value }))} />
                )}
              </div>
            <div className="form-group">
              <label className="form-label">Caption (optional)</label>
              <input className="form-input" value={form.caption} onChange={e => setForm(f => ({ ...f, caption: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
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
            ✕
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
                Open original ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
