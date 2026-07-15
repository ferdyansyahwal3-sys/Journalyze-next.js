// components/admin/LoginScreen.tsx
// Dipindah dari admin.html baris 170-189 + togglePw() baris 420-433
'use client';

import { useState } from 'react';
import { useAdminStore } from '@/store/useAdminStore';
import { useAdminAuth } from '@/hooks/useAdminAuth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const loginError = useAdminStore((s) => s.loginError);
  const { doLogin } = useAdminAuth();

  const submit = async () => {
    setBusy(true);
    await doLogin(email, pass);
    setBusy(false);
  };

  return (
    <div id="login-screen">
      <div className="login-card">
        <div className="login-logo">
          Journal<em>yze</em>
        </div>
        <div className="login-badge">⚙️ Admin Panel</div>
        <div style={{ textAlign: 'left' }}>
          <p className="login-label">Email Admin</p>
          <input
            type="email"
            className="login-input"
            placeholder="admin@email.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          <p className="login-label">Password</p>
          <div className="pw-wrap">
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
              title="Lihat password"
              onClick={() => setShowPass((v) => !v)}
            >
              {showPass ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              )}
            </button>
          </div>
        </div>
        <button className="login-btn" disabled={busy} onClick={submit}>
          {busy ? 'Memeriksa...' : 'Masuk ke Admin Panel →'}
        </button>
        {loginError && (
          <p className="login-err" style={{ display: 'block', color: 'var(--red)', fontSize: 12, marginTop: 12 }}>
            {loginError}
          </p>
        )}
      </div>
    </div>
  );
}
