// components/journal/PageProfile.tsx — REDESIGN TOTAL
// Luxury dark gold — identik design system journal
'use client';

import { useState, useEffect, useRef } from 'react';
import { useJournalStore } from '@/store/useJournalStore';
import { useJournalAuth } from '@/hooks/useJournalAuth';
import { useTradeStore } from '@/store/useTradeStore';
import { _sb } from '@/lib/supabaseClient';

interface ProfilePageProps {
  active: boolean;
  onOpenApiKey?: () => void;
  onOpenNotif?: () => void;
}

export default function PageProfile({ active, onOpenApiKey, onOpenNotif }: ProfilePageProps) {
  const currentUser    = useJournalStore((s) => s.currentUser);
  const displayName    = useJournalStore((s) => s.displayName);
  const setDisplayName = useJournalStore((s) => s.setDisplayName);
  const theme          = useJournalStore((s) => s.theme);
  const setTheme       = useJournalStore((s) => s.setTheme);
  const showToast      = useJournalStore((s) => s.showToast);
  const { doLogout }   = useJournalAuth();
  const trades         = useTradeStore((s) => s.trades);

  const [editName,      setEditName]      = useState('');
  const [nameLoading,   setNameLoading]   = useState(false);
  const [passNew,       setPassNew]       = useState('');
  const [passNew2,      setPassNew2]      = useState('');
  const [passLoading,   setPassLoading]   = useState(false);
  const [avatarUrl,     setAvatarUrl]     = useState<string | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [subscription,  setSubscription]  = useState<{ plan: string; activatedAt: string | null; licenseKey: string | null } | null>(null);
  const [apiKeyStatus,  setApiKeyStatus]  = useState<{ active: boolean; provider: string }>({ active: false, provider: '' });
  const [notifOn,       setNotifOn]       = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Statistik ──
  const totalTrades = trades.length;
  const wins        = trades.filter((t) => t.result === 'Profit').length;
  const losses      = trades.filter((t) => t.result === 'Loss').length;
  const be          = trades.filter((t) => t.result === 'BE' || t.result === 'Breakeven').length;
  const winRate     = totalTrades ? Math.round((wins / totalTrades) * 100) : 0;
  const totalPL     = trades.reduce((acc, t) => acc + (t.pl_idr || 0), 0);
  const pairMap: Record<string, number> = {};
  trades.forEach((t) => { if (t.pair) pairMap[t.pair] = (pairMap[t.pair] || 0) + 1; });
  const favPair = Object.entries(pairMap).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
  const rrTrades = trades.filter((t) => t.rr && t.rr > 0);
  const avgRR    = rrTrades.length ? rrTrades.reduce((a, t) => a + (t.rr || 0), 0) / rrTrades.length : 0;

  useEffect(() => {
    if (!active || !currentUser) return;
    setEditName(displayName);
    const gKey = localStorage.getItem('jz_gemini_key') || '';
    const cKey = localStorage.getItem('jz_anthropic_key') || '';
    const prov = localStorage.getItem('jz_ai_provider') || 'gemini';
    const hasKey = !!(gKey || cKey);
    const activeProv = gKey && prov === 'gemini' ? 'Gemini' : cKey ? 'Claude' : '';
    setApiKeyStatus({ active: hasKey, provider: activeProv });
    setNotifOn(typeof Notification !== 'undefined' && Notification.permission === 'granted');
    _sb.from('profiles')
      .select('avatar_url, is_activated, activated_at, license_key')
      .eq('id', currentUser.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.avatar_url) setAvatarUrl(data.avatar_url);
        setSubscription({
          plan: data?.is_activated ? 'Pro' : 'Free',
          activatedAt: data?.activated_at || null,
          licenseKey: data?.license_key || null,
        });
      });
  }, [active, currentUser, displayName]);

  const handleSaveName = async () => {
    if (!currentUser || !editName.trim()) return;
    setNameLoading(true);
    const { error } = await _sb.from('profiles').update({ display_name: editName.trim() }).eq('id', currentUser.id);
    setNameLoading(false);
    if (error) { showToast('❌ Gagal menyimpan nama', 'error'); return; }
    setDisplayName(editName.trim());
    showToast('✅ Nama berhasil diperbarui', 'success');
  };

  const handleChangePassword = async () => {
    if (!passNew || !passNew2)  { showToast('❌ Isi semua field password', 'error'); return; }
    if (passNew !== passNew2)   { showToast('❌ Password baru tidak cocok', 'error'); return; }
    if (passNew.length < 6)     { showToast('❌ Password minimal 6 karakter', 'error'); return; }
    setPassLoading(true);
    const { error } = await _sb.auth.updateUser({ password: passNew });
    setPassLoading(false);
    if (error) { showToast('❌ ' + error.message, 'error'); return; }
    showToast('✅ Password berhasil diubah', 'success');
    setPassNew(''); setPassNew2('');
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    if (file.size > 2 * 1024 * 1024) { showToast('❌ Ukuran foto max 2MB', 'error'); return; }
    setAvatarLoading(true);
    const ext  = file.name.split('.').pop();
    const path = `avatars/${currentUser.id}.${ext}`;
    const { error: upErr } = await _sb.storage.from('avatars').upload(path, file, { upsert: true });
    if (upErr) { showToast('❌ Gagal upload foto', 'error'); setAvatarLoading(false); return; }
    const { data: pub } = _sb.storage.from('avatars').getPublicUrl(path);
    const url = pub.publicUrl + '?t=' + Date.now();
    await _sb.from('profiles').update({ avatar_url: url }).eq('id', currentUser.id);
    setAvatarUrl(url);
    setAvatarLoading(false);
    showToast('✅ Foto profil diperbarui', 'success');
  };

  const email      = currentUser?.email || '';
  const nameLabel  = displayName || email.split('@')[0];
  const avatarChar = (nameLabel[0] || '?').toUpperCase();
  const formatIDR  = (n: number) => {
    const abs = 'Rp ' + Math.abs(Math.round(n)).toLocaleString('id-ID');
    return n >= 0 ? '+' + abs : '−' + abs;
  };

  if (!active) return null;

  return (
    <div className="page active" id="page-profile">

      {/* ══ PAGE HEADER ══ */}
      <div className="ph ai-anim">
        <div>
          <div className="ph-label">⬡ Modul 08 — Akun &amp; Pengaturan</div>
          <h1 className="ph-title">Profil <em>Saya</em></h1>
          <p className="ph-sub">Kelola akun, lihat statistik trading, dan atur preferensi aplikasi kamu.</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => useJournalStore.setState({ activePage: 'home' })}>
          ← Kembali ke Jurnal
        </button>
      </div>

      {/* ══ HERO CARD ══ */}
      <div className="box ai-anim d1 pp-hero-card">

        {/* Top: avatar + info */}
        <div className="pp-hero-top">
          {/* Avatar */}
          <div className="pp-avatar-wrap">
            <div
              className="pp-avatar"
              onClick={() => fileRef.current?.click()}
              title="Klik untuk ganti foto"
            >
              {avatarUrl
                ? <img src={avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                : <span style={{ fontSize: 36, fontWeight: 700, color: '#080808', fontFamily: "'Cormorant Garamond',serif" }}>{avatarChar}</span>
              }
            </div>
            <button className="pp-avatar-cam" onClick={() => fileRef.current?.click()} title="Ganti foto">
              {avatarLoading ? '⏳' : '📷'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
          </div>

          {/* Info */}
          <div className="pp-hero-info">
            <div className="pp-name">{nameLabel}</div>
            <div className="pp-email">{email}</div>
            <div className="pp-badges">
              {subscription && (
                <span className={`rbadge ${subscription.plan === 'Pro' ? 'mod' : 'agg'}`} style={{ fontSize: 8 }}>
                  {subscription.plan === 'Pro' ? '⭐' : '🔒'} Journalyze {subscription.plan}
                </span>
              )}
              <span className={`rbadge ${apiKeyStatus.active ? 'cons' : 'agg'}`} style={{ fontSize: 8 }}>
                <span style={{
                  width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                  background: apiKeyStatus.active ? 'var(--green)' : 'var(--red)',
                  boxShadow: apiKeyStatus.active ? '0 0 5px var(--green)' : 'none',
                  display: 'inline-block',
                }}/>
                {apiKeyStatus.active ? `AI · ${apiKeyStatus.provider}` : 'AI Belum Aktif'}
              </span>
              {notifOn && (
                <span className="rbadge cons" style={{ fontSize: 8 }}>🔔 Notif Aktif</span>
              )}
            </div>
          </div>
        </div>

        {/* Quick stats strip */}
        <div className="pp-stats-strip">
          {[
            { label: 'Total Trade', value: totalTrades.toString(),  color: 'var(--text)' },
            { label: 'Win Rate',    value: winRate + '%',           color: winRate >= 50 ? 'var(--green)' : 'var(--red)' },
            { label: 'Pair Favorit',value: favPair,                 color: 'var(--gold2)' },
            { label: 'Avg R:R',     value: rrTrades.length ? avgRR.toFixed(2) + 'R' : '—', color: 'var(--text)' },
          ].map((s, i) => (
            <div key={i} className="pp-stat-item" style={{ borderRight: i < 3 ? '1px solid var(--border2)' : 'none' }}>
              <div className="pp-stat-lbl">{s.label}</div>
              <div className="pp-stat-val" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ══ GRID: STATISTIK + PENGATURAN ══ */}
      <div className="g2 ai-anim d2" style={{ marginBottom: 16, alignItems: 'start' }}>

        {/* ── Statistik Trading ── */}
        <div className="box">
          <div className="box-head">
            <span className="box-title">📊 Statistik Trading</span>
            <span className="chip chip-gold">{totalTrades} Trade</span>
          </div>
          <table className="rtable" style={{ width: '100%' }}>
            <tbody>
              {[
                { label: 'Total Trade', value: totalTrades.toString(),       cls: '' },
                { label: 'Profit',      value: wins.toString(),              cls: 'green' },
                { label: 'Loss',        value: losses.toString(),            cls: 'red' },
                { label: 'Breakeven',   value: be.toString(),                cls: '' },
                { label: 'Win Rate',    value: winRate + '%',                cls: winRate >= 50 ? 'green' : 'red' },
                { label: 'Total P/L',   value: totalTrades ? formatIDR(totalPL) : '—', cls: totalPL >= 0 ? 'green' : 'red' },
                { label: 'Pair Favorit',value: favPair,                      cls: 'blue' },
                { label: 'Avg R:R',     value: rrTrades.length ? avgRR.toFixed(2) + 'R' : '—', cls: '' },
              ].map((row, i) => (
                <tr key={i}>
                  <td className="lbl">{row.label}</td>
                  <td className={`val${row.cls ? ' ' + row.cls : ''}`}>{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Kanan: Nama + Password ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Nama Tampilan */}
          <div className="box">
            <div className="box-head">
              <span className="box-title">👤 Nama Tampilan</span>
            </div>
            <div className="box-body">
              <div className="frow f1" style={{ marginBottom: 0 }}>
                <div className="fg">
                  <label className="flabel">Nama Publik</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      className="finput"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Nama kamu..."
                      maxLength={40}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                    />
                    <button
                      className="btn btn-gold btn-sm"
                      onClick={handleSaveName}
                      disabled={nameLoading}
                      style={{ flexShrink: 0 }}
                    >
                      {nameLoading ? '⏳' : '✓ Simpan'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Ganti Password */}
          <div className="box">
            <div className="box-head">
              <span className="box-title">🔑 Ganti Password</span>
            </div>
            <div className="box-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="fg">
                <label className="flabel">Password Baru</label>
                <input
                  className="finput"
                  type="password"
                  placeholder="Min. 6 karakter"
                  value={passNew}
                  onChange={(e) => setPassNew(e.target.value)}
                />
              </div>
              <div className="fg">
                <label className="flabel">Ulangi Password</label>
                <input
                  className="finput"
                  type="password"
                  placeholder="Ulangi password baru"
                  value={passNew2}
                  onChange={(e) => setPassNew2(e.target.value)}
                />
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleChangePassword}
                disabled={passLoading}
                style={{ alignSelf: 'flex-end', marginTop: 4 }}
              >
                {passLoading ? '⏳ Menyimpan...' : '🔑 Ubah Password'}
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* ══ PREFERENSI ══ */}
      <div className="box ai-anim d3" style={{ marginBottom: 16 }}>
        <div className="box-head">
          <span className="box-title">⚙️ Preferensi Aplikasi</span>
        </div>
        <div className="box-body" style={{ padding: 0 }}>

          {/* Tema */}
          <div className="pp-pref-row" style={{ borderBottom: '1px solid var(--border2)' }}>
            <div>
              <div className="pp-pref-title">🎨 Tema Tampilan</div>
              <div className="pp-pref-sub">Mode gelap atau terang</div>
            </div>
            <div className="theme-pill" style={{ flexShrink: 0 }}>
              <button className={`topt ${theme === 'dark'  ? 'active' : ''}`} onClick={() => setTheme('dark')}>🌙 Dark</button>
              <button className={`topt ${theme === 'light' ? 'active' : ''}`} onClick={() => setTheme('light')}>☀️ Light</button>
            </div>
          </div>

          {/* Notif */}
          <div className="pp-pref-row" style={{ borderBottom: '1px solid var(--border2)' }}>
            <div>
              <div className="pp-pref-title">🔔 Notifikasi &amp; Pengingat</div>
              <div className="pp-pref-sub" style={{ color: notifOn ? 'var(--green)' : 'var(--text3)' }}>
                {notifOn ? '✅ Aktif — izin diberikan' : 'Belum diaktifkan'}
              </div>
            </div>
            <button
              className={`btn btn-sm ${notifOn ? 'btn-ghost' : 'btn-ghost'}`}
              style={notifOn ? { borderColor: 'var(--green-bd)', color: 'var(--green)' } : {}}
              onClick={onOpenNotif}
            >
              {notifOn ? '🔔 Kelola' : '🔕 Aktifkan'}
            </button>
          </div>

          {/* API Key */}
          <div className="pp-pref-row">
            <div>
              <div className="pp-pref-title">🤖 API Key AI Analisis</div>
              <div className="pp-pref-sub" style={{ color: apiKeyStatus.active ? 'var(--green)' : 'var(--text3)' }}>
                {apiKeyStatus.active
                  ? `✅ Terhubung — ${apiKeyStatus.provider}`
                  : 'Belum terhubung — analisis foto belum aktif'}
              </div>
            </div>
            <button
              className={`btn btn-sm ${apiKeyStatus.active ? 'btn-ghost' : 'btn-gold'}`}
              style={apiKeyStatus.active ? { borderColor: 'var(--green-bd)', color: 'var(--green)' } : {}}
              onClick={onOpenApiKey}
            >
              {apiKeyStatus.active ? '🔑 Kelola Key' : '🔗 Hubungkan'}
            </button>
          </div>

        </div>
      </div>

      {/* ══ PAKET BERLANGGANAN ══ */}
      {subscription && (
        <div className="box ai-anim d4" style={{ marginBottom: 16 }}>
          <div className="box-head">
            <span className="box-title">⭐ Paket Berlangganan</span>
            <span className={`chip ${subscription.plan === 'Pro' ? 'chip-gold' : 'chip-blue'}`}>
              {subscription.plan}
            </span>
          </div>
          <div className="box-body">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div style={{
                  fontFamily: "'Cormorant Garamond',serif",
                  fontSize: 24, fontWeight: 700, lineHeight: 1.1,
                  color: subscription.plan === 'Pro' ? 'var(--gold2)' : 'var(--text2)',
                  marginBottom: 6,
                }}>
                  Journalyze <em style={{ fontStyle: 'italic' }}>{subscription.plan}</em>
                </div>
                {subscription.licenseKey && (
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: 'var(--text4)', letterSpacing: 1, marginBottom: 4 }}>
                    License · {subscription.licenseKey}
                  </div>
                )}
                {subscription.activatedAt && (
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                    Aktif sejak {new Date(subscription.activatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                )}
              </div>
              {subscription.plan !== 'Pro' && (
                <a href="https://journalyze.my.id" target="_blank" rel="noopener noreferrer" className="btn btn-gold" style={{ textDecoration: 'none' }}>
                  ⬆️ Upgrade ke Pro
                </a>
              )}
            </div>

            {/* Feature list kalau Pro */}
            {subscription.plan === 'Pro' && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {['✅ Akses Lifetime','✅ Semua Fitur','✅ 2 E-Book Premium','✅ Komunitas Trader','✅ Support WA'].map(f => (
                  <span key={f} className="chip chip-gold" style={{ fontSize: 9 }}>{f}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ DANGER ZONE ══ */}
      <div className="box ai-anim" style={{ marginBottom: 32, borderColor: 'var(--red-bd)' }}>
        <div className="box-head" style={{ background: 'var(--red-bg)', borderColor: 'var(--red-bd)' }}>
          <span className="box-title" style={{ color: 'var(--red)' }}>⚠️ Danger Zone</span>
        </div>
        <div className="box-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>Hapus Akun Permanen</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>Semua data trading akan dihapus. Tindakan ini tidak bisa dibatalkan.</div>
            </div>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => {
                const konfirm = prompt('Ketik "HAPUS" untuk konfirmasi:');
                if (konfirm !== 'HAPUS') { showToast('Penghapusan dibatalkan', 'error'); return; }
                window.open('mailto:support@journalyze.my.id?subject=Hapus%20Akun&body=Email%3A%20' + encodeURIComponent(email), '_blank');
              }}
            >
              🗑 Hapus Akun
            </button>
          </div>
          <div style={{ borderTop: '1px solid var(--red-bd)', paddingTop: 12 }}>
            <button
              className="btn btn-ghost"
              onClick={() => { useJournalStore.getState().closeUserMenu(); doLogout(); }}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              🚪 Keluar dari Akun
            </button>
          </div>
        </div>
      </div>

      {/* ══ STYLES ══ */}
      <style>{`
        /* Hero card */
        .pp-hero-card { margin-bottom: 16px; overflow: hidden; }

        .pp-hero-top {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 24px 24px 20px;
          background: linear-gradient(135deg, var(--gold-bg) 0%, transparent 70%);
          border-bottom: 1px solid var(--gold-bd);
          flex-wrap: wrap;
        }

        /* Avatar */
        .pp-avatar-wrap { position: relative; flex-shrink: 0; }
        .pp-avatar {
          width: 88px; height: 88px; border-radius: 50%;
          background: linear-gradient(135deg, var(--gold) 0%, var(--gold3) 100%);
          border: 2px solid var(--gold-bd2);
          box-shadow: 0 0 0 4px var(--gold-bg), 0 8px 24px rgba(0,0,0,.4);
          display: flex; align-items: center; justify-content: center;
          overflow: hidden; cursor: pointer;
          transition: transform .2s, box-shadow .2s;
        }
        .pp-avatar:hover { transform: scale(1.04); box-shadow: 0 0 0 5px var(--gold-bg), 0 12px 32px rgba(0,0,0,.5); }
        .pp-avatar-cam {
          position: absolute; bottom: 2px; right: 2px;
          width: 26px; height: 26px; border-radius: 50%;
          background: var(--bg3); border: 2px solid var(--gold-bd2);
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; cursor: pointer;
          transition: background .15s;
        }
        .pp-avatar-cam:hover { background: var(--bg4); }

        /* Info */
        .pp-hero-info { flex: 1; min-width: 0; }
        .pp-name {
          font-family: 'Cormorant Garamond', serif;
          font-size: 28px; font-weight: 700; line-height: 1.1;
          color: var(--text); margin-bottom: 5px;
        }
        .pp-email {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px; color: var(--text3); letter-spacing: .3px;
          margin-bottom: 12px;
        }
        .pp-badges { display: flex; gap: 7px; flex-wrap: wrap; align-items: center; }

        /* Stats strip */
        .pp-stats-strip {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          border-top: 1px solid var(--border2);
        }
        .pp-stat-item {
          padding: 14px 16px; text-align: center;
        }
        .pp-stat-lbl {
          font-family: 'JetBrains Mono', monospace;
          font-size: 7.5px; letter-spacing: 1.5px;
          text-transform: uppercase; color: var(--text4);
          margin-bottom: 5px;
        }
        .pp-stat-val {
          font-family: 'Cormorant Garamond', serif;
          font-size: 22px; font-weight: 700; line-height: 1;
        }

        /* Preferensi rows */
        .pp-pref-row {
          display: flex; align-items: center;
          justify-content: space-between;
          gap: 12; padding: 14px 18px;
        }
        .pp-pref-title { font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 2px; }
        .pp-pref-sub   { font-size: 11px; color: var(--text3); }

        /* Responsive */
        @media (max-width: 600px) {
          .pp-stats-strip { grid-template-columns: repeat(2, 1fr); }
          .pp-stat-item:nth-child(2) { border-right: none; }
          .pp-stat-item:nth-child(1),
          .pp-stat-item:nth-child(2) { border-bottom: 1px solid var(--border2); }
          .pp-name { font-size: 22px; }
          .pp-pref-row { flex-direction: column; align-items: flex-start; gap: 10px; }
        }
        @media (max-width: 480px) {
          .pp-hero-top { padding: 18px 16px 16px; }
          .pp-avatar { width: 72px; height: 72px; }
        }
      `}</style>

    </div>
  );
}