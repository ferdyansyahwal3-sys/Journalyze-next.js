/**
 * fix-journalyze.js
 * Jalankan dari ROOT folder project: node fix-journalyze.js
 * Fix semua bug hasil analisis Journalyze Next.js
 */

const fs = require('fs');
const path = require('path');

let ok = 0, skip = 0, fail = 0;

function patch(filePath, label, fn) {
  try {
    const full = path.resolve(filePath);
    if (!fs.existsSync(full)) {
      console.log(`⚠️  SKIP ${label} — file tidak ditemukan: ${filePath}`);
      skip++;
      return;
    }
    const content = fs.readFileSync(full, 'utf8');
    const result = fn(content);
    if (result === null) { skip++; return; }
    if (result === content) {
      console.log(`⏭️  SKIP ${label} — sudah dipatch sebelumnya`);
      skip++;
    } else {
      fs.writeFileSync(full, result);
      console.log(`✅  OK   ${label}`);
      ok++;
    }
  } catch (e) {
    console.error(`❌  FAIL ${label}: ${e.message}`);
    fail++;
  }
}

console.log('\n══ Fix Journalyze — mulai ══\n');

// ─────────────────────────────────────────────────────────────
// FIX 1: BottomNav.tsx — hapus 'as any', profile sudah valid JournalPage
// ─────────────────────────────────────────────────────────────
patch(
  'components/journal/BottomNav.tsx',
  'BottomNav.tsx — hapus "as any" di handleOpenProfile',
  (c) => c.replace(
    `setActivePage('profile' as any)`,
    `setActivePage('profile')`
  )
);

// ─────────────────────────────────────────────────────────────
// FIX 2: PageProfile.tsx — hapus duplicate property fontSize
// ─────────────────────────────────────────────────────────────
patch(
  'components/journal/PageProfile.tsx',
  'PageProfile.tsx — hapus duplicate fontSize property',
  (c) => c.replace(
    `{ fontSize: 11, color: 'var(--text3)', fontFamily: \"'JetBrains Mono',monospace\", fontSize: 10 as any }`,
    `{ fontSize: 10, color: 'var(--text3)', fontFamily: \"'JetBrains Mono',monospace\" }`
  )
);

// ─────────────────────────────────────────────────────────────
// FIX 3: PageProfile.tsx — grid 2 kolom inline → class .g2 (responsive)
// ─────────────────────────────────────────────────────────────
patch(
  'components/journal/PageProfile.tsx',
  'PageProfile.tsx — inline grid 2 kolom → class .g2 (responsive mobile)',
  (c) => c.replace(
    `<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>`,
    `<div className="g2" style={{ marginBottom: 16 }}>`
  )
);

// ─────────────────────────────────────────────────────────────
// FIX 4: DemoBotNav.tsx — tambah 'profile' ke Record<JournalPage>
// ─────────────────────────────────────────────────────────────
patch(
  'components/demo/DemoBotNav.tsx',
  'DemoBotNav.tsx — tambah profile ke PAGE_ICONS & PAGE_LABELS',
  (c) => {
    c = c.replace(
      `  news:    '📰',\n};`,
      `  news:    '📰',\n  profile: '👤',\n};`
    );
    c = c.replace(
      `  news:    'News',\n};`,
      `  news:    'News',\n  profile: 'Profil',\n};`
    );
    return c;
  }
);

// ─────────────────────────────────────────────────────────────
// FIX 5: DemoTopbar.tsx — tambah 'profile' ke Record<JournalPage>
// ─────────────────────────────────────────────────────────────
patch(
  'components/demo/DemoTopbar.tsx',
  'DemoTopbar.tsx — tambah profile ke PAGE_LABELS',
  (c) => c.replace(
    `  news:    'News',\n};`,
    `  news:    'News',\n  profile: 'Profil',\n};`
  )
);

// ─────────────────────────────────────────────────────────────
// FIX 6: Hapus file sampah '-p' di root (sisa git command salah)
// ─────────────────────────────────────────────────────────────
try {
  const badFile = path.resolve('-p');
  if (fs.existsSync(badFile)) {
    fs.unlinkSync(badFile);
    console.log('✅  OK   Root — hapus file sampah "-p"');
    ok++;
  } else {
    console.log('⏭️  SKIP Root — file "-p" tidak ada (sudah bersih)');
    skip++;
  }
} catch(e) {
  console.error('❌  FAIL Root — gagal hapus file "-p":', e.message);
  fail++;
}

// ─────────────────────────────────────────────────────────────
// HASIL
// ─────────────────────────────────────────────────────────────
console.log(`\n══ Selesai: ${ok} fix diterapkan | ${skip} skip | ${fail} gagal ══\n`);

if (fail === 0) {
  console.log('🟢 Semua fix berhasil! Jalankan perintah berikut untuk verifikasi:');
  console.log('   npx tsc --noEmit\n');
  console.log('   Kalau output kosong = 0 error TypeScript. ✓');
} else {
  console.log('🔴 Ada yang gagal. Cek pesan error di atas.');
}
