// components/admin/PixelPanel.tsx
// Halaman "Pengaturan Pixel" (sub-tab di menu Pixel):
//  1. Ringkasan status + daftar Analitik (Jenis, Nama, Pixel ID) — bisa lebih dari satu
//  2. Aturan Event (event, halaman dari dropdown, trigger, tujuan analitik, parameter)
//  3. Uji Coba (mode debug + panduan Test Events)
//  4. Event Log
// Semua disimpan ke Supabase 'settings' — berlaku tanpa redeploy Vercel.
// Tampilan memakai bahasa desain yang sama dengan Analitik Meta (gaya di pixel-settings.css).
'use client';

import { useEffect, useState, useCallback } from 'react';
import { _sb, _sbAdmin } from '@/lib/supabaseClient';
import { PIXEL_PAGES } from '@/lib/pixelPages.generated';
import { useAdminStore } from '@/store/useAdminStore';
import {
  DEFAULT_PIXEL_RULES,
  STANDARD_EVENTS,
  parsePixelAnalytics,
  parsePixelRules,
} from '@/hooks/usePixel';
import type {
  PixelAnalytics,
  PixelAnalyticsType,
  PixelRule,
  PixelTriggerType,
  PixelValueMode,
} from '@/hooks/usePixel';
import './dashboard.css';
import './pixel-settings.css';

interface PixelEvent {
  id: string;
  event_name: string;
  page: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface AnalyticsForm {
  id: string | null; // null = analitik baru
  type: PixelAnalyticsType;
  name: string;
  pixelId: string;
  token: string;    // Conversion API token — hanya disimpan di browser admin ini (localStorage)
  testCode: string; // Kode Testing — hanya disimpan di browser admin ini (localStorage)
}

interface CapiSecret {
  token: string;
  testCode: string;
}

interface RuleForm {
  id: string | null; // null = aturan baru
  eventChoice: string;
  customEvent: string;
  pages: string;
  trigger: PixelTriggerType;
  selector: string;
  scrollPercent: string;
  valueMode: PixelValueMode;
  value: string;
  contentName: string;
  targets: string[];
}

const CUSTOM = '__custom__';

const ANALYTICS_TYPE_OPTIONS: { value: PixelAnalyticsType; label: string }[] = [
  { value: 'meta_pixel', label: 'Meta Pixel' },
];

const EMPTY_ANALYTICS_FORM: AnalyticsForm = { id: null, type: 'meta_pixel', name: '', pixelId: '', token: '', testCode: '' };

const EMPTY_RULE_FORM: RuleForm = {
  id: null,
  eventChoice: 'ViewContent',
  customEvent: '',
  pages: '',
  trigger: 'page_load',
  selector: '',
  scrollPercent: '50',
  valueMode: 'none',
  value: '',
  contentName: '',
  targets: [],
};

const TRIGGER_OPTIONS: { value: PixelTriggerType; label: string; hint: string }[] = [
  { value: 'page_load', label: 'Halaman dibuka', hint: 'Event dikirim sekali saat halaman yang cocok dibuka.' },
  {
    value: 'click',
    label: 'Elemen diklik',
    hint: 'Isi selector CSS (#id atau .class), atau text:Teks Tombol untuk mencocokkan lewat teks tombol/link.',
  },
  { value: 'scroll', label: 'Scroll halaman', hint: 'Dikirim sekali per kunjungan saat pengunjung scroll sampai persentase ini.' },
  {
    value: 'pay_click',
    label: 'Tombol bayar diklik',
    hint: 'Titik ini hanya tersedia di /order (setelah form valid) dan /checkout, sebelum pembayaran dibuat.',
  },
  {
    value: 'payment_success',
    label: 'Pembayaran sukses',
    hint: 'Titik ini hanya tersedia di /order dan /checkout, saat pembayaran Midtrans sukses.',
  },
];

const VALUE_MODE_OPTIONS: { value: PixelValueMode; label: string }[] = [
  { value: 'none', label: 'Tanpa nilai' },
  { value: 'fixed', label: 'Angka tetap' },
  { value: 'auto', label: 'Otomatis (harga paket)' },
];

const triggerLabel = (t: PixelTriggerType) => TRIGGER_OPTIONS.find((o) => o.value === t)?.label || t;
const typeLabel = (t: PixelAnalyticsType) => ANALYTICS_TYPE_OPTIONS.find((o) => o.value === t)?.label || t;

const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// Token Conversion API & Kode Testing disimpan HANYA di localStorage browser admin ini.
// Tidak dikirim ke Supabase. Dikirim ke server hanya saat klik "Kirim Tes" (lewat HTTPS, tanpa disimpan).
const SECRETS_KEY = 'jz_capi_secrets_v1';

function readSecrets(): Record<string, CapiSecret> {
  try {
    const raw = window.localStorage.getItem(SECRETS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, CapiSecret> = {};
    for (const [pid, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (!v || typeof v !== 'object') continue;
      const o = v as Record<string, unknown>;
      out[pid] = {
        token: typeof o.token === 'string' ? o.token : '',
        testCode: typeof o.testCode === 'string' ? o.testCode : '',
      };
    }
    return out;
  } catch {
    return {};
  }
}

function writeSecrets(map: Record<string, CapiSecret>) {
  try {
    window.localStorage.setItem(SECRETS_KEY, JSON.stringify(map));
  } catch {
    // penyimpanan browser penuh/diblokir — abaikan
  }
}

const maskToken = (t: string) => (t.length > 4 ? `…${t.slice(-4)}` : '••••');

// Header Authorization dari sesi login admin — dipakai untuk memanggil route server /api/pixel/*
async function authHeaders(): Promise<Record<string, string>> {
  try {
    const { data } = await _sb.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

const splitPages = (csv: string): string[] =>
  csv.split(',').map((s) => s.trim()).filter(Boolean);

function ruleToForm(r: PixelRule): RuleForm {
  const isStandard = STANDARD_EVENTS.includes(r.event);
  return {
    id: r.id,
    eventChoice: isStandard ? r.event : CUSTOM,
    customEvent: isStandard ? '' : r.event,
    // /home dialihkan ke "/", jadi tampilkan sebagai "/"
    pages: splitPages(r.pages).map((p) => (p.toLowerCase() === '/home' ? '/' : p)).join(', '),
    trigger: r.trigger,
    selector: r.selector || '',
    scrollPercent: String(r.scrollPercent ?? 50),
    valueMode: r.valueMode,
    value: r.value !== undefined ? String(r.value) : '',
    contentName: r.contentName || '',
    targets: r.targets ? [...r.targets] : [],
  };
}

function formToRule(
  f: RuleForm,
  enabled: boolean,
  analyticsCount: number
): { rule?: PixelRule; error?: string } {
  const event = (f.eventChoice === CUSTOM ? f.customEvent : f.eventChoice).trim();
  if (!/^[A-Za-z][A-Za-z0-9_]{0,49}$/.test(event)) {
    return { error: 'Nama event hanya boleh huruf, angka, dan underscore (mulai dengan huruf, maksimal 50 karakter).' };
  }

  const patterns = splitPages(f.pages);
  if (patterns.length === 0) {
    return { error: 'Pilih minimal satu halaman (atau "Semua halaman").' };
  }
  if (patterns.some((p) => p !== '*' && !p.startsWith('/'))) {
    return { error: 'Path khusus harus diawali "/" (contoh: /promo, /blog/*).' };
  }

  const rule: PixelRule = {
    id: f.id ?? newId('r'),
    enabled,
    event,
    pages: patterns.join(', '),
    trigger: f.trigger,
    valueMode: f.valueMode,
  };

  if (f.trigger === 'click') {
    const sel = f.selector.trim();
    if (!sel) return { error: 'Isi selector untuk trigger klik, contoh: #btn-daftar atau text:Dapatkan Akses.' };
    if (!sel.toLowerCase().startsWith('text:')) {
      try {
        document.createDocumentFragment().querySelector(sel);
      } catch {
        return { error: 'Selector CSS tidak valid.' };
      }
    }
    rule.selector = sel;
  }

  if (f.trigger === 'scroll') {
    const n = Number(f.scrollPercent);
    if (!Number.isFinite(n) || n < 1 || n > 100) return { error: 'Persentase scroll harus antara 1 dan 100.' };
    rule.scrollPercent = Math.round(n);
  }

  if (f.valueMode === 'fixed') {
    const v = Number(f.value);
    if (f.value.trim() === '' || !Number.isFinite(v) || v < 0) {
      return { error: 'Nilai tetap harus berupa angka 0 atau lebih.' };
    }
    rule.value = v;
  }

  const cn = f.contentName.trim();
  if (cn) rule.contentName = cn.slice(0, 100);

  // Semua analitik dicentang atau tidak ada yang dicentang = kirim ke semua
  if (f.targets.length > 0 && f.targets.length < analyticsCount) rule.targets = [...f.targets];

  return { rule };
}

function describeParams(r: PixelRule): string {
  const parts: string[] = [];
  if (r.valueMode === 'fixed' && r.value !== undefined) parts.push('Rp ' + r.value.toLocaleString('id-ID'));
  if (r.valueMode === 'auto') parts.push('Nilai otomatis');
  if (r.contentName) parts.push(r.contentName);
  return parts.length ? parts.join(' · ') : '—';
}

/* ════════════════════════════════════════════════════════════
   PAGE PICKER — dropdown multi-pilih, daftar halaman otomatis
   dari scripts/generate-pixel-pages.mjs (diperbarui tiap dev/build)
   ════════════════════════════════════════════════════════════ */

function PagePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const [customError, setCustomError] = useState('');

  const selected = splitPages(value);
  const known = new Set(PIXEL_PAGES.map((p) => p.path));
  const customSelected = selected.filter((p) => p !== '*' && !known.has(p));
  const allSelected = selected.includes('*');

  const emit = (arr: string[]) => onChange(arr.join(', '));

  const toggle = (path: string) => {
    if (path === '*') {
      emit(allSelected ? [] : ['*']);
      return;
    }
    const base = selected.filter((p) => p !== '*');
    emit(base.includes(path) ? base.filter((p) => p !== path) : [...base, path]);
  };

  const addCustom = () => {
    const p = custom.trim();
    if (!p) return;
    if (!p.startsWith('/')) {
      setCustomError('Path harus diawali "/".');
      return;
    }
    setCustomError('');
    const base = selected.filter((s) => s !== '*');
    if (!base.includes(p)) emit([...base, p]);
    setCustom('');
  };

  const summary = () => {
    if (selected.length === 0) return 'Pilih halaman…';
    if (allSelected) return 'Semua halaman';
    const shown = selected.slice(0, 3).join(', ');
    return selected.length > 3 ? `${shown} +${selected.length - 3}` : shown;
  };

  return (
    <div className="ps-pp">
      <button
        type="button"
        className={`ps-input ps-pp-btn${selected.length === 0 ? ' empty' : ''}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="ps-pp-sum">{summary()}</span>
        <span className="ps-pp-caret">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <>
          <div className="ps-pp-backdrop" onClick={() => setOpen(false)} />
          <div className="ps-pp-menu">
            <div className="ps-pp-list">
              <label className="ps-pp-row sep">
                <input type="checkbox" checked={allSelected} onChange={() => toggle('*')} />
                <span>
                  <strong>Semua halaman</strong>
                  <small>Berlaku di seluruh halaman publik (admin tetap dikecualikan)</small>
                </span>
              </label>

              {PIXEL_PAGES.map((p) => (
                <label key={p.path} className={`ps-pp-row${allSelected ? ' dim' : ''}`}>
                  <input
                    type="checkbox"
                    checked={selected.includes(p.path)}
                    disabled={allSelected}
                    onChange={() => toggle(p.path)}
                  />
                  <span>
                    {p.path}
                    {p.note && <small>{p.note}</small>}
                  </span>
                </label>
              ))}

              {customSelected.map((p) => (
                <label key={p} className="ps-pp-row">
                  <input type="checkbox" checked onChange={() => toggle(p)} />
                  <span>
                    {p}
                    <small>Path khusus</small>
                  </span>
                </label>
              ))}
            </div>

            <div className="ps-pp-foot">
              <div className="ps-pp-foot-row">
                <input
                  className="ps-input"
                  type="text"
                  placeholder="Path lain, mis. /promo atau /blog/*"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustom();
                    }
                  }}
                />
                <button type="button" className="ps-btn" onClick={addCustom}>
                  Tambah
                </button>
              </div>
              {customError && <div className="ps-hint err">{customError}</div>}
              <div className="ps-hint">
                Daftar halaman diperbarui otomatis tiap kamu menjalankan dev atau deploy.
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   PANEL
   ════════════════════════════════════════════════════════════ */

interface Props { active: boolean }

export default function PixelPanel({ active }: Props) {
  const [saveMsg, setSaveMsg] = useState('');
  const [events, setEvents] = useState<PixelEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [statsPageView, setStatsPageView] = useState(0);
  const [statsPurchase, setStatsPurchase] = useState(0);

  const [analytics, setAnalytics] = useState<PixelAnalytics[]>([]);
  const [savingAnalytics, setSavingAnalytics] = useState(false);
  const [aForm, setAForm] = useState<AnalyticsForm | null>(null);
  const [aFormError, setAFormError] = useState('');
  const [capiStatus, setCapiStatus] = useState<Record<string, boolean>>({});
  const [secrets, setSecrets] = useState<Record<string, CapiSecret>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; title: string; text: string } | null>(null);

  const [rules, setRules] = useState<PixelRule[]>([]);
  const [savingRules, setSavingRules] = useState(false);
  const [form, setForm] = useState<RuleForm | null>(null);
  const [formError, setFormError] = useState('');

  const [testPage, setTestPage] = useState('/');

  const showMsg = (msg: string) => {
    setSaveMsg(msg);
    setTimeout(() => setSaveMsg(''), 3000);
  };

  const loadSettings = useCallback(async () => {
    try {
      const { data, error } = await _sbAdmin
        .from('settings')
        .select('key, value')
        .in('key', ['pixel_id', 'pixel_enabled', 'pixel_analytics', 'pixel_rules']);
      if (error) throw error;
      const get = (k: string): string | undefined =>
        data?.find((r: { key: string }) => r.key === k)?.value;
      setAnalytics(parsePixelAnalytics(get('pixel_analytics'), get('pixel_id'), get('pixel_enabled') === 'true'));
      setRules(parsePixelRules(get('pixel_rules')));
    } catch (e) {
      console.error('loadSettings error:', e);
    }
  }, []);

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const { data } = await _sbAdmin
        .from('pixel_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      setEvents(data || []);

      // stats
      const pv = (data || []).filter((e: PixelEvent) => e.event_name === 'PageView').length;
      const pu = (data || []).filter((e: PixelEvent) => e.event_name === 'Purchase').length;
      setStatsPageView(pv);
      setStatsPurchase(pu);
    } catch (e) {
      console.error('loadEvents error:', e);
    } finally {
      setEventsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    loadSettings();
    loadEvents();
  }, [active, loadSettings, loadEvents]);

  // Status token Conversion API (hanya ya/tidak — nilai token tidak pernah dikirim ke browser)
  const loadCapiStatus = useCallback(async (list: PixelAnalytics[]) => {
    const ids = list.map((a) => a.pixelId).filter(Boolean);
    if (ids.length === 0) {
      setCapiStatus({});
      return;
    }
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/pixel/capi-status?ids=' + encodeURIComponent(ids.join(',')), { headers });
      if (!res.ok) {
        setCapiStatus({});
        return;
      }
      const json = await res.json();
      setCapiStatus(json.configured || {});
    } catch {
      setCapiStatus({});
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    loadCapiStatus(analytics);
  }, [active, analytics, loadCapiStatus]);

  // Token & Kode Testing dibaca dari localStorage browser ini (bukan dari Supabase)
  useEffect(() => {
    setSecrets(readSecrets());
  }, []);

  /* ── Simpan ke Supabase ── */

  const upsertSetting = async (key: string, value: string) => {
    const { error } = await _sbAdmin
      .from('settings')
      .upsert([{ key, value, updated_at: new Date().toISOString() }], { onConflict: 'key' });
    if (error) throw error;
  };

  const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

  /* ── Analitik ── */

  const persistAnalytics = async (next: PixelAnalytics[], okMsg: string): Promise<boolean> => {
    setSavingAnalytics(true);
    try {
      await upsertSetting('pixel_analytics', JSON.stringify(next));
      setAnalytics(next);
      showMsg(okMsg);
      return true;
    } catch (e: unknown) {
      showMsg('❌ Gagal menyimpan analitik: ' + errText(e));
      return false;
    } finally {
      setSavingAnalytics(false);
    }
  };

  const openNewAnalytics = () => {
    setAFormError('');
    setAForm({ ...EMPTY_ANALYTICS_FORM });
  };

  const openEditAnalytics = (a: PixelAnalytics) => {
    setAFormError('');
    setAForm({
      id: a.id,
      type: a.type,
      name: a.name,
      pixelId: a.pixelId,
      token: '', // dikosongkan: kosong = tetap memakai token yang sudah tersimpan
      testCode: secrets[a.pixelId]?.testCode ?? a.testCode ?? '',
    });
  };

  const handleSubmitAnalytics = async () => {
    if (!aForm || savingAnalytics) return;
    const name = aForm.name.trim();
    const pixelId = aForm.pixelId.trim();

    if (!name) {
      setAFormError('Nama wajib diisi.');
      return;
    }
    if (name.length > 60) {
      setAFormError('Nama maksimal 60 karakter.');
      return;
    }
    if (!pixelId) {
      setAFormError('Pixel ID wajib diisi.');
      return;
    }
    if (!/^\d+$/.test(pixelId)) {
      setAFormError('Pixel ID hanya boleh berisi angka.');
      return;
    }
    const testCodeValue = aForm.testCode.trim();
    if (testCodeValue && !/^[A-Za-z0-9_-]{1,40}$/.test(testCodeValue)) {
      setAFormError('Kode Testing hanya boleh huruf, angka, strip, dan underscore (contoh: TEST12345).');
      return;
    }
    const tokenValue = aForm.token.trim();
    if (tokenValue && !/^\S{20,600}$/.test(tokenValue)) {
      setAFormError('Format Conversion API Token tidak valid (tanpa spasi, minimal 20 karakter).');
      return;
    }
    if (analytics.some((a) => a.id !== aForm.id && a.type === aForm.type && a.pixelId === pixelId)) {
      setAFormError('Pixel ID ini sudah terdaftar.');
      return;
    }

    setAFormError('');
    const existing = aForm.id ? analytics.find((a) => a.id === aForm.id) : undefined;
    const item: PixelAnalytics = {
      id: aForm.id ?? newId('a'),
      type: aForm.type,
      name,
      pixelId,
      enabled: existing ? existing.enabled : true,
    };
    const next = aForm.id ? analytics.map((a) => (a.id === aForm.id ? item : a)) : [...analytics, item];
    const ok = await persistAnalytics(
      next,
      aForm.id ? `✅ Analitik ${name} diperbarui.` : `✅ Analitik ${name} ditambahkan. Berlaku di halaman publik setelah refresh.`
    );
    if (ok) {
      // Token & Kode Testing: hanya ke localStorage browser ini, TIDAK ke Supabase
      const nextSecrets = { ...secrets };
      const keptToken = tokenValue || nextSecrets[pixelId]?.token || '';
      if (keptToken || testCodeValue) {
        nextSecrets[pixelId] = { token: keptToken, testCode: testCodeValue };
      } else {
        delete nextSecrets[pixelId];
      }
      writeSecrets(nextSecrets);
      setSecrets(nextSecrets);
      setAForm(null);
    }
  };

  const handleToggleAnalytics = async (id: string) => {
    if (savingAnalytics) return;
    const target = analytics.find((a) => a.id === id);
    if (!target) return;
    const next = analytics.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a));
    await persistAnalytics(next, target.enabled ? `⚠️ ${target.name} dinonaktifkan.` : `✅ ${target.name} diaktifkan!`);
  };

  const handleDeleteAnalytics = async (id: string) => {
    if (savingAnalytics || savingRules) return;
    const target = analytics.find((a) => a.id === id);
    if (!target) return;
    if (!window.confirm(`Hapus analitik ${target.name} (${target.pixelId})?`)) return;

    const ok = await persistAnalytics(analytics.filter((a) => a.id !== id), `✅ Analitik ${target.name} dihapus.`);
    if (!ok) return;

    if (secrets[target.pixelId]) {
      const nextSecrets = { ...secrets };
      delete nextSecrets[target.pixelId];
      writeSecrets(nextSecrets);
      setSecrets(nextSecrets);
    }

    // Aturan yang hanya menuju analitik ini dinonaktifkan; aturan lain cukup dilepas dari tujuan ini
    let changed = false;
    const nextRules = rules.map((r) => {
      if (!r.targets || !r.targets.includes(id)) return r;
      changed = true;
      const remaining = r.targets.filter((t) => t !== id);
      if (remaining.length === 0) {
        const { targets: _unused, ...rest } = r;
        void _unused;
        return { ...rest, enabled: false };
      }
      return { ...r, targets: remaining };
    });
    if (changed) await persistRules(nextRules, `✅ Analitik ${target.name} dihapus. Aturan yang hanya menuju analitik ini dinonaktifkan.`);
  };

  // Kirim satu event tes dari SERVER ke Meta memakai Kode Testing, lalu tampilkan balasan asli Meta
  const handleTestEvent = async (a: PixelAnalytics) => {
    if (testingId) return;
    const secret = secrets[a.pixelId];
    if (!secret || !secret.token) {
      setTestResult({ ok: false, title: `Tes ${a.name} gagal`, text: 'Isi Conversion API Token dulu: klik Edit pada analitik ini.' });
      return;
    }
    if (!secret.testCode) {
      setTestResult({ ok: false, title: `Tes ${a.name} gagal`, text: 'Isi Kode Testing dulu (Events Manager → Test Events): klik Edit pada analitik ini.' });
      return;
    }
    setTestingId(a.id);
    setTestResult(null);
    try {
      const headers = { 'Content-Type': 'application/json', ...(await authHeaders()) };
      const res = await fetch('/api/pixel/test', {
        method: 'POST',
        headers,
        body: JSON.stringify({ pixelId: a.pixelId, token: secret.token, testCode: secret.testCode }),
      });
      const json = await res.json().catch(() => ({} as Record<string, unknown>));
      if (res.ok && json.ok) {
        setTestResult({
          ok: true,
          title: `Tes ${a.name} berhasil`,
          text: `Meta menerima ${json.events_received} event dari server · fbtrace_id: ${json.fbtrace_id} · Kode Testing: ${json.test_event_code}. Buka Events Manager → Test Events dan lihat event PageView dengan sumber "Server".`,
        });
      } else {
        setTestResult({
          ok: false,
          title: `Tes ${a.name} gagal`,
          text: typeof json.error === 'string' ? json.error : `Gagal (HTTP ${res.status})`,
        });
      }
    } catch (e: unknown) {
      setTestResult({ ok: false, title: `Tes ${a.name} gagal`, text: errText(e) });
    } finally {
      setTestingId(null);
    }
  };

  /* ── Aturan event ── */

  const persistRules = async (next: PixelRule[], okMsg: string): Promise<boolean> => {
    setSavingRules(true);
    try {
      await upsertSetting('pixel_rules', JSON.stringify(next));
      setRules(next);
      showMsg(okMsg);
      return true;
    } catch (e: unknown) {
      showMsg('❌ Gagal menyimpan aturan: ' + errText(e));
      return false;
    } finally {
      setSavingRules(false);
    }
  };

  const handleToggleRule = async (id: string) => {
    if (savingRules) return;
    const target = rules.find((r) => r.id === id);
    if (!target) return;
    const next = rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r));
    await persistRules(next, target.enabled ? `⚠️ Aturan ${target.event} dinonaktifkan.` : `✅ Aturan ${target.event} diaktifkan!`);
  };

  const handleDeleteRule = async (id: string) => {
    if (savingRules) return;
    const target = rules.find((r) => r.id === id);
    if (!target) return;
    if (!window.confirm(`Hapus aturan ${target.event} di ${target.pages}?`)) return;
    await persistRules(rules.filter((r) => r.id !== id), `✅ Aturan ${target.event} dihapus.`);
    if (form && form.id === id) setForm(null);
  };

  const handleResetRules = async () => {
    if (savingRules) return;
    if (!window.confirm('Kembalikan semua aturan ke pengaturan awal? Aturan yang sudah kamu buat akan hilang.')) return;
    const ok = await persistRules(DEFAULT_PIXEL_RULES.map((r) => ({ ...r })), '✅ Aturan dikembalikan ke pengaturan awal.');
    if (ok) setForm(null);
  };

  const handleSubmitForm = async () => {
    if (!form || savingRules) return;
    const existing = form.id ? rules.find((r) => r.id === form.id) : undefined;
    const { rule, error } = formToRule(form, existing ? existing.enabled : true, analytics.length);
    if (!rule) {
      setFormError(error || 'Form tidak valid.');
      return;
    }
    setFormError('');
    const next = form.id ? rules.map((r) => (r.id === form.id ? rule : r)) : [...rules, rule];
    const ok = await persistRules(next, form.id ? `✅ Aturan ${rule.event} diperbarui.` : `✅ Aturan ${rule.event} ditambahkan.`);
    if (ok) setForm(null);
  };

  const openNewForm = () => {
    setFormError('');
    setForm({ ...EMPTY_RULE_FORM, targets: [] });
  };

  const openEditForm = (r: PixelRule) => {
    setFormError('');
    setForm(ruleToForm(r));
  };

  const updateForm = (patch: Partial<RuleForm>) => {
    setForm((f) => (f ? { ...f, ...patch } : f));
  };

  const toggleTarget = (id: string) => {
    setForm((f) => {
      if (!f) return f;
      return { ...f, targets: f.targets.includes(id) ? f.targets.filter((t) => t !== id) : [...f.targets, id] };
    });
  };

  /* ── Turunan tampilan ── */

  const activeAnalytics = analytics.filter((a) => a.enabled);
  const analyticsName = (id: string) => analytics.find((a) => a.id === id)?.name || '(dihapus)';
  const activeRules = rules.filter((r) => r.enabled).length;
  const tokenCount = analytics.filter((a) => secrets[a.pixelId]?.token).length;
  const serverPurchaseCount = analytics.filter((a) => capiStatus[a.pixelId]).length;

  const previewScript =
    activeAnalytics.length > 0
      ? `!function(f,b,e,v,n,t,s){...}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
${activeAnalytics.map((a) => `fbq('init', '${a.pixelId}'); // ${a.name}`).join('\n')}
// Event dikirim terpisah sesuai Aturan Event di bawah`
      : '(Tambahkan analitik aktif terlebih dahulu)';

  const testablePages = PIXEL_PAGES.filter((p) => !p.path.includes('*'));

  const formatDate = (str: string) => {
    try {
      return new Date(str).toLocaleString('id-ID', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
      });
    } catch { return str; }
  };

  const refreshAll = () => {
    loadSettings();
    loadEvents();
  };

  if (!active) return null;

  const currentTriggerHint = form ? TRIGGER_OPTIONS.find((o) => o.value === form.trigger)?.hint : '';
  const pixelOn = activeAnalytics.length > 0;

  return (
    <div className="main lp-dash ps-wrap">
      {/* Header */}
      <div className="lp-head">
        <div>
          <div className="lp-eyebrow">Meta Pixel</div>
          <h2 className="lp-title">Pengaturan <em>Pixel</em></h2>
          <p className="lp-sub">Kelola analitik, aturan event, dan uji coba tracking untuk halaman publik Journalyze.</p>
        </div>
        <div className="ps-head-actions">
          <button className="refresh-btn" onClick={refreshAll} disabled={eventsLoading}>
            {eventsLoading ? <><span className="spinner" />Memuat...</> : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Pesan simpan */}
      {saveMsg && (
        <div className={`ps-msg ${saveMsg.startsWith('✅') ? 'ok' : 'err'}`}>{saveMsg}</div>
      )}

      {/* Baris atas: ringkasan + status */}
      <div className="lp-top">
        <div className="lp-card lp-left">
          <div className="lp-card-title">
            Ringkasan tracking
            {pixelOn ? <span className="lp-live">Pixel aktif</span> : <span className="ps-badge">Belum aktif</span>}
          </div>
          <div className="ps-stats">
            <div className="ps-stat">
              <div className="ps-stat-lbl">Analitik aktif</div>
              <div className="ps-stat-val">{activeAnalytics.length}<span style={{ color: 'var(--text3)' }}>/{analytics.length}</span></div>
            </div>
            <div className="ps-stat">
              <div className="ps-stat-lbl">Aturan event aktif</div>
              <div className="ps-stat-val">{activeRules}<span style={{ color: 'var(--text3)' }}>/{rules.length}</span></div>
            </div>
            <div className="ps-stat">
              <div className="ps-stat-lbl">Token CAPI (browser ini)</div>
              <div className="ps-stat-val">{tokenCount}<span style={{ color: 'var(--text3)' }}>/{analytics.length}</span></div>
            </div>
            <div className="ps-stat">
              <div className="ps-stat-lbl">Purchase dari server</div>
              <div className="ps-stat-val">{serverPurchaseCount}<span style={{ color: 'var(--text3)' }}>/{analytics.length}</span></div>
            </div>
            <div className="ps-stat">
              <div className="ps-stat-lbl">PageView (log)</div>
              <div className="ps-stat-val gold">{statsPageView}</div>
            </div>
            <div className="ps-stat">
              <div className="ps-stat-lbl">Purchase (log)</div>
              <div className="ps-stat-val green">{statsPurchase}</div>
            </div>
          </div>
        </div>

        <div className="lp-card lp-hero">
          <div>
            <div className="lp-hero-lbl">Status Pixel</div>
            <div className={`lp-hero-val money ps-hero-val ${pixelOn ? 'on' : 'off'}`}>
              {pixelOn ? '● AKTIF' : '○ NONAKTIF'}
            </div>
            <div className="lp-hero-sub">
              {analytics.length === 0
                ? 'Belum ada analitik'
                : `${activeAnalytics.length} dari ${analytics.length} analitik aktif`}
            </div>
          </div>
          <div>
            <div className="lp-hero-row">
              <span>Pixel aktif</span>
              <b className="ps-hero-names">{pixelOn ? activeAnalytics.map((a) => a.name).join(', ') : '—'}</b>
            </div>
            <div className="lp-hero-row">
              <span>Aturan event aktif</span>
              <b>{activeRules} dari {rules.length}</b>
            </div>
            <div className="lp-hero-row">
              <span>Purchase otomatis (server)</span>
              <b>{serverPurchaseCount > 0 ? 'Aktif' : 'Belum aktif'}</b>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ ANALITIK ═══ */}
      <div className="lp-card ps-section">
        <div className="ps-sec-head">
          <div>
            <div className="ps-sec-title">Analitik</div>
            <div className="ps-sec-sub">Daftar pixel yang dipasang di halaman publik.</div>
          </div>
          <div className="ps-sec-actions">
            <button className="ps-btn-gold" onClick={openNewAnalytics} disabled={savingAnalytics || aForm !== null}>
              + Tambah Analitik
            </button>
          </div>
        </div>

        {analytics.length === 0 ? (
          <div className="ps-empty">
            Belum ada analitik. Klik &quot;+ Tambah Analitik&quot; untuk menambahkan Meta Pixel.
          </div>
        ) : (
          <div className="ps-pixels">
            {analytics.map((a) => {
              const secret = secrets[a.pixelId];
              return (
                <div key={a.id} className={`ps-px${a.enabled ? '' : ' off'}`}>
                  <div>
                    <div className="ps-px-name">
                      {a.name}
                      <span className="ps-tag">{typeLabel(a.type)}</span>
                    </div>
                    <div className="ps-px-id">{a.pixelId}</div>
                  </div>

                  <div className="ps-px-meta">
                    {secret?.token ? (
                      <span className="ps-badge ok">Token tersimpan di browser ini ({maskToken(secret.token)})</span>
                    ) : (
                      <span className="ps-badge warn">Token belum diisi</span>
                    )}
                    <span className="ps-badge">
                      {secret?.testCode ? `Kode Testing: ${secret.testCode}` : 'Tanpa Kode Testing'}
                    </span>
                    {capiStatus[a.pixelId] !== undefined && (
                      <span className={`ps-badge ${capiStatus[a.pixelId] ? 'ok' : ''}`}>
                        Purchase otomatis dari server: {capiStatus[a.pixelId] ? 'aktif' : 'tidak aktif'}
                      </span>
                    )}
                  </div>

                  <div className="ps-px-actions">
                    <button
                      className={`ps-pill${a.enabled ? ' on' : ''}`}
                      onClick={() => handleToggleAnalytics(a.id)}
                      disabled={savingAnalytics}
                    >
                      {a.enabled ? '● ON' : '○ OFF'}
                    </button>
                    <button
                      className="ps-btn"
                      onClick={() => handleTestEvent(a)}
                      disabled={savingAnalytics || testingId !== null}
                    >
                      {testingId === a.id ? '⏳ Mengirim…' : '🧪 Kirim Tes'}
                    </button>
                    <button className="ps-btn" onClick={() => openEditAnalytics(a)} disabled={savingAnalytics}>
                      ✏️ Edit
                    </button>
                    <button className="ps-btn danger" onClick={() => handleDeleteAnalytics(a.id)} disabled={savingAnalytics}>
                      🗑️ Hapus
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {testResult && (
          <div className={`ps-result ${testResult.ok ? 'ok' : 'err'}`}>
            <strong>{testResult.ok ? '✅' : '❌'} {testResult.title}</strong>
            <div>{testResult.text}</div>
          </div>
        )}

        <details className="ps-details">
          <summary>Preview script yang akan di-inject di halaman publik</summary>
          <div className="ps-details-body">
            <pre className="ps-pre" style={{ color: pixelOn ? 'var(--gold2)' : 'var(--text3)' }}>{previewScript}</pre>
          </div>
        </details>

        <details className="ps-details">
          <summary>Cara kerja penyimpanan</summary>
          <div className="ps-details-body ps-info">
            <p>
              Analitik dan aturan event disimpan di Supabase tabel <code>settings</code>. Semua halaman publik
              membaca pengaturan ini saat load, jadi tidak perlu redeploy Vercel. Halaman <code>/admin</code> tidak
              pernah dilacak.
            </p>
            <p>
              <strong>Conversion API Token &amp; Kode Testing</strong> disimpan hanya di browser admin ini
              (localStorage), tidak masuk Supabase, jadi pengunjung tidak bisa melihatnya. Konsekuensinya, nilai itu
              hanya ada di browser tempat kamu mengisinya dan dipakai oleh tombol &quot;Kirim Tes&quot;. Purchase
              otomatis dari server (webhook) tidak bisa membaca browser, jadi itu hanya aktif kalau token juga
              dipasang sebagai environment variable server.
            </p>
          </div>
        </details>
      </div>

      {/* ═══ ATURAN EVENT ═══ */}
      <div className="lp-card ps-section">
        <div className="ps-sec-head">
          <div>
            <div className="ps-sec-title">Aturan Event</div>
            <div className="ps-sec-sub">Kapan dan di halaman mana event dikirim ke analitik.</div>
          </div>
          <div className="ps-sec-actions">
            <button className="ps-btn" onClick={handleResetRules} disabled={savingRules}>
              ↺ Reset ke Awal
            </button>
            <button className="ps-btn-gold" onClick={openNewForm} disabled={savingRules || form !== null}>
              + Tambah Aturan
            </button>
          </div>
        </div>

        {activeAnalytics.length === 0 && (
          <div className="ps-alert">
            ⚠️ Belum ada analitik yang aktif, jadi semua aturan tidak mengirim event walaupun statusnya ON.
          </div>
        )}

        {/* Form tambah / edit aturan */}
        {form && (
          <div className="ps-form">
            <div className="ps-form-title">{form.id ? 'Edit Aturan' : 'Aturan Baru'}</div>

            <div className="ps-form-grid">
              {/* Event */}
              <div>
                <label className="ps-label">Event</label>
                <select
                  className="ps-input"
                  value={form.eventChoice}
                  onChange={(e) => updateForm({ eventChoice: e.target.value })}
                >
                  {STANDARD_EVENTS.map((ev) => (
                    <option key={ev} value={ev}>{ev}</option>
                  ))}
                  <option value={CUSTOM}>Custom event…</option>
                </select>
                {form.eventChoice === CUSTOM && (
                  <input
                    className="ps-input ps-gap-top"
                    type="text"
                    placeholder="NamaEventCustom"
                    value={form.customEvent}
                    onChange={(e) => updateForm({ customEvent: e.target.value })}
                  />
                )}
              </div>

              {/* Halaman — dropdown otomatis */}
              <div>
                <label className="ps-label">Halaman</label>
                <PagePicker value={form.pages} onChange={(v) => updateForm({ pages: v })} />
                <div className="ps-hint">
                  Beranda ada di <code>/</code> (alamat /home dialihkan ke sana).
                </div>
              </div>

              {/* Trigger */}
              <div>
                <label className="ps-label">Trigger</label>
                <select
                  className="ps-input"
                  value={form.trigger}
                  onChange={(e) => updateForm({ trigger: e.target.value as PixelTriggerType })}
                >
                  {TRIGGER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {form.trigger === 'click' && (
                  <input
                    className="ps-input ps-gap-top"
                    type="text"
                    placeholder="#btn-daftar  atau  text:Dapatkan Akses"
                    value={form.selector}
                    onChange={(e) => updateForm({ selector: e.target.value })}
                  />
                )}
                {form.trigger === 'scroll' && (
                  <div className="ps-inline">
                    <input
                      className="ps-input"
                      type="number"
                      min={1}
                      max={100}
                      value={form.scrollPercent}
                      onChange={(e) => updateForm({ scrollPercent: e.target.value })}
                    />
                    <span>% dari tinggi halaman</span>
                  </div>
                )}
                <div className="ps-hint">{currentTriggerHint}</div>
              </div>

              {/* Kirim ke */}
              <div>
                <label className="ps-label">Kirim ke</label>
                {analytics.length === 0 ? (
                  <div className="ps-hint">Belum ada analitik. Tambahkan dulu di bagian Analitik.</div>
                ) : (
                  <div className="ps-checks">
                    {analytics.map((a) => (
                      <label key={a.id}>
                        <input
                          type="checkbox"
                          checked={form.targets.includes(a.id)}
                          onChange={() => toggleTarget(a.id)}
                        />
                        <span>{a.name}</span>
                        <small>{a.pixelId}</small>
                      </label>
                    ))}
                  </div>
                )}
                <div className="ps-hint">Tanpa centang = kirim ke semua analitik aktif.</div>
              </div>

              {/* Nilai */}
              <div>
                <label className="ps-label">Nilai (value)</label>
                <select
                  className="ps-input"
                  value={form.valueMode}
                  onChange={(e) => updateForm({ valueMode: e.target.value as PixelValueMode })}
                >
                  {VALUE_MODE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {form.valueMode === 'fixed' && (
                  <input
                    className="ps-input ps-gap-top"
                    type="number"
                    min={0}
                    placeholder="149000"
                    value={form.value}
                    onChange={(e) => updateForm({ value: e.target.value })}
                  />
                )}
                {form.valueMode === 'auto' && (
                  <div className="ps-hint">
                    Otomatis terisi di /upgrade dan /order (harga paket terpilih) serta titik pembayaran. Di halaman lain, nilai tidak ikut terkirim.
                  </div>
                )}
              </div>

              {/* Content name */}
              <div>
                <label className="ps-label">Nama konten (opsional)</label>
                <input
                  className="ps-input"
                  type="text"
                  placeholder="Journalyze Premium"
                  value={form.contentName}
                  onChange={(e) => updateForm({ contentName: e.target.value })}
                />
                <div className="ps-hint">Mata uang selalu IDR.</div>
              </div>
            </div>

            {formError && <div className="ps-form-error">❌ {formError}</div>}

            <div className="ps-form-actions">
              <button className="ps-btn-gold" onClick={handleSubmitForm} disabled={savingRules}>
                {savingRules ? '⏳ Menyimpan...' : form.id ? '💾 Simpan Perubahan' : '💾 Simpan Aturan'}
              </button>
              <button
                className="ps-btn"
                onClick={() => { setForm(null); setFormError(''); }}
                disabled={savingRules}
              >
                Batal
              </button>
            </div>
          </div>
        )}

        {/* Tabel aturan */}
        <div className="ps-table-wrap">
          <table className="ps-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Halaman</th>
                <th>Trigger</th>
                <th>Kirim ke</th>
                <th>Parameter</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="ps-empty">
                    Belum ada aturan. Klik &quot;+ Tambah Aturan&quot; untuk mulai mengirim event.
                  </td>
                </tr>
              ) : (
                rules.map((r) => (
                  <tr key={r.id} className={r.enabled ? '' : 'off'}>
                    <td className="ps-event-name">{r.event}</td>
                    <td>
                      {splitPages(r.pages).map((p) => (
                        <span key={p} className="ps-chip">{p === '*' ? 'Semua halaman' : p}</span>
                      ))}
                    </td>
                    <td>
                      {triggerLabel(r.trigger)}
                      {r.trigger === 'click' && r.selector && (
                        <div className="ps-muted ps-mono">{r.selector}</div>
                      )}
                      {r.trigger === 'scroll' && (
                        <div className="ps-muted">{r.scrollPercent ?? 50}%</div>
                      )}
                    </td>
                    <td>
                      {r.targets && r.targets.length > 0 ? r.targets.map(analyticsName).join(', ') : 'Semua analitik'}
                    </td>
                    <td>{describeParams(r)}</td>
                    <td>
                      <button
                        className={`ps-pill${r.enabled ? ' on' : ''}`}
                        onClick={() => handleToggleRule(r.id)}
                        disabled={savingRules}
                      >
                        {r.enabled ? '● ON' : '○ OFF'}
                      </button>
                    </td>
                    <td>
                      <div className="ps-row-actions">
                        <button className="ps-btn" onClick={() => openEditForm(r)} disabled={savingRules}>
                          ✏️ Edit
                        </button>
                        <button className="ps-btn danger" onClick={() => handleDeleteRule(r.id)} disabled={savingRules}>
                          🗑️ Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ UJI COBA ═══ */}
      <div className="lp-card ps-section">
        <div className="ps-sec-head">
          <div>
            <div className="ps-sec-title">Uji Coba</div>
            <div className="ps-sec-sub">Pastikan aturan jalan sebelum memasang iklan.</div>
          </div>
        </div>

        <div className="ps-test-row">
          <div className="ps-test-pick">
            <label className="ps-label">Halaman yang dibuka</label>
            <select className="ps-input" value={testPage} onChange={(e) => setTestPage(e.target.value)}>
              {testablePages.map((p) => (
                <option key={p.path} value={p.path}>{p.path}</option>
              ))}
            </select>
          </div>
          <button
            className="ps-btn-gold"
            onClick={() => window.open(`${testPage}?pixel_debug=1`, '_blank')}
          >
            🧪 Buka dengan Mode Debug
          </button>
        </div>

        <p className="ps-test-note">
          <strong>Mode Debug:</strong> halaman terbuka dengan panel kecil di pojok kiri bawah yang mencatat tiap event
          yang terkirim (nama event, tujuan analitik, parameter) dan alasan kalau tidak ada yang terkirim.
          Debug aktif selama tab itu terbuka; tambahkan <code>?pixel_debug=0</code> di URL untuk mematikan.
        </p>
        <p className="ps-test-note" style={{ marginTop: 8 }}>
          <strong>Cek di sisi Meta:</strong> Events Manager → pilih Pixel → tab <em>Test Events</em> → masukkan URL situs
          lalu buka. Event dari browser itu akan muncul di sana. Untuk event dari server (Conversion API), isi
          Kode Testing di analitik lalu klik &quot;Kirim Tes&quot; di bagian Analitik; hasilnya muncul di Test Events
          dengan sumber &quot;Server&quot;.
        </p>
      </div>

      {/* ═══ Arahan ke Analitik Meta ═══ */}
      <div className="lp-card ps-section ps-cta">
        <div>
          <div className="ps-sec-title">Angka performa iklan</div>
          <p>Reach, impressions, klik link, biaya, dan hasil iklan ada lengkap di tab Analitik Meta.</p>
        </div>
        <button className="ps-btn-gold" onClick={() => useAdminStore.getState().setPixelSubTab('meta')}>
          Buka Analitik Meta →
        </button>
      </div>

      {/* ═══ EVENT LOG ═══ */}
      <div className="lp-card ps-section">
        <div className="ps-sec-head">
          <div>
            <div className="ps-sec-title">Event Log</div>
            <div className="ps-sec-sub">20 event terakhir di tabel pixel_events.</div>
          </div>
          <div className="ps-sec-actions">
            <button className="ps-btn" onClick={loadEvents} disabled={eventsLoading}>
              {eventsLoading ? '⏳' : '🔄'} Refresh
            </button>
          </div>
        </div>

        {eventsLoading ? (
          <div className="ps-empty">Memuat event log...</div>
        ) : events.length === 0 ? (
          <div className="ps-empty">
            <div style={{ fontSize: 32, marginBottom: 12 }}>📡</div>
            <div>Belum ada event tercatat.</div>
            <div style={{ fontSize: 12, marginTop: 8 }}>
              Event akan muncul di sini setelah Pixel aktif dan halaman publik dibuka.
            </div>
          </div>
        ) : (
          <div className="ps-table-wrap">
            <table className="ps-table" style={{ minWidth: 560 }}>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Page</th>
                  <th>Metadata</th>
                  <th>Waktu</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id}>
                    <td>
                      <span className={`ps-badge ${ev.event_name === 'PageView' ? 'blue' : 'ok'}`}>
                        {ev.event_name}
                      </span>
                    </td>
                    <td className="ps-mono">{ev.page || '—'}</td>
                    <td className="ps-muted" style={{ marginTop: 0 }}>
                      {ev.metadata ? JSON.stringify(ev.metadata).slice(0, 40) : '—'}
                    </td>
                    <td className="ps-muted" style={{ marginTop: 0 }}>{formatDate(ev.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══ MODAL TAMBAH / EDIT ANALITIK ═══ */}
      {aForm && (
        <div
          className="ps-overlay"
          onClick={() => { if (!savingAnalytics) setAForm(null); }}
        >
          <div className="ps-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="ps-dialog-head">
              <span className="ps-dialog-title">{aForm.id ? 'Edit Analitik' : 'Tambah Analitik'}</span>
              <button
                className="ps-close"
                onClick={() => setAForm(null)}
                disabled={savingAnalytics}
                aria-label="Tutup"
              >
                ✕
              </button>
            </div>

            <div className="ps-field">
              <label className="ps-label">Jenis</label>
              <select
                className="ps-input"
                value={aForm.type}
                onChange={(e) => setAForm({ ...aForm, type: e.target.value as PixelAnalyticsType })}
              >
                {ANALYTICS_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="ps-field">
              <label className="ps-label">Nama <span className="ps-req">*</span></label>
              <input
                className="ps-input"
                type="text"
                placeholder="Contoh: Pixel Utama"
                value={aForm.name}
                onChange={(e) => setAForm({ ...aForm, name: e.target.value })}
              />
            </div>

            <div className="ps-field">
              <label className="ps-label">Pixel ID <span className="ps-req">*</span></label>
              <input
                className="ps-input"
                style={{ letterSpacing: 1 }}
                type="text"
                inputMode="numeric"
                placeholder="Contoh: 123456789012345"
                value={aForm.pixelId}
                onChange={(e) => setAForm({ ...aForm, pixelId: e.target.value })}
              />
            </div>

            <div className="ps-field">
              <label className="ps-label">Conversion API Token (opsional)</label>
              <input
                className="ps-input"
                type="password"
                autoComplete="off"
                placeholder={
                  aForm.pixelId.trim() && secrets[aForm.pixelId.trim()]?.token
                    ? `Tersimpan (${maskToken(secrets[aForm.pixelId.trim()].token)}) — kosongkan untuk tetap memakai ini`
                    : 'Tempel token dari Events Manager'
                }
                value={aForm.token}
                onChange={(e) => setAForm({ ...aForm, token: e.target.value })}
              />
              <div className="ps-hint">
                Events Manager → Settings → Conversions API → Generate access token. Disimpan hanya di browser ini.
              </div>
            </div>

            <div className="ps-field">
              <label className="ps-label">Kode Testing (opsional)</label>
              <input
                className="ps-input"
                type="text"
                placeholder="Contoh: TEST12345"
                value={aForm.testCode}
                onChange={(e) => setAForm({ ...aForm, testCode: e.target.value })}
              />
              <div className="ps-hint">
                Dari Events Manager → Test Events. Hanya dipakai tombol &quot;Kirim Tes&quot;, tidak mempengaruhi
                event produksi.
              </div>
            </div>

            <div className="ps-hint">
              Token dan Kode Testing tidak dikirim ke database. Kalau kamu ganti browser atau membersihkan data
              browser, isi ulang di sini.
            </div>

            {aFormError && <div className="ps-form-error">❌ {aFormError}</div>}

            <div className="ps-dialog-actions">
              <button className="ps-btn" onClick={() => setAForm(null)} disabled={savingAnalytics}>
                Batal
              </button>
              <button className="ps-btn-gold" onClick={handleSubmitAnalytics} disabled={savingAnalytics}>
                {savingAnalytics ? '⏳ Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
