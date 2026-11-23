import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** Shareable invite: QR code + link, using the network address so phones can open it. */
export default function InviteCard({ link, local, onClose }: { link: string; local: boolean; onClose: () => void }) {
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    QRCode.toDataURL(link, { margin: 1, width: 360, color: { dark: '#2a2160', light: '#ffffff' } }).then(setQr);
  }, [link]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable on http */ }
  };
  return (
    <section className="card invite">
      <h2>Invite players</h2>
      <p className="muted">Scan with a phone camera or share the link. Phones must be on the same Wi-Fi (or use a tunnel for outside access).</p>
      {qr && <img className="qr" src={qr} alt="QR code for the invite link" />}
      <div className="linkbox">{link}</div>
      {local && <p className="warn">This link uses localhost, which phones can't open. Open the app from your network address instead.</p>}
      <div className="btns">
        <button className="primary" onClick={copy}>{copied ? 'Copied ✓' : 'Copy link'}</button>
        {typeof navigator.share === 'function' && <button onClick={() => navigator.share({ title: 'Join my game', url: link }).catch(() => {})}>Share…</button>}
        <button onClick={onClose}>Close</button>
      </div>
    </section>
  );
}
