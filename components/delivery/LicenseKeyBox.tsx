// components/delivery/LicenseKeyBox.tsx
// Dipindah dari delivery.html baris 184-226 + copyKey() baris 377-400
'use client';

import { useState } from 'react';

export default function LicenseKeyBox({
  licenseKey,
  customerName,
  isExpired,
}: {
  licenseKey: string;
  customerName: string;
  isExpired: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copyKey = async () => {
    if (licenseKey === 'TIDAK DITEMUKAN' || licenseKey === 'TOKEN TIDAK VALID') return;
    try {
      await navigator.clipboard.writeText(licenseKey);
    } catch {
      // fallback sama seperti aslinya kalau clipboard API gagal
      const el = document.createElement('textarea');
      el.value = licenseKey;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      alert('License key tersalin: ' + licenseKey);
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="license-section reveal">
      <div className="license-card">
        <div className="license-eyebrow">🔑 License Key Kamu</div>
        <div className="license-key-display" id="license-key-display">
          {licenseKey}
        </div>
        {customerName && (
          <div className="license-name" id="license-name">
            Atas nama: {decodeURIComponent(customerName)}
          </div>
        )}
        <button className={`license-copy-btn ${copied ? 'copied' : ''}`} id="copy-btn" onClick={copyKey}>
          <span id="copy-icon">{copied ? '✅' : '📋'}</span>
          <span id="copy-text">{copied ? 'Tersalin!' : 'Tap untuk Copy Key'}</span>
        </button>
        <div className="license-note">⚠️ Simpan key ini — hanya berlaku untuk 1 akun</div>

        {isExpired && (
          <div
            style={{
              marginTop: 12,
              background: 'rgba(232,64,64,0.08)',
              border: '1px solid rgba(232,64,64,0.25)',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 11,
              color: '#E84040',
              textAlign: 'center',
            }}
          >
            ⚠️ Link ini sudah lebih dari 72 jam. Key masih valid, simpan baik-baik sebelum link ini tidak bisa diakses.
          </div>
        )}
      </div>

      {/* How to Register — admin.html/delivery.html baris 197-217 */}
      <div className="how-section" style={{ marginTop: 20 }}>
        <div className="how-title">Cara Aktivasi Journalyze</div>
        <div className="how-steps">
          {[
            <>Klik tombol <strong>&quot;Buka Journalyze&quot;</strong> di bawah untuk membuka aplikasi jurnal kamu</>,
            <>Di halaman login, pilih tab <strong>Daftar</strong></>,
            <>Isi email, password (min. 6 karakter), lalu paste <strong>License Key</strong> di atas</>,
            <>Klik <strong>Buat Akun</strong> — data kamu tersimpan di cloud, bisa diakses dari HP maupun laptop ✅</>,
          ].map((text, i) => (
            <div className="how-step" key={i}>
              <div className="how-step-num">{i + 1}</div>
              <div className="how-step-text">{text}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 20 }}>
        <a href="https://journalyze.my.id" target="_blank" rel="noreferrer" className="access-btn" style={{ fontSize: 15, padding: '15px 32px' }}>
          <span className="btn-icon">🚀</span>
          Buka Journalyze
          <span className="btn-arr">→</span>
        </a>
      </div>
    </div>
  );
}
