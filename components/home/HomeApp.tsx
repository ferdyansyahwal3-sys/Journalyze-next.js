'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { _sb, _sbAdmin } from '@/lib/supabaseClient';
import Script from 'next/script';

const WA_BASE = `https://wa.me/6281311973602`;
const WA_MSG_DEFAULT = encodeURIComponent('Halo, saya ingin info lebih lanjut tentang Journalyze 🙏');
const WA_MSG_BASIC   = encodeURIComponent('Halo, saya mau order paket Basic Journalyze (Rp 99.000) 🙏');
const WA_MSG_PRO     = encodeURIComponent('Halo, saya mau order paket Pro Journalyze (Rp 149.000) ⭐');
const WA_MSG_ELITE   = encodeURIComponent('Halo, saya mau order paket Elite Journalyze (Rp 249.000) 🔥');
const wa = (msg: string) => `${WA_BASE}?text=${msg}`;

const TOASTS = [
  { name: 'Budi S.',    action: 'membeli Paket Pro',              time: '2 menit lalu',  emoji: '📈' },
  { name: 'Rahmad F.',  action: 'membeli Paket Lifetime',         time: '7 menit lalu',  emoji: '💰' },
  { name: 'Dewi A.',    action: 'bergabung dengan Journalyze',    time: '12 menit lalu', emoji: '🏆' },
  { name: 'Andi P.',    action: 'membeli Paket Elite',            time: '18 menit lalu', emoji: '🎯' },
  { name: 'Siti R.',    action: 'membeli Paket Pro',              time: '25 menit lalu', emoji: '📊' },
];

const FEATURES = [
  { icon: '⚡', title: 'Kalkulator Risiko Real-Time',   desc: 'Hitung lot size, pip value, dan risiko per trade secara otomatis. Input balance, risk %, S/L → hasil instan.' },
  { icon: '📋', title: 'Trading Plan Terstruktur',       desc: 'Catat plan sebelum entry: pair, bias, entry level, target, alasan. Disiplin mulai dari perencanaan.' },
  { icon: '📊', title: 'Rekap Trade Lengkap',            desc: 'Log setiap trade dengan detail: tanggal, pair, RR, profit/loss. Semua tersimpan aman di cloud.' },
  { icon: '🔍', title: 'Filter & Analisis Mendalam',     desc: 'Filter trade per pair, per waktu, per sesi. Temukan pola: jam terbaik, pair paling profitable.' },
  { icon: '📅', title: 'Ringkasan Bulanan & Mingguan',   desc: 'Dashboard performa otomatis per bulan. Win rate, average RR, drawdown — semua terhitung.' },
  { icon: '📡', title: 'Share Journal Publik',            desc: 'Bagikan track record trading kamu ke siapapun tanpa login. Bangun kepercayaan dan portofolio profesional.' },
];

const TABS = [
  { id: 'risk',    label: '⚖️ Risiko'  },
  { id: 'plan',    label: '📅 Plan'    },
  { id: 'data',    label: '📋 Data'    },
  { id: 'filter',  label: '🔍 Filter'  },
  { id: 'monthly', label: '📊 Bulanan' },
];

const TESTIMONIALS = [
  { initial: 'B', name: 'Budi Santoso',    role: 'Trader Forex 3 tahun', stars: 5, text: 'Jujur ini yang paling lengkap yang pernah saya coba. Kalkulator risikonya akurat, dan fitur share journal-nya keren banget buat bukti track record ke klien.', time: '10:24' },
  { initial: 'R', name: 'Rahmad Fauzi',    role: 'Swing Trader',          stars: 5, text: 'Sebelum pakai Journalyze saya nggak sadar win rate saya cuma 40% tapi profit tetap karena RR bagus. Sekarang bisa lihat data detail tiap bulan.', time: '14:08' },
  { initial: 'D', name: 'Dewi Anggraeni',  role: 'Trader Pemula',         stars: 5, text: 'Sebagai pemula, fitur trading plan-nya sangat membantu biar saya nggak FOMO entry. E-book Candlestick bonusnya juga langsung bisa dipraktikkan.', time: '09:33' },
  { initial: 'A', name: 'Andi Pratama',    role: 'Full-time Trader',      stars: 5, text: 'Dashboard bulanannya bersih dan informatif. Saya bisa langsung tahu bulan mana yang jelek dan kenapa. Wajib punya buat yang serius di trading.', time: '16:45' },
  { initial: 'S', name: 'Siti Rahayu',     role: 'Price Action Trader',   stars: 5, text: 'Filter per pair-nya ini yang saya cari dari dulu. Sekarang saya tahu bahwa XAUUSD adalah pair paling profitable buat saya. Recommended banget!', time: '11:17' },
];

const FAQS = [
  { q: 'Apakah data trading saya aman?',                    a: 'Ya, semua data disimpan di Supabase dengan enkripsi enterprise-grade. Data Anda hanya bisa diakses dengan akun Anda sendiri. Kami tidak pernah menjual atau membagikan data pengguna ke pihak manapun.' },
  { q: 'Bisa diakses dari HP?',                             a: 'Journalyze adalah Progressive Web App (PWA) yang dioptimalkan penuh untuk mobile. Bisa diinstall langsung di homescreen Android maupun iOS layaknya app native, dan berjalan mulus di semua ukuran layar.' },
  { q: 'Apakah ada biaya tambahan setelah beli?',           a: 'Tidak ada sama sekali. Paket Pro dan Elite adalah akses lifetime — bayar sekali, pakai selamanya termasuk semua update dan fitur baru di masa depan. Paket Basic adalah akses 3 bulan.' },
  { q: 'Bagaimana cara mendapatkan akses setelah pembayaran?', a: 'Setelah transfer, kirim bukti pembayaran via WhatsApp ke 081311973602. Kami akan aktivasi akun dalam maksimal 1×24 jam (biasanya lebih cepat, 1–2 jam di jam kerja). Akses langsung dikirim ke email atau WA.' },
];

const CANDLES = [
  { c: 'green', w1: 10, b: 22, w2: 6  },
  { c: 'red',   w1: 6,  b: 30, w2: 12 },
  { c: 'green', w1: 14, b: 18, w2: 5  },
  { c: 'red',   w1: 8,  b: 25, w2: 9  },
  { c: 'green', w1: 5,  b: 35, w2: 8  },
  { c: 'red',   w1: 10, b: 20, w2: 7  },
];

const MOCK_TRADES = [
  { no: 1,  tgl: '21 Apr', sesi: 'London',   pair: 'XAUUSD', pos: 'Buy',  lot: '0.05', entry: '2320.00', close: '2333.80', win: true,  pips: '+138', pl: '+Rp 90.000',   saldo: 'Rp 5.380.000', metode: 'SNR'       },
  { no: 2,  tgl: '17 Apr', sesi: 'New York', pair: 'XAUUSD', pos: 'Buy',  lot: '0.05', entry: '2308.50', close: '2304.30', win: false, pips: '-42',  pl: '-Rp 27.300',   saldo: 'Rp 5.290.000', metode: 'SNR'       },
  { no: 3,  tgl: '15 Apr', sesi: 'London',   pair: 'XAUUSD', pos: 'Sell', lot: '0.07', entry: '2330.00', close: '2316.00', win: true,  pips: '+140', pl: '+Rp 127.400',  saldo: 'Rp 5.317.000', metode: 'Trendline' },
  { no: 4,  tgl: '14 Apr', sesi: 'Asia',     pair: 'XAUUSD', pos: 'Buy',  lot: '0.04', entry: '2318.20', close: '2320.10', win: true,  pips: '+19',  pl: '+Rp 12.380',   saldo: 'Rp 5.190.000', metode: 'Scalping'  },
  { no: 5,  tgl: '10 Apr', sesi: 'London',   pair: 'XAUUSD', pos: 'Buy',  lot: '0.05', entry: '2300.50', close: '2315.00', win: true,  pips: '+145', pl: '+Rp 94.250',   saldo: 'Rp 5.178.000', metode: 'SNR'       },
];

function useCountdown() {
  // null = belum mount (SSR), supaya server & client render sama dulu → no hydration error
  const [state, setState] = useState<{ h: string; m: string; s: string } | null>(null);
  useEffect(() => {
    const KEY = 'jz_home_cd';
    let target = parseInt(localStorage.getItem(KEY) || '0');
    if (!target || target <= Date.now()) {
      target = Date.now() + 24 * 60 * 60 * 1000;
      localStorage.setItem(KEY, String(target));
    }
    const tick = () => {
      const diff = Math.max(0, target - Date.now());
      setState({
        h: String(Math.floor(diff / 3600000)).padStart(2, '0'),
        m: String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0'),
        s: String(Math.floor((diff % 60000) / 1000)).padStart(2, '0'),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  // Sebelum mount: tampilkan placeholder statis agar SSR & client cocok
  return state ?? { h: '--', m: '--', s: '--' };
}

export default function HomeApp() {
  const cd = useCountdown();
  const [activeTab, setActiveTab]       = useState('risk');
  const [sliderIdx, setSliderIdx]       = useState(0);
  const [openFaq, setOpenFaq]           = useState<number | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastData, setToastData]       = useState(TOASTS[0]);
  const [pixelId, setPixelId]           = useState<string | null>(null);
  const [pixelEnabled, setPixelEnabled] = useState(false);
  const [navScrolled, setNavScrolled]   = useState(false);
  const [user, setUser]                 = useState<{ email: string; name: string; initial: string } | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  const maxIdx = TESTIMONIALS.length - 3;

  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.reveal,.reveal-left,.reveal-right');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { (e.target as HTMLElement).classList.add('visible'); io.unobserve(e.target); } });
    }, { threshold: 0.1 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const h = () => setNavScrolled(window.scrollY > 40);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  useEffect(() => {
    let idx = 0;
    const show = () => {
      setToastData(TOASTS[idx % TOASTS.length]);
      setToastVisible(true); idx++;
      setTimeout(() => setToastVisible(false), 5000);
    };
    const id  = setInterval(show, 40000);
    const fid = setTimeout(show, 8000);
    return () => { clearInterval(id); clearTimeout(fid); };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await _sbAdmin.from('settings').select('key,value').in('key', ['pixel_id', 'pixel_enabled']);
        if (!data) return;
        const pid = data.find((r: {key:string}) => r.key === 'pixel_id')?.value || '';
        const pen = data.find((r: {key:string}) => r.key === 'pixel_enabled')?.value === 'true';
        if (pid) setPixelId(pid);
        setPixelEnabled(pen);
      } catch { /**/ }
    })();
  }, []);

  useEffect(() => {
    // Cek session saat ini
    _sb.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      if (!u) return;
      const email = u.email ?? '';
      const name  = u.user_metadata?.full_name || u.user_metadata?.name || email.split('@')[0] || 'Trader';
      const initial = name.charAt(0).toUpperCase();
      setUser({ email, name, initial });
    });
    // Listen perubahan auth (login/logout di tab lain)
    const { data: { subscription } } = _sb.auth.onAuthStateChange((_event, session) => {
      const u = session?.user;
      if (!u) { setUser(null); return; }
      const email = u.email ?? '';
      const name  = u.user_metadata?.full_name || u.user_metadata?.name || email.split('@')[0] || 'Trader';
      const initial = name.charAt(0).toUpperCase();
      setUser({ email, name, initial });
    });
    return () => subscription.unsubscribe();
  }, []);

  const slideTo = useCallback((i: number) => {
    const c = Math.max(0, Math.min(i, maxIdx));
    setSliderIdx(c);
    if (sliderRef.current) sliderRef.current.style.transform = `translateX(-${c * 320}px)`;
  }, [maxIdx]);

  const bars = [20,45,30,65,50,80,35,90,60,75,40,55,70,85,45,60,30,72,88,50];

  // Kalau sudah login → langsung ke /journal, belum login → ke /order
  const ctaOrder = (paket: string) => user ? '/journal' : `/order?paket=${paket}`;

  const jmStyles: Record<string, React.CSSProperties> = {
    app: { background: '#080808', borderRadius: '0 0 12px 12px', overflow: 'hidden', position: 'relative' },
    topbar: { background: '#0E0E0E', borderBottom: '1px solid rgba(201,168,76,0.12)', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 48, flexShrink: 0, gap: 8 },
    brand: { fontFamily: "'Cormorant Garamond',serif", fontSize: 16, fontWeight: 700, color: '#E8C567' },
    ptabs: { display: 'flex', gap: 2, overflow: 'hidden', flex: 1, justifyContent: 'center' },
    ptab: { fontFamily: "'JetBrains Mono',monospace", fontSize: 8, letterSpacing: 1, textTransform: 'uppercase' as const, padding: '4px 10px', borderRadius: 5, border: '1px solid transparent', background: 'transparent', color: '#6A6050', cursor: 'default', whiteSpace: 'nowrap' as const },
    ptabActive: { background: 'rgba(201,168,76,0.06)', borderColor: 'rgba(201,168,76,0.16)', color: '#E8C567' },
    main: { padding: '16px 16px 60px', maxWidth: 900, margin: '0 auto' },
    ph: { marginBottom: 16, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', borderBottom: '1px solid rgba(201,168,76,0.12)', paddingBottom: 12, gap: 8, flexWrap: 'wrap' as const },
    phLabel: { fontFamily: "'JetBrains Mono',monospace", fontSize: 8, letterSpacing: 3, textTransform: 'uppercase' as const, color: '#C9A84C', marginBottom: 4 },
    phTitle: { fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, color: '#F8F4EC', lineHeight: 1.1 },
    phSub: { fontSize: 11, color: '#6A6050', marginTop: 3 },
    btnGold: { background: 'linear-gradient(135deg,#C9A84C,#E8C567)', color: '#000', fontWeight: 700, fontSize: 11, padding: '7px 14px', border: 'none', borderRadius: 6, cursor: 'default', whiteSpace: 'nowrap' as const, fontFamily: "'Outfit',sans-serif" },
    statRow: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 12 },
    scard: { background: '#0E0E0E', border: '1px solid rgba(201,168,76,0.12)', borderRadius: 8, padding: '10px 12px' },
    scardLbl: { fontFamily: "'JetBrains Mono',monospace", fontSize: 7, letterSpacing: 1.5, textTransform: 'uppercase' as const, color: '#6A6050', marginBottom: 4 },
    scardVal: { fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: '#F8F4EC' },
    box: { background: '#0E0E0E', border: '1px solid rgba(201,168,76,0.12)', borderRadius: 10, overflow: 'hidden', marginBottom: 10 },
    boxHead: { background: 'rgba(201,168,76,0.06)', borderBottom: '1px solid rgba(201,168,76,0.16)', padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    boxTitle: { fontFamily: "'JetBrains Mono',monospace", fontSize: 8, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' as const, color: '#E8C567' },
    g12: { display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 12, alignItems: 'start' },
    frow: { marginBottom: 10 },
    flabel: { display: 'block', fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: '#6A6050', marginBottom: 4 },
    fwrap: { display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 6, overflow: 'hidden' },
    fpre: { padding: '0 8px', fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: '#6A6050', background: 'rgba(255,255,255,0.02)', borderRight: '1px solid rgba(255,255,255,0.05)', height: 34, display: 'flex', alignItems: 'center' },
    finput: { flex: 1, padding: '7px 10px', fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#F8F4EC', background: 'transparent', minHeight: 34, display: 'flex', alignItems: 'center' },
    fselect: { padding: '8px 10px', fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#F8F4EC', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 6, width: '100%' },
    rrow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.03)' },
    rlbl: { fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: '#6A6050' },
    rval: { fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 700, color: '#F8F4EC' },
    tblWrap: { overflowX: 'auto' as const },
    th: { background: '#141414', color: '#E8C567', padding: '7px 8px', textAlign: 'left' as const, borderBottom: '1px solid rgba(201,168,76,0.16)', fontSize: 7, letterSpacing: 1, textTransform: 'uppercase' as const, fontWeight: 700, whiteSpace: 'nowrap' as const, fontFamily: "'JetBrains Mono',monospace" },
    td: { padding: '7px 8px', fontSize: 10, color: '#C8C0B0', borderBottom: '1px solid rgba(255,255,255,0.03)', whiteSpace: 'nowrap' as const, fontFamily: "'JetBrains Mono',monospace" },
    badgeWin: { background: 'rgba(34,197,94,0.09)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.25)', fontSize: 8, padding: '2px 6px', borderRadius: 4, fontWeight: 700 },
    badgeLoss: { background: 'rgba(232,64,64,0.09)', color: '#E84040', border: '1px solid rgba(232,64,64,0.25)', fontSize: 8, padding: '2px 6px', borderRadius: 4, fontWeight: 700 },
    kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 },
    kpi: { background: '#0E0E0E', border: '1px solid rgba(201,168,76,0.12)', borderRadius: 8, padding: 10, textAlign: 'center' as const },
    kpiLbl: { fontFamily: "'JetBrains Mono',monospace", fontSize: 7, letterSpacing: 1, textTransform: 'uppercase' as const, color: '#6A6050', marginBottom: 4 },
    kpiVal: { fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700, color: '#F8F4EC' },
  };

  return (
    <>
      {pixelId && pixelEnabled && (
        <Script id="meta-pixel" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
          fbq('init','${pixelId}');fbq('track','PageView');
        ` }} />
      )}

      {/* ── NAVBAR ── */}
      <nav className={`home-navbar${navScrolled ? ' scrolled' : ''}`}>
        <a href="/home" className="nav-logo">Journal<em>yze</em><span className="logo-badge">v2.0</span></a>
        <div className="nav-right">
          <div className="nav-countdown">
            <span>🔥</span><span>Penawaran berakhir:</span>
            <span className="time-val">{cd.h}:{cd.m}:{cd.s}</span>
          </div>

          {user ? (
            /* ── SUDAH LOGIN: avatar + dropdown ── */
            <div className="nav-user-wrap" style={{position:'relative'}}>
              <button
                className="nav-user-btn"
                onClick={() => setUserMenuOpen(v => !v)}
                onBlur={() => setTimeout(() => setUserMenuOpen(false), 150)}
              >
                <div className="nav-user-avatar">{user.initial}</div>
                <div className="nav-user-info">
                  <span className="nav-user-name">{user.name}</span>
                  <span className="nav-user-email">{user.email}</span>
                </div>
                <span className="nav-user-chevron" style={{
                  display:'inline-block',
                  transition:'transform .2s',
                  transform: userMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  fontSize: 10,
                  color: 'var(--text3)',
                }}>▼</span>
              </button>
              {userMenuOpen && (
                <div className="nav-user-dropdown">
                  <a href="/journal" className="nav-dd-item">
                    <span>📊</span><span>Jurnal Saya</span>
                  </a>
                  <a href="/journal?page=profile" className="nav-dd-item">
                    <span>👤</span><span>Profil</span>
                  </a>
                  <div className="nav-dd-divider"/>
                  <button
                    className="nav-dd-item nav-dd-logout"
                    onClick={async () => {
                      await _sb.auth.signOut();
                      setUser(null);
                      setUserMenuOpen(false);
                    }}
                  >
                    <span>🚪</span><span>Keluar</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* ── BELUM LOGIN: tombol Masuk + CTA ── */
            <>
              <a href="/journal" className="nav-login">
                <span>Masuk</span>
              </a>
              <a href={ctaOrder('pro')} className="nav-cta">
                <span>Mulai Sekarang</span><span>↗</span>
              </a>
            </>
          )}
        </div>
      </nav>

      {/* ── STATS BAR ── */}
      <div className="stats-bar">
        {[
          { val: '2.400+', label: 'Trade Tercatat' },
          { val: '68%',    label: 'Avg Win Rate User' },
          { val: '340+',   label: 'Trader Aktif' },
          { val: '4.9★',   label: 'Rating Pengguna' },
        ].map((s, i) => (
          <div key={i} className="stats-bar-item">
            <span className="stats-bar-val">{s.val}</span>
            <span className="stats-bar-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── MARQUEE — social proof ── */}
      <div className="marquee-wrap">
        <div className="marquee-track">
          {[...Array(2)].map((_, rep) => (
            <span key={rep} className="marquee-inner">
              {['Budi S. baru join ⚡','Rahmad F. catat 12 trade hari ini 📊','Dewi A. win rate naik ke 72% 🏆','Andi P. profit bulan ini +Rp 1.2jt 💰','Siti R. share journal ke klien 📡','Hendra K. baru join ⚡','Yoga P. catat 8 trade hari ini 📊','Lina M. win rate 65% bulan ini 🎯','Fajar R. baru aktivasi Elite 🔥','Nadia S. share journal publik 📡'].map((item, j) => (
                <span key={j} className="marquee-item"><span className="marquee-dot">●</span>{item}</span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* ── HERO ── */}
      <section className="hero-section">
        <div className="hero-bg"/><div className="hero-grid-lines"/>
        <div className="hero-content">
          <div className="hero-tag reveal"><span className="dot"/><span>Platform Jurnal Trading Profesional Indonesia</span></div>
          <h1 className="hero-headline reveal">
            <span className="line1">Berhenti Tebak-tebak.</span>
            <span className="line2">Mulai Catat, Analisis,</span>
            <span className="line3">dan Naik Level sebagai Trader.</span>
          </h1>
          <p className="hero-sub reveal delay-1">
            Journalyze adalah jurnal trading web app profesional yang membantu kamu mencatat setiap trade,
            menganalisis performa, dan menemukan pola kemenangan yang konsisten.
          </p>
          <div className="hero-countdown reveal delay-2">
            <span className="countdown-label">Harga spesial berakhir dalam</span>
            <div className="countdown-blocks">
              <div className="cblock"><span className="val">{cd.h}</span><span className="lbl">Jam</span></div>
              <span className="sep">:</span>
              <div className="cblock"><span className="val">{cd.m}</span><span className="lbl">Menit</span></div>
              <span className="sep">:</span>
              <div className="cblock"><span className="val">{cd.s}</span><span className="lbl">Detik</span></div>
            </div>
          </div>
          <div className="hero-cta-wrap reveal delay-3">
            <a href={ctaOrder('pro')} className="btn-primary-gold">
              <span>⚡</span><span>Dapatkan Akses Sekarang</span>
            </a>
            <a href={wa(WA_MSG_DEFAULT)} target="_blank" rel="noopener noreferrer" className="btn-secondary-outline">
              <span>Tanya-tanya dulu →</span>
            </a>
          </div>
          <div className="hero-mockup reveal delay-4">
            <div className="mockup-frame">
              <div className="mockup-topbar">
                <div className="mockup-brand">Journal<em>yze</em></div>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:'var(--text3)'}}>⚡ Dashboard Aktif</div>
              </div>
              <div className="mockup-stats">
                {[{l:'Win Rate',v:'68%',c:'green'},{l:'Total Trade',v:'142',c:'gold'},{l:'Avg RR',v:'1.8',c:'gold'},{l:'Net P/L',v:'+$1,284',c:'green'}].map(s=>(
                  <div key={s.l} className="mockup-stat">
                    <div className="ms-lbl">{s.l}</div>
                    <div className={`ms-val ${s.c}`}>{s.v}</div>
                  </div>
                ))}
              </div>
              <div className="mockup-chart-placeholder">
                {bars.map((h,i)=><div key={i} className={`mockup-bar${h>60?' green':h<30?' red':''}`} style={{height:`${h}%`}}/>)}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider"/>

      {/* ── PROBLEM ── */}
      <section className="home-section">
        <div className="section-header">
          <div className="section-badge reveal"><span className="dot"/><span>Problem Trader</span></div>
          <h2 className="section-title reveal">Kenapa 95% Trader Retail<br/><span className="gold-text">Gagal Konsisten?</span></h2>
          <p className="section-sub reveal delay-1">Bukan karena strategi yang salah. Tapi karena mereka tidak pernah mencatat, menganalisis, dan belajar dari kesalahan yang sama.</p>
        </div>
        <div className="problem-grid">
          {[
            {n:'01',icon:'😵',title:'Trading Tanpa Catatan',desc:'Kamu mengulangi kesalahan yang sama berulang kali tanpa sadar. Tanpa data, tidak ada yang bisa diperbaiki.'},
            {n:'02',icon:'🎲',title:'Risiko Asal-asalan',desc:'Entry dengan lot sembarangan karena tidak ada kalkulator risiko. Satu trade buruk bisa habiskan seminggu profit.'},
            {n:'03',icon:'🙈',title:'Tidak Tahu Kekuatan Sendiri',desc:'Tidak tahu pair mana yang paling profitable, jam berapa win rate paling tinggi, atau setup mana yang paling konsisten.'},
          ].map((p,i)=>(
            <div key={p.n} className={`problem-card reveal delay-${i+1}`}>
              <div className="problem-number">{p.n}</div>
              <span className="problem-icon">{p.icon}</span>
              <h3 className="problem-title">{p.title}</h3>
              <p className="problem-desc">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="section-divider"/>

      {/* ── JUJUR DULU (no-BS section, inspired by akademimarketer) ── */}
      <section className="honest-section">
        <div className="honest-inner">
          <div className="section-header">
            <div className="section-badge reveal"><span className="dot"/><span>Jujur Dulu</span></div>
            <h2 className="section-title reveal">Kami Tidak Akan<br/><span className="gold-text">Janji Muluk-muluk.</span></h2>
            <p className="section-sub reveal delay-1">
              Journalyze bukan alat sihir yang bikin kamu langsung profit. Ini adalah tool untuk trader yang
              <strong style={{color:'var(--gold2)'}}> serius ingin tahu apa yang benar-benar terjadi</strong> di trading mereka.
            </p>
          </div>
          <div className="honest-grid">
            <div className="honest-card reveal delay-1">
              <div className="honest-icon">✅</div>
              <h3 className="honest-card-title">Yang Journalyze Bisa Lakukan</h3>
              <div className="honest-list">
                {[
                  'Bantu kamu catat & analisis setiap trade secara sistematis',
                  'Tunjukkan pair, jam, dan setup mana yang paling cocok untukmu',
                  'Hitung risiko yang tepat sebelum entry — bukan setelah rugi',
                  'Beri data konkret untuk perbaiki strategi dari bulan ke bulan',
                  'Bantu kamu bangun track record yang bisa ditunjukkan ke orang lain',
                ].map((item, i) => (
                  <div key={i} className="honest-item yes"><span>✓</span><span>{item}</span></div>
                ))}
              </div>
            </div>
            <div className="honest-card reveal delay-2">
              <div className="honest-icon">❌</div>
              <h3 className="honest-card-title">Yang Journalyze Tidak Bisa</h3>
              <div className="honest-list">
                {[
                  'Menggantikan strategi trading yang solid — itu PR kamu sendiri',
                  'Membuat kamu profit kalau kamu tidak disiplin menggunakannya',
                  'Memprediksi market atau memberi sinyal trading',
                  'Bekerja kalau kamu malas mencatat dan evaluasi rutin',
                  'Mengubah trader yang tidak mau belajar menjadi konsisten',
                ].map((item, i) => (
                  <div key={i} className="honest-item no"><span>✗</span><span>{item}</span></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider"/>

      {/* ── SOLUTION ── */}
      <section className="solution-section">
        <div className="solution-inner">
          <div className="section-header">
            <div className="section-badge reveal"><span className="dot"/><span>Solusi Lengkap</span></div>
            <h2 className="section-title reveal">Semua yang Kamu Butuhkan<br/><em className="gold-text">dalam Satu Platform</em></h2>
            <p className="section-sub reveal delay-1">Journalyze dirancang khusus untuk trader Forex Indonesia yang serius ingin naik level ke konsistensi nyata.</p>
          </div>
          <div className="feature-grid">
            {FEATURES.map((f,i)=>(
              <div key={f.title} className={`feature-card reveal delay-${(i%3)+1}`}>
                <div className="feature-icon-wrap">{f.icon}</div>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider"/>

      {/* ── INTERACTIVE MOCKUP ── */}
      <section className="mockup-section">
        <div className="section-header">
          <div className="section-badge reveal"><span className="dot"/><span>Preview Fitur</span></div>
          <h2 className="section-title reveal">Lihat Sendiri<br/><span className="gold-text">Tampilan Journalyze</span></h2>
          <p className="section-sub reveal delay-1">Preview langsung tampilan asli Journalyze. Akses penuh setelah aktivasi.</p>
        </div>

        {/* Tab pills di luar browser */}
        <div style={{display:'flex',justifyContent:'center',gap:8,marginBottom:16,flexWrap:'wrap'}}>
          {TABS.map(t=>(
            <button key={t.id}
              onClick={()=>setActiveTab(t.id)}
              style={{
                background: activeTab===t.id ? 'rgba(201,168,76,0.09)' : '#141414',
                border: activeTab===t.id ? '1px solid #C9A84C' : '1px solid rgba(201,168,76,0.12)',
                color: activeTab===t.id ? '#E8C567' : '#C4BBa8',
                fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 7,
                cursor: 'pointer', transition: 'all 0.2s', fontFamily: "'Outfit',sans-serif",
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Browser chrome */}
        <div className="reveal" style={{background:'#111',borderRadius:'14px 14px 0 0',border:'2px solid #1e1e1e',overflow:'hidden',maxWidth:960,margin:'0 auto'}}>
          {/* Chrome bar */}
          <div style={{background:'#1a1a1a',padding:'10px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,borderBottom:'1px solid #222'}}>
            <div style={{display:'flex',gap:6,alignItems:'center'}}>
              <span style={{width:10,height:10,borderRadius:'50%',background:'#FF5F57',display:'inline-block'}}/>
              <span style={{width:10,height:10,borderRadius:'50%',background:'#FFBD2E',display:'inline-block'}}/>
              <span style={{width:10,height:10,borderRadius:'50%',background:'#28CA41',display:'inline-block'}}/>
            </div>
            <div style={{flex:1,textAlign:'center',background:'rgba(255,255,255,0.05)',borderRadius:5,padding:'5px 12px',fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:'rgba(255,255,255,0.25)'}}>
              journalyze.my.id — Jurnal Trading Profesional
            </div>
            <div style={{width:44}}/>
          </div>

          {/* App container */}
          <div style={{...jmStyles.app, maxHeight: 560, overflowY: 'hidden', position: 'relative'}}>

            {/* Topbar */}
            <nav style={jmStyles.topbar}>
              <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
                <div style={jmStyles.brand}>Journal<em style={{fontStyle:'italic',color:'#F5D87A'}}>yze</em></div>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,letterSpacing:2,textTransform:'uppercase',color:'#6A6050',marginLeft:4}}>Suite</span>
              </div>
              <div style={jmStyles.ptabs}>
                {TABS.map(t=>(
                  <button key={t.id} style={{...jmStyles.ptab,...(activeTab===t.id?jmStyles.ptabActive:{})}} onClick={()=>setActiveTab(t.id)}>
                    {t.label}
                  </button>
                ))}
              </div>
              <div style={{display:'flex',background:'#1C1C1C',border:'1px solid rgba(201,168,76,0.12)',borderRadius:99,padding:2,gap:1,flexShrink:0}}>
                <button style={{padding:'3px 8px',borderRadius:99,fontSize:10,fontWeight:600,cursor:'default',border:'none',background:'#0E0E0E',color:'#F8F4EC',fontFamily:"'Outfit',sans-serif"}}>🌙 Dark</button>
                <button style={{padding:'3px 8px',borderRadius:99,fontSize:10,cursor:'default',border:'none',background:'transparent',color:'#6A6050',fontFamily:"'Outfit',sans-serif"}}>☀️ Light</button>
              </div>
            </nav>

            {/* ── PAGE: RISK ── */}
            {activeTab === 'risk' && (
              <div style={{...jmStyles.main, overflowY:'auto', maxHeight:500}}>
                <div style={jmStyles.ph}>
                  <div>
                    <div style={jmStyles.phLabel}>⚖️ Modul 01 — Manajemen Risiko</div>
                    <div style={jmStyles.phTitle}>Profil Risiko & <em style={{fontStyle:'italic',color:'#F5D87A'}}>Kalkulator</em></div>
                    <div style={jmStyles.phSub}>Jawab 5 pertanyaan. Semua rekomendasi dihitung otomatis.</div>
                  </div>
                  <button style={jmStyles.btnGold}>⚡ Hitung Sekarang</button>
                </div>
                <div style={jmStyles.g12}>
                  <div>
                    <div style={jmStyles.box}>
                      <div style={jmStyles.boxHead}>
                        <span style={jmStyles.boxTitle}>📝 Pertanyaan</span>
                        <span style={{...jmStyles.boxTitle,color:'#F5D87A'}}>Jawab Disini!</span>
                      </div>
                      <div style={{padding:'12px 14px'}}>
                        {[
                          {label:'1. Saldo awal yang ingin kamu gunakan untuk trading?', pre:'Rp', val:'3.000.000'},
                          {label:'2. Risiko yang siap kamu tanggung di setiap transaksi?', sel:'1% — Konservatif'},
                          {label:'3. Ingin mengembangkan akun ini dalam berapa bulan?', sel:'3 Bulan'},
                          {label:'4. Target saldo yang kamu harapkan?', pre:'Rp', val:'10.000.000'},
                          {label:'5. Pair yang paling sering kamu gunakan?', sel:'XAUUSD — Gold'},
                        ].map((f,i)=>(
                          <div key={i} style={jmStyles.frow}>
                            <label style={jmStyles.flabel}>{f.label}</label>
                            {f.sel ? (
                              <div style={jmStyles.fselect}>{f.sel} ▾</div>
                            ) : (
                              <div style={jmStyles.fwrap}>
                                <span style={jmStyles.fpre}>{f.pre}</span>
                                <div style={jmStyles.finput}>{f.val}</div>
                              </div>
                            )}
                          </div>
                        ))}
                        <div style={{display:'flex',gap:8,marginTop:8}}>
                          <button style={{...jmStyles.btnGold,flex:1}}>⚡ Hitung & Generate</button>
                          <button style={{background:'#1C1C1C',border:'1px solid rgba(201,168,76,0.12)',color:'#C8C0B0',fontSize:11,padding:'7px 12px',borderRadius:6,cursor:'default',fontFamily:"'Outfit',sans-serif"}}>↺ Reset</button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div style={jmStyles.box}>
                      <div style={jmStyles.boxHead}>
                        <span style={jmStyles.boxTitle}>📊 Rangkuman Teknis</span>
                        <span style={{background:'rgba(34,197,94,0.1)',color:'#22C55E',border:'1px solid rgba(34,197,94,0.25)',fontSize:8,padding:'2px 7px',borderRadius:5,fontFamily:"'JetBrains Mono',monospace"}}>KONSERVATIF</span>
                      </div>
                      {[
                        {l:'💰 Saldo Awal',v:'Rp 3.000.000',c:'#F8F4EC'},
                        {l:'🎯 Target',v:'Rp 10.000.000',c:'#F8F4EC'},
                        {l:'⚡ Lot Ideal',v:'0.02 lot',c:'#E8C567'},
                        {l:'🛡️ Max Loss/Trade',v:'Rp 30.000',c:'#E84040'},
                        {l:'📊 Profit/Hari (Target)',v:'Rp 77.778',c:'#22C55E'},
                        {l:'🔢 Max Trade/Hari',v:'3 trade',c:'#F8F4EC'},
                        {l:'📉 Max Drawdown',v:'15%',c:'#F8F4EC'},
                        {l:'💱 Value per Pip',v:'Rp 163',c:'#F8F4EC'},
                      ].map((r,i)=>(
                        <div key={i} style={{...jmStyles.rrow,borderBottom: i<7?'1px solid rgba(255,255,255,0.03)':'none'}}>
                          <span style={jmStyles.rlbl}>{r.l}</span>
                          <span style={{...jmStyles.rval,color:r.c}}>{r.v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── PAGE: PLAN ── */}
            {activeTab === 'plan' && (
              <div style={{...jmStyles.main, overflowY:'auto', maxHeight:500}}>
                <div style={jmStyles.ph}>
                  <div>
                    <div style={jmStyles.phLabel}>📅 Modul 02 — Trading Plan</div>
                    <div style={jmStyles.phTitle}>Plan <em style={{fontStyle:'italic',color:'#F5D87A'}}>Harian</em></div>
                    <div style={jmStyles.phSub}>Buka market dengan arah yang jelas — bukan feeling.</div>
                  </div>
                </div>
                <div style={jmStyles.g12}>
                  <div>
                    <div style={jmStyles.box}>
                      <div style={jmStyles.boxHead}><span style={jmStyles.boxTitle}>📝 Isi Plan Hari Ini</span></div>
                      <div style={{padding:'12px 14px'}}>
                        {[
                          {label:'Tanggal', val:'Senin, 21 April 2025'},
                          {label:'Bias Market Hari Ini', sel:'Bullish'},
                          {label:'Target Profit Hari Ini (Rp)', val:'200.000'},
                          {label:'Max Loss yang Ditoleransi (Rp)', val:'100.000'},
                          {label:'Session Target', sel:'London Open'},
                        ].map((f,i)=>(
                          <div key={i} style={jmStyles.frow}>
                            <label style={jmStyles.flabel}>{f.label}</label>
                            {f.sel ? <div style={jmStyles.fselect}>{f.sel} ▾</div>
                              : <div style={{...jmStyles.fwrap}}><div style={jmStyles.finput}>{f.val}</div></div>}
                          </div>
                        ))}
                        <button style={{...jmStyles.btnGold,width:'100%',marginTop:8}}>💾 Simpan Plan</button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div style={jmStyles.box}>
                      <div style={jmStyles.boxHead}><span style={jmStyles.boxTitle}>📊 Proyeksi Otomatis</span></div>
                      {[
                        {l:'📅 Tanggal',v:'21 April 2025',c:'#F8F4EC'},
                        {l:'📈 Bias',v:'Bullish ↑',c:'#22C55E'},
                        {l:'🎯 Target Profit',v:'Rp 200.000',c:'#22C55E'},
                        {l:'🛑 Max Loss',v:'Rp 100.000',c:'#E84040'},
                        {l:'💰 Proyeksi Saldo',v:'Rp 5.200.000',c:'#E8C567'},
                        {l:'🔢 Max Trade',v:'3 trade',c:'#F8F4EC'},
                        {l:'⏰ Session Target',v:'London Open',c:'#F8F4EC'},
                      ].map((r,i)=>(
                        <div key={i} style={{...jmStyles.rrow,borderBottom:i<6?'1px solid rgba(255,255,255,0.03)':'none'}}>
                          <span style={jmStyles.rlbl}>{r.l}</span>
                          <span style={{...jmStyles.rval,color:r.c}}>{r.v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── PAGE: DATA ── */}
            {activeTab === 'data' && (
              <div style={{...jmStyles.main, overflowY:'auto', maxHeight:500}}>
                <div style={jmStyles.ph}>
                  <div>
                    <div style={jmStyles.phLabel}>📋 Modul 03 — Data Trading</div>
                    <div style={jmStyles.phTitle}>Jurnal <em style={{fontStyle:'italic',color:'#F5D87A'}}>Transaksi</em></div>
                    <div style={jmStyles.phSub}>Catat setiap trade — semua kalkulasi otomatis.</div>
                  </div>
                  <button style={jmStyles.btnGold}>+ Tambah Trade</button>
                </div>
                <div style={jmStyles.statRow}>
                  {[{l:'Total P&L',v:'+Rp 380.000',c:'#22C55E'},{l:'Win Rate',v:'70%',c:'#22C55E'},{l:'Total Trade',v:'10',c:'#F8F4EC'},{l:'Saldo Akhir',v:'Rp 5.380.000',c:'#E8C567'}].map(s=>(
                    <div key={s.l} style={jmStyles.scard}>
                      <div style={jmStyles.scardLbl}>{s.l}</div>
                      <div style={{...jmStyles.scardVal,color:s.c}}>{s.v}</div>
                    </div>
                  ))}
                </div>
                <div style={jmStyles.box}>
                  <div style={jmStyles.boxHead}><span style={jmStyles.boxTitle}>📊 Data Trading</span></div>
                  <div style={jmStyles.tblWrap}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:10}}>
                      <thead>
                        <tr>
                          {['No','Tanggal','Sesi','Pair','Posisi','Lot','Entry','Close','Result','Pips','P/L','Saldo','Metode'].map(h=>(
                            <th key={h} style={jmStyles.th}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {MOCK_TRADES.map((r,i)=>(
                          <tr key={i} style={{background: i%2===1 ? 'rgba(255,255,255,0.018)' : 'transparent'}}>
                            <td style={jmStyles.td}>{r.no}</td>
                            <td style={jmStyles.td}>{r.tgl}</td>
                            <td style={jmStyles.td}>{r.sesi}</td>
                            <td style={{...jmStyles.td,color:'#E8C567'}}>{r.pair}</td>
                            <td style={{...jmStyles.td,color:r.pos==='Buy'?'#22C55E':'#E84040'}}>{r.pos}</td>
                            <td style={jmStyles.td}>{r.lot}</td>
                            <td style={jmStyles.td}>{r.entry}</td>
                            <td style={jmStyles.td}>{r.close}</td>
                            <td style={jmStyles.td}><span style={r.win?jmStyles.badgeWin:jmStyles.badgeLoss}>{r.win?'Profit':'Lose'}</span></td>
                            <td style={{...jmStyles.td,color:r.win?'#22C55E':'#E84040'}}>{r.pips}</td>
                            <td style={{...jmStyles.td,color:r.win?'#22C55E':'#E84040'}}>{r.pl}</td>
                            <td style={{...jmStyles.td,color:'#E8C567'}}>{r.saldo}</td>
                            <td style={jmStyles.td}>{r.metode}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── PAGE: FILTER ── */}
            {activeTab === 'filter' && (
              <div style={{...jmStyles.main, overflowY:'auto', maxHeight:500}}>
                <div style={jmStyles.ph}>
                  <div>
                    <div style={jmStyles.phLabel}>🔍 Modul 04 — Filter Trading</div>
                    <div style={jmStyles.phTitle}>Analisis <em style={{fontStyle:'italic',color:'#F5D87A'}}>Performa</em></div>
                    <div style={jmStyles.phSub}>Temukan pola trading lo berdasarkan data nyata.</div>
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:12}}>
                  {[{l:'Total Profit',v:'+Rp 507.330',c:'#22C55E'},{l:'Total Lose',v:'-Rp 103.876',c:'#E84040'},{l:'Total P - L',v:'+Rp 403.454',c:'#F8F4EC'},{l:'Total Saldo',v:'Rp 5.380.000',c:'#E8C567'}].map(s=>(
                    <div key={s.l} style={{...jmStyles.scard,borderColor:s.c==='#22C55E'?'rgba(34,197,94,0.25)':s.c==='#E84040'?'rgba(232,64,64,0.25)':s.c==='#E8C567'?'rgba(201,168,76,0.16)':'rgba(255,255,255,0.05)'}}>
                      <div style={jmStyles.scardLbl}>{s.l}</div>
                      <div style={{...jmStyles.scardVal,color:s.c}}>{s.v}</div>
                    </div>
                  ))}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div style={jmStyles.box}>
                    <div style={jmStyles.boxHead}><span style={jmStyles.boxTitle}>📈 Profit vs Saldo</span></div>
                    <div style={{padding:12}}>
                      <svg viewBox="0 0 240 80" width="100%" xmlns="http://www.w3.org/2000/svg">
                        <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22C55E" stopOpacity="0.3"/><stop offset="100%" stopColor="#22C55E" stopOpacity="0"/></linearGradient></defs>
                        <path d="M0,70 L30,60 L60,65 L90,45 L120,50 L150,35 L180,25 L210,15 L240,10" stroke="#22C55E" strokeWidth="1.5" fill="none"/>
                        <path d="M0,70 L30,60 L60,65 L90,45 L120,50 L150,35 L180,25 L210,15 L240,10 L240,80 L0,80 Z" fill="url(#g1)"/>
                      </svg>
                    </div>
                  </div>
                  <div style={jmStyles.box}>
                    <div style={jmStyles.boxHead}><span style={jmStyles.boxTitle}>🌏 Market Session</span></div>
                    <div style={{padding:12,display:'flex',alignItems:'center',gap:12}}>
                      <svg viewBox="0 0 80 80" width="80" height="80">
                        <circle cx="40" cy="40" r="35" fill="none" stroke="#22C55E" strokeWidth="12" strokeDasharray="124 221" strokeDashoffset="0"/>
                        <circle cx="40" cy="40" r="35" fill="none" stroke="#E84040" strokeWidth="12" strokeDasharray="64 221" strokeDashoffset="-124"/>
                        <circle cx="40" cy="40" r="35" fill="none" stroke="#60A5FA" strokeWidth="12" strokeDasharray="33 221" strokeDashoffset="-188"/>
                      </svg>
                      <div style={{display:'flex',flexDirection:'column',gap:6}}>
                        {[{c:'#22C55E',l:'London (57%)'},{c:'#E84040',l:'New York (29%)'},{c:'#60A5FA',l:'Asia (14%)'}].map(l=>(
                          <div key={l.l} style={{display:'flex',alignItems:'center',gap:6,fontSize:10,color:'#C8C0B0'}}>
                            <span style={{width:8,height:8,borderRadius:'50%',background:l.c,flexShrink:0}}/>
                            {l.l}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── PAGE: MONTHLY ── */}
            {activeTab === 'monthly' && (
              <div style={{...jmStyles.main, overflowY:'auto', maxHeight:500}}>
                <div style={jmStyles.ph}>
                  <div>
                    <div style={jmStyles.phLabel}>📊 Modul 06 — Dashboard Bulanan</div>
                    <div style={jmStyles.phTitle}>Performa <em style={{fontStyle:'italic',color:'#F5D87A'}}>Bulanan</em></div>
                    <div style={jmStyles.phSub}>Ringkasan lengkap performa trading bulan ini.</div>
                  </div>
                  <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,fontWeight:700,color:'#E8C567',padding:'3px 10px',background:'rgba(201,168,76,0.06)',border:'1px solid rgba(201,168,76,0.16)',borderRadius:6}}>IDR</span>
                </div>
                <div style={jmStyles.kpiGrid}>
                  {[
                    {l:'Total Profit',v:'+Rp 380.000',c:'#22C55E',bc:'rgba(34,197,94,0.25)'},
                    {l:'Win Rate',v:'70%',c:'#22C55E',bc:'rgba(34,197,94,0.25)'},
                    {l:'Saldo Akhir',v:'Rp 5.380.000',c:'#E8C567',bc:'rgba(201,168,76,0.16)'},
                    {l:'Total Trade',v:'10',c:'#F8F4EC',bc:'rgba(255,255,255,0.05)'},
                    {l:'Best Day',v:'10 Apr (+145p)',c:'#F8F4EC',bc:'rgba(255,255,255,0.05)'},
                    {l:'Worst Day',v:'03 Apr (-38p)',c:'#E84040',bc:'rgba(232,64,64,0.25)'},
                    {l:'Avg Pips/Trade',v:'+61.6',c:'#22C55E',bc:'rgba(34,197,94,0.25)'},
                    {l:'Best Session',v:'London',c:'#F8F4EC',bc:'rgba(255,255,255,0.05)'},
                  ].map((k,i)=>(
                    <div key={i} style={{...jmStyles.kpi,borderColor:k.bc}}>
                      <div style={jmStyles.kpiLbl}>{k.l}</div>
                      <div style={{...jmStyles.kpiVal,color:k.c}}>{k.v}</div>
                    </div>
                  ))}
                </div>
                <div style={{...jmStyles.box,marginTop:10}}>
                  <div style={jmStyles.boxHead}><span style={jmStyles.boxTitle}>📈 Equity Curve — April 2025</span></div>
                  <div style={{padding:12}}>
                    <svg viewBox="0 0 400 80" width="100%" xmlns="http://www.w3.org/2000/svg">
                      <defs><linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22C55E" stopOpacity="0.25"/><stop offset="100%" stopColor="#22C55E" stopOpacity="0"/></linearGradient></defs>
                      <path d="M0,60 L44,52 L88,65 L132,40 L176,48 L220,30 L264,25 L308,10 L352,18 L400,8" stroke="#22C55E" strokeWidth="2" fill="none"/>
                      <path d="M0,60 L44,52 L88,65 L132,40 L176,48 L220,30 L264,25 L308,10 L352,18 L400,8 L400,80 L0,80 Z" fill="url(#g2)"/>
                      {[0,44,88,132,176,220,264,308,352,400].map((x,i)=>(
                        <circle key={i} cx={x} cy={[60,52,65,40,48,30,25,10,18,8][i]} r="3" fill="#22C55E"/>
                      ))}
                    </svg>
                  </div>
                </div>
              </div>
            )}

            {/* ── LOCK OVERLAY ── */}
            <div style={{
              position:'absolute', bottom:0, left:0, right:0, height:'55%',
              background:'linear-gradient(to bottom, transparent 0%, rgba(8,8,8,0.92) 30%, rgba(8,8,8,0.99) 100%)',
              display:'flex', alignItems:'flex-end', justifyContent:'center', padding:'0 24px 28px',
              pointerEvents:'all', zIndex:10,
            }}>
              <div style={{textAlign:'center',padding:'0 16px',maxWidth:500,width:'100%'}}>
                <div style={{fontSize:24,marginBottom:8}}>🔒</div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:700,color:'#fff',marginBottom:12,lineHeight:1.3}}>
                  Fitur Lengkap Tersedia Setelah Aktivasi
                </div>
                <div style={{display:'flex',flexWrap:'wrap',justifyContent:'center',gap:'6px 10px',marginBottom:18}}>
                  {['📊 Dashboard Bulanan','🔍 Filter & Analisis','📅 Equity Curve','📋 Export Data','🤖 AI Assistant'].map(f=>(
                    <span key={f} style={{fontSize:11,color:'#C4BBa8',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:20,padding:'4px 10px',whiteSpace:'nowrap'}}>{f}</span>
                  ))}
                </div>
                <a href={ctaOrder('pro')} style={{
                  display:'inline-block',background:'linear-gradient(135deg,#C9A84C,#E8C567)',color:'#000',
                  fontWeight:900,fontSize:14,padding:'13px 32px',borderRadius:8,textDecoration:'none',
                  transition:'all 0.2s',letterSpacing:0.2,fontFamily:"'Outfit',sans-serif",
                }}>
                  ⚡ Dapatkan Akses Penuh — Rp 149K
                </a>
              </div>
            </div>
          </div>
        </div>
        {/* Browser base */}
        <div style={{maxWidth:960,margin:'0 auto',background:'#161616',height:10,borderRadius:'0 0 8px 8px',border:'2px solid #1e1e1e',borderTop:'none'}}/>
      </section>

      <div className="section-divider"/>

      {/* ── EBOOK — teks di atas, buku di bawah ── */}
      <section className="ebook-section">
        <div className="ebook-inner">
          <div className="ebook-grid" style={{display:'flex',flexDirection:'column',alignItems:'center',gap:56}}>

            {/* === TEKS — ATAS, center === */}
            <div className="ebook-text reveal" style={{display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center',maxWidth:640,width:'100%',gap:20}}>
              <div className="ebook-tag">🎁 Bonus Eksklusif</div>
              <h2 className="ebook-title">
                Dapat 2 E-Book<br/>
                <span className="gold-text">Trading Premium</span><br/>
                Gratis!
              </h2>
              <p style={{color:'var(--text2)',fontSize:15,lineHeight:1.7,textAlign:'center',maxWidth:560}}>
                Khusus pembeli paket Pro & Elite, dapatkan 2 e-book eksklusif senilai Rp 400.000 secara GRATIS.
                Ditulis dari pengalaman nyata trading.
              </p>
              <div className="ebook-list" style={{alignSelf:'center',maxWidth:500,width:'100%',textAlign:'left'}}>
                {[
                  'Panduan membaca 12 pola candlestick dengan win rate tertinggi',
                  'Support & Resistance: cara menggambar level yang valid dan actionable',
                  'Cara mengkombinasikan candlestick pattern dengan S&R untuk entry presisi',
                  'Contoh setup nyata dengan screenshot trade asli',
                ].map(item=>(
                  <div key={item} className="ebook-item"><span className="check">✅</span><span>{item}</span></div>
                ))}
              </div>
              <a href={ctaOrder('pro')}
                className="btn-primary-gold" style={{alignSelf:'center'}}>
                <span>📚</span><span>Klaim E-Book Sekarang</span>
              </a>
            </div>

            {/* === BUKU — BAWAH, side by side === */}
            <div className="ebook-books reveal" style={{display:'flex',flexDirection:'row',gap:48,justifyContent:'center',flexWrap:'wrap',alignItems:'flex-start'}}>

              {/* BOOK 1 — Candlestick, gold/dark */}
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:16}}>
                <div className="ebook-book-wrap">
                  <div className="ebook-book-inner-gold">
                    <div className="ebook-shell-gold">
                      <div className="ebook-spine-gold"/>
                      <div className="ebook-free-badge green">FREE</div>
                      <div>
                        <div className="ebook-book-badge gold">Journalyze · Bonus Eksklusif</div>
                        <div className="ebook-book-title-main">Panduan<br/><em className="gold">Candlestick</em><br/>Trading</div>
                        <div className="ebook-book-desc gold">Baca pola candle dengan benar — stop salah baca arah market</div>
                      </div>
                      <div className="ebook-candles">
                        {CANDLES.map((cd,i)=>(
                          <div key={i} className={`ebook-candle ${cd.c}`}>
                            <div className="ebook-candle-wick" style={{height:cd.w1}}/>
                            <div className="ebook-candle-body" style={{height:cd.b}}/>
                            <div className="ebook-candle-wick" style={{height:cd.w2}}/>
                          </div>
                        ))}
                      </div>
                      <div className="ebook-book-footer gold">JOURNALYZE.APP</div>
                    </div>
                  </div>
                </div>
                <div className="ebook-desc-wrap">
                  <div className="ebook-label-badge gold">📘 E-BOOK #1</div>
                  <div className="ebook-desc-title">Panduan Candlestick Trading</div>
                  <div className="ebook-desc-text">Pelajari pola candle paling profitable — Doji, Engulfing, Hammer, Pin Bar, dan 15+ pola lainnya.</div>
                  <div className="ebook-desc-price">✓ Senilai Rp 200.000 · Gratis!</div>
                </div>
              </div>

              {/* BOOK 2 — S&R, blue/dark */}
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:16}}>
                <div className="ebook-book-wrap">
                  <div className="ebook-book-inner-blue">
                    <div className="ebook-shell-blue">
                      <div className="ebook-spine-blue"/>
                      <div className="ebook-free-badge blue">FREE</div>
                      <div>
                        <div className="ebook-book-badge blue">Journalyze · Bonus Eksklusif</div>
                        <div className="ebook-book-title-main">Support &amp;<br/><em className="blue">Resistance</em><br/>Mastery</div>
                        <div className="ebook-book-desc blue">Temukan zona kunci market — di sinilah semua entry terbaik berada</div>
                      </div>
                      <div className="ebook-sr-chart">
                        <div className="ebook-sr-line-r"/>
                        <div className="ebook-sr-label-r">RESISTANCE</div>
                        <svg viewBox="0 0 180 50" width="180" height="50" style={{position:'absolute',top:0,left:0}}>
                          <polyline points="0,35 25,25 50,40 75,12 100,38 125,20 150,36 180,15" stroke="#60A5FA" strokeWidth="1.5" fill="none"/>
                        </svg>
                        <div className="ebook-sr-line-s"/>
                        <div className="ebook-sr-label-s">SUPPORT</div>
                      </div>
                      <div className="ebook-book-footer blue">JOURNALYZE.APP</div>
                    </div>
                  </div>
                </div>
                <div className="ebook-desc-wrap">
                  <div className="ebook-label-badge blue">📚 E-BOOK #2</div>
                  <div className="ebook-desc-title">Support & Resistance Mastery</div>
                  <div className="ebook-desc-text">Cara menggambar zona S&R yang valid dan menghindari false breakout yang menjebak trader pemula.</div>
                  <div className="ebook-desc-price">✓ Senilai Rp 200.000 · Gratis!</div>
                </div>
              </div>

            </div>{/* /ebook-books */}

          </div>{/* /ebook-grid */}
        </div>
      </section>

      <div className="section-divider"/>

      {/* ── PRICING ── */}
      <section className="pricing-section">
        <div className="section-header">
          <div className="section-badge reveal"><span className="dot"/><span>Pilih Paket</span></div>
          <h2 className="section-title reveal">Investasi Terbaik<br/><span className="gold-text">untuk Karir Trading Kamu</span></h2>
          <p className="section-sub reveal delay-1">Pilih paket yang sesuai kebutuhanmu.</p>
        </div>
        <div className="pricing-grid">
          <div className="pricing-card reveal delay-1">
            <div className="pricing-tier">Paket Basic</div>
            <div><div className="price-fake">Rp 149.000</div><div className="price-real">99K</div></div>
            <div className="price-note">Akses 3 bulan · Web App Only</div>
            <div className="pricing-divider"/>
            <div className="pricing-features">
              {['Akses Journalyze Web App','Kalkulator risiko & lot size','Rekap & analisis trade','Trading plan harian','Share journal publik'].map(f=>(
                <div key={f} className="pricing-feature"><span className="pf-icon">✓</span><span>{f}</span></div>
              ))}
            </div>
            <a href={ctaOrder('basic')} className="btn-pricing"><span>⚡</span><span>Pesan Sekarang</span></a>
          </div>
          <div className="pricing-card highlight reveal delay-2">
            <div className="pricing-badge-top">⭐ Paling Populer</div>
            <div className="pricing-tier gold">Paket Pro</div>
            <div><div className="price-fake">Rp 297.000</div><div className="price-real">149K</div></div>
            <div className="price-note">Lifetime · + E-Book + Komunitas</div>
            <div className="pricing-divider"/>
            <div className="pricing-features">
              {['Semua fitur Journalyze Web App','Akses LIFETIME (bukan langganan)','2 E-Book Trading Premium (Bonus)','Akses grup komunitas trader','Konsultasi 1x via WhatsApp','Semua update fitur gratis'].map(f=>(
                <div key={f} className="pricing-feature"><span className="pf-icon">✓</span><span>{f}</span></div>
              ))}
            </div>
            <a href={ctaOrder('pro')} className="btn-pricing gold"><span>⚡</span><span>Pesan Paket Pro Sekarang</span></a>
          </div>
          <div className="pricing-card reveal delay-3">
            <div className="pricing-tier">Paket Elite</div>
            <div><div className="price-fake">Rp 497.000</div><div className="price-real">249K</div></div>
            <div className="price-note">Lifetime · + Review + Konsultasi 3x</div>
            <div className="pricing-divider"/>
            <div className="pricing-features">
              {['Semua fitur Paket Pro','Review journal bulanan (1x/bulan)','Konsultasi trading 3x via WhatsApp','Analisis psikologi trading','Feedback strategy personal','Prioritas support & update'].map(f=>(
                <div key={f} className="pricing-feature"><span className="pf-icon">✓</span><span>{f}</span></div>
              ))}
            </div>
            <a href={ctaOrder('elite')} className="btn-pricing"><span>🔥</span><span>Pesan Sekarang</span></a>
          </div>
        </div>
      </section>

      <div className="section-divider"/>

      {/* ── TESTIMONIAL ── */}
      <section className="testimonial-section">
        <div className="testimonial-inner">
          <div className="section-header">
            <div className="section-badge reveal"><span className="dot"/><span>Testimoni Pengguna</span></div>
            <h2 className="section-title reveal">Apa Kata Trader<br/><span className="gold-text">yang Sudah Pakai Journalyze?</span></h2>
          </div>
          <div className="testimonial-slider-wrap reveal">
            <div className="testimonial-track" ref={sliderRef}>
              {TESTIMONIALS.map(t=>(
                <div key={t.name} className="testimonial-card">
                  <div className="testi-header">
                    <div className="testi-avatar">{t.initial}</div>
                    <div><div className="testi-name">{t.name}</div><div className="testi-role">{t.role}</div></div>
                  </div>
                  <div className="testi-stars">{Array(t.stars).fill(0).map((_,i)=><span key={i} className="testi-star">★</span>)}</div>
                  <div className="testi-bubble">{t.text}<div className="testi-time">{t.time} ✓✓</div></div>
                </div>
              ))}
            </div>
          </div>
          <div className="slider-controls">
            <button className="slider-btn" onClick={()=>slideTo(sliderIdx-1)}>←</button>
            <div className="slider-dots">
              {Array(maxIdx+1).fill(0).map((_,i)=>(
                <div key={i} className={`slider-dot${sliderIdx===i?' active':''}`} onClick={()=>slideTo(i)}/>
              ))}
            </div>
            <button className="slider-btn" onClick={()=>slideTo(sliderIdx+1)}>→</button>
          </div>
        </div>
      </section>

      <div className="section-divider"/>

      {/* ── HASIL NYATA — proof strip ── */}
      <section className="proof-section">
        <div className="section-header">
          <div className="section-badge reveal"><span className="dot"/><span>Data Nyata</span></div>
          <h2 className="section-title reveal">Jangan Percaya Kami.<br/><span className="gold-text">Lihat Datanya Sendiri.</span></h2>
          <p className="section-sub reveal delay-1">Angka ini berasal dari aktivitas trader aktif Journalyze selama 30 hari terakhir.</p>
        </div>
        <div className="proof-grid reveal">
          {[
            { icon: '📊', val: '2.400+',   label: 'Trade Tercatat',          sub: 'di platform bulan ini' },
            { icon: '🏆', val: '68%',       label: 'Rata-rata Win Rate',      sub: 'user aktif yang rutin catat' },
            { icon: '💰', val: 'Rp 1.2jt', label: 'Avg Profit Bulanan',      sub: 'trader yang pakai risk calculator' },
            { icon: '📈', val: '3.2x',      label: 'Peningkatan Konsistensi', sub: 'setelah 60 hari pakai Journalyze' },
            { icon: '⚡', val: '340+',      label: 'Trader Aktif',            sub: 'login minimal 3x seminggu' },
            { icon: '📡', val: '180+',      label: 'Journal Publik Dibagikan', sub: 'untuk bangun track record' },
          ].map((p, i) => (
            <div key={i} className="proof-card">
              <div className="proof-icon">{p.icon}</div>
              <div className="proof-val">{p.val}</div>
              <div className="proof-label">{p.label}</div>
              <div className="proof-sub">{p.sub}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="section-divider"/>

      {/* ── FOR WHO ── */}
      <section className="forwho-section">
        <div className="section-header">
          <div className="section-badge reveal"><span className="dot"/><span>Untuk Siapa?</span></div>
          <h2 className="section-title reveal">Journalyze Cocok<br/><span className="gold-text">untuk Kamu?</span></h2>
        </div>
        <div className="forwho-grid">
          <div className="forwho-col reveal-left">
            <div className="forwho-header yes"><span style={{fontSize:24}}>✅</span><h3 className="forwho-header-title">Journalyze UNTUK Kamu jika:</h3></div>
            <div className="forwho-body">
              {['Kamu trader Forex yang ingin konsisten dan punya track record nyata','Kamu mau disiplin dengan risk management yang terukur setiap trade','Kamu ingin tahu pair, sesi, dan setup mana yang paling cocok untukmu','Kamu serius membangun karir atau bisnis sebagai trader profesional','Kamu trader pemula yang mau belajar dengan cara yang benar dari awal'].map(item=>(
                <div key={item} className="forwho-item"><span className="forwho-icon">✅</span><span>{item}</span></div>
              ))}
            </div>
          </div>
          <div className="forwho-col reveal-right">
            <div className="forwho-header no"><span style={{fontSize:24}}>❌</span><h3 className="forwho-header-title">BUKAN untuk Kamu jika:</h3></div>
            <div className="forwho-body">
              {['Kamu cari cara cepat kaya tanpa belajar dan berproses','Kamu tidak mau catat dan evaluasi trading secara rutin','Kamu masih yakin "feeling" lebih baik dari data dan analisis','Kamu tidak mau investasi untuk upgrade skill dan tools trading','Kamu trader yang sudah puas dengan hasil seadanya'].map(item=>(
                <div key={item} className="forwho-item"><span className="forwho-icon">❌</span><span>{item}</span></div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider"/>

      {/* ── FAQ — REVISI 2: accordion fix ── */}
      <section className="faq-section">
        <div className="faq-inner">
          <div className="section-header">
            <div className="section-badge reveal"><span className="dot"/><span>FAQ</span></div>
            <h2 className="section-title reveal">Pertanyaan<br/><span className="gold-text">yang Sering Ditanya</span></h2>
          </div>
          <div className="faq-list reveal">
            {FAQS.map((f,i)=>(
              <div
                key={i}
                className={`faq-item${openFaq===i ? ' open' : ''}`}
              >
                <div className="faq-question" onClick={()=>setOpenFaq(openFaq===i ? null : i)}>
                  <span className="faq-q-text">{f.q}</span>
                  <span
                    className="faq-chevron"
                    style={{
                      display: 'inline-block',
                      transition: 'transform 0.3s ease, color 0.3s ease',
                      transform: openFaq===i ? 'rotate(180deg)' : 'rotate(0deg)',
                      color: openFaq===i ? 'var(--gold2)' : 'var(--text3)',
                    }}
                  >▼</span>
                </div>
                <div
                  style={{
                    display: openFaq===i ? 'block' : 'none',
                    padding: '16px 24px 20px',
                    fontSize: 14,
                    color: 'var(--text2)',
                    lineHeight: 1.7,
                    fontFamily: "'Outfit', sans-serif",
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  {f.a}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GUARANTEE ── */}
      <section className="guarantee-section">
        <div className="guarantee-inner reveal">
          <div className="guarantee-icon">🛡️</div>
          <div className="guarantee-text">
            <h3 className="guarantee-title">Garansi Aktivasi atau Uang Kembali</h3>
            <p className="guarantee-desc">
              Kalau akun kamu tidak aktif dalam <strong>1×24 jam</strong> setelah bukti transfer dikirim,
              kami kembalikan 100% uang kamu. Tidak ada pertanyaan, tidak ada drama.
              Kami yakin dengan produk kami — dan kamu tidak perlu menanggung risikonya sendirian.
            </p>
          </div>
          <div className="guarantee-badges">
            {['✅ Aktivasi Cepat','🔒 Data Aman','💬 Support WA','♾️ Lifetime Access'].map(b => (
              <span key={b} className="guarantee-badge">{b}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="final-cta-section">
        <div className="final-cta-bg"/>
        <div className="final-cta-inner">
          <div className="section-badge reveal" style={{margin:'0 auto 24px'}}><span className="dot"/><span>Mulai Hari Ini</span></div>
          <h2 className="final-cta-title reveal">Waktunya Upgrade<br/><span className="gold-text">Cara Trading Kamu.</span></h2>
          <p className="final-cta-sub reveal delay-1">Jangan biarkan kesalahan yang sama terus berulang.</p>
          <div className="hero-cta-wrap reveal delay-2">
            <a href={ctaOrder('pro')} className="btn-primary-gold">
              <span>⚡</span><span>Dapatkan Akses Sekarang — Rp 149K</span>
            </a>
          </div>
          <div className="final-cta-guarantee reveal delay-3">
            <span>🔒</span><span>Pembayaran aman · Aktivasi cepat · Support via WhatsApp</span>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="home-footer">
        <div className="footer-inner">
          <div className="footer-top">
            <div className="footer-brand">
              <div className="logo">Journal<em>yze</em></div>
              <div className="tagline">Platform jurnal trading profesional untuk trader Forex Indonesia.</div>
            </div>
            <div className="footer-links">
              <div className="footer-link-group">
                <div className="fg-title">Produk</div>
                <a href="/demo">Demo Gratis</a><a href="/journal">Login Akun</a><a href="/delivery">Aktivasi Key</a>
              </div>
              <div className="footer-link-group">
                <div className="fg-title">Dukungan</div>
                <a href={wa(WA_MSG_DEFAULT)} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                <a href="#faq">FAQ</a>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <div className="footer-copy">© 2025 Journalyze. All rights reserved.</div>
            <div className="footer-legal"><a href="#">Kebijakan Privasi</a><a href="#">Syarat & Ketentuan</a></div>
          </div>
        </div>
      </footer>

      {/* ── PURCHASE TOAST ── */}
      <div className={`purchase-toast${toastVisible?' show':''}`}>
        <div className="pt-avatar">{toastData.emoji}</div>
        <div className="pt-text">
          <div className="pt-name">{toastData.name}</div>
          <div className="pt-action">baru saja <strong>{toastData.action}</strong></div>
        </div>
        <div className="pt-time">{toastData.time}</div>
        <button className="pt-close" onClick={()=>setToastVisible(false)}>✕</button>
      </div>

      {/* ── STICKY MOBILE CTA ── */}
      <div className="sticky-mobile-cta">
        <div className="sticky-cta-inner">
          <div className="sticky-price">
            <div className="sp-fake">Rp 297.000</div>
            <div className="sp-real">Rp 149K</div>
          </div>
          <a href={ctaOrder('pro')} className="sticky-btn">
            <span>⚡</span><span>Pesan Sekarang</span>
          </a>
        </div>
      </div>
    </>
  );
}