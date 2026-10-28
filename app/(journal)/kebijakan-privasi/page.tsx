import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Kebijakan Privasi — Journalyze',
  description: 'Bagaimana Journalyze mengumpulkan, menggunakan, dan melindungi data penggunanya.',
};

const h2: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 700, margin: '36px 0 12px', color: 'var(--text)',
};
const p: React.CSSProperties = { fontSize: 15, lineHeight: 1.8, color: 'var(--text2)', margin: '0 0 12px' };
const li: React.CSSProperties = { fontSize: 15, lineHeight: 1.8, color: 'var(--text2)', marginBottom: 6 };

export default function KebijakanPrivasiPage() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: "'Outfit', sans-serif", padding: '48px 24px 96px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <a href="/" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 700, color: 'var(--text)', textDecoration: 'none' }}>
          Journal<em style={{ color: 'var(--gold2)' }}>yze</em>
        </a>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 44, fontWeight: 700, margin: '28px 0 8px' }}>Kebijakan Privasi</h1>
        <p style={{ ...p, color: 'var(--text3)' }}>Terakhir diperbarui: 28 Oktober 2026</p>

        <h2 style={h2}>1. Data yang kami kumpulkan</h2>
        <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
          <li style={li}>Data akun: nama, alamat email, dan paket yang dibeli.</li>
          <li style={li}>Data jurnal yang kamu input: trade, alasan, emosi, catatan, dan foto yang kamu unggah (misalnya layar riwayat MT5).</li>
          <li style={li}>Data transaksi: status dan nomor pesanan pembayaran. Data kartu atau rekening diproses langsung oleh Midtrans dan tidak kami simpan.</li>
          <li style={li}>Data kunjungan: halaman yang dibuka dan klik pada halaman pemasaran, termasuk tautan afiliasi, untuk mengukur kinerja halaman dan iklan.</li>
        </ul>

        <h2 style={h2}>2. Cara kami menggunakan data</h2>
        <p style={p}>
          Data dipakai untuk menjalankan akun dan fitur jurnalmu, mengaktifkan paket setelah pembayaran, mengirim email
          konfirmasi, memberi bantuan, serta memahami dan memperbaiki halaman dan layanan kami.
        </p>

        <h2 style={h2}>3. Fitur AI</h2>
        <p style={p}>
          Fitur AI memakai API key milikmu. API key disimpan di browser perangkatmu. Saat kamu memakai fitur AI, data yang
          dianalisis (misalnya foto trade atau data jurnal) dikirim ke penyedia AI yang kamu pilih, seperti Google Gemini atau
          Anthropic, melalui server kami. Penyedia AI tersebut memiliki kebijakan privasinya sendiri.
        </p>

        <h2 style={h2}>4. Pihak ketiga yang kami gunakan</h2>
        <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
          <li style={li}>Supabase untuk autentikasi dan penyimpanan data.</li>
          <li style={li}>Midtrans untuk pembayaran.</li>
          <li style={li}>Resend untuk pengiriman email.</li>
          <li style={li}>Vercel untuk hosting.</li>
          <li style={li}>Meta Pixel dapat digunakan untuk mengukur iklan. Kamu dapat membatasinya lewat pengaturan privasi browser atau akun Meta-mu.</li>
        </ul>
        <p style={p}>Kami tidak menjual data penggunamu ke pihak manapun.</p>

        <h2 style={h2}>5. Keamanan dan penyimpanan</h2>
        <p style={p}>
          Data jurnal hanya dapat diakses melalui akunmu. Kami berupaya menjaga keamanan data, namun tidak ada sistem yang
          sepenuhnya bebas risiko. Kamu juga bertanggung jawab menjaga kerahasiaan kata sandi dan API key-mu.
        </p>

        <h2 style={h2}>6. Hak kamu</h2>
        <p style={p}>
          Kamu dapat meminta akses, perbaikan, atau penghapusan data akunmu dengan menghubungi kami melalui WhatsApp
          081311973602. Fitur share jurnal publik hanya menampilkan data yang kamu pilih untuk dibagikan.
        </p>

        <h2 style={h2}>7. Perubahan kebijakan</h2>
        <p style={p}>Kami dapat memperbarui kebijakan ini. Versi terbaru selalu tersedia di halaman ini.</p>

        <p style={{ ...p, marginTop: 40 }}>
          <a href="/syarat-ketentuan" style={{ color: 'var(--gold2)' }}>Syarat &amp; Ketentuan</a>
          {' · '}
          <a href="/" style={{ color: 'var(--gold2)' }}>Kembali ke beranda</a>
        </p>
      </div>
    </main>
  );
}
