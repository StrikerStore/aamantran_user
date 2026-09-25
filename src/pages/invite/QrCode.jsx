import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download } from '../../components/ui/icons';

/**
 * QR code for an invitation link, drawn in the browser — the link is never
 * sent to a third-party QR service.
 */
export function QrCode({ url, fileName = 'invitation-qr.png', size = 168 }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let live = true;
    QRCode.toDataURL(url, { width: 640, margin: 1, color: { dark: '#3d2532', light: '#ffffff' } })
      .then((data) => { if (live) setSrc(data); })
      .catch(() => { if (live) setSrc(''); });
    return () => { live = false; };
  }, [url]);

  if (!src) return null;
  return (
    <div className="qr-block">
      <img src={src} width={size} height={size} alt="QR code for your invitation link" className="qr-img" />
      <a className="btn btn-secondary btn-sm" href={src} download={fileName}>
        <Download size={16} aria-hidden="true" /> Download QR code
      </a>
    </div>
  );
}
