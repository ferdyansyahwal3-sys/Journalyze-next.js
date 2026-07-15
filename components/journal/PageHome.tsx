// components/journal/PageHome.tsx
// Dipindah dari index.html baris 1625-2018 (page-home).
// Tidak ada Supabase/state eksternal — pure presentational + navigasi.
'use client';

import { useJournalStore } from '@/store/useJournalStore';
import type { JournalPage } from '@/store/useJournalStore';

function NavTag({ page, children, style }: { page: JournalPage; children: React.ReactNode; style?: React.CSSProperties }) {
  const setActivePage = useJournalStore((s) => s.setActivePage);
  return (
    <span className="step-tag" style={style} onClick={() => setActivePage(page)}>
      {children}
    </span>
  );
}

export default function PageHome({ active }: { active: boolean }) {
  const setActivePage = useJournalStore((s) => s.setActivePage);

  return (
    <div className={`page ${active ? 'active' : ''}`} id="page-home">

      {/* HERO */}
      <div className="home-hero">
        <div className="home-orb"></div>
        <div className="home-orb2"></div>
        <div className="home-orb3"></div>
        <div className="home-hero-eyebrow">Trading Journal Suite</div>
        <h1 className="home-hero-title">Selamat Datang di<br /><em>Journalyze</em></h1>
        <p className="home-hero-sub">
          Platform jurnal trading pribadi kamu — catat setiap trade, analisa performa,
          dan bangun disiplin yang konsisten setiap hari.
        </p>
        <div className="home-cta-row">
          <button className="btn btn-gold btn-hero" onClick={() => setActivePage('risk')}>⚡ Mulai Trading</button>
          <button
            className="btn btn-ghost btn-hero"
            onClick={() => document.getElementById('panduan-section')?.scrollIntoView({ behavior: 'smooth' })}
          >
            📖 Lihat Panduan
          </button>
        </div>
      </div>

      {/* FEATURE CARDS */}
      <div className="home-features" id="home-features">
        {[
          { icon: '⚖️', title: 'Manajemen Risiko', desc: 'Hitung profil risiko kamu secara otomatis. Dapatkan rekomendasi lot size, risk per trade, dan batas drawdown berdasarkan saldo akun.' },
          { icon: '📋', title: 'Jurnal Trade', desc: 'Catat semua trade lengkap dengan pair, sesi, strategi, lot, SL/TP, dan hasil. Semua data tersimpan di cloud secara real-time.' },
          { icon: '📊', title: 'Analisa & Statistik', desc: 'Lihat performa per minggu dan bulan dengan chart, kalender visual, win rate, profit factor, dan breakdown per pair maupun sesi.' },
          { icon: '📅', title: 'Growth Plan', desc: 'Buat plan pertumbuhan akun yang realistis. Simulasikan target saldo, lot yang harus dipakai, dan estimasi hari untuk mencapai target.' },
          { icon: '🔍', title: 'Filter & Rekap', desc: 'Filter trade berdasarkan pair, sesi, strategi, dan hasil. Temukan pola trading terbaik dan sesi paling menguntungkan kamu.' },
          { icon: '📈', title: 'Live Kurs', desc: 'Pantau kurs USD/IDR secara real-time. Semua kalkulasi P&L otomatis dikonversi ke mata uang pilihan kamu (IDR, USD, atau Cent).' },
        ].map((f) => (
          <div className="feat-card" key={f.title}>
            <span className="feat-icon">{f.icon}</span>
            <div className="feat-title">{f.title}</div>
            <div className="feat-desc">{f.desc}</div>
          </div>
        ))}
        <div className="feat-card" onClick={() => setActivePage('news')} style={{ cursor: 'pointer' }}>
          <span className="feat-icon">📰</span>
          <div className="feat-title">Berita Forex</div>
          <div className="feat-desc">Pantau berita pasar forex terkini — update sentimen, event ekonomi, analisis Gold/XAUUSD, Fed, dan pair utama kamu secara otomatis.</div>
        </div>
      </div>

      {/* VIDEO TUTORIAL */}
      <div className="home-video-section" id="video-tutorial-section">
        <div className="home-video-eyebrow">🎬 Video Tutorial</div>
        <div className="home-video-title">Cara Menggunakan <em>Journalyze</em></div>
        <div className="home-video-sub">Tonton video panduan lengkap — mulai dari setup profil risiko hingga menganalisis foto screenshot MT5 kamu secara otomatis.</div>
        <div className="home-video-wrap">
          <div className="home-video-glow"></div>
          <div className="home-video-frame">
            <iframe
              src="https://www.youtube.com/embed/V8eodZkIfYk?rel=0&modestbranding=1&color=white"
              title="Panduan Penggunaan Journalyze"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
          <div className="home-video-caption">
            <span className="home-video-badge">▶ HD</span>
            Durasi ~5 menit · Cocok untuk pemula &amp; trader berpengalaman
          </div>
        </div>
      </div>

      {/* PANDUAN */}
      <div className="home-guide" id="panduan-section">
        <div className="home-guide-head">
          <span style={{ fontSize: 16 }}>📖</span>
          <div className="home-guide-head-title">Panduan Penggunaan — Cara Mulai</div>
        </div>
        <div className="home-steps">

          <div className="home-step">
            <div className="step-num">1</div>
            <div className="step-content">
              <div className="step-title">Isi Profil Risiko &amp; Pilih Mata Uang</div>
              <div className="step-desc">
                Mulai dari halaman <strong>Risiko</strong>. Langkah pertama adalah memilih mata uang akun
                trading kamu — <strong>IDR</strong> (Rupiah), <strong>CENT</strong> (Cent USD), atau
                <strong>USD</strong> (Dollar). Pilihan ini penting karena menentukan format angka
                di seluruh jurnal, trading plan, dan form deposit/withdraw.
                <br /><br />
                Setelah itu isi saldo awal sesuai mata uang yang dipilih, toleransi risiko per trade,
                berapa bulan target kamu, dan target saldo akhir. Klik <em>&quot;Hitung Sekarang&quot;</em> —
                Journalyze akan otomatis menghitung rekomendasi lot size, tipe akun, batasan harian,
                dan tabel growth plan kamu.
                <br /><br />
                <strong>Catatan:</strong> semua nilai disimpan dan menjadi titik awal perhitungan
                saldo di seluruh halaman jurnal. Pastikan saldo awal yang kamu isi sudah benar
                sebelum mulai mencatat trade.
              </div>
              <NavTag page="risk">⚖️ Buka Halaman Risiko →</NavTag>
            </div>
          </div>

          <div className="home-step">
            <div className="step-num">2</div>
            <div className="step-content">
              <div className="step-title">Catat Deposit &amp; Withdraw</div>
              <div className="step-desc">
                Di halaman <strong>Data</strong>, ada bagian <em>Deposit &amp; Withdraw</em> di bawah tabel trade.
                Gunakan ini untuk mencatat setiap penambahan atau penarikan saldo akun kamu.
                <br /><br />
                <strong>Penting:</strong> nominal yang kamu isi di form deposit/withdraw harus mengikuti
                mata uang yang sedang aktif. Sistem akan mengkonversi nilainya ke IDR internal secara
                otomatis — jadi kamu tidak perlu hitung manual.
              </div>
              <NavTag page="data">💰 Buka Halaman Data →</NavTag>
            </div>
          </div>

          <div className="home-step">
            <div className="step-num">3</div>
            <div className="step-content">
              <div className="step-title">Catat Setiap Trade di Jurnal</div>
              <div className="step-desc">
                Klik <em>&quot;+ Tambah Trade&quot;</em> di halaman <strong>Data</strong>. Isi pair, sesi, arah posisi,
                lot, entry, close, SL, TP, dan hasil. Kamu juga bisa upload screenshot chart sebagai dokumentasi.
                <br /><br />
                Setiap trade yang disimpan akan langsung dihitung P/L-nya dan ditambahkan ke saldo berjalan.
              </div>
              <NavTag page="data">📋 Buka Jurnal Data →</NavTag>
            </div>
          </div>

          <div className="home-step">
            <div className="step-num">4</div>
            <div className="step-content">
              <div className="step-title">Cara Journalyze Menghitung Saldo Kamu</div>
              <div className="step-desc">
                Saldo awal diambil dari profil risiko. Setiap trade menambah atau mengurangi saldo berdasarkan
                hasil P/L-nya. Deposit menambah saldo pada tanggal yang dicatat, withdraw menguranginya.
                <br /><br />
                Kurs mata uang yang berlaku saat sebuah trade disimpan akan dikunci langsung ke data trade tersebut —
                sehingga perubahan kurs di kemudian hari tidak mengubah hitungan trade yang sudah ada.
              </div>
              <NavTag page="data">📊 Lihat Jurnal →</NavTag>
            </div>
          </div>

          <div className="home-step">
            <div className="step-num">5</div>
            <div className="step-content">
              <div className="step-title">Pantau Performa &amp; Analisa Pola</div>
              <div className="step-desc">
                Gunakan halaman <strong>Mingguan</strong> dan <strong>Bulanan</strong> untuk melihat rekap
                performa dengan chart dan kalender visual. Halaman <strong>Filter</strong> membantu kamu
                menyaring trade untuk menemukan setup, pair, atau sesi yang paling konsisten menguntungkan.
              </div>
              <NavTag page="weekly">📆 Mingguan →</NavTag>
              <NavTag page="monthly" style={{ marginLeft: 6 }}>📊 Bulanan →</NavTag>
              <NavTag page="filter" style={{ marginLeft: 6 }}>🔍 Filter →</NavTag>
            </div>
          </div>

          <div className="home-step">
            <div className="step-num">6</div>
            <div className="step-content">
              <div className="step-title">Simulasi Growth Plan</div>
              <div className="step-desc">
                Di halaman <strong>Plan</strong>, lihat proyeksi pertumbuhan akun harian berdasarkan profil
                risiko yang sudah kamu isi. Tabel milestones menampilkan target saldo per hari lengkap dengan
                estimasi lot dan pips yang perlu dicapai.
              </div>
              <NavTag page="plan">📅 Buka Plan →</NavTag>
            </div>
          </div>

          <div className="home-step">
            <div className="step-num">7</div>
            <div className="step-content">
              <div className="step-title">Pantau Berita &amp; Kalender Ekonomi di Tab News</div>
              <div className="step-desc">
                Tab <strong>News</strong> membantu kamu memahami konteks fundamental market sebelum dan sesudah trading.
                Ada tiga bagian: <strong>Kalender Ekonomi</strong> minggu ini, <strong>Kartu Berita Forex</strong> (auto-refresh 30 menit),
                dan <strong>Kesimpulan &amp; Spekulasi Market</strong> dari berita high-impact.
                <br /><br />
                Aktifkan notifikasi lewat tombol <strong>🔔 Notif</strong> di topbar untuk alert berita high-impact
                dan pengingat isi jurnal harian.
              </div>
              <NavTag page="news" style={{ marginTop: 10, display: 'inline-block' }}>📰 Buka Tab News →</NavTag>
            </div>
          </div>

        </div>
      </div>

      {/* TIPS TRADING */}
      <div style={{ padding: '0 var(--sp) 32px' }}>
        <div className="box" style={{ marginTop: 0 }}>
          <div className="box-head">
            <div className="box-title">💡 Tips Trading</div>
          </div>
          <div className="box-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              '📌 Selalu isi jurnal <em>segera setelah trade ditutup</em> — jangan tunda.',
              '📌 Gunakan halaman <strong>Mingguan</strong> setiap akhir pekan untuk evaluasi.',
              '📌 Win rate rendah bukan masalah asal <em>Risk:Reward</em> kamu ≥ 1:2.',
              '📌 Kalau floating loss > 2x SL, pertimbangkan untuk close manual.',
              '📌 Jangan tambah lot hanya karena sedang profit streak — tetap disiplin.',
              '📌 Catat alasan entry di kolom <em>Catatan</em> — berguna untuk evaluasi pola.',
            ].map((tip, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
                <span dangerouslySetInnerHTML={{ __html: tip }} />
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}