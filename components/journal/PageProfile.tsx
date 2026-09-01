// components/journal/PageProfile.tsx
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

  // ── Baca API key & notif status langsung dari localStorage & browser ──
  // Tidak pakai useApiKey() hook karena dia punya state sendiri yang mungkin stale
  const [apiKeyStatus, setApiKeyStatus] = useState<{ active: boolean; provider: string }>({ active: false, provider: '' });
  const [notifOn, setNotifOn] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Statistik ──
  const totalTrades = trades.length;
  const wins        = trades.filter((t) => t.result === 'Profit').length;
  const losses      = trades.filter((t) => t.result === 'Loss').length;
  const be          = trades.filter((t) => t.result === 'BE' || t.result === 'Breakeven').length;
  const winRate     = totalTrades ? Math.round((wins / totalTrades) * 100) : 0;
  const totalPL     = trades.reduce((acc, t) => acc + (t.pl_idr || 0), 0);
  const pairs: Record<string, number> = {};
  trades.forEach((t) => { if (t.pair) pairs[t.pair] = (pairs[t.pair] || 0) + 1; });
  const favPair     = Object.entries(pairs).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
  const rrTrades    = trades.filter((t) => t.rr && t.rr > 0);
  const avgRR       = rrTrades.length ? (rrTrades.reduce((a, t) => a + (t.rr || 0), 0) / rrTrades.length) : 0;

  // ── Hydrate saat page aktif ──
  useEffect(() => {
    if (!active || !currentUser) return;
    setEditName(displayName);

    // Baca localStorage langsung — paling akurat
    const gKey = localStorage.getItem('jz_gemini_key') || '';
    const cKey = localStorage.getItem('jz_anthropic_key') || '';
    const prov = localStorage.getItem('jz_ai_provider') || 'gemini';
    const hasKey = !!(gKey || cKey);
    const activeProv = gKey && prov === 'gemini' ? '🔵 Gemini' : cKey ? '🟡 Claude' : '';
    setApiKeyStatus({ active: hasKey, provider: activeProv });

    // Baca notif
    setNotifOn(typeof Notification !== 'undefined' && Notification.permission === 'granted');

    // Ambil data dari Supabase
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

  // ── Ganti nama ──
  const handleSaveName = async () => {
    if (!currentUser || !editName.trim()) return;
    setNameLoading(true);
    const { error } = await _sb.from('profiles').update({ display_name: editName.trim() }).eq('id', currentUser.id);
    setNameLoading(false);
    if (error) { showToast('❌ Gagal menyimpan nama', 'error'); return; }
    setDisplayName(editName.trim());
    showToast('✅ Nama berhasil diperbarui', 'success');
  };

  // ── Ganti password ──
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

  // ── Upload foto ──
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

  const formatIDR = (n: number) => {
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
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => useJournalStore.setState({ activePage: 'home' })}
        >
          ← Kembali ke Jurnal
        </button>
      </div>

      {/* ══ HERO CARD — Avatar + Info ══ */}
      <div className="box ai-anim d1" style={{ marginBottom: 16 }}>
        <div style={{
          background: 'linear-gradient(135deg, var(--gold-bg) 0%, transparent 60%)',
          borderBottom: '1px solid var(--gold-bd)',
          padding: '24px 24px 20px',
          display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
        }}>
          {/* Avatar */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div
              onClick={() => fileRef.current?.click()}
              title="Klik untuk ganti foto"
              style={{
                width: 80, height: 80, borderRadius: '50%', cursor: 'pointer',
                background: avatarUrl ? 'transparent' : 'linear-gradient(135deg, var(--gold) 0%, var(--gold3) 100%)',
                border: '2px solid var(--gold-bd2)',
                boxShadow: '0 0 0 4px var(--gold-bg), 0 8px 24px rgba(0,0,0,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 32, fontWeight: 700, color: '#080808',
                overflow: 'hidden', transition: 'transform .2s',
              }}
            >
              {avatarUrl
                ? <img src={avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : avatarChar}
            </div>
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                position: 'absolute', bottom: 2, right: 2,
                width: 24, height: 24, borderRadius: '50%',
                background: 'var(--bg3)', border: '2px solid var(--gold-bd2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, cursor: 'pointer',
              }}
            >
              {avatarLoading ? '⏳' : '📷'}
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 26, fontWeight: 700, lineHeight: 1.1,
              color: 'var(--text)', marginBottom: 4,
            }}>
              {nameLabel}
            </div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11, color: 'var(--text3)', letterSpacing: '.3px', marginBottom: 10,
            }}>
              {email}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {subscription && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '3px 10px', borderRadius: 99,
                  background: subscription.plan === 'Pro' ? 'var(--gold-bg)' : 'var(--bg4)',
                  border: `1px solid ${subscription.plan === 'Pro' ? 'var(--gold-bd2)' : 'var(--border)'}`,
                  fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' as const,
                  color: subscription.plan === 'Pro' ? 'var(--gold2)' : 'var(--text3)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {subscription.plan === 'Pro' ? '⭐' : '🔒'} Journalyze {subscription.plan}
                </span>
              )}
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 10px', borderRadius: 99,
                background: apiKeyStatus.active ? 'var(--green-bg)' : 'var(--bg4)',
                border: `1px solid ${apiKeyStatus.active ? 'var(--green-bd)' : 'var(--border)'}`,
                fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' as const,
                color: apiKeyStatus.active ? 'var(--green)' : 'var(--text3)',
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: apiKeyStatus.active ? 'var(--green)' : 'var(--text4)',
                  boxShadow: apiKeyStatus.active ? '0 0 4px var(--green)' : 'none',
                  flexShrink: 0,
                }}/>
                {apiKeyStatus.active ? 'AI ' + apiKeyStatus.provider : 'AI Belum Aktif'}
              </span>
            </div>
          </div>
        </div>

        {/* Quick stats strip */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          borderTop: '1px solid var(--border2)',
        }}>
          {[
            { label: 'Total Trade', value: totalTrades.toString(), color: 'var(--text)' },
            { label: 'Win Rate', value: winRate + '%', color: winRate >= 50 ? 'var(--green)' : 'var(--red)' },
            { label: 'Pair Favorit', value: favPair, color: 'var(--gold2)' },
            { label: 'Avg R:R', value: rrTrades.length ? avgRR.toFixed(2) : '—', color: 'var(--text)' },
          ].map((s, i) => (
            <div key={i} style={{
              padding: '14px 16px', textAlign: 'center',
              borderRight: i < 3 ? '1px solid var(--border2)' : 'none',
            }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase' as const, color: 'var(--text4)', marginBottom: 4 }}>
                {s.label}
              </div>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 700, color: s.color }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ══ GRID 2 KOLOM ══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* ── Statistik Detail ── */}
        <div className="box ai-anim d2">
          <div className="box-head">
            <span className="box-title">📊 Statistik Trading</span>
          </div>
          <div className="box-body" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { label: 'Total Trade', value: totalTrades.toString(), color: 'var(--text)' },
              { label: 'Profit', value: wins.toString(), color: 'var(--green)' },
              { label: 'Loss', value: losses.toString(), color: 'var(--red)' },
              { label: 'Breakeven', value: be.toString(), color: 'var(--gold2)' },
              { label: 'Win Rate', value: winRate + '%', color: winRate >= 50 ? 'var(--green)' : 'var(--red)' },
              { label: 'Total P/L', value: totalTrades ? formatIDR(totalPL) : '—', color: totalPL >= 0 ? 'var(--green)' : 'var(--red)' },
              { label: 'Pair Favorit', value: favPair, color: 'var(--gold2)' },
              { label: 'Avg R:R', value: rrTrades.length ? avgRR.toFixed(2) + 'R' : '—', color: 'var(--text)' },
            ].map((row, i, arr) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 0',
                borderBottom: i < arr.length - 1 ? '1px solid var(--border2)' : 'none',
              }}>
                <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: "'JetBrains Mono',monospace", fontSize: 10 as any }}>
                  {row.label}
                </span>
                <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 16, fontWeight: 700, color: row.color }}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Pengaturan Akun ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Nama */}
          <div className="box ai-anim d2">
            <div className="box-head">
              <span className="box-title">👤 Nama Tampilan</span>
            </div>
            <div className="box-body">
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="akm-input"
                  style={{ flex: 1 }}
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

          {/* Password */}
          <div className="box ai-anim d3">
            <div className="box-head">
              <span className="box-title">🔑 Ganti Password</span>
            </div>
            <div className="box-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                className="akm-input"
                type="password"
                placeholder="Password baru (min. 6 karakter)"
                value={passNew}
                onChange={(e) => setPassNew(e.target.value)}
              />
              <input
                className="akm-input"
                type="password"
                placeholder="Ulangi password baru"
                value={passNew2}
                onChange={(e) => setPassNew2(e.target.value)}
              />
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleChangePassword}
                disabled={passLoading}
                style={{ alignSelf: 'flex-end' }}
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
        <div className="box-body" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

          {/* Tema */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border2)' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>🎨 Tema Tampilan</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>Mode gelap atau terang</div>
            </div>
            <div className="theme-pill" style={{ flexShrink: 0 }}>
              <button className={`topt ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme('dark')}>🌙 Dark</button>
              <button className={`topt ${theme === 'light' ? 'active' : ''}`} onClick={() => setTheme('light')}>☀️ Light</button>
            </div>
          </div>

          {/* Notif */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border2)' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>🔔 Notifikasi &amp; Pengingat</div>
              <div style={{ fontSize: 11, color: notifOn ? 'var(--green)' : 'var(--text3)' }}>
                {notifOn ? '✅ Aktif — izin notifikasi diberikan' : 'Belum diaktifkan'}
              </div>
            </div>
            <button
              className={`btn-notif${notifOn ? ' notif-on' : ''}`}
              onClick={onOpenNotif}
              style={{ flexShrink: 0 }}
            >
              <span>{notifOn ? '🔔' : '🔕'}</span>
              <span>{notifOn ? 'Kelola' : 'Aktifkan'}</span>
            </button>
          </div>

          {/* API Key */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 0' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>🤖 API Key AI Analisis Foto</div>
              <div style={{ fontSize: 11, color: apiKeyStatus.active ? 'var(--green)' : 'var(--text3)' }}>
                {apiKeyStatus.active
                  ? `✅ Terhubung — provider ${apiKeyStatus.provider}`
                  : 'Belum terhubung — fitur analisis foto belum aktif'}
              </div>
            </div>
            <button
              className={`btn-apikey${apiKeyStatus.active ? ' key-active' : ' key-warn'}`}
              onClick={onOpenApiKey}
              style={{ flexShrink: 0 }}
            >
              <span className="key-dot"/>
              <span>{apiKeyStatus.active ? 'Kelola Key' : 'Hubungkan'}</span>
            </button>
          </div>

        </div>
      </div>

      {/* ══ SUBSCRIPTION ══ */}
      {subscription && (
        <div className="box ai-anim d4" style={{ marginBottom: 16 }}>
          <div className="box-head">
            <span className="box-title">⭐ Paket Berlangganan</span>
          </div>
          <div className="box-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, color: subscription.plan === 'Pro' ? 'var(--gold2)' : 'var(--text2)', marginBottom: 4 }}>
                Journalyze {subscription.plan}
              </div>
              {subscription.licenseKey && (
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: 'var(--text4)', letterSpacing: 1, marginBottom: 4 }}>
                  License: {subscription.licenseKey}
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
        </div>
      )}

      {/* ══ DANGER ZONE ══ */}
      <div className="box ai-anim" style={{ marginBottom: 32, border: '1px solid var(--red-bd)' }}>
        <div className="box-head" style={{ background: 'var(--red-bg)', borderBottom: '1px solid var(--red-bd)' }}>
          <span className="box-title" style={{ color: 'var(--red)' }}>⚠️ Danger Zone</span>
        </div>
        <div className="box-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>Hapus Akun Permanen</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>Semua data trading akan dihapus. Tidak bisa dibatalkan.</div>
            </div>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => {
                const konfirm = prompt('Ketik "HAPUS" untuk konfirmasi:');
                if (konfirm !== 'HAPUS') { showToast('Penghapusan dibatalkan', 'error'); return; }
                window.open('mailto:support@journalyze.my.id?subject=Hapus%20Akun&body=Email%3A%20' + encodeURIComponent(email), '_blank');
              }}
              style={{ flexShrink: 0 }}
            >
              🗑 Hapus Akun
            </button>
          </div>
          <div style={{ paddingTop: 12, borderTop: '1px solid var(--red-bd)' }}>
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

    </div>
  );
}