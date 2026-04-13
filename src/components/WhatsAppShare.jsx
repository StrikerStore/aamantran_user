import { useState, useRef, useEffect } from 'react';
import { getInviteBaseUrl } from '../lib/config';
import { copyToClipboard } from '../lib/utils';
import { useToast } from './ui/Toast';
import { api } from '../lib/api';
import './WhatsAppShare.css';

/**
 * WhatsAppShare — share invitation via WhatsApp.
 *
 * Props:
 *   event            — full event object (must be published)
 *   people           — array of EventPerson (all people)
 *   schemaPeopleRoles — array of { role, label, required } from template schema
 *   functions        — array of ceremony functions
 *   venues           — array of venue objects
 *   partialUrl       — (optional) partial invite URL if a paired subset exists
 *   eventId          — event ID for persisting the share image via media API
 */
export function WhatsAppShare({ event, people = [], schemaPeopleRoles = [], functions = [], venues = [], partialUrl = null, eventId }) {
  const toast = useToast();
  const [imageFile, setImageFile]         = useState(null);   // local File (before upload)
  const [imagePreview, setImagePreview]   = useState(null);   // URL for display
  const [savedMediaId, setSavedMediaId]   = useState(null);   // persisted media record id
  const [uploading, setUploading]         = useState(false);
  const [linkType, setLinkType]           = useState('full');
  const [messageText, setMessageText]     = useState('');
  const fileRef = useRef(null);

  const inviteBase = getInviteBaseUrl();
  const fullLink   = `${inviteBase}/i/${event?.slug || ''}`;
  const hasPartial = !!partialUrl;

  // ── Load persisted share image on mount ─────────────────────────────────────
  useEffect(() => {
    if (!eventId) return;
    api.media.list(eventId).then(r => {
      const shareMedia = (r.media || []).find(m => m.slotKey === 'wa_share_image');
      if (shareMedia) {
        setImagePreview(shareMedia.url);
        setSavedMediaId(shareMedia.id);
      }
    }).catch(() => {});
  }, [eventId]);

  // ── Build default message whenever key data changes ──────────────────────────
  useEffect(() => {
    if (!event) return;

    // Only use required-role names (frozen names) when schema is available
    const requiredRoles = new Set(
      schemaPeopleRoles.filter(r => r.required).map(r => r.role)
    );
    const namesForMsg = schemaPeopleRoles.length > 0
      ? people.filter(p => requiredRoles.has(p.role)).map(p => p.name).join(' & ')
      : people.map(p => p.name).join(' & ');
    const names = namesForMsg || 'the couple';

    // Date — first function
    const mainFn  = functions[0];
    const dateLine = mainFn?.date
      ? `\n📅 ${new Date(mainFn.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`
      : '';

    // Location — only if all functions share exactly one venue
    const venueNames = functions.map(f => f.venueName).filter(Boolean);
    const uniqueVenues = [...new Set(venueNames)];
    const venueLine = uniqueVenues.length === 1 ? `\n📍 ${uniqueVenues[0]}` : '';

    const link = linkType === 'full' ? fullLink : (partialUrl || `${fullLink}-partial`);

    setMessageText(
      `You are cordially invited to the wedding of ${names}! 🎉${dateLine}${venueLine}\n\nView our invitation:\n${link}\n\nMade with ❤️ on Aamantran`
    );
  }, [event, people, schemaPeopleRoles, functions, linkType, fullLink, partialUrl]);

  // ── Upload share image and persist it ───────────────────────────────────────
  async function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show local preview immediately
    const localUrl = URL.createObjectURL(file);
    setImagePreview(localUrl);
    setImageFile(file);

    if (!eventId) return;
    setUploading(true);
    try {
      // Remove previous persisted image
      if (savedMediaId) {
        await api.media.remove(eventId, savedMediaId).catch(() => {});
        setSavedMediaId(null);
      }
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', 'photo');
      fd.append('slotKey', 'wa_share_image');
      const r = await api.media.upload(eventId, fd);
      // Replace local blob URL with server URL
      URL.revokeObjectURL(localUrl);
      setImagePreview(r.media.url);
      setImageFile(null);
      setSavedMediaId(r.media.id);
      toast('Share image saved!', 'success');
    } catch {
      // Keep local preview if upload fails
    } finally {
      setUploading(false);
    }
  }

  async function removeImage() {
    if (savedMediaId && eventId) {
      await api.media.remove(eventId, savedMediaId).catch(() => {});
      setSavedMediaId(null);
    }
    if (imageFile && imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  // ── Share ────────────────────────────────────────────────────────────────────
  async function handleShare() {
    // Try to get a File object for native share
    let shareFile = imageFile;

    if (!shareFile && imagePreview) {
      // Image is a server URL — fetch as blob for native share
      try {
        const resp = await fetch(imagePreview);
        const blob = await resp.blob();
        shareFile = new File([blob], 'share-image.jpg', { type: blob.type });
      } catch { /* ignore, share text only */ }
    }

    const canShareFiles = shareFile && navigator.canShare?.({ files: [shareFile] });

    if (canShareFiles) {
      try {
        await navigator.share({ text: messageText, files: [shareFile] });
      } catch (err) {
        if (err.name !== 'AbortError') toast('Share failed', 'error');
      }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(messageText)}`, '_blank');
      if (shareFile) {
        const a = document.createElement('a');
        a.href = imagePreview || URL.createObjectURL(shareFile);
        a.download = 'share-image.jpg';
        a.click();
      }
    }
  }

  async function handleCopy() {
    const ok = await copyToClipboard(messageText);
    toast(ok ? 'Message copied!' : 'Copy failed', ok ? 'success' : 'error');
  }

  if (!event?.isPublished) return null;

  const isMobileShareAvailable = typeof navigator.share === 'function';

  return (
    <div className="wa-share">
      <div className="wa-share-header">
        <span className="wa-icon">📲</span>
        <h3>Share on WhatsApp</h3>
      </div>

      {/* Share image — persisted for future use */}
      <div className="wa-section">
        <div className="wa-section-label">
          Share Image <span className="wa-optional">(optional — saved for future sharing)</span>
        </div>
        {imagePreview ? (
          <div className="wa-image-preview-wrap">
            <img src={imagePreview} alt="Share preview" className="wa-image-preview" />
            <button className="wa-image-remove" onClick={removeImage} disabled={uploading}>✕ Remove</button>
          </div>
        ) : (
          <div className="wa-upload-area" onClick={() => !uploading && fileRef.current?.click()}>
            <span className="wa-upload-icon">📷</span>
            <span>{uploading ? 'Uploading…' : 'Upload a photo to attach with your message'}</span>
            <span className="wa-upload-hint">e.g. couple photo or save-the-date card</span>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />
        {uploading && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>Saving share image…</div>}
      </div>

      {/* Link selector — only show if a real partial invite exists */}
      {hasPartial && (
        <div className="wa-section">
          <div className="wa-section-label">Select Invitation Link</div>
          <div className="wa-link-options">
            <label className={`wa-link-option ${linkType === 'full' ? 'selected' : ''}`}>
              <input type="radio" name="linkType" value="full" checked={linkType === 'full'} onChange={() => setLinkType('full')} />
              <div>
                <div className="wa-link-label">Full Invitation (all functions)</div>
                <div className="wa-link-url">{fullLink}</div>
              </div>
            </label>
            <label className={`wa-link-option ${linkType === 'partial' ? 'selected' : ''}`}>
              <input type="radio" name="linkType" value="partial" checked={linkType === 'partial'} onChange={() => setLinkType('partial')} />
              <div>
                <div className="wa-link-label">Partial Invitation (selected functions only)</div>
                <div className="wa-link-url">{partialUrl}</div>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Editable message */}
      <div className="wa-section">
        <div className="wa-section-label">Message</div>
        <textarea
          className="form-textarea wa-message"
          value={messageText}
          onChange={e => setMessageText(e.target.value)}
          rows={7}
        />
      </div>

      {/* Preview card */}
      <div className="wa-section">
        <div className="wa-section-label">Preview</div>
        <div className="wa-preview-card">
          {imagePreview && <img src={imagePreview} alt="" className="wa-preview-image" />}
          <p className="wa-preview-text">{messageText}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="wa-actions">
        <button className="btn btn-primary" onClick={handleShare} disabled={uploading}>
          <span>📱</span>
          {isMobileShareAvailable ? 'Share via WhatsApp' : 'Open WhatsApp Web'}
        </button>
        {imagePreview && !isMobileShareAvailable && (
          <button className="btn btn-secondary" onClick={async () => {
            const a = document.createElement('a');
            a.href = imagePreview;
            a.download = 'share-image.jpg';
            a.target = '_blank';
            a.click();
          }}>
            <span>⬇</span> Download Image
          </button>
        )}
        <button className="btn btn-secondary" onClick={handleCopy}>
          <span>📋</span> Copy Message
        </button>
      </div>
    </div>
  );
}
