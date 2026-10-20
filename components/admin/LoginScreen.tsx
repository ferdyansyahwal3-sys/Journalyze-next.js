// components/admin/LoginScreen.tsx
'use client';

import { useState } from 'react';
import { useAdminStore } from '@/store/useAdminStore';
import { useAdminAuth } from '@/hooks/useAdminAuth';

const EyeIcon = ({ off }: { off: boolean }) =>
  off ? (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );

export default function LoginScreen() {
  const [email, setEmail]       = useState('');
  const [pass, setPass]         = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy]         = useState(false);

  const loginError  = useAdminStore((s) => s.loginError);
  const authStatus  = useAdminStore((s) => s.authStatus);
  const { doLogin } = useAdminAuth();

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    await doLogin(email, pass);
    setBusy(false);
  };

  /* ── Loading saat cek session (auto-login) ── */
  if (authStatus === 'checking') {
    return (
      <div id="login-screen">
        {/* orbs tetap ada biar tidak flash putih */}
        <div className="login-corner login-corner-tl" />
        <div className="login-corner login-corner-tr" />
        <div className="login-corner login-corner-bl" />
        <div className="login-corner login-corner-br" />
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 16, position: 'relative', zIndex: 2,
        }}>
          <span style={{
            fontFamily: 'var(--font-cormorant, "Cormorant Garamond", serif)',
            fontSize: 42, fontWeight: 700, color: 'var(--text)',
            letterSpacing: -0.5,
          }}>
            Journal<em style={{ color: 'var(--gold2)', fontStyle: 'italic' }}>yze</em>
          </span>
          <div style={{
            width: 28, height: 28,
            border: '2px solid var(--border)',
            borderTopColor: 'var(--gold)',
            borderRadius: '50%',
            animation: 'spin .8s linear infinite',
          }} />
          <span style={{
            fontFamily: 'var(--font-jetbrains, "JetBrains Mono", monospace)',
            fontSize: 9, letterSpacing: 3, textTransform: 'uppercase',
            color: 'var(--text3)',
          }}>
            Memeriksa sesi...
          </span>
        </div>
      </div>
    );
  }

  /* ── Form login ── */
  return (
    <div id="login-screen">
      {/* Corner decorations */}
      <div className="login-corner login-corner-tl" />
      <div className="login-corner login-corner-tr" />
      <div className="login-corner login-corner-bl" />
      <div className="login-corner login-corner-br" />

      <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* Brand atas card */}
        <div className="login-brand-top">
          <div className="login-eyebrow">✦ Admin Suite</div>
          <span className="login-logo">
            Journal<em>yze</em>
          </span>
          <div style={{
            fontFamily: 'var(--font-jetbrains, "JetBrains Mono", monospace)',
            fontSize: 9, letterSpacing: 2, textTransform: 'uppercase',
            color: 'var(--text3)', marginTop: 6,
          }}>
            Restricted Access
          </div>
        </div>

        {/* Divider */}
        <div className="login-divider" style={{ width: '100%', marginBottom: 20 }}>
          <div className="login-divider-line" />
          <div className="login-divider-diamond">✦</div>
          <div className="login-divider-line r" />
        </div>

        {/* Card */}
        <div className="login-card" style={{ width: '100%' }}>

          {/* Badge */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <span className="login-badge">⚙️ Admin Panel</span>
          </div>

          {/* Email */}
          <label className="login-label">Email Admin</label>
          <input
            type="email"
            className="login-input"
            placeholder="admin@email.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />

          {/* Password */}
          <label className="login-label" style={{ marginTop: 4 }}>Password</label>
          <div className="pw-wrap" style={{ marginBottom: 20 }}>
            <input
              type={showPass ? 'text' : 'password'}
              className="login-input"
              placeholder="••••••••"
              autoComplete="current-password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
            <button
              type="button"
              className="pw-toggle"
              title={showPass ? 'Sembunyikan' : 'Lihat password'}
              onClick={() => setShowPass((v) => !v)}
            >
              <EyeIcon off={showPass} />
            </button>
          </div>

          {/* Error */}
          {loginError && (
            <div style={{
              background: 'var(--red-bg)', border: '1px solid var(--red-bd)',
              borderRadius: 8, padding: '9px 13px', marginBottom: 14,
              fontSize: 12, color: 'var(--red)', lineHeight: 1.5,
            }}>
              {loginError}
            </div>
          )}

          {/* Submit */}
          <button className="login-btn" disabled={busy} onClick={submit}>
            {busy ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                <span style={{
                  width: 14, height: 14,
                  border: '2px solid rgba(8,8,8,0.3)',
                  borderTopColor: '#080808',
                  borderRadius: '50%',
                  animation: 'spin .7s linear infinite',
                  display: 'inline-block',
                }} />
                Memverifikasi...
              </span>
            ) : (
              <>Masuk ke Admin Panel <span style={{ marginLeft: 6 }}>→</span></>
            )}
          </button>

          {/* Bottom note */}
          <div className="login-bottom-note" style={{ marginTop: 24 }}>
            Journalyze · Secure Admin Access
          </div>
        </div>
      </div>
    </div>
  );
}