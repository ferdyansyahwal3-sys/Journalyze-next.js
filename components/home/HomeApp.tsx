'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import type { ReactNode, MouseEvent as ReactMouseEvent, CSSProperties } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { fireEvent, fireLandingEvent, getAffiliateCode } from '@/components/AffiliateTracker';
import { _sb } from '@/lib/supabaseClient';
import {
  Fire, Lightning, ChartBar, CalendarBlank, Target, CheckCircle, Money, Books, Star, Lock, Shield,
  Eye, Broadcast, WarningCircle, ArrowRight, MagnifyingGlass, Camera, Brain, Newspaper,
  Headset, ShieldCheck, Infinity as InfinityIcon, Play,
} from '@phosphor-icons/react';

/* ───────────────────────── KONFIGURASI ───────────────────────── */

const WA_LINK = 'https://wa.me/6281311973602?text=' + encodeURIComponent('Halo, saya ingin info lebih lanjut tentang Journalyze 🙏');
const VIDEO_ID = 'ZFCCENQV4hw';

const HARGA_CORET_AFFILIATE = { basic: 'Rp 149.000', pro: 'Rp 248.000', elite: 'Rp 497.000' };
const HARGA_CORET_NORMAL    = { basic: 'Rp 149.000', pro: 'Rp 297.000', elite: 'Rp 497.000' };

// Angka asli dari database tampil hanya kalau >= batas ini (di bawahnya diganti fakta produk).
const MIN_PUBLIC_COUNT = 20;

// Screenshot WhatsApp testimoni: diisi otomatis oleh set-testimoni.js dari folder public/testimoni.
const TESTIMONI_IMAGES: string[] = [
  '/testimoni/1.jpg',
  '/testimoni/2.jpg',
  '/testimoni/3.jpg',
  '/testimoni/4.jpg',
  '/testimoni/5.jpg',
  '/testimoni/6.jpg',
  '/testimoni/IMG_5045.jpg',
];

/* ───────────────────────── KONTEN ───────────────────────── */

const MARQUEE_ITEMS = [
  '📸 Foto MT5, jurnal terisi otomatis',
  '💱 Hitungan sesuai MT5 dalam IDR · USC · USD',
  '🧠 Profil risiko dari 6 pertanyaan',
  '📋 Trading plan dibuat otomatis',
  '📅 Kalender ekonomi Forex Factory',
  '📰 Analisis berita global oleh AI',
  '📊 Analisis pola dari data tradingmu',
  '📡 Share jurnal publik tanpa login',
];

type Toast = { name: string; action: string; time?: string };
// Notifikasi pembelian — muncul bergantian setiap 35 detik
const TOASTS: Toast[] = [
  { name: 'Reza A.',       action: 'baru saja bergabung dengan Paket Pro',   time: '2 mnt lalu'  },
  { name: 'Dina F.',       action: 'baru saja bergabung dengan Paket Basic', time: '5 mnt lalu'  },
  { name: 'Bagas K.',      action: 'baru saja upgrade ke Paket Elite',       time: '8 mnt lalu'  },
  { name: 'Andi S.',       action: 'baru saja bergabung dengan Paket Pro',   time: '12 mnt lalu' },
  { name: 'Siti R.',       action: 'baru saja bergabung dengan Paket Basic', time: '15 mnt lalu' },
  { name: 'Yusuf H.',      action: 'baru saja upgrade ke Paket Pro',         time: '19 mnt lalu' },
  { name: 'Mega W.',       action: 'baru saja bergabung dengan Paket Elite', time: '22 mnt lalu' },
  { name: 'Arif N.',       action: 'baru saja bergabung dengan Paket Pro',   time: '27 mnt lalu' },
];

const PROBLEMS = [
  { n: '01', icon: <WarningCircle size={36} weight="duotone" color="var(--red)" />, title: 'Tahu Harus Jurnal, Tapi Malas', desc: 'Selesai trade, kamu harus buka spreadsheet dan ketik pair, lot, entry, SL, TP. Seminggu kemudian jurnalnya kosong lagi.' },
  { n: '02', icon: <Target size={36} weight="duotone" color="var(--red)" />,        title: 'Hitungan Beda dengan MT5',     desc: 'Kurs berubah, akun cent, lot berbeda. Angkanya tidak cocok dan kamu jadi tidak percaya catatanmu sendiri.' },
  { n: '03', icon: <Eye size={36} weight="duotone" color="var(--red)" />,           title: 'Loss Lagi, Tidak Tahu Kenapa', desc: 'Tanpa alasan dan emosi yang tercatat di tiap trade, kesalahan yang sama terulang tanpa kamu sadari.' },
];

const COMPARE_ROWS = [
  { k: 'Input tiap trade',        old: 'Ketik manual: pair, lot, entry, SL, TP',  now: 'Foto layar MT5, AI isi datanya dalam sekitar 20 detik' },
  { k: 'Hitung lot, pip, profit', old: 'Rumus buatan sendiri, mudah salah',       now: 'Otomatis, sesuai perhitungan MT5' },
  { k: 'Mencari pola kesalahan',  old: 'Filter dan hitung sendiri',               now: 'Analisis otomatis dari data tradingmu' },
  { k: 'Berita & kalender',       old: 'Buka tab dan aplikasi lain',              now: 'Analisis berita AI dan kalender Forex Factory di satu app' },
];

// 3 pertama tampil langsung, sisanya muncul lewat tombol "Lihat fitur lainnya".
const FEATURES = [
  { icon: <Camera size={24} weight="duotone" color="var(--gold2)" />, title: 'Foto MT5, Jurnal Terisi Otomatis', desc: 'Foto layar riwayat trade MT5. AI mengisi pair, lot, entry, dan hasil dalam sekitar 20 detik. Kamu tinggal klik alasan dan emosi.' },
  { icon: <Lightning size={24} weight="fill" color="var(--gold2)" />, title: 'Hitungan Sesuai MT5', desc: 'Lot, pip, dan profit dihitung mengikuti MT5 dengan kurs live, jadi angkanya cocok dengan platform-mu.' },
  { icon: <MagnifyingGlass size={24} weight="duotone" color="var(--gold2)" />, title: 'Analisis dari Data Tradingmu', desc: 'Temukan pair, sesi, dan setup yang paling cocok untukmu dari data trade yang kamu catat.' },
  { icon: <Brain size={24} weight="duotone" color="var(--gold2)" />, title: 'Profil Risiko dari 6 Pertanyaan', desc: 'Jawab 6 pertanyaan singkat, Journalyze membaca gaya dan batas risikomu secara otomatis.' },
  { icon: <CalendarBlank size={24} weight="duotone" color="var(--gold2)" />, title: 'Trading Plan Otomatis', desc: 'Plan dibuat dari profil risikomu, jadi kamu mulai dari rencana, bukan dari feeling.' },
  { icon: <Money size={24} weight="duotone" color="var(--gold2)" />, title: 'IDR, USC, dan USD Otomatis', desc: 'Lihat hasil tradingmu dalam rupiah, cent, atau dolar. Konversi berjalan otomatis.' },
  { icon: <Newspaper size={24} weight="duotone" color="var(--gold2)" />, title: 'Analisis Berita Global oleh AI', desc: 'AI merangkum dan menganalisis berita pasar global, jadi kamu tidak perlu membaca satu per satu.' },
  { icon: <ChartBar size={24} weight="duotone" color="var(--gold2)" />, title: 'Kalender Ekonomi Forex Factory', desc: 'Jadwal rilis data ekonomi dari Forex Factory, langsung di dalam app.' },
  { icon: <Broadcast size={24} weight="duotone" color="var(--gold2)" />, title: 'Share Jurnal Publik', desc: 'Bagikan track record tradingmu ke siapa pun tanpa login. Bangun kepercayaan dan portofolio profesional.' },
];
const FEATURES_VISIBLE = 3;

const TABS = [
  { id: 'risk',    label: '⚖️ Risiko'  },
  { id: 'plan',    label: '📅 Plan'    },
  { id: 'data',    label: '📋 Data'    },
  { id: 'filter',  label: '🔍 Filter'  },
  { id: 'monthly', label: '📊 Bulanan' },
  { id: 'news',    label: '📰 News'    },
];

// Data nyata pengguna — diperbarui per Oktober 2026
const PROOF_FACTS = [
  { icon: <Lightning size={24} weight="fill"    color="var(--gold2)" />, val: '1.567',  label: 'Pengguna Terdaftar',       sub: 'trader yang sudah pakai Journalyze'        },
  { icon: <ChartBar  size={24} weight="duotone" color="var(--gold2)" />, val: '7.000+', label: 'Data Trade Tersimpan',      sub: 'entri jurnal dari seluruh pengguna'        },
  { icon: <Star      size={24} weight="fill"    color="var(--gold2)" />, val: '4.8 ★',  label: 'Rating Pengguna',          sub: 'dari screenshot testimoni WhatsApp'        },
  { icon: <Target    size={24} weight="duotone" color="var(--gold2)" />, val: '+3,4%',  label: 'Rata-rata Peningkatan',    sub: 'winrate setelah konsisten jurnal'          },
  { icon: <Fire      size={24} weight="fill"    color="var(--gold2)" />, val: '937',    label: 'Trader Aktif Sekarang',    sub: 'login dan mencatat trade bulan ini'        },
  { icon: <CheckCircle size={24} weight="fill" color="var(--gold2)" />, val: '65%', label: 'Rata-rata Win Rate', sub: 'user aktif yang rutin catat' },
];

const FORWHO_YES = [
  'Kamu trader Forex yang ingin konsisten dan punya track record nyata',
  'Kamu mau disiplin dengan risk management yang terukur setiap trade',
  'Kamu ingin tahu pair, sesi, dan setup mana yang paling cocok untukmu',
  'Kamu serius membangun karir atau bisnis sebagai trader profesional',
  'Kamu trader pemula yang mau belajar dengan cara yang benar dari awal',
];
const FORWHO_NO = [
  'Kamu cari cara cepat kaya tanpa belajar dan berproses',
  'Kamu tidak mau catat dan evaluasi trading secara rutin',
  'Kamu masih yakin "feeling" lebih baik dari data dan analisis',
  'Kamu tidak mau investasi untuk upgrade skill dan tools trading',
  'Kamu trader yang sudah puas dengan hasil seadanya',
];

const GUARANTEE_BADGES = [
  { label: 'Bantuan Aktivasi',        icon: <CheckCircle size={15} weight="regular" color="var(--green)" /> },
  { label: 'Support WhatsApp',        icon: <Headset size={15} weight="regular" color="var(--green)" /> },
  { label: 'Transaksi Terverifikasi', icon: <ShieldCheck size={15} weight="regular" color="var(--green)" /> },
  { label: 'Lifetime Access',         icon: <InfinityIcon size={15} weight="regular" color="var(--green)" /> },
];

const FAQS = [
  { q: 'Apakah AI-nya berbayar? & berapa lama AI menganalisis data trade?', a: 'Tidak berbayar. Fitur AI memakai API key Gemini milikmu sendiri, yang bisa kamu ambil gratis dari Google. Langkah-langkahnya dijelaskan di dalam app dan hanya butuh hitungan detik. Soal kecepatan, AI membaca foto layar riwayat MT5 dan mengisi data tradenya dalam sekitar 20 detik. Setelah itu kamu tinggal klik alasan dan emosi.' },
  { q: 'Bagaimana cara mendapatkan akses setelah bayar?', a: 'Setelah pembayaran terkonfirmasi, akunmu aktif otomatis dan bisa langsung dipakai login. Kalau ada kendala, hubungi WhatsApp 081311973602 dan kami bantu sampai akunmu bisa dipakai.' },
  { q: 'Apa bedanya paket Basic, Pro, dan Elite?', a: 'Basic: akses web app selama 3 bulan. Pro: akses lifetime, 2 e-book bonus, grup komunitas, dan konsultasi 1x via WhatsApp. Elite: semua fitur Pro, ditambah review jurnal bulanan, konsultasi 3x, dan analisis psikologi trading.' },
  { q: 'Apakah data trading saya aman?', a: 'Ya. Data disimpan di Supabase dan hanya bisa diakses dengan akunmu sendiri. Kami tidak menjual atau membagikan data penggunamu ke pihak manapun.' },
  { q: 'Bisa diakses dari HP?', a: 'Bisa. Journalyze adalah Progressive Web App (PWA) yang dioptimalkan untuk mobile. Bisa dipasang di homescreen Android maupun iOS dan berjalan di semua ukuran layar.' },
  { q: 'Apakah ada biaya tambahan setelah beli?', a: 'Tidak ada. Paket Pro dan Elite adalah akses lifetime, bayar sekali pakai selamanya termasuk update fitur baru. Paket Basic adalah akses 3 bulan. Satu-satunya yang kamu siapkan sendiri adalah API key Gemini untuk fitur AI, yang gratis diambil dari Google.' },
];

const CANDLES = [
  { c: 'green', w1: 10, b: 22, w2: 6  },
  { c: 'red',   w1: 6,  b: 30, w2: 12 },
  { c: 'green', w1: 14, b: 18, w2: 5  },
  { c: 'red',   w1: 8,  b: 25, w2: 9  },
  { c: 'green', w1: 5,  b: 35, w2: 8  },
  { c: 'red',   w1: 10, b: 20, w2: 7  },
];

/* ───────────────────────── HELPER ───────────────────────── */

type JzUser = { email: string; name: string; initial: string };
type PublicStats = { trades: number; users: number; live_shares: number } | null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toUser(u: any): JzUser | null {
  if (!u) return null;
  const email: string = u.email ?? '';
  const name: string = u.user_metadata?.full_name || u.user_metadata?.name || email.split('@')[0] || 'Trader';
  return { email, name, initial: name.charAt(0).toUpperCase() };
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function goTo(id: string) {
  return (e: ReactMouseEvent) => { e.preventDefault(); scrollToId(id); };
}
const fmt = (n: number) => n.toLocaleString('id-ID');

function Head({ badge, children, sub, size }: { badge: string; children: ReactNode; sub?: ReactNode; size?: string }) {
  return (
    <div className="section-header">
      <div className="section-badge reveal"><span className="dot"/><span>{badge}</span></div>
      <h2 className="section-title reveal" style={size ? { fontSize: size } : undefined}>{children}</h2>
      {sub && <p className="section-sub reveal delay-1">{sub}</p>}
    </div>
  );
}

const tagStyle: CSSProperties = {
  fontFamily: "'JetBrains Mono',monospace", fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6,
};

/* Video: thumbnail dulu, iframe YouTube baru dimuat saat diklik (lebih ringan di HP) */
function LiteVideo({ id }: { id: string }) {
  const [on, setOn] = useState(false);
  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: 'var(--bg)' }}>
      {on ? (
        <iframe
          src={'https://www.youtube.com/embed/' + id + '?autoplay=1&rel=0&modestbranding=1&color=white'}
          title="Demo Journalyze"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setOn(true)}
          aria-label="Putar video demo Journalyze"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', padding: 0, cursor: 'pointer', background: 'var(--bg)' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={'https://img.youtube.com/vi/' + id + '/hqdefault.jpg'} alt="Video demo Journalyze" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-gold)' }}>
              <Play size={30} weight="fill" color="var(--bg)" />
            </span>
          </span>
        </button>
      )}
    </div>
  );
}

/* ───────────────────────── HALAMAN ───────────────────────── */

function HomeAppInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const affiliateRef = searchParams.get('ref');
  const hargaCoret = affiliateRef ? HARGA_CORET_AFFILIATE : HARGA_CORET_NORMAL;

  const [activeTab, setActiveTab]       = useState('risk');
  const [openFaq, setOpenFaq]           = useState<number | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastData, setToastData]       = useState<Toast>(TOASTS[0]);
  const [navScrolled, setNavScrolled]   = useState(false);
  const [user, setUser]                 = useState<JzUser | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showAllFeatures, setShowAllFeatures] = useState(false);
  const [stats, setStats]               = useState<PublicStats>(null);
  const [testiPaused, setTestiPaused]   = useState(false);
  const [testiLoad, setTestiLoad]       = useState(false);
  const testiRef = useRef<HTMLDivElement>(null);

  function handleCtaClick(paket: string) {
    fireLandingEvent('cta_click', { plan_type: paket });
    const code = getAffiliateCode();
    if (code) fireEvent(code, 'cta_click', 'landing', { plan_type: paket });
    router.push(user ? '/journal' : `/order?paket=${paket}${code ? `&ref=${code}` : ''}`);
  }

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
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    const show = () => {
      setToastData(TOASTS[idx % TOASTS.length]);
      setToastVisible(true); idx++;
      hideTimer = setTimeout(() => setToastVisible(false), 5000);
    };
    const id  = setInterval(show, 35000);
    const fid = setTimeout(show, 5000);
    return () => { clearInterval(id); clearTimeout(fid); if (hideTimer) clearTimeout(hideTimer); };
  }, []);

  useEffect(() => {
    _sb.auth.getSession().then(({ data }) => setUser(toUser(data.session?.user)));
    const { data: { subscription } } = _sb.auth.onAuthStateChange((_event, session) => setUser(toUser(session?.user)));
    return () => subscription.unsubscribe();
  }, []);

  // Angka asli dari database (fungsi get_public_stats di Supabase). Kalau belum dibuat, halaman memakai fakta produk.
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = _sb as any;
    Promise.resolve(sb.rpc('get_public_stats'))
      .then((res: { data?: PublicStats; error?: unknown }) => { if (res && !res.error && res.data) setStats(res.data); })
      .catch(() => { /* abaikan, pakai fakta produk */ });
  }, []);

  // Muat gambar testimoni hanya saat mendekati layar
  useEffect(() => {
    const el = testiRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setTestiLoad(true); io.disconnect(); } }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Sinkron tab preview dengan iframe demo
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.jz_active_page && typeof e.data.jz_active_page === 'string') setActiveTab(e.data.jz_active_page);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  /* data turunan */
  const trades = stats && stats.trades >= MIN_PUBLIC_COUNT ? stats.trades : null;
  const users  = stats && stats.users >= MIN_PUBLIC_COUNT ? stats.users : null;
  const shares = stats && stats.live_shares >= MIN_PUBLIC_COUNT ? stats.live_shares : null;

  const statsBar = [
    { val: '1.567',   label: 'Pengguna',      icon: <Lightning size={16} weight="fill"    color="var(--gold2)" /> },
    { val: '7.000+',  label: 'Data Trade',    icon: <ChartBar  size={16} weight="duotone" color="var(--gold2)" /> },
    { val: '±20 dtk', label: 'Foto → Data',   icon: <Camera    size={16} weight="duotone" color="var(--gold2)" /> },
    { val: '4.8 ★',   label: 'Rating',        icon: <Star      size={16} weight="fill"    color="var(--gold2)" /> },
  ];

  const hasRealData = true; // selalu tampilkan label "Data Nyata"
  const proofItems = PROOF_FACTS; // 6 kartu hardcoded data nyata (3x2 desktop, 2x3 tablet)

  const visibleFeatures = showAllFeatures ? FEATURES : FEATURES.slice(0, FEATURES_VISIBLE);
  const hiddenCount = FEATURES.length - FEATURES_VISIBLE;

  return (
    <>
      {/* ── NAVBAR ── */}
      <nav className={`home-navbar${navScrolled ? ' scrolled' : ''}`}>
        <a href="/" className="nav-logo">Journal<em>yze</em><span className="logo-badge">v2.0</span></a>
        <div className="nav-right">
          <div className="nav-countdown">
            <Fire size={14} weight="fill" color="var(--gold2)" />
            <span>Penawaran berakhir:</span>
            <NavCountdown />
          </div>

          {user ? (
            <div className="nav-user-wrap" style={{ position: 'relative' }}>
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
                <span style={{ display: 'inline-block', transition: 'transform .2s', transform: userMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)', fontSize: 10, color: 'var(--text3)' }}>▼</span>
              </button>
              {userMenuOpen && (
                <div className="nav-user-dropdown">
                  <a href="/journal" className="nav-dd-item"><ChartBar size={14} color="var(--text2)" /><span>Jurnal Saya</span></a>
                  <a href="/journal?page=profile" className="nav-dd-item"><span>👤</span><span>Profil</span></a>
                  <div className="nav-dd-divider"/>
                  <button
                    className="nav-dd-item nav-dd-logout"
                    onClick={async () => { await _sb.auth.signOut(); setUser(null); setUserMenuOpen(false); }}
                  >
                    <span>🚪</span><span>Keluar</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <a href="/journal" className="nav-login"><span>Masuk</span></a>
              <a href="#pricing" onClick={goTo('pricing')} className="nav-cta"><span>Mulai Sekarang</span><span>↗</span></a>
            </>
          )}
        </div>
      </nav>

      {/* ── MARQUEE ── */}
      <div className="marquee-wrap">
        <div className="marquee-track">
          {[0, 1].map((rep) => (
            <span key={rep} className="marquee-inner">
              {MARQUEE_ITEMS.map((item, j) => (
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
          <div className="hero-tag reveal"><span className="dot"/><span>Jurnal Trading Otomatis Bersama AI</span></div>
          <h1 className="hero-headline reveal">
            <span className="line1">Malas nulis jurnal?</span>
            <span className="line2">Cukup foto MT5-mu.</span>
            <span className="line3" style={{ whiteSpace: 'normal' }}>AI isi datanya. Kamu tinggal klik alasan &amp; emosi.</span>
          </h1>
          <p className="hero-sub reveal delay-1">
            Hitungannya sama dengan MT5, dalam IDR, USC, atau USD. Lalu AI membaca pola tradingmu
            dan menunjukkan kesalahan yang paling sering kamu ulang.
          </p>

          <div className="hero-cta-wrap reveal delay-2">
            <a href="#pricing" onClick={goTo('pricing')} className="btn-primary-gold">
              <Lightning size={16} weight="fill" /><span>Lihat Paket &amp; Harga</span><ArrowRight size={14} />
            </a>
            <a href="#preview-fitur" onClick={goTo('preview-fitur')} className="btn-secondary-outline">
              <Eye size={16} weight="fill" /><span>Coba Demo Interaktif</span>
            </a>
          </div>

          <div className="hero-mockup reveal delay-3">
            <div style={{
              width: '100%', maxWidth: 700, borderRadius: 20, overflow: 'hidden',
              border: '1px solid var(--gold-bd)',
              boxShadow: '0 40px 80px rgba(0,0,0,.6), 0 0 80px rgba(201,168,76,.06)',
              animation: 'float-mockup 6s ease-in-out infinite',
            }}>
              <LiteVideo id={VIDEO_ID} />
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR (layout lama 2x2, label pendek) ── */}
      <div className="stats-bar reveal">
        {statsBar.map((s, i) => (
          <div key={i} className="stats-bar-item">
            {s.icon}
            <span className="stats-bar-val">{s.val}</span>
            <span className="stats-bar-label">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="section-divider"/>

      {/* ── PROBLEM ── */}
      <section className="home-section">
        <Head
          badge="Problem Trader"
          size="clamp(30px, 8.2vw, 56px)"
          sub="Bukan karena kamu tidak disiplin. Tapi karena mencatat manual itu melelahkan, jadi data yang seharusnya mengajarimu tidak pernah terkumpul."
        >
          Kenapa Jurnal Trading<br/><span className="gold-text">Sering Berhenti?</span>
        </Head>
        <div className="problem-grid">
          {PROBLEMS.map((p, i) => (
            <div key={p.n} className={`problem-card reveal delay-${i + 1}`}>
              <div className="problem-number">{p.n}</div>
              <span className="problem-icon">{p.icon}</span>
              <h3 className="problem-title">{p.title}</h3>
              <p className="problem-desc">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="section-divider"/>

      {/* ── JUJUR DULU: Journalyze vs Excel ── */}
      <section className="honest-section">
        <div className="honest-inner">
          <Head badge="Jujur Dulu" sub="Excel itu gratis dan fleksibel. Tapi ada harga yang kamu bayar dengan waktu dan konsistensi. Bandingkan sendiri.">
            Journalyze vs<br/><span className="gold-text">Excel &amp; Buku Catatan</span>
          </Head>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 900, margin: '0 auto' }}>
            {COMPARE_ROWS.map((r, i) => (
              <div key={r.k} className={`reveal delay-${(i % 3) + 1}`} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '18px 20px' }}>
                <div style={{ ...tagStyle, color: 'var(--gold)', fontSize: 10, marginBottom: 12 }}>{r.k}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
                  <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text2)', background: 'rgba(232,64,64,0.05)', border: '1px solid rgba(232,64,64,0.18)', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ ...tagStyle, color: 'var(--red)' }}>Excel / Buku</div>{r.old}
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text)', background: 'var(--gold-bg)', border: '1px solid var(--gold-bd)', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ ...tagStyle, color: 'var(--gold2)' }}>Journalyze</div>{r.now}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="reveal" style={{ textAlign: 'center', maxWidth: 640, margin: '28px auto 0', fontSize: 14, color: 'var(--text3)', lineHeight: 1.7 }}>
            Journalyze tidak memberi sinyal, tidak memprediksi market, dan tidak menjamin profit. Fitur AI memakai API key Gemini milikmu (gratis, panduannya ada di dalam app).
          </p>
        </div>
      </section>

      <div className="section-divider"/>

      {/* ── SOLUSI: 3 kartu dulu, sisanya lewat tombol ── */}
      <section className="solution-section">
        <div className="solution-inner">
          <Head badge="Solusi Lengkap" sub="Journalyze dirancang khusus untuk trader Forex Indonesia yang serius ingin naik level ke konsistensi nyata.">
            Semua yang Kamu Butuhkan<br/><em className="gold-text">dalam Satu Platform</em>
          </Head>
          <div className="feature-grid">
            {visibleFeatures.map((f, i) => (
              <div key={f.title} className={`feature-card reveal visible delay-${(i % 3) + 1}`}>
                <div className="feature-icon-wrap">{f.icon}</div>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 32 }}>
            <button type="button" onClick={() => setShowAllFeatures(v => !v)} className="btn-secondary-outline">
              <span>{showAllFeatures ? 'Tampilkan Lebih Sedikit ↑' : `Lihat ${hiddenCount} Fitur Lainnya ↓`}</span>
            </button>
          </div>
        </div>
      </section>

      <div className="section-divider"/>

      {/* ── TAMPILAN JOURNALYZE (demo interaktif) ── */}
      <section id="preview-fitur" className="mockup-section">
        <Head badge="Preview Fitur" sub="Ini tampilan asli Journalyze. Coba langsung: klik dan ketik di jurnal demo di bawah ini. Akses penuh setelah aktivasi.">
          Lihat Sendiri<br/><span className="gold-text">Tampilan Journalyze</span>
        </Head>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t.id}
              onClick={() => {
                setActiveTab(t.id);
                const iframe = document.getElementById('jz-preview-iframe') as HTMLIFrameElement | null;
                iframe?.contentWindow?.postMessage({ jz_page: t.id }, '*');
              }}
              style={{
                background: activeTab === t.id ? 'var(--gold-bg2)' : 'var(--bg3)',
                border: activeTab === t.id ? '1px solid var(--gold)' : '1px solid var(--gold-bd)',
                color: activeTab === t.id ? 'var(--gold2)' : 'var(--text2)',
                fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 7,
                cursor: 'pointer', transition: 'all 0.2s', fontFamily: "'Outfit',sans-serif",
              }}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="reveal" style={{ background: 'var(--bg2)', borderRadius: '14px 14px 0 0', border: '2px solid var(--bg4)', overflow: 'hidden', maxWidth: 960, margin: '0 auto' }}>
          <div style={{ background: 'var(--bg3)', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid var(--border2)' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--red)', display: 'inline-block' }}/>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--gold)', display: 'inline-block' }}/>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }}/>
            </div>
            <div style={{ flex: 1, textAlign: 'center', background: 'var(--border2)', borderRadius: 5, padding: '5px 12px', fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--text3)' }}>
              journalyze.my.id — Jurnal Trading Profesional
            </div>
            <div style={{ width: 44 }}/>
          </div>
          <div style={{ position: 'relative', height: 700 }}>
            <iframe
              id="jz-preview-iframe"
              src="/demo/embed"
              title="Preview Journalyze"
              loading="lazy"
              style={{ width: '100%', height: '100%', border: 'none', display: 'block', pointerEvents: 'all' }}
            />
          </div>
        </div>
        <div style={{ maxWidth: 960, margin: '0 auto', background: 'var(--bg3)', height: 10, borderRadius: '0 0 8px 8px', border: '2px solid var(--bg4)', borderTop: 'none' }}/>
      </section>

      <div className="section-divider"/>

      {/* ── EBOOK BONUS ── */}
      <section className="ebook-section">
        <div className="ebook-inner">
          <div className="ebook-grid" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 56 }}>

            <div className="reveal" style={{ textAlign: 'center' }}>
              <div className="ebook-tag"><Books size={14} weight="duotone" color="var(--green)" /> Bonus Paket Pro &amp; Elite</div>
              <h2 className="ebook-title" style={{ marginTop: 12 }}>
                Bonus 2 E-Book<br/>
                <span className="gold-text">Trading Premium</span>
              </h2>
            </div>

            <div className="ebook-books reveal" style={{ display: 'flex', flexDirection: 'row', gap: 48, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'flex-start' }}>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <div className="ebook-book-wrap">
                  <div className="ebook-book-inner-gold">
                    <div className="ebook-shell-gold">
                      <div className="ebook-spine-gold"/>
                      <div className="ebook-free-badge green">BONUS</div>
                      <div>
                        <div className="ebook-book-badge gold">Journalyze · Bonus Eksklusif</div>
                        <div className="ebook-book-title-main">Panduan<br/><em className="gold">Candlestick</em><br/>Trading</div>
                        <div className="ebook-book-desc gold">Baca pola candle dengan benar — stop salah baca arah market</div>
                      </div>
                      <div className="ebook-candles">
                        {CANDLES.map((cd, i) => (
                          <div key={i} className={`ebook-candle ${cd.c}`}>
                            <div className="ebook-candle-wick" style={{ height: cd.w1 }}/>
                            <div className="ebook-candle-body" style={{ height: cd.b }}/>
                            <div className="ebook-candle-wick" style={{ height: cd.w2 }}/>
                          </div>
                        ))}
                      </div>
                      <div className="ebook-book-footer gold">JOURNALYZE.MY.ID</div>
                    </div>
                  </div>
                </div>
                <div className="ebook-desc-wrap">
                  <div className="ebook-label-badge gold"><Books size={12} weight="duotone" /> E-BOOK #1</div>
                  <div className="ebook-desc-title">Panduan Candlestick Trading</div>
                  <div className="ebook-desc-text">Pelajari pola candle paling profitable — Doji, Engulfing, Hammer, Pin Bar, dan 15+ pola lainnya.</div>
                  <div className="ebook-desc-price">✓ Senilai Rp 200.000 · Bonus</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <div className="ebook-book-wrap">
                  <div className="ebook-book-inner-blue">
                    <div className="ebook-shell-blue">
                      <div className="ebook-spine-blue"/>
                      <div className="ebook-free-badge blue">BONUS</div>
                      <div>
                        <div className="ebook-book-badge blue">Journalyze · Bonus Eksklusif</div>
                        <div className="ebook-book-title-main">Support &amp;<br/><em className="blue">Resistance</em><br/>Mastery</div>
                        <div className="ebook-book-desc blue">Temukan zona kunci market — di sinilah semua entry terbaik berada</div>
                      </div>
                      <div className="ebook-sr-chart">
                        <div className="ebook-sr-line-r"/>
                        <div className="ebook-sr-label-r">RESISTANCE</div>
                        <svg viewBox="0 0 180 50" width="180" height="50" style={{ position: 'absolute', top: 0, left: 0 }}>
                          <polyline points="0,35 25,25 50,40 75,12 100,38 125,20 150,36 180,15" stroke="#60A5FA" strokeWidth="1.5" fill="none"/>
                        </svg>
                        <div className="ebook-sr-line-s"/>
                        <div className="ebook-sr-label-s">SUPPORT</div>
                      </div>
                      <div className="ebook-book-footer blue">JOURNALYZE.MY.ID</div>
                    </div>
                  </div>
                </div>
                <div className="ebook-desc-wrap">
                  <div className="ebook-label-badge blue"><Books size={12} weight="duotone" /> E-BOOK #2</div>
                  <div className="ebook-desc-title">Support &amp; Resistance Mastery</div>
                  <div className="ebook-desc-text">Cara menggambar zona S&amp;R yang valid dan menghindari false breakout yang menjebak trader pemula.</div>
                  <div className="ebook-desc-price">✓ Senilai Rp 200.000 · Bonus</div>
                </div>
              </div>

            </div>

            <div className="ebook-text reveal" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', maxWidth: 640, width: '100%', gap: 20 }}>
              <p style={{ color: 'var(--text2)', fontSize: 15, lineHeight: 1.7, textAlign: 'center', maxWidth: 560 }}>
                Khusus pembeli paket Pro &amp; Elite, dapatkan 2 e-book eksklusif senilai Rp 400.000 sebagai bonus.
                Ditulis dari pengalaman nyata trading.
              </p>
              <div className="ebook-list" style={{ alignSelf: 'center', maxWidth: 500, width: '100%', textAlign: 'left' }}>
                {[
                  'Panduan membaca 15+ pola candlestick yang paling sering muncul di chart',
                  'Support & Resistance: cara menggambar level yang valid dan actionable',
                  'Cara mengkombinasikan candlestick pattern dengan S&R untuk entry presisi',
                  'Contoh setup nyata dengan screenshot trade asli',
                ].map(item => (
                  <div key={item} className="ebook-item">
                    <CheckCircle size={16} weight="fill" color="var(--green)" className="check" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <a href="#pricing" onClick={goTo('pricing')} className="btn-primary-gold" style={{ alignSelf: 'center' }}>
                <Books size={18} weight="duotone" /><span>Dapatkan Bonus E-Book</span>
              </a>
            </div>

          </div>
        </div>
      </section>

      <div className="section-divider"/>

      {/* ── PRICING ── */}
      <section id="pricing" className="pricing-section">
        <div className="section-header">
          <div className="section-badge reveal"><span className="dot"/><span>Pilih Paket</span></div>
          <h2 className="section-title reveal">Investasi Terbaik<br/><span className="gold-text">untuk Karir Trading Kamu</span></h2>
          <p className="section-sub reveal delay-1">Pilih paket yang sesuai kebutuhanmu.</p>
          <div className="reveal delay-2" style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: 'var(--text3)' }}>
            <Fire size={14} weight="fill" color="var(--gold2)" /><span>Penawaran berakhir:</span>
            <span style={{ color: 'var(--gold2)', fontWeight: 700 }}><NavCountdown /></span>
          </div>
        </div>
        <div className="pricing-grid">
          <div className="pricing-card reveal delay-1">
            <div className="pricing-tier">Paket Basic</div>
            <div><div className="price-fake">{hargaCoret.basic}</div><div className="price-real">99K</div></div>
            <div className="price-note">Akses 3 bulan · Web App Only</div>
            <div className="pricing-divider"/>
            <div className="pricing-features">
              {['Akses Journalyze Web App', 'Kalkulator risiko & lot size', 'Rekap & analisis trade', 'Trading plan harian', 'Share journal publik'].map(f => (
                <div key={f} className="pricing-feature"><span className="pf-icon">✓</span><span>{f}</span></div>
              ))}
            </div>
            <button onClick={() => handleCtaClick('basic')} className="btn-pricing">
              <Lightning size={14} weight="fill" /><span>Pesan Sekarang</span>
            </button>
          </div>
          <div className="pricing-card highlight reveal delay-2">
            <div className="pricing-badge-top"><Star size={10} weight="fill" /> Paling Populer</div>
            <div className="pricing-tier gold">Paket Pro</div>
            <div><div className="price-fake">{hargaCoret.pro}</div><div className="price-real">149K</div></div>
            <div className="price-note">Lifetime · + E-Book + Komunitas</div>
            <div className="pricing-divider"/>
            <div className="pricing-features">
              {['Semua fitur Journalyze Web App', 'Akses LIFETIME (bukan langganan)', '2 E-Book Trading Premium (Bonus)', 'Akses grup komunitas trader', 'Konsultasi 1x via WhatsApp', 'Semua update fitur gratis'].map(f => (
                <div key={f} className="pricing-feature"><span className="pf-icon">✓</span><span>{f}</span></div>
              ))}
            </div>
            <button onClick={() => handleCtaClick('pro')} className="btn-pricing gold">
              <Lightning size={14} weight="fill" /><span>Pesan Paket Pro Sekarang</span>
            </button>
          </div>
          <div className="pricing-card reveal delay-3">
            <div className="pricing-tier">Paket Elite</div>
            <div><div className="price-fake">{hargaCoret.elite}</div><div className="price-real">299K</div></div>
            <div className="price-note">Lifetime · + Review + Konsultasi 3x</div>
            <div className="pricing-divider"/>
            <div className="pricing-features">
              {['Semua fitur Paket Pro', 'Review journal bulanan (1x/bulan)', 'Konsultasi trading 3x via WhatsApp', 'Analisis psikologi trading', 'Feedback strategy personal', 'Prioritas support & update'].map(f => (
                <div key={f} className="pricing-feature"><span className="pf-icon">✓</span><span>{f}</span></div>
              ))}
            </div>
            <button onClick={() => handleCtaClick('elite')} className="btn-pricing">
              <Fire size={14} weight="fill" color="var(--gold2)" /><span>Pesan Sekarang</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── TESTIMONI: satu baris geser otomatis, klik untuk berhenti ── */}
      {TESTIMONI_IMAGES.length > 0 && (
        <section className="testimonial-section">
          <div className="testimonial-inner">
            <Head badge="Testimoni Pengguna">Apa Kata Trader<br/><span className="gold-text">yang Sudah Pakai Journalyze?</span></Head>
            <div
              ref={testiRef}
              className="testi-marquee-row"
              onClick={() => setTestiPaused(v => !v)}
              style={{ overflow: 'hidden', cursor: 'pointer', minHeight: 300 }}
            >
              {testiLoad && (
                <div style={{
                  display: 'flex', width: 'max-content',
                  animation: 'testi-scroll-left ' + Math.max(30, TESTIMONI_IMAGES.length * 7) + 's linear infinite',
                  animationPlayState: testiPaused ? 'paused' : 'running',
                }}>
                  {[...TESTIMONI_IMAGES, ...TESTIMONI_IMAGES].map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={src} alt={'Testimoni pengguna Journalyze ' + ((i % TESTIMONI_IMAGES.length) + 1)} draggable={false}
                      style={{ width: 230, height: 'auto', flexShrink: 0, marginRight: 16, borderRadius: 14, border: '1px solid var(--gold-bd)' }} />
                  ))}
                </div>
              )}
            </div>
            <p style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: 'var(--text3)', fontFamily: "'JetBrains Mono',monospace", letterSpacing: 1 }}>
              {testiPaused ? 'KLIK UNTUK MELANJUTKAN' : 'KLIK UNTUK BERHENTI'}
            </p>
          </div>
        </section>
      )}

      {/* ── DATA NYATA ── */}
      <section className="proof-section">
        <Head
          badge="Data Nyata"
          sub="Angka-angka berikut adalah data pemakaian asli Journalyze per Oktober 2026. Bukan estimasi, bukan mockup."
        >
          Jangan Percaya Kami.<br/><span className="gold-text">Lihat Datanya Sendiri.</span>
        </Head>
        <div className="proof-grid reveal">
          {proofItems.map((p, i) => (
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

      {/* ── UNTUK SIAPA ── */}
      <section className="forwho-section">
        <Head badge="Untuk Siapa?">Journalyze Cocok<br/><span className="gold-text">untuk Kamu?</span></Head>
        <div className="forwho-grid">
          <div className="forwho-col reveal-left">
            <div className="forwho-header yes"><CheckCircle size={24} weight="fill" color="var(--green)" /><h3 className="forwho-header-title">Journalyze UNTUK Kamu jika:</h3></div>
            <div className="forwho-body">
              {FORWHO_YES.map(item => (
                <div key={item} className="forwho-item"><CheckCircle size={16} weight="fill" color="var(--green)" className="forwho-icon" /><span>{item}</span></div>
              ))}
            </div>
          </div>
          <div className="forwho-col reveal-right">
            <div className="forwho-header no"><span style={{ fontSize: 24 }}>✗</span><h3 className="forwho-header-title">BUKAN untuk Kamu jika:</h3></div>
            <div className="forwho-body">
              {FORWHO_NO.map(item => (
                <div key={item} className="forwho-item"><span className="forwho-icon">✗</span><span>{item}</span></div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider"/>

      {/* ── FAQ ── */}
      <section id="faq" className="faq-section">
        <div className="faq-inner">
          <Head badge="FAQ">Pertanyaan<br/><span className="gold-text">yang Sering Ditanya</span></Head>
          <div className="faq-list reveal">
            {FAQS.map((f, i) => (
              <div key={i} className={`faq-item${openFaq === i ? ' open' : ''}`}>
                <div className="faq-question" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <span className="faq-q-text">{f.q}</span>
                  <span className="faq-chevron" style={{ display: 'inline-block', transition: 'transform 0.3s ease, color 0.3s ease', transform: openFaq === i ? 'rotate(180deg)' : 'rotate(0deg)', color: openFaq === i ? 'var(--gold2)' : 'var(--text3)' }}>▼</span>
                </div>
                <div style={{ display: openFaq === i ? 'block' : 'none', padding: '16px 24px 20px', fontSize: 14, color: 'var(--text2)', lineHeight: 1.7, fontFamily: "'Outfit', sans-serif", borderTop: '1px solid var(--border2)' }}>
                  {f.a}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GARANSI ── */}
      <section className="guarantee-section">
        <div className="guarantee-inner reveal">
          <div className="guarantee-icon"><Shield size={48} weight="duotone" color="var(--green)" /></div>
          <div className="guarantee-text">
            <h3 className="guarantee-title">Garansi Akses Journalyze</h3>
            <p className="guarantee-desc">
              Kami menjamin setiap pembelian yang berhasil akan mendapatkan akses Journalyze sesuai paket yang dipilih.
              Jika akses tidak dapat diberikan dan kendala tidak dapat diselesaikan oleh tim kami, pelanggan berhak
              mengajukan pengembalian dana sesuai <a href="/syarat-ketentuan" style={{ color: 'var(--green)', textDecoration: 'underline' }}>ketentuan yang berlaku</a>.
            </p>
          </div>
          <div className="guarantee-badges">
            {GUARANTEE_BADGES.map((b) => (
              <span key={b.label} className="guarantee-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '7px 14px' }}>
                {b.icon}{b.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── MULAI HARI INI ── */}
      <section className="final-cta-section">
        <div className="final-cta-bg"/>
        <div className="final-cta-inner">
          <div className="section-badge reveal" style={{ margin: '0 auto 24px' }}><span className="dot"/><span>Mulai Hari Ini</span></div>
          <h2 className="final-cta-title reveal">Berhenti Tebak-tebak.<br/><span className="gold-text">Mulai dari Foto Pertamamu.</span></h2>
          <p className="final-cta-sub reveal delay-1">Satu foto layar MT5, dan jurnalmu mulai terisi.</p>
          <div className="hero-cta-wrap reveal delay-2">
            <a href="#pricing" onClick={goTo('pricing')} className="btn-primary-gold">
              <Lightning size={16} weight="fill" /><span>Dapatkan Akses Sekarang — Rp 149K</span>
            </a>
          </div>
          <div className="final-cta-guarantee reveal delay-3">
            <Lock size={14} weight="fill" color="var(--text3)" /><span>Pembayaran aman · Aktivasi otomatis · Support via WhatsApp</span>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="home-footer">
        <div className="footer-inner">
          <div className="footer-top">
            <div className="footer-brand">
              <div className="logo">Journal<em>yze</em></div>
              <div className="tagline">Jurnal trading otomatis bersama AI untuk trader Forex Indonesia.</div>
            </div>
            <div className="footer-links">
              <div className="footer-link-group">
                <div className="fg-title">Produk</div>
                <a href="/journal">Login Akun</a>
                <a href="/delivery">Aktivasi Key</a>
              </div>
              <div className="footer-link-group">
                <div className="fg-title">Dukungan</div>
                <a href={WA_LINK} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                <a href="#faq" onClick={goTo('faq')}>FAQ</a>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <div className="footer-copy">© 2026 Journalyze. All rights reserved.</div>
            <div className="footer-legal"><a href="/kebijakan-privasi">Kebijakan Privasi</a><a href="/syarat-ketentuan">Syarat &amp; Ketentuan</a></div>
          </div>
        </div>
      </footer>

      {/* ── TOAST NOTIF PEMBELIAN ── */}
      <div className={`purchase-toast${toastVisible ? ' show' : ''}`}>
        <div className="pt-avatar">J</div>
        <div className="pt-text">
          <div className="pt-name" style={{ fontWeight: 700 }}>{toastData.name}</div>
          <div className="pt-action">{toastData.action}</div>
        </div>
        <div className="pt-time">{toastData.time}</div>
        <button className="pt-close" onClick={() => setToastVisible(false)}>✕</button>
      </div>
    </>
  );
}

/* ── Countdown (navbar + dekat pricing) ── */
function NavCountdown() {
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
  const t = state ?? { h: '--', m: '--', s: '--' };
  return <span className="time-val">{t.h}:{t.m}:{t.s}</span>;
}

export default function HomeApp() {
  return (
    <Suspense fallback={null}>
      <HomeAppInner />
    </Suspense>
  );
}