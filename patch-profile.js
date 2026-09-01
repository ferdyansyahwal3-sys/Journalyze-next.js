/**
 * patch-profile.js
 * Jalankan dari ROOT folder project: node patch-profile.js
 * Otomatis patch JournalApp.tsx, Topbar.tsx, BottomNav.tsx, useJournalStore.ts
 */
const fs = require('fs');
const path = require('path');

let ok = 0, fail = 0;

function patch(filePath, label, fn) {
  try {
    const full = path.resolve(filePath);
    const content = fs.readFileSync(full, 'utf8');
    const result = fn(content);
    if (result === content) {
      console.log(`⚠️  ${label} — tidak ada perubahan (sudah dipatch?)`);
    } else {
      fs.writeFileSync(full, result);
      console.log(`✅ ${label}`);
      ok++;
    }
  } catch (e) {
    console.error(`❌ ${label}: ${e.message}`);
    fail++;
  }
}

// ────────────────────────────────────────────
// 1. store/useJournalStore.ts — tambah 'profile' ke JournalPage type
// ────────────────────────────────────────────
patch('store/useJournalStore.ts', 'useJournalStore.ts — tambah page profile', (c) => {
  return c
    // Tambah 'profile' ke type
    .replace(
      `export type JournalPage = 'home' | 'risk' | 'plan' | 'data' | 'filter' | 'weekly' | 'monthly' | 'news';`,
      `export type JournalPage = 'home' | 'risk' | 'plan' | 'data' | 'filter' | 'weekly' | 'monthly' | 'news' | 'profile';`
    );
});

// ────────────────────────────────────────────
// 2. components/journal/JournalApp.tsx — import & render PageProfile
// ────────────────────────────────────────────
patch('components/journal/JournalApp.tsx', 'JournalApp.tsx — import & render PageProfile', (c) => {
  return c
    // Tambah import setelah NotifModal
    .replace(
      `import NotifModal from './NotifModal';`,
      `import NotifModal from './NotifModal';\nimport PageProfile from './PageProfile';`
    )
    // Tambah render PageProfile setelah PageNews
    .replace(
      `        <PageNews active={activePage === 'news'} onOpenApiKeyModal={() => setApiKeyOpen(true)} />`,
      `        <PageNews active={activePage === 'news'} onOpenApiKeyModal={() => setApiKeyOpen(true)} />\n        <PageProfile active={activePage === 'profile'} onOpenApiKey={() => setApiKeyOpen(true)} onOpenNotif={() => setNotifOpen(true)} />`
    );
});

// ────────────────────────────────────────────
// 3. components/journal/Topbar.tsx — tambah menu item "Profil Saya"
// ────────────────────────────────────────────
patch('components/journal/Topbar.tsx', 'Topbar.tsx — tambah menu Profil Saya', (c) => {
  return c
    // Tambah setActivePage ke dalam destructure useJournalStore
    .replace(
      `  const userMenuOpen   = useJournalStore((s) => s.userMenuOpen);`,
      `  const setActivePage  = useJournalStore((s) => s.setActivePage);\n  const userMenuOpen   = useJournalStore((s) => s.userMenuOpen);`
    )
    // Tambah menu item Profil sebelum menu Keluar
    .replace(
      `        <div className="user-menu-item danger" onClick={doLogout}>
          🚪 Keluar
        </div>`,
      `        <div className="user-menu-item" onClick={() => { toggleUserMenu(); setActivePage('profile'); }}>
          👤 Profil Saya
        </div>
        <div className="user-menu-item danger" onClick={doLogout}>
          🚪 Keluar
        </div>`
    );
});

// ────────────────────────────────────────────
// 4. components/journal/BottomNav.tsx — tambah menu item Profil di drawer
// ────────────────────────────────────────────
patch('components/journal/BottomNav.tsx', 'BottomNav.tsx — tambah item Profil di drawer', (c) => {
  // Tambah handler navigasi ke profile
  c = c.replace(
    `  const handleOpenApiKey = () => { closeMoreDrawer(); onOpenApiKey?.(); };`,
    `  const handleOpenApiKey = () => { closeMoreDrawer(); onOpenApiKey?.(); };\n  const handleOpenProfile = () => { closeMoreDrawer(); setActivePage('profile' as any); };`
  );
  // Tambah tombol profil + keluar sebelum div user email
  c = c.replace(
    `        <div style={{ margin: '14px 0 0', padding: '14px 0 0', borderTop: '1px solid var(--gold-bd)' }}>`,
    `        {/* Profil */}
        <div className="bn-drawer-theme" style={{ marginTop: 12, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <span className="bn-drawer-theme-label">Akun</span>
          <button className="bn-drawer-item" style={{ justifyContent:'center' }} onClick={handleOpenProfile}>
            👤 Profil Saya
          </button>
        </div>

        <div style={{ margin: '14px 0 0', padding: '14px 0 0', borderTop: '1px solid var(--gold-bd)' }}>`
  );
  return c;
});

console.log(`\n── Selesai: ${ok} sukses, ${fail} gagal ──`);