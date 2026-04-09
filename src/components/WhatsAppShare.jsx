import { useState, useRef, useEffect } from 'react';
import { getInviteBaseUrl } from '../lib/config';
import { copyToClipboard } from '../lib/utils';
import { useToast } from './ui/Toast';
import './WhatsAppShare.css';

/**
 * WhatsAppShare — share invitation via WhatsApp.
 *
 * Props:
 *   event      — full event object (must be published)
 *   people     — array of EventPerson
 *   functions  — array of ceremony functions
 *   partialUrl — (optional) partial invite URL if a paired subset exists
 */
export function WhatsAppShare({ event, people = [], functions = [], partialUrl = null }) {
  const toast = useToast();
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [linkType, setLinkType] = useState('full');
  const [messageText, setMessageText] = useState('');
  const fileRef = useRef(null);

  const inviteBase = getInviteBaseUrl();
  const fullLink   = `${inviteBase}/i/${event?.slug || ''}`;
  const hasPartial = !!partialUrl;

  // Build default message whenever event/people/functions change
  useEffect(() => {
    if (!event) return;
    const names = people.map(p => p.name).join(' & ') || 'the couple';
    const mainFn = functions[0];
    const dateLine = mainFn?.date ? `\n📅 ${new Date(mainFn.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}` : '';
    const venueLine = mainFn?.venueName ? `\n📍 ${mainFn.venueName}` : '';
    const link = linkType === 'full' ? fullLink : (partialUrl || `${fullLink}-partial`);
    setMessageText(
      `You are cordially invited to the wedding of ${names}! 🎉${dateLine}${venueLine}\n\nView our invitation:\n${link}\n\nMade with ❤️ on Aamantran`
    );
  }, [event, people, functions, linkType, fullLink]);

  function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
  }

  function removeImage() {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleShare() {
    const canShareFiles = imageFile && navigator.canShare?.({ files: [imageFile] });

    if (canShareFiles) {
      try {
        await navigator.share({ text: messageText, files: [imageFile] });
      } catch (err) {
        if (err.name !== 'AbortError') toast('Share failed', 'error');
      }
    } else {
      // Desktop: open wa.me + optionally download image
      const waUrl = `https://wa.me/?text=${encodeURIComponent(messageText)}`;
      window.open(waUrl, '_blank');
      if (imageFile) {
        // Trigger download so user can manually attach
        const a = document.createElement('a');
        a.href = imagePreview;
        a.download = imageFile.name;
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

      {/* Image upload */}
      <div className="wa-section">
        <div className="wa-section-label">Share Image <span className="wa-optional">(optional)</span></div>
        {imagePreview ? (
          <div className="wa-image-preview-wrap">
            <img src={imagePreview} alt="Share preview" className="wa-image-preview" />
            <button className="wa-image-remove" onClick={removeImage}>✕ Remove</button>
          </div>
        ) : (
          <div className="wa-upload-area" onClick={() => fileRef.current?.click()}>
            <span className="wa-upload-icon">📷</span>
            <span>Upload a photo to attach with your message</span>
            <span className="wa-upload-hint">e.g. couple photo or save-the-date card</span>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />
      </div>

      {/* Message */}
      <div className="wa-section">
        <div className="wa-section-label">Message</div>
        <textarea
          className="form-textarea wa-message"
          value={messageText}
          onChange={e => setMessageText(e.target.value)}
          rows={7}
        />
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
        <button className="btn btn-primary" onClick={handleShare}>
          <span>📱</span>
          {isMobileShareAvailable ? 'Share via WhatsApp' : 'Open WhatsApp Web'}
        </button>
        {imageFile && !isMobileShareAvailable && (
          <button className="btn btn-secondary" onClick={() => {
            const a = document.createElement('a');
            a.href = imagePreview;
            a.download = imageFile.name;
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
