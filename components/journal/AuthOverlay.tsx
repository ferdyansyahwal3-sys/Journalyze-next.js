// components/journal/AuthOverlay.tsx
// Dipindah dari index.html baris 1446-1531 (markup) + tab-switch &
// togglePass (baris 6792-6829, 6816-6828). Logic validasi & submit
// ada di hooks/useJournalAuth.ts.
'use client';

import { useState } from 'react';
import { useJournalStore } from '@/store/useJournalStore';
import { useJournalAuth } from '@/hooks/useJournalAuth';

const EyeIcon = ({ off }: { off: boolean }) =>
  off ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
  );

export default function AuthOverlay() {
  const authOverlayVisible = useJournalStore((s) => s.authOverlayVisible);
  const {
    doLogin,
    doRegister,
    loginErr,
    regErr,
    regOk,
    loginBusy,
    regBusy,
    blockedMsg,
  } = useJournalAuth();

  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [showRegPass, setShowRegPass] = useState(false);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');

  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regKey, setRegKey] = useState('');

  const submitLogin = () => doLogin(loginEmail, loginPass);
  const submitRegister = async () => {
    const ok = await doRegister(regName, regEmail, regPass, regPhone, regKey);
    if (ok) setTimeout(() => setTab('login'), 2000); // index.html baris 6876
  };

  return (
    <div id="auth-overlay" className={authOverlayVisible ? '' : 'hidden'}>
      <div className="auth-bg-orb auth-orb1"></div>
      <div className="auth-bg-orb auth-orb2"></div>
      <div className="auth-bg-orb auth-orb3"></div>
      <div className="auth-lines"></div>
      <div className="auth-corner auth-corner-tl"></div>
      <div className="auth-corner auth-corner-tr"></div>
      <div className="auth-corner auth-corner-bl"></div>
      <div className="auth-corner auth-corner-br"></div>
      <div className="auth-content">
        <div className="auth-brand-top">
          <div className="auth-brand-eyebrow">✦ Trading Journal Suite</div>
          <div className="auth-brand-logo">
            Journal<em>yze</em>
          </div>
          <div className="auth-brand-tagline">Catat. Analisa. Berkembang.</div>
        </div>
        <div className="auth-divider">
          <div className="auth-divider-line"></div>
          <div className="auth-divider-diamond">✦</div>
          <div className="auth-divider-line r"></div>
        </div>
        <div className="auth-card">
          <div className="auth-tabs">
            <button className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')}>
              Masuk
            </button>
            <button className={`auth-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => setTab('register')}>
              Daftar
            </button>
          </div>

          {/* LOGIN */}
          <div className={`auth-form ${tab === 'login' ? '' : 'hidden'}`}>
            <div className="auth-field">
              <label className="auth-label">Email</label>
              <input
                className="auth-input"
                type="email"
                placeholder="trader@email.com"
                autoComplete="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
              />
            </div>
            <div className="auth-field">
              <label className="auth-label">Password</label>
              <div className="auth-pass-wrap">
                <input
                  className="auth-input"
                  type={showLoginPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitLogin()}
                />
                <button className="auth-eye-btn" type="button" title="Lihat password" onClick={() => setShowLoginPass((v) => !v)}>
                  <EyeIcon off={showLoginPass} />
                </button>
              </div>
            </div>
            {(loginErr || blockedMsg) && <div className="auth-err show">{blockedMsg || loginErr}</div>}
            <button className="auth-btn" disabled={loginBusy} onClick={submitLogin}>
              <span>{loginBusy ? 'Memproses...' : 'Masuk ke Jurnal'}</span>
              <span className="auth-btn-arrow">→</span>
            </button>
            <div className="auth-switch">
              Belum punya akun? <span onClick={() => setTab('register')}>Daftar sekarang</span>
            </div>
          </div>

          {/* REGISTER */}
          <div className={`auth-form ${tab === 'register' ? '' : 'hidden'}`}>
            <div className="auth-field">
              <label className="auth-label">👤 Nama Panggilan</label>
              <input
                className="auth-input"
                type="text"
                placeholder="contoh: Ferdy"
                autoComplete="nickname"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
              />
              <div className="auth-field-hint">Akan ditampilkan di dalam aplikasi</div>
            </div>
            <div className="auth-field">
              <label className="auth-label">Email</label>
              <input
                className="auth-input"
                type="email"
                placeholder="trader@email.com"
                autoComplete="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
              />
            </div>
            <div className="auth-field">
              <label className="auth-label">
                Password <span style={{ color: 'var(--text4)', fontWeight: 400 }}>(min. 6 karakter)</span>
              </label>
              <div className="auth-pass-wrap">
                <input
                  className="auth-input"
                  type={showRegPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  value={regPass}
                  onChange={(e) => setRegPass(e.target.value)}
                />
                <button className="auth-eye-btn" type="button" title="Lihat password" onClick={() => setShowRegPass((v) => !v)}>
                  <EyeIcon off={showRegPass} />
                </button>
              </div>
            </div>
            <div className="auth-field">
              <label className="auth-label">📱 No. HP / WhatsApp</label>
              <input
                className="auth-input"
                type="tel"
                placeholder="08xxxxxxxxxx"
                autoComplete="tel"
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
              />
              <div className="auth-field-hint">Digunakan untuk keperluan dukungan teknis</div>
            </div>
            <div className="auth-field">
              <label className="auth-label">🔑 License Key</label>
              <input
                className="auth-input auth-input-key"
                type="text"
                placeholder="JZ-XXXX-XXXX"
                autoComplete="off"
                value={regKey}
                onChange={(e) => setRegKey(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && submitRegister()}
              />
              <div className="auth-field-hint">Dapatkan dari penjual setelah pembelian</div>
            </div>
            {regErr && <div className="auth-err show">{regErr}</div>}
            {regOk && <div className="auth-ok show">{regOk}</div>}
            <button className="auth-btn" disabled={regBusy} onClick={submitRegister}>
              <span>{regBusy ? 'Verifikasi license...' : 'Buat Akun'}</span>
              <span className="auth-btn-arrow">→</span>
            </button>
            <div className="auth-switch">
              Sudah punya akun? <span onClick={() => setTab('login')}>Masuk</span>
            </div>
          </div>
        </div>
        <div className="auth-bottom-line">Journalyze &nbsp;·&nbsp; Cloud Sync &nbsp;·&nbsp; Secure Account</div>
      </div>
    </div>
  );
}