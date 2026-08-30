'use client'

"use client";

export default function PageHome({
  active,
  switchPage,
  openApiKeyModal,
  hideBonus = false,
}: {
  active: boolean;
  switchPage: (page: string) => void;
  openApiKeyModal: () => void;
  hideBonus?: boolean;
}) {
  return (
    <div className={`page${active ? ' active' : ''}`} id="page-home">

      {/* HERO */}
      <div className="home-hero">
        <div className="home-orb"></div>
        <div className="home-orb2"></div>
        <div className="home-orb3"></div>
        <div className="home-hero-eyebrow">Trading Journal Suite</div>
        <h1 className="home-hero-title">Selamat Datang di<br /><em>Journalyze</em></h1>
        <p className="home-hero-sub">Platform jurnal trading pribadi kamu — catat setiap trade, analisa performa, dan bangun disiplin yang konsisten setiap hari.</p>
        <div className="home-cta-row">
          <button className="btn btn-gold btn-hero" onClick={() => switchPage('risk')}>⚡ Mulai Trading</button>
          <button className="btn btn-ghost btn-hero" onClick={() => { const el = document.getElementById('panduan-section'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }}>📖 Lihat Panduan</button>
        </div>
      </div>

      {/* FEATURE CARDS */}
      <div className="home-features" id="home-features">
        <div className="feat-card">
          <span className="feat-icon">⚖️</span>
          <div className="feat-title">Manajemen Risiko</div>
          <div className="feat-desc">Hitung profil risiko kamu secara otomatis. Dapatkan rekomendasi lot size, risk per trade, dan batas drawdown berdasarkan saldo akun.</div>
        </div>
        <div className="feat-card">
          <span className="feat-icon">📋</span>
          <div className="feat-title">Jurnal Trade</div>
          <div className="feat-desc">Catat semua trade lengkap dengan pair, sesi, strategi, lot, SL/TP, dan hasil. Semua data tersimpan di browser kamu secara lokal.</div>
        </div>
        <div className="feat-card">
          <span className="feat-icon">📊</span>
          <div className="feat-title">Analisa &amp; Statistik</div>
          <div className="feat-desc">Lihat performa per minggu dan bulan dengan chart, kalender visual, win rate, profit factor, dan breakdown per pair maupun sesi.</div>
        </div>
        <div className="feat-card">
          <span className="feat-icon">📅</span>
          <div className="feat-title">Growth Plan</div>
          <div className="feat-desc">Buat plan pertumbuhan akun yang realistis. Simulasikan target saldo, lot yang harus dipakai, dan estimasi hari untuk mencapai target.</div>
        </div>
        <div className="feat-card">
          <span className="feat-icon">🔍</span>
          <div className="feat-title">Filter &amp; Rekap</div>
          <div className="feat-desc">Filter trade berdasarkan pair, sesi, strategi, dan hasil. Temukan pola trading terbaik dan sesi paling menguntungkan kamu.</div>
        </div>
        <div className="feat-card">
          <span className="feat-icon">📈</span>
          <div className="feat-title">Live Kurs</div>
          <div className="feat-desc">Pantau kurs USD/IDR secara real-time. Semua kalkulasi P&amp;L otomatis dikonversi ke mata uang pilihan kamu (IDR, USD, atau Cent).</div>
        </div>
        <div className="feat-card" onClick={() => switchPage('news')} style={{ cursor: 'pointer' }}>
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
            ></iframe>
          </div>
          <div className="home-video-caption">
            <span className="home-video-badge">▶ HD</span>
            Durasi ~5 menit · Cocok untuk pemula &amp; trader berpengalaman
          </div>
        </div>
      </div>

      {/* ── BONUS EKSKLUSIF ── */}
      {!hideBonus && <div className="home-bonus-section">
        <div className="home-bonus-eyebrow">✦ Bonus Eksklusif</div>
        <div className="home-bonus-title">
          Semua yang kamu<br />dapat <em>ada di sini.</em>
        </div>
        <p className="home-bonus-sub">
          Download e-book dan bergabung ke komunitas trader — bagian dari paket Journalyze kamu.
        </p>

        <div className="home-bonus-grid">

          {/* E-BOOK 1 */}
          <a
            className="home-bonus-card"
            href="https://drive.google.com/uc?export=download&id=1awMIAUKsxRKkz4y71O4VXriDMjzWsNnV"
            target="_blank"
            rel="noopener noreferrer"
          >
            <div className="hb-icon hb-icon-green">📊</div>
            <div className="hb-badge hb-badge-green">✨ Bonus E-Book #1</div>
            <div className="hb-title">E-Book Candlestick Pattern</div>
            <div className="hb-desc">
              Panduan lengkap 12+ pola candlestick dengan contoh nyata, cara entry, SL, TP,
              dan kombinasi dengan Support &amp; Resistance.
            </div>
            <div className="hb-note">Klik untuk menyimpan salinan e-book pribadi kamu.</div>
            <div className="hb-btn hb-btn-green">📥 Download E-Book →</div>
          </a>

          {/* E-BOOK 2 */}
          <a
            className="home-bonus-card"
            href="https://drive.google.com/uc?export=download&id=1LF8C84FJImpw2QidWRaDUFxK0m17-dL4"
            target="_blank"
            rel="noopener noreferrer"
          >
            <div className="hb-icon hb-icon-blue">📈</div>
            <div className="hb-badge hb-badge-blue">✨ Bonus E-Book #2</div>
            <div className="hb-title">E-Book Support &amp; Resistance</div>
            <div className="hb-desc">
              Panduan lengkap cara menentukan S&amp;R, role reversal, bounce vs breakout,
              3 strategi trading, dan multi timeframe analysis.
            </div>
            <div className="hb-note">Klik untuk menyimpan salinan e-book pribadi kamu.</div>
            <div className="hb-btn hb-btn-blue">📥 Download E-Book →</div>
          </a>

          {/* KOMUNITAS */}
          <a
            className="home-bonus-card"
            href="https://chat.whatsapp.com/ElTxKk7yP68CcRr6mf9T87?mode=gi_t"
            target="_blank"
            rel="noopener noreferrer"
          >
            <div className="hb-icon hb-icon-purple">💬</div>
            <div className="hb-badge hb-badge-purple">💬 Bonus Komunitas</div>
            <div className="hb-title">Grup Komunitas &amp; Konsultasi Eksklusif</div>
            <div className="hb-desc">
              Bergabung dengan trader aktif Indonesia. Diskusi harian, sharing strategi,
              evaluasi bareng, dan konsultasi personal dari tim Journalyze.
            </div>
            <div className="hb-note">Klik link agar kamu punya akses grup komunitas.</div>
            <div className="hb-btn hb-btn-purple">💬 Gabung Komunitas →</div>
          </a>

        </div>

        <div className="hb-footer-note">
          <span>💡</span>
          <span>
            Kamu mendapatkan akses ini sebagai bagian dari pembelian{' '}
            <strong>Journalyze Full Package</strong>. Simpan link e-book dan komunitas
            baik-baik — akses bersifat permanen.
          </span>
        </div>
      </div>
      }{/* ── END BONUS EKSKLUSIF ── */}

      {/* PANDUAN */}
      <div className="home-guide" id="panduan-section">
        <div className="home-guide-head">
          <span style={{ fontSize: '16px' }}>📖</span>
          <div className="home-guide-head-title">Panduan Penggunaan — Cara Mulai</div>
        </div>
        <div className="home-steps">

          {/* STEP 1: PROFIL RISIKO */}
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
              <span className="step-tag" onClick={() => switchPage('risk')}>⚖️ Buka Halaman Risiko →</span>
            </div>
          </div>

          {/* STEP 2: DEPOSIT & WITHDRAW */}
          <div className="home-step">
            <div className="step-num">2</div>
            <div className="step-content">
              <div className="step-title">Catat Deposit &amp; Withdraw</div>
              <div className="step-desc">
                Di halaman <strong>Data</strong>, ada bagian <em>Deposit &amp; Withdraw</em> di bawah tabel trade.
                Gunakan ini untuk mencatat setiap penambahan atau penarikan saldo akun kamu.
                <br /><br />
                <strong>Penting:</strong> nominal yang kamu isi di form deposit/withdraw harus mengikuti
                mata uang yang sedang aktif. Kalau kamu pilih <strong>IDR</strong>, isi dalam Rupiah.
                Kalau pilih <strong>USD</strong>, isi dalam Dollar. Kalau pilih <strong>CENT</strong>, isi dalam Cent.
                Sistem akan mengkonversi nilainya ke IDR internal secara otomatis — jadi kamu tidak perlu
                hitung manual. Tampilan di tabel akan selalu menyesuaikan mata uang yang aktif.
              </div>
              <span className="step-tag" onClick={() => switchPage('data')}>💰 Buka Halaman Data →</span>
            </div>
          </div>

          {/* STEP 3: CATAT TRADE */}
          <div className="home-step">
            <div className="step-num">3</div>
            <div className="step-content">
              <div className="step-title">Catat Setiap Trade di Jurnal</div>
              <div className="step-desc">
                Klik <em>&quot;+ Tambah Trade&quot;</em> di halaman <strong>Data</strong>. Isi pair, sesi, arah posisi,
                lot, entry, close, SL, TP, dan hasil. Kamu juga bisa upload screenshot chart sebagai dokumentasi.
                <br /><br />
                Setiap trade yang disimpan akan langsung dihitung P/L-nya dan ditambahkan ke saldo berjalan.
                Saldo kamu bertambah atau berkurang secara real-time sesuai urutan tanggal trade.
              </div>
              <span className="step-tag" onClick={() => switchPage('data')}>📋 Buka Jurnal Data →</span>
            </div>
          </div>

          {/* STEP 4: ALUR PERHITUNGAN */}
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
                Tampilan seluruh angka menyesuaikan mata uang yang kamu pilih.
              </div>
              <span className="step-tag" onClick={() => switchPage('data')}>📊 Lihat Jurnal →</span>
            </div>
          </div>

          {/* STEP 5: ANALISA */}
          <div className="home-step">
            <div className="step-num">5</div>
            <div className="step-content">
              <div className="step-title">Pantau Performa &amp; Analisa Pola</div>
              <div className="step-desc">
                Gunakan halaman <strong>Mingguan</strong> dan <strong>Bulanan</strong> untuk melihat rekap
                performa dengan chart dan kalender visual. Halaman <strong>Filter</strong> membantu kamu
                menyaring trade untuk menemukan setup, pair, atau sesi yang paling konsisten menguntungkan.
              </div>
              <span className="step-tag" onClick={() => switchPage('weekly')}>📆 Mingguan →</span>
              <span className="step-tag" style={{ marginLeft: '6px' }} onClick={() => switchPage('monthly')}>📊 Bulanan →</span>
              <span className="step-tag" style={{ marginLeft: '6px' }} onClick={() => switchPage('filter')}>🔍 Filter →</span>
            </div>
          </div>

          {/* STEP 6: GROWTH PLAN */}
          <div className="home-step">
            <div className="step-num">6</div>
            <div className="step-content">
              <div className="step-title">Simulasi Growth Plan</div>
              <div className="step-desc">
                Di halaman <strong>Plan</strong>, lihat proyeksi pertumbuhan akun harian berdasarkan profil
                risiko yang sudah kamu isi. Tabel milestones menampilkan target saldo per hari lengkap dengan
                estimasi lot dan pips yang perlu dicapai.
              </div>
              <span className="step-tag" onClick={() => switchPage('plan')}>📅 Buka Plan →</span>
            </div>
          </div>

          {/* STEP 7: TAB NEWS */}
          <div className="home-step">
            <div className="step-num">7</div>
            <div className="step-content">
              <div className="step-title">Pantau Berita &amp; Kalender Ekonomi di Tab News</div>
              <div className="step-desc">
                Tab <strong>News</strong> membantu kamu memahami konteks fundamental market sebelum dan sesudah trading.
                Ada tiga bagian utama di dalamnya:
                <br /><br />
                <strong>📅 Economic Calendar — Minggu Ini</strong><br />
                Daftar event ekonomi penting minggu ini lengkap dengan jam WIB, negara, forecast, dan level dampak
                (🔴 High, 🟡 Med, 🟢 Low). Jadwal ini otomatis menyesuaikan minggu berjalan — kamu tidak perlu
                update manual.
                <br /><br />
                <strong>📰 Kartu Berita Forex</strong><br />
                Berita terbaru dari ForexLive, DailyFX, dan Investing.com yang di-refresh otomatis setiap 30 menit.
                Setiap kartu menampilkan:
                <ul style={{ margin: '6px 0 0 16px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: 'var(--text2)' }}>
                  <li><strong>Judul &amp; ringkasan</strong> berita dalam bahasa Inggris</li>
                  <li><strong>Label dampak</strong> — 🔴 High / 🟡 Medium / 🟢 Low — seberapa besar potensi gerak market</li>
                  <li><strong>Kategori</strong> — Ekonomi, Sentimen, Bank Sentral, Komoditas, dll</li>
                  <li><strong>Pair yang relevan</strong> — misal XAUUSD, USDJPY, GBPUSD</li>
                  <li><strong>Waktu terbit</strong> — berapa menit/jam lalu + jam WIB lengkap</li>
                  <li><strong>Analisis &amp; Spekulasi</strong> — dampak ke market dan proyeksi pergerakan harga (diisi AI)</li>
                </ul>
                <br />
                <strong>🎯 Kesimpulan &amp; Spekulasi Market</strong><br />
                Ringkasan otomatis dari berita high-impact: arah market (Risk-On / Risk-Off), analisis fundamental,
                dan proyeksi pergerakan pair utama hari ini.
              </div>

              {/* Sub-guide: Cara baca berita */}
              <div style={{ marginTop: '14px', padding: '14px 16px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '8px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gold2)' }}>📖 Cara Baca Berita &amp; Terapkan ke Trading</div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '16px', flexShrink: 0 }}>1️⃣</span>
                    <div style={{ fontSize: '11px', color: 'var(--text2)', lineHeight: 1.6 }}>
                      <strong style={{ color: 'var(--text)' }}>Cek kalender sebelum market buka</strong><br />
                      Lihat event apa yang terjadi hari ini dan jam berapa (WIB). Hindari entry di dekat waktu rilis
                      event 🔴 High Impact — spread bisa melebar drastis dan harga bergerak tidak terduga.
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '16px', flexShrink: 0 }}>2️⃣</span>
                    <div style={{ fontSize: '11px', color: 'var(--text2)', lineHeight: 1.6 }}>
                      <strong style={{ color: 'var(--text)' }}>Baca label dampak &amp; pair relevan</strong><br />
                      Kalau kamu trading XAUUSD, fokus ke berita berlabel <strong>XAUUSD</strong> atau kategori
                      <em>Bank Sentral</em> dan <em>Ekonomi</em>. Berita inflasi AS (CPI/PPI) biasanya menggerakkan
                      Gold lebih dari 100 pips — wajib dipantau.
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '16px', flexShrink: 0 }}>3️⃣</span>
                    <div style={{ fontSize: '11px', color: 'var(--text2)', lineHeight: 1.6 }}>
                      <strong style={{ color: 'var(--text)' }}>Gunakan bagian Spekulasi sebagai konfirmasi bias</strong><br />
                      Spekulasi bukan sinyal buy/sell. Gunakan sebagai <em>konfirmasi</em> apakah bias analisis
                      teknikal kamu searah dengan sentimen fundamental. Kalau teknikal bullish tapi fundamental
                      Risk-Off, lebih baik tunggu konfirmasi lebih dulu.
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '16px', flexShrink: 0 }}>4️⃣</span>
                    <div style={{ fontSize: '11px', color: 'var(--text2)', lineHeight: 1.6 }}>
                      <strong style={{ color: 'var(--text)' }}>Aktifkan notifikasi untuk alert otomatis</strong><br />
                      Klik tombol <strong>🔔 Notif</strong> di pojok kanan atas → Aktifkan. Kamu akan dapat alert
                      di HP saat ada berita high-impact baru, dan pengingat untuk mengisi jurnal setiap hari.
                    </div>
                  </div>

                </div>
              </div>

              <span className="step-tag" onClick={() => switchPage('news')} style={{ marginTop: '10px', display: 'inline-block' }}>📰 Buka Tab News →</span>
            </div>
          </div>

        </div>
      </div>

      {/* API KEY GUIDE + ANALISIS FOTO */}
      <div className="home-api-section" id="api-guide-section">
        <div className="home-api-head">
          <div className="home-api-head-inner">
            <span className="home-api-icon">🤖</span>
            <div>
              <div className="home-api-eyebrow">Fitur Premium AI</div>
              <div className="home-api-title">Panduan <em>Analisis Foto MT5</em></div>
              <div className="home-api-sub">Hubungkan API Key Anthropic untuk membaca screenshot MT5 kamu secara otomatis — entry, close, SL/TP, pair, lot, dan tanggal terisi sendiri!</div>
            </div>
          </div>
        </div>

        <div className="home-api-body">
          {/* Langkah daftar API */}
          <div className="home-api-steps-col">
            <div className="home-api-section-label">⚙️ Cara Mendaftarkan API Key (2 Menit)</div>
            <div className="home-api-steps-list">
              <div className="home-api-step">
                <div className="home-api-snum">1</div>
                <div className="home-api-stxt">
                  <strong>Buka Console Anthropic</strong><br />
                  Kunjungi <a href="https://console.anthropic.com" target="_blank" rel="noopener" className="home-api-link">console.anthropic.com</a> dan daftar akun gratis menggunakan email kamu.
                </div>
              </div>
              <div className="home-api-step">
                <div className="home-api-snum">2</div>
                <div className="home-api-stxt">
                  <strong>Buat API Key Baru</strong><br />
                  Di dashboard, klik menu <strong>API Keys</strong> di sidebar kiri → klik tombol <strong>&quot;Create Key&quot;</strong> → beri nama (misal: &quot;Journalyze&quot;).
                </div>
              </div>
              <div className="home-api-step">
                <div className="home-api-snum">3</div>
                <div className="home-api-stxt">
                  <strong>Copy API Key</strong><br />
                  Key akan muncul sekali saja. Copy seluruh teksnya — formatnya:<br />
                  <code className="home-api-code">sk-ant-api03-xxxxxxxx...</code>
                </div>
              </div>
              <div className="home-api-step">
                <div className="home-api-snum">4</div>
                <div className="home-api-stxt">
                  <strong>Paste di Journalyze</strong><br />
                  Klik tombol <strong>&quot;API Key&quot;</strong> di topbar (pojok kanan atas) → paste key → klik <strong>&quot;Simpan &amp; Aktifkan&quot;</strong>. Tombol akan berubah hijau ✅
                </div>
              </div>
              <div className="home-api-step">
                <div className="home-api-snum">5</div>
                <div className="home-api-stxt">
                  <strong>Mulai Analisis Foto!</strong><br />
                  Di halaman <strong>Jurnal</strong>, klik <strong>&quot;+ Tambah Trade&quot;</strong> → di bagian upload foto, pilih screenshot MT5 kamu → AI akan otomatis mengisi form.
                </div>
              </div>
            </div>
            <div className="home-api-note">
              <span>💡</span>
              <span>Key tersimpan <strong>hanya di browser kamu</strong> — tidak pernah dikirim ke server Journalyze. Biaya API sangat terjangkau (~Rp 15/foto) dan ditagih langsung ke akun Anthropic kamu.</span>
            </div>
            <button className="home-api-cta" onClick={openApiKeyModal}>
              <span>🔑</span> Hubungkan API Key Sekarang →
            </button>
          </div>

          {/* Contoh Screenshot MT5 */}
          <div className="home-api-img-col">
            <div className="home-api-section-label">📱 Contoh Screenshot MT5 yang Bisa Dianalisis</div>
            <div className="home-api-img-wrap">
              <div className="home-api-img-glow"></div>
              <img
                src="/mt5-screenshot.png"
                alt="Contoh Screenshot MT5"
                className="home-api-mt5-img"
              />
              <div className="home-api-img-badge">MT5 · MetaTrader 5</div>
            </div>
            <div className="home-api-img-caption-list">
              <div className="home-api-img-caption-item">
                <div className="home-api-caption-dot green"></div>
                <div><strong>Entry &amp; Close</strong> — harga masuk dan keluar posisi terbaca otomatis</div>
              </div>
              <div className="home-api-img-caption-item">
                <div className="home-api-caption-dot gold"></div>
                <div><strong>SL / TP &amp; Lot</strong> — stop loss, take profit, dan ukuran lot terdeteksi</div>
              </div>
              <div className="home-api-img-caption-item">
                <div className="home-api-caption-dot blue"></div>
                <div><strong>Pair &amp; Tanggal</strong> — simbol instrumen dan waktu transaksi terisi sendiri</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* INFO CARDS */}
      <div className="home-tips">
        <div className="tip-card gold">
          <div className="tip-label">💰 Tips Risiko</div>
          <div className="tip-text">
            Jangan pernah risk lebih dari <strong>1–2% per trade</strong>. Dengan risk 1%, akun kamu bisa
            bertahan 100 loss berturut-turut. Disiplin manajemen risiko adalah kunci utama bertahan lama di pasar.
          </div>
        </div>
        <div className="tip-card green">
          <div className="tip-label">📋 Tips Jurnal</div>
          <div className="tip-text">
            Catat <strong>setiap trade tanpa terkecuali</strong> — termasuk yang loss. Data yang lengkap
            memungkinkan kamu menemukan pola kelemahan dan memperbaikinya sebelum merugikan lebih jauh.
          </div>
        </div>
        <div className="tip-card blue">
          <div className="tip-label">📊 Tips Analisa</div>
          <div className="tip-text">
            Review jurnal kamu <strong>minimal sekali seminggu</strong>. Gunakan halaman Filter untuk mencari
            pair dan sesi yang paling konsisten profit — fokus di situ, kurangi trade di area yang lemah.
          </div>
        </div>
        <div className="tip-card red">
          <div className="tip-label">⚠️ Peringatan</div>
          <div className="tip-text">
            <strong>Jangan revenge trading</strong> setelah loss besar. Tutup platform, istirahat minimal
            30 menit. Emosi adalah musuh terbesar trader — jurnal ini ada untuk membantu kamu tetap objektif.
          </div>
        </div>
      </div>

      <div className="home-footer-note">Journalyze · Trading Journal Suite · Catat. Analisa. Berkembang.</div>

    </div>
  );
}