import { useState, useRef, useEffect } from 'react';
import { getInviteBaseUrl } from '../lib/config';
import { copyToClipboard, whatsappShareUrl } from '../lib/utils';
import { useToast } from './ui/Toast';
import { api } from '../lib/api';
import { eventTypeWord } from '../lib/event';
import { MessageCircle, ImagePlus, Trash2, Share2, Copy, Download } from 'lucide-react';
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
  const [imageFile, setImageFile] = useState(null);   // local File (before upload)
  const [imagePreview, setImagePreview] = useState(null);   // URL for display
  const [savedMediaId, setSavedMediaId] = useState(null);   // persisted media record id
  const [uploading, setUploading] = useState(false);
  const [linkType, setLinkType] = useState('full');
  const [messageText, setMessageText] = useState('');
  const fileRef = useRef(null);

  const inviteBase = getInviteBaseUrl();
  const fullLink = `${inviteBase}/i/${event?.slug || ''}`;
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
    }).catch(() => { });
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
    const mainFn = functions[0];
    const dateLine = mainFn?.date
      ? `\n📅 ${new Date(mainFn.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`
      : '';

    // Location — only if all functions share exactly one venue
    const venueNames = functions.map(f => f.venueName).filter(Boolean);
    const uniqueVenues = [...new Set(venueNames)];
    const venueLine = uniqueVenues.length === 1 ? `\n📍 ${uniqueVenues[0]}` : '';

    const link = linkType === 'full' ? fullLink : (partialUrl || `${fullLink}-partial`);

    setMessageText(
      `You are cordially invited to the ${eventTypeWord(event)} of ${names}! 🎉${dateLine}${venueLine}\n\nView our invitation:\n${link}\n\nMade with ❤️ on Aamantran`
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
        await api.media.remove(eventId, savedMediaId).catch(() => { });
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
      toast('Photo saved.', 'success');
    } catch {
      // Keep local preview if upload fails
    } finally {
      setUploading(false);
    }
  }

  async function removeImage() {
    if (savedMediaId && eventId) {
      await api.media.remove(eventId, savedMediaId).catch(() => { });
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
        if (err.name !== 'AbortError') toast('Couldn’t open sharing. Try “Copy message” instead.', 'error');
      }
    } else {
      window.open(whatsappShareUrl(messageText), '_blank');
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
    toast(ok ? 'Message copied.' : 'Couldn’t copy — select the message and copy it yourself.', ok ? 'success' : 'error');
  }

  if (!event?.isPublished) return null;

  const isMobileShareAvailable = typeof navigator.share === 'function';

  return (
    <div className="wa-share">
      <div className="wa-share-header">
        <span className="wa-icon" aria-hidden="true"><MessageCircle size={20} /></span>
        <h2>Send on WhatsApp</h2>
      </div>

      {/* Share image — persisted for future use */}
      <div className="wa-section">
        <div className="wa-section-label">
          Photo to send with your message <span className="form-optional">(optional)</span>
        </div>
        {imagePreview ? (
          <div className="wa-image-preview-wrap">
            <img src={imagePreview} alt="Share preview" className="wa-image-preview" />
            <button type="button" className="wa-image-remove" onClick={removeImage} disabled={uploading}>
              <Trash2 size={14} aria-hidden="true" /> Remove photo
            </button>
          </div>
        ) : (
          <button type="button" className="wa-upload-area" onClick={() => !uploading && fileRef.current?.click()}>
            <span className="wa-upload-icon" aria-hidden="true"><ImagePlus size={28} /></span>
            <span>{uploading ? 'Uploading…' : 'Add a photo'}</span>
            <span className="wa-upload-hint">A couple photo or save-the-date card makes your message stand out.</span>
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />
        {uploading && <div className="form-hint">Saving your photo…</div>}
      </div>

      {/* Link selector — only show if a real partial invite exists */}
      {hasPartial && (
        <div className="wa-section">
          <div className="wa-section-label">Which link?</div>
          <div className="wa-link-options">
            <label className={`wa-link-option ${linkType === 'full' ? 'selected' : ''}`}>
              <input type="radio" name="linkType" value="full" checked={linkType === 'full'} onChange={() => setLinkType('full')} />
              <div>
                <div className="wa-link-label">Your link — every ceremony</div>
                <div className="wa-link-url">{fullLink}</div>
              </div>
            </label>
            <label className={`wa-link-option ${linkType === 'partial' ? 'selected' : ''}`}>
              <input type="radio" name="linkType" value="partial" checked={linkType === 'partial'} onChange={() => setLinkType('partial')} />
              <div>
                <div className="wa-link-label">Link for selected ceremonies</div>
                <div className="wa-link-url">{partialUrl}</div>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Editable message */}
      <div className="wa-section">
        <label className="wa-section-label" htmlFor="wa-message">Message</label>
        <div className="form-hint" style={{ marginBottom: 6 }}>Edit it however you like.</div>
        <textarea
          id="wa-message"
          className="form-textarea wa-message"
          value={messageText}
          onChange={e => setMessageText(e.target.value)}
          rows={7}
        />
      </div>

      {/* Preview card */}
      <div className="wa-section">
        <div className="wa-section-label">How it will look</div>
        <div className="wa-preview-card">
          {imagePreview && <img src={imagePreview} alt="" className="wa-preview-image" />}
          <p className="wa-preview-text">{messageText}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="wa-actions">
        <button type="button" className="btn btn-primary" onClick={handleShare} disabled={uploading}>
          <Share2 size={18} aria-hidden="true" />
          {isMobileShareAvailable ? 'Share' : 'Open WhatsApp'}
        </button>
        {imagePreview && !isMobileShareAvailable && (
          <button type="button" className="btn btn-secondary" onClick={async () => {
            const a = document.createElement('a');
            a.href = imagePreview;
            a.download = 'share-image.jpg';
            a.target = '_blank';
            a.click();
          }}>
            <Download size={18} aria-hidden="true" /> Download image
          </button>
        )}
        <button type="button" className="btn btn-secondary" onClick={handleCopy}>
          <Copy size={18} aria-hidden="true" /> Copy message
        </button>
      </div>
    </div>
  );
}
