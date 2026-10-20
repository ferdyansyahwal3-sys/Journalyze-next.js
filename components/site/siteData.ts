// components/site/siteData.ts
// Satu-satunya sumber kebenaran untuk konten situs publik Journalyze.
// Komponen harus membaca dari sini — JANGAN hardcode teks di JSX.
// TODO user: isi nilai yang masih kosong (ditandai komentar TODO).

import type { ComponentType } from 'react';

// ─── IDENTITAS SITUS ────────────────────────────────────────────────────────

export const SITE = {
  name:      'Journalyze',
  tagline:   'Jurnal trading berbasis AI untuk trader Forex Indonesia.',
  url:       'journalyze.my.id',
  whatsapp:  '6281311973602',
  email:     '',        // TODO user: email kontak publik
  instagram: '',        // TODO user: username Instagram (tanpa @)
};

// ─── MEDIA ──────────────────────────────────────────────────────────────────

/** Gambar hero beranda (satin emas gelap). Isi setelah upload ke Cloudinary. */
export const HERO_IMAGE = {
  src: '',  // TODO user: https://res.cloudinary.com/<CLOUD>/image/upload/f_auto,q_auto,w_2400/<ID>.jpg
  alt: 'Kain satin emas gelap dengan kilau tipis',
};

/** Video latar CTA penutup (gold dust / partikel emas). */
export const CTA_VIDEO = {
  src:    '',  // TODO user: https://res.cloudinary.com/<CLOUD>/video/upload/f_auto,q_auto,w_1920,ac_none/<ID>.mp4
  poster: '',  // TODO user: https://res.cloudinary.com/<CLOUD>/video/upload/so_0,f_jpg,q_auto/<ID>.jpg
};

/** Gambar fallback jika iframe /demo gagal dimuat. */
export const PREVIEW_FALLBACK_IMG = ''; // TODO user

/**
 * Tanggal akhir promo dalam ISO string (mis. "2025-12-31T23:59:59+07:00").
 * Set null untuk menyembunyikan countdown — JANGAN isi tanggal palsu.
 */
export const PROMO_END: string | null = null;

// ─── PAKET ──────────────────────────────────────────────────────────────────
// Sumber kebenaran: app/order/page.tsx (PAKET_DATA) + hooks/usePlan.ts
// Share journal TIDAK termasuk Basic (canShare: pro/elite only — lihat usePlan).

export interface Plan {
  key:       'basic' | 'pro' | 'elite';
  name:      string;
  price:     string;   // "99K"
  priceRaw:  number;   // 99000
  strike:    string;   // "Rp 149.000"
  note:      string;
  highlight: boolean;
  badge:     string | null;
  features:  string[];
}

export const PLANS: Plan[] = [
  {
    key:       'basic',
    name:      'Paket Basic',
    price:     '99K',
    priceRaw:  99000,
    strike:    'Rp 149.000',
    note:      'Akses 3 bulan · Web App Only',
    highlight: false,
    badge:     null,
    features: [
      'Akses Journalyze Web App',
      'Kalkulator risiko & lot size',
      'Rekap & analisis trade',
      'Trading plan harian',
    ],
  },
  {
    key:       'pro',
    name:      'Paket Pro',
    price:     '149K',
    priceRaw:  149000,
    strike:    'Rp 297.000',
    note:      'Lifetime · + E-Book + Komunitas',
    highlight: true,
    badge:     'Paling Populer',
    features: [
      'Semua fitur Journalyze Web App',
      'Akses LIFETIME (bukan langganan)',
      '2 E-Book Trading Premium (Bonus)',
      'Akses grup komunitas trader',
      'Konsultasi 1x via WhatsApp',
      'Semua update fitur gratis',
    ],
  },
  {
    key:       'elite',
    name:      'Paket Elite',
    price:     '249K',
    priceRaw:  249000,
    strike:    'Rp 497.000',
    note:      'Lifetime · + Review + Konsultasi 3x',
    highlight: false,
    badge:     'Terlengkap',
    features: [
      'Semua fitur Paket Pro',
      'Review journal bulanan (1x/bulan)',
      'Konsultasi trading 3x via WhatsApp',
      'Analisis psikologi trading',
      'Feedback strategy personal',
      'Prioritas support & update',
    ],
  },
];

// ─── STATISTIK (hanya fakta produk, BUKAN angka karangan) ───────────────────

export interface Stat {
  value: string;
  label: string;
  sub?:  string;
}

export const STATS: Stat[] = [
  { value: '30 detik', label: 'Input satu trade',         sub: 'isi form, simpan, selesai' },
  { value: 'AI',       label: 'Refleksi per trade',       sub: 'grade, pola, saran perbaikan' },
  { value: 'Lifetime', label: 'Akses Pro & Elite',        sub: 'bayar sekali, pakai selamanya' },
  { value: 'IDR',      label: 'Kalkulasi otomatis',       sub: 'pips, RR, P&L dalam Rupiah' },
];

// ─── FITUR ───────────────────────────────────────────────────────────────────

export interface Feature {
  id:       string;
  icon:     string;           // nama ikon Phosphor (PascalCase)
  title:    string;
  summary:  string;
  points:   [string, string, string];
  planFrom: 'basic' | 'pro' | 'elite';
  image:    string;           // TODO user: URL gambar screenshot fitur
}

export const FEATURES: Feature[] = [
  {
    id:       'ocr',
    icon:     'Camera',
    title:    'OCR Foto MT5',
    summary:  'Foto screenshot MT5-mu, Journalyze membaca angka secara otomatis — tidak perlu ketik manual.',
    points:   [
      'Upload foto langsung dari HP atau desktop',
      'AI mengenali pair, entry, close, dan lot secara otomatis',
      'Hemat waktu input hingga 80% dibanding tulis manual',
    ],
    planFrom: 'pro',
    image:    '',
  },
  {
    id:       'ai-refleksi',
    icon:     'Brain',
    title:    'AI Refleksi per Trade',
    summary:  'Setiap trade dianalisis AI — dapat grade, identifikasi pola, dan saran perbaikan konkret.',
    points:   [
      'Grade A–F per trade berdasarkan disiplin dan eksekusi',
      'Identifikasi pola berulang yang merugikan',
      'Saran spesifik untuk trade berikutnya',
    ],
    planFrom: 'pro',
    image:    '',
  },
  {
    id:       'dashboard',
    icon:     'ChartBar',
    title:    'Dashboard & Chart',
    summary:  'Equity curve, win rate, rata-rata RR, dan drawdown — semua tersaji dalam satu layar.',
    points:   [
      'Equity curve yang menggambar progres akun secara visual',
      'Win rate dan RR rata-rata per periode',
      'Identifikasi bulan terbaik dan terburuk seketika',
    ],
    planFrom: 'basic',
    image:    '',
  },
  {
    id:       'kalkulator',
    icon:     'Calculator',
    title:    'Kalkulator Risiko',
    summary:  'Masukkan balance, risk %, dan stop loss — lot size optimal dihitung otomatis dalam Rupiah.',
    points:   [
      'Kalkulasi lot size real-time sebelum entry',
      'Nilai pip dalam IDR untuk XAUUSD dan pasangan lain',
      'Profil risiko personal berdasarkan jawaban 5 pertanyaan',
    ],
    planFrom: 'basic',
    image:    '',
  },
  {
    id:       'gallery',
    icon:     'Images',
    title:    'Gallery Foto Analisa',
    summary:  'Simpan screenshot chart dan analisa teknikal setiap trade dalam satu tempat terorganisir.',
    points:   [
      'Lampirkan foto chart langsung ke setiap catatan trade',
      'Lihat kembali setup yang berhasil dan yang gagal',
      'Bangun arsip analisa pribadi yang bisa dipelajari ulang',
    ],
    planFrom: 'pro',
    image:    '',
  },
  {
    id:       'live-share',
    icon:     'ShareNetwork',
    title:    'Live Share Journal',
    summary:  'Bagikan track record trading ke siapapun melalui link publik — tanpa perlu login.',
    points:   [
      'Satu link publik yang bisa dibuka siapa saja',
      'Tampilkan statistik dan trade history secara selektif',
      'Bangun kredibilitas dan portofolio trader profesional',
    ],
    planFrom: 'pro',
    image:    '',
  },
  {
    id:       'news',
    icon:     'Newspaper',
    title:    'News Forex + AI',
    summary:  'Berita forex terkini dengan ringkasan AI dalam Bahasa Indonesia — tanpa buka tab lain.',
    points:   [
      'Feed berita forex dan XAUUSD dari sumber terpercaya',
      'Ringkasan singkat dalam Bahasa Indonesia oleh AI',
      'Kalender ekonomi high-impact terintegrasi',
    ],
    planFrom: 'pro',
    image:    '',
  },
  {
    id:       'report',
    icon:     'CalendarCheck',
    title:    'Weekly & Monthly Report',
    summary:  'Rekap performa otomatis per minggu dan per bulan — tidak perlu hitung manual di Excel.',
    points:   [
      'Win rate, total trade, dan net P&L per periode',
      'Pair paling profitable dan sesi terbaik',
      'Tren konsistensi dari bulan ke bulan',
    ],
    planFrom: 'pro',
    image:    '',
  },
];

// ─── TABEL PERBANDINGAN FITUR ────────────────────────────────────────────────
// Sumber: hooks/usePlan.ts — JANGAN ubah tanpa menyinkronkan dengan kode

export interface CompareRow {
  label:  string;
  basic:  boolean | string;
  pro:    boolean | string;
  elite:  boolean | string;
}

export const COMPARE_ROWS: CompareRow[] = [
  { label: 'Akses Web App',             basic: true,          pro: true,      elite: true },
  { label: 'Kalkulator risiko',         basic: true,          pro: true,      elite: true },
  { label: 'Rekap & analisis trade',    basic: true,          pro: true,      elite: true },
  { label: 'Trading plan harian',       basic: true,          pro: true,      elite: true },
  { label: 'Durasi akses',             basic: '3 bulan',     pro: 'Lifetime', elite: 'Lifetime' },
  { label: 'Filter & analisis lanjut',  basic: false,         pro: true,      elite: true },
  { label: 'Dashboard bulanan',         basic: false,         pro: true,      elite: true },
  { label: 'AI Refleksi per trade',     basic: false,         pro: true,      elite: true },
  { label: 'OCR foto MT5',             basic: false,         pro: true,      elite: true },
  { label: 'Live Share Journal',        basic: false,         pro: true,      elite: true },
  { label: 'Export data',              basic: false,         pro: true,      elite: true },
  { label: 'News Forex + AI',          basic: false,         pro: true,      elite: true },
  { label: 'Gallery foto analisa',     basic: false,         pro: true,      elite: true },
  { label: 'E-Book Trading Premium',   basic: false,         pro: '2 buku',  elite: '2 buku' },
  { label: 'Grup komunitas trader',    basic: false,         pro: true,      elite: true },
  { label: 'Konsultasi via WhatsApp',  basic: false,         pro: '1x',      elite: '3x' },
  { label: 'Review journal bulanan',   basic: false,         pro: false,     elite: '1x/bulan' },
  { label: 'Analisis psikologi trading',basic: false,        pro: false,     elite: true },
  { label: 'Prioritas support',        basic: false,         pro: false,     elite: true },
];

// ─── TESTIMONI ───────────────────────────────────────────────────────────────
// Kosong dulu — isi dengan data nyata sebelum publish.
// Komponen menyembunyikan section ini jika array kosong.

export interface Testimonial {
  initial:  string;
  name:     string;
  role:     string;
  stars:    1 | 2 | 3 | 4 | 5;
  text:     string;
}

export const TESTIMONIALS: Testimonial[] = [];
// TODO user: isi dengan testimoni nyata dari pengguna

// ─── FAQ ─────────────────────────────────────────────────────────────────────

export interface FaqItem {
  category: string;
  q:        string;
  a:        string;
}

export const FAQS: FaqItem[] = [
  {
    category: 'Keamanan Data',
    q: 'Apakah data trading saya aman?',
    a: 'Ya. Semua data disimpan di Supabase dengan enkripsi enterprise-grade. Data kamu hanya bisa diakses dengan akun milikmu sendiri. Kami tidak pernah menjual atau membagikan data pengguna ke pihak mana pun.',
  },
  {
    category: 'AI & API Key',
    q: 'Apakah fitur AI memerlukan biaya tambahan?',
    a: 'Tidak. Fitur AI Refleksi menggunakan API key milikmu sendiri (Google Gemini) yang bisa didapatkan secara gratis. Ada tutorial langkah demi langkah di dalam aplikasi untuk membantu setup.',
  },
  {
    category: 'AI & API Key',
    q: 'Bagaimana cara mendapatkan API key untuk AI?',
    a: 'Daftar di Google AI Studio (aistudio.google.com), buat API key gratis, lalu masukkan di pengaturan Journalyze. Tutorial lengkap tersedia di dalam aplikasi setelah login.',
  },
  {
    category: 'Perangkat',
    q: 'Bisa diakses dari HP?',
    a: 'Ya. Journalyze adalah Progressive Web App (PWA) yang dioptimalkan untuk mobile. Bisa diinstal langsung di homescreen Android maupun iOS layaknya aplikasi native, dan berjalan mulus di semua ukuran layar.',
  },
  {
    category: 'Plan & Pembayaran',
    q: 'Apa perbedaan Paket Basic, Pro, dan Elite?',
    a: 'Basic memberikan akses 3 bulan ke fitur inti (kalkulator risiko, rekap trade, trading plan). Pro dan Elite adalah akses Lifetime dengan fitur lengkap termasuk AI Refleksi, OCR foto MT5, dashboard bulanan, dan Live Share Journal. Elite menambahkan review jurnal bulanan, konsultasi trading 3x, dan analisis psikologi trading.',
  },
  {
    category: 'Plan & Pembayaran',
    q: 'Apakah ada biaya berlangganan bulanan?',
    a: 'Tidak. Paket Pro dan Elite adalah akses lifetime — bayar satu kali dan pakai selamanya, termasuk semua update dan fitur baru di masa depan. Paket Basic adalah akses 3 bulan.',
  },
  {
    category: 'Aktivasi',
    q: 'Bagaimana proses aktivasi setelah pembayaran?',
    a: 'Akun langsung aktif otomatis setelah pembayaran sukses melalui Midtrans. Tidak perlu kirim bukti transfer atau menunggu konfirmasi manual. Jika membeli melalui Lynk.id atau Scalev, aktivasi dilakukan di halaman /delivery dengan kode lisensi yang dikirim ke emailmu.',
  },
  {
    category: 'Aktivasi',
    q: 'Apa itu kode lisensi?',
    a: 'Kode lisensi format JZ-XXXX-XXXX dikirim otomatis ke email setelah pembelian melalui platform lain (Lynk.id, Scalev). Untuk pembelian langsung di situs ini, akun aktif tanpa kode lisensi — login langsung dengan email dan password yang didaftarkan saat checkout.',
  },
];

// ─── NAVIGASI ─────────────────────────────────────────────────────────────────

export interface NavLink {
  label: string;
  href:  string;
}

export const NAV_LINKS: NavLink[] = [
  { label: 'Fitur',       href: '/fitur'       },
  { label: 'Cara Kerja',  href: '/cara-kerja'  },
  { label: 'Harga',       href: '/harga'       },
  { label: 'Tentang',     href: '/tentang'     },
  { label: 'Blog',        href: '/blog'        },
  { label: 'Kontak',      href: '/kontak'      },
];

// ─── HELPER ──────────────────────────────────────────────────────────────────

/** URL order dengan paket yang dipilih */
export const orderUrl = (key: Plan['key']) => `/order?paket=${key}`;

/** URL WhatsApp dengan pesan default */
export const waUrl = (msg = 'Halo, saya ingin info lebih lanjut tentang Journalyze 🙏') =>
  `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(msg)}`;
