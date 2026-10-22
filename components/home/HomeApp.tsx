'use client';

import { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { fireEvent, fireLandingEvent, getAffiliateCode } from '@/components/AffiliateTracker';
import { _sb } from '@/lib/supabaseClient';
import {
  Fire, Lightning, Trophy, ChartBar, CalendarBlank, Target,
  CheckCircle, Money, Books, Star, Lock, Shield,
  Eye, Broadcast, WarningCircle, ArrowRight, MagnifyingGlass,
} from '@phosphor-icons/react';

const WA_BASE = `https://wa.me/6281311973602`;

const HARGA_CORET_AFFILIATE = {
  basic: 'Rp 149.000',
  pro:   'Rp 248.000',
  elite: 'Rp 497.000',
};
const HARGA_CORET_NORMAL = {
  basic: 'Rp 149.000',
  pro:   'Rp 297.000',
  elite: 'Rp 497.000',
};
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
  { icon: <Lightning size={24} weight="fill" color="var(--gold2)" />, title: 'Kalkulator Risiko Real-Time',   desc: 'Hitung lotsize, pip value, dan risiko per trade secara otomatis. Input balance, risk %, S/L → hasil instan.' },
  { icon: <CalendarBlank size={24} weight="duotone" color="var(--gold2)" />, title: 'Trading Plan Terstruktur', desc: 'Catat plan sebelum entry: pair, bias, entry level, target, alasan. Disiplin mulai dari perencanaan.' },
  { icon: <ChartBar size={24} weight="duotone" color="var(--gold2)" />, title: 'Rekap Trade Lengkap', desc: 'Log setiap trade dengan detail: tanggal, pair, RR, profit/loss. Semua tersimpan aman di cloud.' },
  { icon: <MagnifyingGlass size={24} weight="duotone" color="var(--gold2)" />, title: 'Filter & Analisis Mendalam', desc: 'Filter trade per pair, per waktu, per sesi. Temukan pola: jam terbaik, pair paling profitable.' },
  { icon: <CalendarBlank size={24} weight="duotone" color="var(--gold2)" />, title: 'Ringkasan Bulanan & Mingguan', desc: 'Dashboard performa otomatis per bulan. Win rate, average RR, drawdown — semua terhitung.' },
  { icon: <Broadcast size={24} weight="duotone" color="var(--gold2)" />, title: 'Share Journal Publik', desc: 'Bagikan track record trading kamu ke siapapun tanpa login. Bangun kepercayaan dan portofolio profesional.' },
];

const TABS = [
  { id: 'risk',    label: '⚖️ Risiko'  },
  { id: 'plan',    label: '📅 Plan'    },
  { id: 'data',    label: '📋 Data'    },
  { id: 'filter',  label: '🔍 Filter'  },
  { id: 'monthly', label: '📊 Bulanan' },
  { id: 'news',    label: '📰 News'    },
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
  { no: 1,  tgl: '21 Apr', sesi: 'London',   pair: 'XAUUSD', pos: 'Buy',  lot: '0.05', entry: '2320.00', close: '2333.80', win:true,  pips: '+138', pl: '+Rp 90.000',   saldo: 'Rp 5.380.000', metode: 'SNR'       },
  { no: 2,  tgl: '17 Apr', sesi: 'New York', pair: 'XAUUSD', pos: 'Buy',  lot: '0.05', entry: '2308.50', close: '2304.30', win:false, pips: '-42',  pl: '-Rp 27.300',   saldo: 'Rp 5.290.000', metode: 'SNR'       },
  { no: 3,  tgl: '15 Apr', sesi: 'London',   pair: 'XAUUSD', pos: 'Sell', lot: '0.07', entry: '2330.00', close: '2316.00', win:true,  pips: '+140', pl: '+Rp 127.400',  saldo: 'Rp 5.317.000', metode: 'Trendline' },
  { no: 4,  tgl: '14 Apr', sesi: 'Asia',     pair: 'XAUUSD', pos: 'Buy',  lot: '0.04', entry: '2318.20', close: '2320.10', win:true,  pips: '+19',  pl: '+Rp 12.380',   saldo: 'Rp 5.190.000', metode: 'Scalping'  },
  { no: 5,  tgl: '10 Apr', sesi: 'London',   pair: 'XAUUSD', pos: 'Buy',  lot: '0.05', entry: '2300.50', close: '2315.00', win:true,  pips: '+145', pl: '+Rp 94.250',   saldo: 'Rp 5.178.000', metode: 'SNR'       },
];

// ── Helper: scroll ke section pricing ──
function scrollToPricing(e: React.MouseEvent) {
  e.preventDefault();
  const el = document.getElementById('pricing');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function HomeAppInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const affiliateRef = searchParams.get('ref');
  const hargaCoret = affiliateRef ? HARGA_CORET_AFFILIATE : HARGA_CORET_NORMAL;

  function handleCtaClick(paket: string) {
    fireLandingEvent('cta_click', { plan_type: paket });
    const code = getAffiliateCode();
    if (code) {
      fireEvent(code, 'cta_click', 'landing', { plan_type: paket });
    }
    const dest = user ? '/journal' : `/order?paket=${paket}${code ? `&ref=${code}` : ''}`;
    router.push(dest);
  }
  const [activeTab, setActiveTab]       = useState('risk');
  const [sliderIdx, setSliderIdx]       = useState(0);
  const [openFaq, setOpenFaq]           = useState<number | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastData, setToastData]       = useState(TOASTS[0]);
  const [navScrolled, setNavScrolled]   = useState(false);
  const [user, setUser]                 = useState<{ email: string; name: string; initial: string } | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  const autoSlideRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
    _sb.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      if (!u) return;
      const email = u.email ?? '';
      const name  = u.user_metadata?.full_name || u.user_metadata?.name || email.split('@')[0] || 'Trader';
      const initial = name.charAt(0).toUpperCase();
      setUser({ email, name, initial });
    });
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

  // ── Listen postMessage dari iframe → sync activeTab di landing page ──
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.jz_active_page && typeof e.data.jz_active_page === 'string') {
        setActiveTab(e.data.jz_active_page);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // ── [REVISI #4] Auto-slide testimoni setiap 4 detik ──
  const slideTo = useCallback((i: number) => {
    const c = Math.max(0, Math.min(i, maxIdx));
    setSliderIdx(c);
    if (sliderRef.current) sliderRef.current.style.transform = `translateX(-${c * 320}px)`;
  }, [maxIdx]);

  useEffect(() => {
    autoSlideRef.current = setInterval(() => {
      setSliderIdx(prev => {
        const next = prev >= maxIdx ? 0 : prev + 1;
        if (sliderRef.current) sliderRef.current.style.transform = `translateX(-${next * 320}px)`;
        return next;
      });
    }, 4000);
    return () => { if (autoSlideRef.current) clearInterval(autoSlideRef.current); };
  }, [maxIdx]);

  // Pause auto-slide saat user klik manual
  const handleManualSlide = (i: number) => {
    if (autoSlideRef.current) clearInterval(autoSlideRef.current);
    slideTo(i);
    // Resume setelah 8 detik idle
    autoSlideRef.current = setInterval(() => {
      setSliderIdx(prev => {
        const next = prev >= maxIdx ? 0 : prev + 1;
        if (sliderRef.current) sliderRef.current.style.transform = `translateX(-${next * 320}px)`;
        return next;
      });
    }, 4000);
  };

  const bars = [20,45,30,65,50,80,35,90,60,75,40,55,70,85,45,60,30,72,88,50];

  const ctaOrder = (paket: string) => user ? '/journal' : `/order?paket=${paket}`;

  return (
    <>
      {/* ── NAVBAR ── */}
      <nav className={`home-navbar${navScrolled ? ' scrolled' : ''}`}>
        <a href="/home" className="nav-logo">Journal<em>yze</em><span className="logo-badge">v2.0</span></a>
        <div className="nav-right">
          <div className="nav-countdown">
            <Fire size={14} weight="fill" color="var(--gold2)" />
            <span>Penawaran berakhir:</span>
            <NavCountdown />
          </div>

          {user ? (
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
                    <ChartBar size={14} color="var(--text2)" /><span>Jurnal Saya</span>
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
            <>
              <a href="/journal" className="nav-login">
                <span>Masuk</span>
              </a>
              {/* [REVISI #2] Tombol navbar → scroll ke pricing */}
              <a href="#pricing" onClick={scrollToPricing} className="nav-cta">
                <span>Mulai Sekarang</span><span>↗</span>
              </a>
            </>
          )}
        </div>
      </nav>

      {/* ── MARQUEE — social proof ── */}
      <div className="marquee-wrap">
        <div className="marquee-track">
          {[...Array(2)].map((_, rep) => (
            <span key={rep} className="marquee-inner">
              {['Budi S. baru join ⚡','Rahmad F. catat 12 trade hari ini 📊','Dewi A. win rate naik ke 72% 🏆','Andi P. profitbulan ini +Rp 1.2jt 💰','Siti R. share journal ke klien 📡','Hendra K. baru join ⚡','Yoga P. catat 8 trade hari ini 📊','Lina M. win rate 65% bulan ini 🎯','Fajar R. baru aktivasi Elite 🔥','Nadia S. share journal publik 📡'].map((item, j) => (
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

          <div className="hero-cta-wrap reveal delay-2">
            <a href="#preview-fitur" onClick={(e)=>{e.preventDefault();document.getElementById('preview-fitur')?.scrollIntoView({behavior:'smooth'})}} className="btn-primary-gold">
              <Eye size={16} weight="fill" /><span>Lihat Fitur Lengkapnya ↓</span>
            </a>
            <a href="#pricing" onClick={scrollToPricing} className="btn-secondary-outline">
              <span>Gabung Sekarang</span><ArrowRight size={14} />
            </a>
          </div>

          {/* [REVISI #1] Ganti mockup dashboard → YouTube embed */}
          <div className="hero-mockup reveal delay-3">
            <div style={{
              width: '100%',
              maxWidth: 700,
              borderRadius: 20,
              overflow: 'hidden',
              border: '1px solid var(--gold-bd)',
              boxShadow: '0 40px 80px rgba(0,0,0,.6), 0 0 80px rgba(201,168,76,.06)',
              animation: 'float-mockup 6s ease-in-out infinite',
              background: '#000',
              aspectRatio: '16/9',
              position: 'relative',
            }}>
              <iframe
                src="https://www.youtube.com/embed/ZFCCENQV4hw?rel=0&modestbranding=1&color=white"
                title="Demo Journalyze"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  display: 'block',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <div className="stats-bar reveal">
        {[
          { val: '2.400+', label: 'Trade Tercatat',  icon: <ChartBar size={16} weight="duotone" color="var(--gold2)" /> },
          { val: '68%',    label: 'Avg Win Rate',    icon: <Trophy size={16} weight="duotone" color="var(--gold2)" /> },
          { val: '340+',   label: 'Trader Aktif',    icon: <Lightning size={16} weight="fill" color="var(--gold2)" /> },
          { val: '4.9',    label: 'Rating Pengguna', icon: <Star size={16} weight="fill" color="var(--gold2)" /> },
        ].map((s, i) => (
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
        <div className="section-header">
          <div className="section-badge reveal"><span className="dot"/><span>Problem Trader</span></div>
          <h2 className="section-title reveal">Kenapa 95% Trader Retail<br/><span className="gold-text">Gagal Konsisten?</span></h2>
          <p className="section-sub reveal delay-1">Bukan karena strategi yang salah. Tapi karena mereka tidak pernah mencatat,menganalisis, dan belajar dari kesalahan yang sama.</p>
        </div>
        <div className="problem-grid">
          {[
            { n:'01', icon: <WarningCircle size={36} weight="duotone" color="var(--red)" />, title:'Trading Tanpa Catatan', desc:'Kamu mengulangi kesalahan yang sama berulang kali tanpa sadar. Tanpa data, tidak ada yang bisa diperbaiki.' },
            { n:'02', icon: <Target size={36} weight="duotone" color="var(--red)" />,        title:'Risiko Asal-asalan',   desc:'Entry dengan lot sembarangan karena tidak ada kalkulator risiko. Satu trade buruk bisa habiskan seminggu profit.' },
            { n:'03', icon: <Eye size={36} weight="duotone" color="var(--red)" />,           title:'Tidak Tahu Kekuatan Sendiri', desc:'Tidak tahu pair mana yang paling profitable, jam berapa win rate paling tinggi, atau setup mana yang paling konsisten.'},
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

      {/* ── JUJUR DULU ── */}
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
              <div className="honest-icon"><CheckCircle size={28} weight="fill" color="var(--green)" /></div>
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
              <div className="honest-icon" style={{color:'var(--red)'}}>✗</div>
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

      {/* ── PREVIEW FITUR ── */}
      <section id="preview-fitur" className="mockup-section">
        <div className="section-header">
          <div className="section-badge reveal"><span className="dot"/><span>Preview Fitur</span></div>
          <h2 className="section-title reveal">Lihat Sendiri<br/><span className="gold-text">Tampilan Journalyze</span></h2>
          <p className="section-sub reveal delay-1">Preview langsung tampilan asli Journalyze. Akses penuh setelah aktivasi.</p>
        </div>

        <div style={{display:'flex',justifyContent:'center',gap:8,marginBottom:16,flexWrap:'wrap'}}>
          {TABS.map(t=>(
            <button key={t.id}
              onClick={()=>{
                setActiveTab(t.id);
                const iframe = document.getElementById('jz-preview-iframe') as HTMLIFrameElement | null;
                iframe?.contentWindow?.postMessage({ jz_page: t.id }, '*');
              }}
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

        <div className="reveal" style={{background:'#111',borderRadius:'14px 14px 0 0',border:'2px solid #1e1e1e',overflow:'hidden',maxWidth:960,margin:'0 auto'}}>
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

          <div style={{position:'relative', height:700}}>
            <iframe
              id="jz-preview-iframe"
              src="/demo/embed"
              title="Preview Journalyze"
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                display: 'block',
                pointerEvents: 'all',
              }}
            />
          </div>
        </div>
        <div style={{maxWidth:960,margin:'0 auto',background:'#161616',height:10,borderRadius:'0 0 8px 8px',border:'2px solid #1e1e1e',borderTop:'none'}}/>
      </section>

      <div className="section-divider"/>

      {/* ── EBOOK ── */}
      <section className="ebook-section">
        <div className="ebook-inner">
          <div className="ebook-grid" style={{display:'flex',flexDirection:'column',alignItems:'center',gap:56}}>

            <div className="reveal" style={{textAlign:'center'}}>
              <div className="ebook-tag"><Books size={14} weight="duotone" color="var(--green)" /> Bonus Eksklusif</div>
              <h2 className="ebook-title" style={{marginTop:12}}>
                Dapat 2 E-Book<br/>
                <span className="gold-text">Trading Premium</span><br/>
                Gratis!
              </h2>
            </div>

            <div className="ebook-books reveal" style={{display:'flex',flexDirection:'row',gap:48,justifyContent:'center',flexWrap:'wrap',alignItems:'flex-start'}}>

              {/* BOOK 1 */}
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
                  <div className="ebook-label-badge gold"><Books size={12} weight="duotone" /> E-BOOK #1</div>
                  <div className="ebook-desc-title">Panduan Candlestick Trading</div>
                  <div className="ebook-desc-text">Pelajari pola candle paling profitable — Doji, Engulfing, Hammer, Pin Bar, dan 15+ pola lainnya.</div>
                  <div className="ebook-desc-price">✓ Senilai Rp 200.000 · Gratis!</div>
                </div>
              </div>

              {/* BOOK 2 */}
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
                  <div className="ebook-label-badge blue"><Books size={12} weight="duotone" /> E-BOOK #2</div>
                  <div className="ebook-desc-title">Support & Resistance Mastery</div>
                  <div className="ebook-desc-text">Cara menggambar zona S&R yang valid dan menghindari false breakout yang menjebak trader pemula.</div>
                  <div className="ebook-desc-price">✓ Senilai Rp 200.000 · Gratis!</div>
                </div>
              </div>

            </div>

            <div className="ebook-text reveal" style={{display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center',maxWidth:640,width:'100%',gap:20}}>
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
                  <div key={item} className="ebook-item">
                    <CheckCircle size={16} weight="fill" color="var(--green)" className="check" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              {/* [REVISI #3] Klaim e-book → scroll ke pricing */}
              <a href="#pricing" onClick={scrollToPricing} className="btn-primary-gold" style={{alignSelf:'center'}}>
                <Books size={18} weight="duotone" /><span>Klaim E-Book Sekarang</span>
              </a>
            </div>

          </div>
        </div>
      </section>

      <div className="section-divider"/>

      {/* ── PRICING ── */}
      {/* [REVISI #2] id="pricing" sebagai anchor target scroll */}
      <section id="pricing" className="pricing-section">
        <div className="section-header">
          <div className="section-badge reveal"><span className="dot"/><span>Pilih Paket</span></div>
          <h2 className="section-title reveal">Investasi Terbaik<br/><span className="gold-text">untuk Karir Trading Kamu</span></h2>
          <p className="section-sub reveal delay-1">Pilih paket yang sesuai kebutuhanmu.</p>
        </div>
        <div className="pricing-grid">
          <div className="pricing-card reveal delay-1">
            <div className="pricing-tier">Paket Basic</div>
            <div><div className="price-fake">{hargaCoret.basic}</div><div className="price-real">99K</div></div>
            <div className="price-note">Akses 3 bulan · Web App Only</div>
            <div className="pricing-divider"/>
            <div className="pricing-features">
              {['Akses Journalyze Web App','Kalkulator risiko & lot size','Rekap & analisis trade','Trading plan harian','Sharejournal publik'].map(f=>(
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
              {['Semua fitur Journalyze Web App','Akses LIFETIME (bukan langganan)','2 E-Book Trading Premium (Bonus)','Akses grup komunitas trader','Konsultasi 1x via WhatsApp','Semua update fitur gratis'].map(f=>(
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
              {['Semua fitur Paket Pro','Review journal bulanan (1x/bulan)','Konsultasi trading 3x via WhatsApp','Analisis psikologi trading','Feedback strategy personal','Prioritas support & update'].map(f=>(
                <div key={f} className="pricing-feature"><span className="pf-icon">✓</span><span>{f}</span></div>
              ))}
            </div>
            <button onClick={() => handleCtaClick('elite')} className="btn-pricing">
              <Fire size={14} weight="fill" color="var(--gold2)" /><span>Pesan Sekarang</span>
            </button>
          </div>
        </div>
      </section>

      <div className="section-divider"/>

      {/* ── TESTIMONIAL — auto-marquee ── */}
      <section className="testimonial-section">
        <div className="testimonial-inner">
          <div className="section-header">
            <div className="section-badge reveal"><span className="dot"/><span>Testimoni Pengguna</span></div>
            <h2 className="section-title reveal">Apa Kata Trader<br/><span className="gold-text">yang Sudah Pakai Journalyze?</span></h2>
          </div>

          {/* Row 1 — gerak ke kiri */}
          <div className="testi-marquee-row" style={{overflow:'hidden',marginBottom:16}}>
            <div style={{display:'flex',gap:16,width:'max-content',animation:'testi-scroll-left 30s linear infinite'}}>
              {[...TESTIMONIALS,...TESTIMONIALS].map((t,i)=>(
                <div key={i} className="testimonial-card" style={{minWidth:300,maxWidth:300}}>
                  <div className="testi-header">
                    <div className="testi-avatar">{t.initial}</div>
                    <div><div className="testi-name">{t.name}</div><div className="testi-role">{t.role}</div></div>
                  </div>
                  <div className="testi-stars">{Array(t.stars).fill(0).map((_,j)=><Star key={j} size={12} weight="fill" color="var(--gold2)" />)}</div>
                  <div className="testi-bubble">{t.text}<div className="testi-time">{t.time} ✓✓</div></div>
                </div>
              ))}
            </div>
          </div>

          {/* Row 2 — gerak ke kanan */}
          <div className="testi-marquee-row" style={{overflow:'hidden'}}>
            <div style={{display:'flex',gap:16,width:'max-content',animation:'testi-scroll-right 35s linear infinite'}}>
              {[...[...TESTIMONIALS].reverse(),...[...TESTIMONIALS].reverse()].map((t,i)=>(
                <div key={i} className="testimonial-card" style={{minWidth:300,maxWidth:300}}>
                  <div className="testi-header">
                    <div className="testi-avatar">{t.initial}</div>
                    <div><div className="testi-name">{t.name}</div><div className="testi-role">{t.role}</div></div>
                  </div>
                  <div className="testi-stars">{Array(t.stars).fill(0).map((_,j)=><Star key={j} size={12} weight="fill" color="var(--gold2)" />)}</div>
                  <div className="testi-bubble">{t.text}<div className="testi-time">{t.time} ✓✓</div></div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* ── PROOF SECTION ── */}
      <section className="proof-section">
        <div className="section-header">
          <div className="section-badge reveal"><span className="dot"/><span>Data Nyata</span></div>
          <h2 className="section-title reveal">Jangan Percaya Kami.<br/><span className="gold-text">Lihat Datanya Sendiri.</span></h2>
          <p className="section-sub reveal delay-1">Angka ini berasal dari aktivitas trader aktif Journalyze selama 30 hari terakhir.</p>
        </div>
        <div className="proof-grid reveal">
          {[
            { icon: <ChartBar size={24} weight="duotone" color="var(--gold2)" />, val: '2.400+',   label: 'Trade Tercatat',      sub: 'di platform bulan ini' },
            { icon: <Trophy size={24} weight="duotone" color="var(--gold2)" />,   val: '68%',       label: 'Rata-rata Win Rate',       sub: 'user aktif yang rutin catat' },
            { icon: <Money size={24} weight="duotone" color="var(--gold2)" />,    val: 'Rp 1.2jt', label: 'Avg Profit Bulanan',      sub: 'trader yang pakai risk calculator' },
            { icon: <Target size={24} weight="duotone" color="var(--gold2)" />,   val: '3.2x',      label: 'Peningkatan Konsistensi',  sub: 'setelah 60 hari pakai Journalyze' },
            { icon: <Lightning size={24} weight="fill" color="var(--gold2)" />,   val: '340+',      label: 'Trader Aktif',       sub: 'login minimal 3x seminggu' },
            { icon: <Broadcast size={24} weight="duotone" color="var(--gold2)" />,val: '180+',      label: 'Journal Publik Dibagikan', sub: 'untuk bangun track record' },
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
            <div className="forwho-header yes"><CheckCircle size={24} weight="fill" color="var(--green)" /><h3 className="forwho-header-title">Journalyze UNTUK Kamu jika:</h3></div>
            <div className="forwho-body">
              {['Kamu trader Forex yang ingin konsisten dan punya track record nyata','Kamu mau disiplin dengan risk managementyang terukur setiap trade','Kamu ingin tahu pair, sesi, dan setup mana yang paling cocok untukmu','Kamu serius membangun karir atau bisnis sebagai trader profesional','Kamu trader pemula yang mau belajar dengan cara yang benar dari awal'].map(item=>(
                <div key={item} className="forwho-item"><CheckCircle size={16} weight="fill" color="var(--green)" className="forwho-icon" /><span>{item}</span></div>
              ))}
            </div>
          </div>
          <div className="forwho-col reveal-right">
            <div className="forwho-header no"><span style={{fontSize:24}}>✗</span><h3 className="forwho-header-title">BUKAN untuk Kamu jika:</h3></div>
            <div className="forwho-body">
              {['Kamu cari cara cepat kaya tanpa belajar dan berproses','Kamu tidak mau catat dan evaluasi trading secara rutin','Kamu masih yakin "feeling" lebih baik dari data dan analisis','Kamu tidak mau investasi untuk upgrade skill dan tools trading','Kamu trader yang sudah puas dengan hasil seadanya'].map(item=>(
                <div key={item} className="forwho-item"><span className="forwho-icon">✗</span><span>{item}</span></div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider"/>

      {/* ── FAQ ── */}
      <section className="faq-section">
        <div className="faq-inner">
          <div className="section-header">
            <div className="section-badge reveal"><span className="dot"/><span>FAQ</span></div>
            <h2 className="section-title reveal">Pertanyaan<br/><span className="gold-text">yang Sering Ditanya</span></h2>
          </div>
          <div className="faq-list reveal">
            {FAQS.map((f,i)=>(
              <div key={i} className={`faq-item${openFaq===i ? ' open' : ''}`}>
                <div className="faq-question" onClick={()=>setOpenFaq(openFaq===i ? null : i)}>
                  <span className="faq-q-text">{f.q}</span>
                  <span className="faq-chevron" style={{display:'inline-block',transition:'transform 0.3s ease, color 0.3s ease',transform:openFaq===i?'rotate(180deg)':'rotate(0deg)',color:openFaq===i?'var(--gold2)':'var(--text3)'}}>▼</span>
                </div>
                <div style={{display:openFaq===i?'block':'none',padding:'16px 24px 20px',fontSize:14,color:'var(--text2)',lineHeight:1.7,fontFamily:"'Outfit', sans-serif",borderTop:'1px solid rgba(255,255,255,0.05)'}}>
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
          <div className="guarantee-icon"><Shield size={48} weight="duotone" color="var(--green)" /></div>
          <div className="guarantee-text">
            <h3 className="guarantee-title">Garansi Aktivasi atau Uang Kembali</h3>
            <p className="guarantee-desc">
              Kalau akun kamu tidak aktif dalam <strong>1×24 jam</strong> setelah bukti transfer dikirim,
              kami kembalikan 100% uang kamu. Tidak ada pertanyaan, tidak ada drama.
              Kami yakin dengan produk kami — dan kamu tidak perlu menanggung risikonya sendirian.
            </p>
          </div>
          <div className="guarantee-badges">
            {['Aktivasi Cepat','Data Aman','Support WA','Lifetime Access'].map((b,i) => (
              <span key={b} className="guarantee-badge">
                {i===0 && <CheckCircle size={12} weight="fill" color="var(--green)" />}
                {i===1 && <Lock size={12} weight="fill" color="var(--green)" />}
                {i===2 && <span>💬</span>}
                {i===3 && <span>♾️</span>}
                {b}
              </span>
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
            {/* [REVISI #2] Final CTA → scroll ke pricing */}
            <a href="#pricing" onClick={scrollToPricing} className="btn-primary-gold">
              <Lightning size={16} weight="fill" /><span>Dapatkan Akses Sekarang — Rp 149K</span>
            </a>
          </div>
          <div className="final-cta-guarantee reveal delay-3">
            <Lock size={14} weight="fill" color="var(--text3)" /><span>Pembayaran aman · Aktivasi cepat · Support via WhatsApp</span>
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
                <a href="/journal">Login Akun</a>
                <a href="/delivery">Aktivasi Key</a>
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
    </>
  );
}

/* ── Sub-komponen countdown khusus navbar ── */
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