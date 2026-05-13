import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { API_BASE } from '../lib/config';
import { useToast } from '../components/ui/Toast';
import { ConfirmModal } from '../components/ui/Modal';
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

function normalizePinterestUrl(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';

  let url;
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.pinterest.com';
    url = new URL(value, origin);
  } catch {
    return '';
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';

  const host = url.hostname.toLowerCase();
  const isPinterest = host === 'pinterest.com' || host.endsWith('.pinterest.com');
  const isPinShortlink = host === 'pin.it' || host.endsWith('.pin.it');
  return isPinterest || isPinShortlink ? url.href : '';
}

function copySafeDimensionAttr(source, target, attr) {
  const value = source.getAttribute(attr);
  if (value && /^[0-9.%]+$/.test(value)) target.setAttribute(attr, value);
}

function sanitizePinterestEmbedHtml(html) {
  if (typeof document === 'undefined' || !html) return null;

  const template = document.createElement('template');
  template.innerHTML = String(html);
  const output = document.createElement('div');

  function appendSafeChildren(source, target) {
    Array.from(source.childNodes).forEach((node) => {
      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const tag = node.tagName.toLowerCase();
      if (tag === 'a') {
        const href = normalizePinterestUrl(node.getAttribute('href'));
        if (!href) return;

        const anchor = document.createElement('a');
        anchor.href = href;
        anchor.textContent = node.textContent || 'Pinterest';
        ['data-pin-do', 'data-pin-board-width', 'data-pin-scale-height', 'data-pin-scale-width'].forEach((attr) => {
          const value = node.getAttribute(attr);
          if (value && /^[\w%.-]+$/.test(value)) anchor.setAttribute(attr, value);
        });
        target.appendChild(anchor);
        return;
      }

      if (tag === 'iframe') {
        const src = normalizePinterestUrl(node.getAttribute('src'));
        if (!src) return;

        const iframe = document.createElement('iframe');
        iframe.src = src;
        iframe.title = node.getAttribute('title') || 'Pinterest embed';
        iframe.loading = 'lazy';
        iframe.referrerPolicy = 'no-referrer-when-downgrade';
        iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox');
        copySafeDimensionAttr(node, iframe, 'width');
        copySafeDimensionAttr(node, iframe, 'height');
        target.appendChild(iframe);
        return;
      }

      if (tag === 'div' || tag === 'span' || tag === 'blockquote') {
        const wrapper = document.createElement(tag);
        appendSafeChildren(node, wrapper);
        if (wrapper.childNodes.length) target.appendChild(wrapper);
        return;
      }

      appendSafeChildren(node, target);
    });
  }

  appendSafeChildren(template.content, output);
  return output.innerHTML.trim() || null;
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
  const embedHostRef = useRef(null);
  const widgetHostRef = useRef(null);
  const safeBoardUrl = normalizePinterestUrl(boardUrl);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setEmbedHtml(null);

    if (!safeBoardUrl) {
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    api.moodboard
      .pinterestOembed(eventId, safeBoardUrl)
      .then((r) => {
        if (cancelled) return;
        setEmbedHtml(sanitizePinterestEmbedHtml(r.html));
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
  }, [eventId, safeBoardUrl]);

  useEffect(() => {
    if (loading || !embedHtml) return;
    const root = embedHostRef.current;
    if (!root) return;

    let cancelled = false;
    loadPinterestScript().then(() => {
      if (cancelled || !embedHostRef.current) return;
      requestAnimationFrame(() => {
        try {
          if (typeof window.parsePins === 'function') window.parsePins(embedHostRef.current);
          else if (window.PinUtils && typeof window.PinUtils.build === 'function') {
            window.PinUtils.build(embedHostRef.current);
          }
        } catch {
          /* Pinterest script API varies by region/version */
        }
      });
    }).catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [loading, embedHtml]);

  useEffect(() => {
    if (loading || embedHtml || !safeBoardUrl) return;
    const root = widgetHostRef.current;
    if (!root) return;

    root.innerHTML = '';
    const a = document.createElement('a');
    a.href = safeBoardUrl;
    a.dataset.pinDo = pinDoForUrl(safeBoardUrl);
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
  }, [loading, embedHtml, safeBoardUrl]);

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
        {!loading && embedHtml && (
          <div className="mb-pinterest-viewport">
            <div ref={embedHostRef} className="mb-pinterest-embed" dangerouslySetInnerHTML={{ __html: embedHtml }} />
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
          href={safeBoardUrl || '#'}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            if (!safeBoardUrl) e.preventDefault();
          }}
        >
          Open on Pinterest ↗
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
  const splitBoardLayout = pinterestBoards.length > 0 && regularPins.length > 0;

  if (loading) return <div className="loading-center"><div className="spinner spinner-lg" /></div>;

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
