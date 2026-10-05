// scripts/generate-pixel-pages.mjs
// Memindai folder app/ dan menulis daftar halaman ke lib/pixelPages.generated.ts
// Dipakai dropdown "Halaman" di admin Pixel.
// Dijalankan otomatis oleh `npm run dev` dan `npm run build` (atau manual: npm run pixel:pages).
import { readdirSync, statSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const appDir = existsSync(join(root, 'app')) ? join(root, 'app') : join(root, 'src', 'app');
const outFile = join(root, 'lib', 'pixelPages.generated.ts');

const PAGE_FILES = new Set(['page.tsx', 'page.ts', 'page.jsx', 'page.js', 'page.mdx']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name.startsWith('_') || name.startsWith('.')) continue;
      walk(full, out);
    } else if (PAGE_FILES.has(name)) {
      out.push(full);
    }
  }
  return out;
}

function toRoute(file) {
  const rel = relative(appDir, dirname(file));
  const segs = rel === '' ? [] : rel.split(sep);
  const parts = [];
  for (const seg of segs) {
    if (seg.startsWith('@')) return null;                 // parallel route slot
    if (/^\(\.{1,3}\)/.test(seg)) return null;            // intercepting route
    if (/^\(.*\)$/.test(seg)) continue;                   // route group → tidak ada di URL
    if (/^\[.*\]$/.test(seg)) { parts.push('*'); break; } // segmen dinamis → wildcard
    parts.push(seg);
  }
  return '/' + parts.join('/');
}

function noteFor(path) {
  if (path === '/') return 'Beranda / landing page (alamat /home dialihkan ke sini)';
  if (path.includes('*')) return 'Halaman dinamis';
  return '';
}

let pages = [];
if (!existsSync(appDir)) {
  console.warn('[pixel-pages] Folder app/ tidak ditemukan, dilewati.');
  process.exit(0);
}

const routes = new Set();
for (const file of walk(appDir)) {
  const route = toRoute(file);
  if (!route) continue;
  if (route === '/admin' || route.startsWith('/admin/')) continue; // admin tidak dilacak
  routes.add(route);
}

pages = [...routes]
  .sort((a, b) => (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b)))
  .map((path) => ({ path, note: noteFor(path) }));

const body = pages
  .map((p) => `  { path: ${JSON.stringify(p.path)}, note: ${JSON.stringify(p.note)} },`)
  .join('\n');

const content = `// AUTO-GENERATED oleh scripts/generate-pixel-pages.mjs — jangan edit manual.
// Diperbarui otomatis saat \`npm run dev\` dan \`npm run build\`.
export interface PixelPage {
  path: string;
  note: string;
}

export const PIXEL_PAGES: PixelPage[] = [
${body}
];
`;

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, content);
console.log('[pixel-pages] ' + pages.length + ' halaman: ' + pages.map((p) => p.path).join(', '));
