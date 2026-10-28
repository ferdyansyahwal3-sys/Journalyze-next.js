import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Syarat & Ketentuan — Journalyze',
  description: 'Syarat dan ketentuan penggunaan Journalyze, termasuk garansi akses dan pengembalian dana.',
};

const h2: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 700, margin: '36px 0 12px', color: 'var(--text)',
};
const p: React.CSSProperties = { fontSize: 15, lineHeight: 1.8, color: 'var(--text2)', margin: '0 0 12px' };

export default function SyaratKetentuanPage() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: "'Outfit', sans-serif", padding: '48px 24px 96px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <a href="/" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 700, color: 'var(--text)', textDecoration: 'none' }}>
          Journal<em style={{ color: 'var(--gold2)' }}>yze</em>
        </a>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 44, fontWeight: 700, margin: '28px 0 8px' }}>Syarat &amp; Ketentuan</h1>
        <p style={{ ...p, color: 'var(--text3)' }}>Terakhir diperbarui: 28 Oktober 2026</p>

        <h2 style={h2}>1. Tentang layanan</h2>
        <p style={p}>
          Journalyze adalah aplikasi jurnal trading berbasis web untuk mencatat dan menganalisis trading milik pengguna sendiri.
          Journalyze bukan penyedia sinyal trading, bukan penasihat keuangan, dan tidak menjamin hasil trading apa pun.
          Keputusan trading sepenuhnya menjadi tanggung jawab pengguna.
        </p>

        <h2 style={h2}>2. Paket dan masa akses</h2>
        <p style={p}>
          Paket Basic memberi akses selama 3 bulan sejak aktivasi. Paket Pro dan Elite memberi akses lifetime, yang berarti
          akses tanpa biaya perpanjangan selama layanan Journalyze masih beroperasi. Fitur dan bonus yang berlaku adalah yang
          tercantum pada halaman paket saat pembelian.
        </p>

        <h2 style={h2}>3. Pembayaran dan aktivasi</h2>
        <p style={p}>
          Pembayaran diproses melalui Midtrans. Setelah pembayaran terkonfirmasi, akun diaktifkan otomatis sesuai paket yang
          dipilih. Jika aktivasi bermasalah, pengguna dapat menghubungi kami melalui WhatsApp 081311973602 dan tim kami akan
          membantu sampai akun dapat digunakan.
        </p>

        <h2 style={h2}>4. Garansi akses dan pengembalian dana</h2>
        <p style={p}>
          Kami menjamin setiap pembelian yang berhasil akan mendapatkan akses Journalyze sesuai paket yang dipilih. Jika akses
          tidak dapat diberikan dan kendala tidak dapat diselesaikan oleh tim kami, pelanggan berhak mengajukan pengembalian
          dana.
        </p>
        <p style={p}>
          Pengajuan dilakukan melalui WhatsApp 081311973602 dengan menyertakan bukti pembayaran atau nomor pesanan. Tim kami
          akan memeriksa kendalanya, mencoba menyelesaikannya terlebih dahulu, dan menginformasikan proses serta estimasi waktu
          pengembalian dana apabila kendala tidak dapat diselesaikan. Pengembalian dana mengikuti mekanisme metode pembayaran
          yang digunakan.
        </p>

        <h2 style={h2}>5. Fitur AI</h2>
        <p style={p}>
          Fitur AI di Journalyze memerlukan API key milik pengguna sendiri dari penyedia AI yang didukung (misalnya Google
          Gemini). Ketersediaan, kuota, dan biaya API key menjadi urusan pengguna dengan penyedia AI tersebut. Hasil analisis AI
          bersifat informasi pendukung dan bukan nasihat keuangan atau investasi.
        </p>

        <h2 style={h2}>6. Perubahan layanan dan ketentuan</h2>
        <p style={p}>
          Kami dapat memperbarui fitur dan ketentuan ini dari waktu ke waktu. Versi terbaru selalu tersedia di halaman ini.
        </p>

        <h2 style={h2}>7. Kontak</h2>
        <p style={p}>Pertanyaan tentang ketentuan ini dapat dikirim melalui WhatsApp 081311973602.</p>

        <p style={{ ...p, marginTop: 40 }}>
          <a href="/kebijakan-privasi" style={{ color: 'var(--gold2)' }}>Kebijakan Privasi</a>
          {' · '}
          <a href="/" style={{ color: 'var(--gold2)' }}>Kembali ke beranda</a>
        </p>
      </div>
    </main>
  );
}
