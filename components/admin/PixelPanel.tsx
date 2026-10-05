// components/admin/PixelPanel.tsx
// Panel admin Pixel Tracking (gaya Scalev):
//  1. Daftar Analitik (Jenis, Nama, Pixel ID) — bisa lebih dari satu
//  2. Aturan Event (event, halaman dari dropdown, trigger, tujuan analitik, parameter)
//  3. Uji Coba (mode debug + panduan Test Events)
// Semua disimpan ke Supabase 'settings' — berlaku tanpa redeploy Vercel
'use client';

import { useEffect, useState, useCallback } from 'react';
import { _sb, _sbAdmin } from '@/lib/supabaseClient';
import { PIXEL_PAGES } from '@/lib/pixelPages.generated';
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

/* ── Style bersama ── */

const fieldLabel: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text3, #6A6050)',
  marginBottom: 6,
  display: 'block',
  fontFamily: "'JetBrains Mono',monospace",
};

const fieldInput: React.CSSProperties = {
  width: '100%',
  fontSize: 13,
  padding: '9px 12px',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid var(--border, rgba(255,255,255,0.1))',
  borderRadius: 8,
  color: 'var(--text, #F8F4EC)',
  fontFamily: "'JetBrains Mono',monospace",
};

const hintStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text3, #6A6050)',
  marginTop: 6,
  lineHeight: 1.5,
};

const pillBtn = (on: boolean, disabled: boolean): React.CSSProperties => ({
  background: on ? 'var(--green-bg)' : 'rgba(255,255,255,0.04)',
  border: `1px solid ${on ? 'var(--green-bd)' : 'var(--border)'}`,
  color: on ? 'var(--green)' : 'var(--text3)',
  borderRadius: 99,
  padding: '5px 14px',
  fontSize: 11,
  fontWeight: 700,
  fontFamily: "'JetBrains Mono',monospace",
  cursor: disabled ? 'not-allowed' : 'pointer',
  letterSpacing: 1,
  minWidth: 72,
});

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

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '7px 12px',
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: "'JetBrains Mono',monospace",
    color: 'var(--text, #F8F4EC)',
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          ...fieldInput,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          textAlign: 'left',
          cursor: 'pointer',
          color: selected.length === 0 ? 'var(--text3, #6A6050)' : 'var(--text, #F8F4EC)',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary()}</span>
        <span style={{ fontSize: 10 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
          />
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              right: 0,
              zIndex: 41,
              background: 'var(--bg2, #121212)',
              border: '1px solid var(--border2, rgba(255,255,255,0.15))',
              borderRadius: 10,
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              overflow: 'hidden',
            }}
          >
            <div style={{ maxHeight: 260, overflowY: 'auto' }}>
              <label style={{ ...rowStyle, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <input type="checkbox" checked={allSelected} onChange={() => toggle('*')} />
                <span>
                  <strong>Semua halaman</strong>
                  <span style={{ display: 'block', fontSize: 10, color: 'var(--text3, #6A6050)' }}>
                    Berlaku di seluruh halaman publik (admin tetap dikecualikan)
                  </span>
                </span>
              </label>

              {PIXEL_PAGES.map((p) => (
                <label key={p.path} style={{ ...rowStyle, opacity: allSelected ? 0.4 : 1 }}>
                  <input
                    type="checkbox"
                    checked={selected.includes(p.path)}
                    disabled={allSelected}
                    onChange={() => toggle(p.path)}
                  />
                  <span>
                    {p.path}
                    {p.note && (
                      <span style={{ display: 'block', fontSize: 10, color: 'var(--text3, #6A6050)' }}>{p.note}</span>
                    )}
                  </span>
                </label>
              ))}

              {customSelected.map((p) => (
                <label key={p} style={rowStyle}>
                  <input type="checkbox" checked onChange={() => toggle(p)} />
                  <span>
                    {p}
                    <span style={{ display: 'block', fontSize: 10, color: 'var(--text3, #6A6050)' }}>Path khusus</span>
                  </span>
                </label>
              ))}
            </div>

            <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={{ ...fieldInput, padding: '7px 10px', fontSize: 12 }}
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
                <button type="button" className="refresh-btn" onClick={addCustom}>
                  Tambah
                </button>
              </div>
              {customError && <div style={{ ...hintStyle, color: 'var(--red)' }}>{customError}</div>}
              <div style={hintStyle}>
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

  if (!active) return null;

  const currentTriggerHint = form ? TRIGGER_OPTIONS.find((o) => o.value === form.trigger)?.hint : '';

  return (
    <div className="main">
      {/* Header stats */}
      <div className="stats-row" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="stat-card">
          <div className="stat-lbl">Status Pixel</div>
          <div className="stat-val" style={{ fontSize: 28, color: activeAnalytics.length > 0 ? 'var(--green)' : 'var(--text3)' }}>
            {activeAnalytics.length > 0 ? '● AKTIF' : '○ NONAKTIF'}
          </div>
          <div className="stat-sub">
            {analytics.length === 0
              ? 'Belum ada analitik'
              : `${activeAnalytics.length} dari ${analytics.length} analitik aktif`}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">PageView (log)</div>
          <div className="stat-val gold">{statsPageView}</div>
          <div className="stat-sub">Event tercatat di tabel pixel_events</div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">Purchase (log)</div>
          <div className="stat-val green">{statsPurchase}</div>
          <div className="stat-sub">Event purchase yang dilacak</div>
        </div>
      </div>

      {/* Save message */}
      {saveMsg && (
        <div style={{
          background: saveMsg.startsWith('✅') ? 'var(--green-bg)' : 'rgba(232,64,64,0.09)',
          border: `1px solid ${saveMsg.startsWith('✅') ? 'var(--green-bd)' : 'rgba(232,64,64,0.25)'}`,
          borderRadius: 10,
          padding: '12px 20px',
          fontSize: 13,
          marginBottom: 16,
          color: saveMsg.startsWith('✅') ? 'var(--green)' : 'var(--red)',
        }}>
          {saveMsg}
        </div>
      )}

      {/* ═══ ANALITIK ═══ */}
      <div className="section">
        <div className="section-head">
          <span className="section-title">📡 Analitik</span>
          <button className="gen-btn" onClick={openNewAnalytics} disabled={savingAnalytics || aForm !== null}>
            + Tambah Analitik
          </button>
        </div>
        <div className="section-body" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Jenis</th>
                  <th>Pixel ID</th>
                  <th>Conversion API</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {analytics.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="date-text" style={{ textAlign: 'center', padding: 28 }}>
                      Belum ada analitik. Klik &quot;+ Tambah Analitik&quot; untuk menambahkan Meta Pixel.
                    </td>
                  </tr>
                ) : (
                  analytics.map((a) => (
                    <tr key={a.id} style={{ opacity: a.enabled ? 1 : 0.55 }}>
                      <td className="key-mono" style={{ fontSize: 12, letterSpacing: 0 }}>{a.name}</td>
                      <td className="date-text">{typeLabel(a.type)}</td>
                      <td className="key-mono" style={{ fontSize: 12, letterSpacing: 1 }}>{a.pixelId}</td>
                      <td className="date-text">
                        {secrets[a.pixelId]?.token
                          ? `✅ Token tersimpan di browser ini (${maskToken(secrets[a.pixelId].token)})`
                          : '⚠️ Token belum diisi'}
                        <div style={{ fontSize: 10, marginTop: 2 }}>
                          {secrets[a.pixelId]?.testCode
                            ? `Kode Testing: ${secrets[a.pixelId].testCode}`
                            : 'Tanpa Kode Testing'}
                        </div>
                        {capiStatus[a.pixelId] !== undefined && (
                          <div style={{ fontSize: 10, marginTop: 2 }}>
                            {capiStatus[a.pixelId]
                              ? 'Purchase otomatis dari server: aktif'
                              : 'Purchase otomatis dari server: tidak aktif'}
                          </div>
                        )}
                      </td>
                      <td>
                        <button
                          onClick={() => handleToggleAnalytics(a.id)}
                          disabled={savingAnalytics}
                          style={pillBtn(a.enabled, savingAnalytics)}
                        >
                          {a.enabled ? '● ON' : '○ OFF'}
                        </button>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            className="refresh-btn"
                            onClick={() => handleTestEvent(a)}
                            disabled={savingAnalytics || testingId !== null}
                          >
                            {testingId === a.id ? '⏳ Mengirim…' : '🧪 Kirim Tes'}
                          </button>
                          <button className="refresh-btn" onClick={() => openEditAnalytics(a)} disabled={savingAnalytics}>
                            ✏️ Edit
                          </button>
                          <button className="refresh-btn" onClick={() => handleDeleteAnalytics(a.id)} disabled={savingAnalytics}>
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

          {testResult && (
            <div style={{
              margin: '16px 20px 0',
              padding: '12px 16px',
              background: testResult.ok ? 'var(--green-bg)' : 'rgba(232,64,64,0.09)',
              border: `1px solid ${testResult.ok ? 'var(--green-bd)' : 'rgba(232,64,64,0.25)'}`,
              borderRadius: 10,
              fontSize: 12,
              lineHeight: 1.6,
              color: testResult.ok ? 'var(--green)' : 'var(--red)',
            }}>
              <strong>{testResult.ok ? '✅' : '❌'} {testResult.title}</strong>
              <div style={{ marginTop: 4, wordBreak: 'break-word' }}>{testResult.text}</div>
            </div>
          )}

          <div style={{ padding: '16px 20px 20px' }}>
            <div style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border2)',
              borderRadius: 10,
              padding: '16px 20px',
            }}>
              <div style={{
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 9,
                letterSpacing: 2,
                textTransform: 'uppercase',
                color: 'var(--text3)',
                marginBottom: 12,
              }}>
                Preview Script yang akan di-inject di halaman publik
              </div>
              <pre style={{
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 11,
                color: activeAnalytics.length > 0 ? 'var(--gold2)' : 'var(--text3)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                lineHeight: 1.6,
              }}>
                {previewScript}
              </pre>
            </div>

            <div style={{
              marginTop: 16,
              padding: '12px 16px',
              background: 'var(--blue-bg)',
              border: '1px solid var(--blue-bd)',
              borderRadius: 10,
              fontSize: 12,
              color: 'var(--blue)',
              lineHeight: 1.6,
            }}>
              <strong>ℹ️ Cara kerja:</strong> Analitik dan aturan event disimpan di Supabase tabel <code>settings</code>.
              Semua halaman publik membaca pengaturan ini saat load — tidak perlu redeploy Vercel.
              Halaman <code>/admin</code> tidak pernah dilacak.
              <strong>Conversion API Token &amp; Kode Testing</strong> disimpan hanya di browser admin ini
              (localStorage), tidak masuk Supabase, jadi pengunjung tidak bisa melihatnya. Konsekuensinya, nilai itu
              hanya ada di browser tempat kamu mengisinya dan dipakai oleh tombol &quot;Kirim Tes&quot;. Purchase
              otomatis dari server (webhook) tidak bisa membaca browser, jadi itu hanya aktif kalau token juga
              dipasang sebagai environment variable server.
            </div>
          </div>
        </div>
      </div>

      {/* ═══ ATURAN EVENT ═══ */}
      <div className="section">
        <div className="section-head">
          <span className="section-title">🎯 Aturan Event</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="refresh-btn" onClick={handleResetRules} disabled={savingRules}>
              ↺ Reset ke Awal
            </button>
            <button className="gen-btn" onClick={openNewForm} disabled={savingRules || form !== null}>
              + Tambah Aturan
            </button>
          </div>
        </div>
        <div className="section-body" style={{ padding: 0 }}>
          {activeAnalytics.length === 0 && (
            <div style={{
              margin: '16px 20px 0',
              padding: '10px 14px',
              background: 'rgba(232,64,64,0.09)',
              border: '1px solid rgba(232,64,64,0.25)',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--red)',
              lineHeight: 1.6,
            }}>
              ⚠️ Belum ada analitik yang aktif, jadi semua aturan tidak mengirim event walaupun statusnya ON.
            </div>
          )}

          {/* Form tambah / edit aturan */}
          {form && (
            <div style={{
              margin: '16px 20px 0',
              padding: '18px 20px',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border2, rgba(255,255,255,0.12))',
              borderRadius: 10,
            }}>
              <div style={{
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 10,
                letterSpacing: 2,
                textTransform: 'uppercase',
                color: 'var(--gold2, #E8C567)',
                marginBottom: 14,
              }}>
                {form.id ? 'Edit Aturan' : 'Aturan Baru'}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 14 }}>
                {/* Event */}
                <div>
                  <label style={fieldLabel}>Event</label>
                  <select
                    style={fieldInput}
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
                      style={{ ...fieldInput, marginTop: 8 }}
                      type="text"
                      placeholder="NamaEventCustom"
                      value={form.customEvent}
                      onChange={(e) => updateForm({ customEvent: e.target.value })}
                    />
                  )}
                </div>

                {/* Halaman — dropdown otomatis */}
                <div>
                  <label style={fieldLabel}>Halaman</label>
                  <PagePicker value={form.pages} onChange={(v) => updateForm({ pages: v })} />
                  <div style={hintStyle}>
                    Beranda ada di <code>/</code> (alamat /home dialihkan ke sana).
                  </div>
                </div>

                {/* Trigger */}
                <div>
                  <label style={fieldLabel}>Trigger</label>
                  <select
                    style={fieldInput}
                    value={form.trigger}
                    onChange={(e) => updateForm({ trigger: e.target.value as PixelTriggerType })}
                  >
                    {TRIGGER_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  {form.trigger === 'click' && (
                    <input
                      style={{ ...fieldInput, marginTop: 8 }}
                      type="text"
                      placeholder="#btn-daftar  atau  text:Dapatkan Akses"
                      value={form.selector}
                      onChange={(e) => updateForm({ selector: e.target.value })}
                    />
                  )}
                  {form.trigger === 'scroll' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                      <input
                        style={{ ...fieldInput, width: 90 }}
                        type="number"
                        min={1}
                        max={100}
                        value={form.scrollPercent}
                        onChange={(e) => updateForm({ scrollPercent: e.target.value })}
                      />
                      <span style={{ fontSize: 12, color: 'var(--text3, #6A6050)' }}>% dari tinggi halaman</span>
                    </div>
                  )}
                  <div style={hintStyle}>{currentTriggerHint}</div>
                </div>

                {/* Kirim ke */}
                <div>
                  <label style={fieldLabel}>Kirim ke</label>
                  {analytics.length === 0 ? (
                    <div style={hintStyle}>Belum ada analitik. Tambahkan dulu di bagian Analitik.</div>
                  ) : (
                    <div style={{
                      ...fieldInput,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      maxHeight: 130,
                      overflowY: 'auto',
                    }}>
                      {analytics.map((a) => (
                        <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
                          <input
                            type="checkbox"
                            checked={form.targets.includes(a.id)}
                            onChange={() => toggleTarget(a.id)}
                          />
                          <span>{a.name}</span>
                          <span style={{ color: 'var(--text3, #6A6050)', fontSize: 10 }}>{a.pixelId}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  <div style={hintStyle}>Tanpa centang = kirim ke semua analitik aktif.</div>
                </div>

                {/* Nilai */}
                <div>
                  <label style={fieldLabel}>Nilai (value)</label>
                  <select
                    style={fieldInput}
                    value={form.valueMode}
                    onChange={(e) => updateForm({ valueMode: e.target.value as PixelValueMode })}
                  >
                    {VALUE_MODE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  {form.valueMode === 'fixed' && (
                    <input
                      style={{ ...fieldInput, marginTop: 8 }}
                      type="number"
                      min={0}
                      placeholder="149000"
                      value={form.value}
                      onChange={(e) => updateForm({ value: e.target.value })}
                    />
                  )}
                  {form.valueMode === 'auto' && (
                    <div style={hintStyle}>
                      Otomatis terisi di /upgrade dan /order (harga paket terpilih) serta titik pembayaran. Di halaman lain, nilai tidak ikut terkirim.
                    </div>
                  )}
                </div>

                {/* Content name */}
                <div>
                  <label style={fieldLabel}>Nama konten (opsional)</label>
                  <input
                    style={fieldInput}
                    type="text"
                    placeholder="Journalyze Premium"
                    value={form.contentName}
                    onChange={(e) => updateForm({ contentName: e.target.value })}
                  />
                  <div style={hintStyle}>Mata uang selalu IDR.</div>
                </div>
              </div>

              {formError && (
                <div style={{
                  marginTop: 14,
                  padding: '10px 14px',
                  background: 'rgba(232,64,64,0.09)',
                  border: '1px solid rgba(232,64,64,0.25)',
                  borderRadius: 8,
                  fontSize: 12,
                  color: 'var(--red)',
                }}>
                  ❌ {formError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button className="gen-btn" onClick={handleSubmitForm} disabled={savingRules}>
                  {savingRules ? '⏳ Menyimpan...' : form.id ? '💾 Simpan Perubahan' : '💾 Simpan Aturan'}
                </button>
                <button
                  className="refresh-btn"
                  onClick={() => { setForm(null); setFormError(''); }}
                  disabled={savingRules}
                >
                  Batal
                </button>
              </div>
            </div>
          )}

          {/* Tabel aturan */}
          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table>
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
                    <td colSpan={7} className="date-text" style={{ textAlign: 'center', padding: 28 }}>
                      Belum ada aturan. Klik &quot;+ Tambah Aturan&quot; untuk mulai mengirim event.
                    </td>
                  </tr>
                ) : (
                  rules.map((r) => (
                    <tr key={r.id} style={{ opacity: r.enabled ? 1 : 0.55 }}>
                      <td className="key-mono" style={{ fontSize: 12, letterSpacing: 0 }}>{r.event}</td>
                      <td className="date-text">{r.pages}</td>
                      <td className="date-text">
                        {triggerLabel(r.trigger)}
                        {r.trigger === 'click' && r.selector && (
                          <div className="key-mono" style={{ fontSize: 10, letterSpacing: 0, marginTop: 2 }}>{r.selector}</div>
                        )}
                        {r.trigger === 'scroll' && (
                          <div style={{ fontSize: 10, marginTop: 2 }}>{r.scrollPercent ?? 50}%</div>
                        )}
                      </td>
                      <td className="date-text">
                        {r.targets && r.targets.length > 0 ? r.targets.map(analyticsName).join(', ') : 'Semua analitik'}
                      </td>
                      <td className="date-text">{describeParams(r)}</td>
                      <td>
                        <button
                          onClick={() => handleToggleRule(r.id)}
                          disabled={savingRules}
                          style={pillBtn(r.enabled, savingRules)}
                        >
                          {r.enabled ? '● ON' : '○ OFF'}
                        </button>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="refresh-btn" onClick={() => openEditForm(r)} disabled={savingRules}>
                            ✏️ Edit
                          </button>
                          <button className="refresh-btn" onClick={() => handleDeleteRule(r.id)} disabled={savingRules}>
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
      </div>

      {/* ═══ UJI COBA ═══ */}
      <div className="section">
        <div className="section-head">
          <span className="section-title">🧪 Uji Coba</span>
          <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: "'JetBrains Mono',monospace" }}>
            Pastikan aturan jalan sebelum memasang iklan
          </span>
        </div>
        <div className="section-body">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ minWidth: 260, flex: 1, maxWidth: 420 }}>
              <label style={fieldLabel}>Halaman yang dibuka</label>
              <select style={fieldInput} value={testPage} onChange={(e) => setTestPage(e.target.value)}>
                {testablePages.map((p) => (
                  <option key={p.path} value={p.path}>{p.path}</option>
                ))}
              </select>
            </div>
            <button
              className="gen-btn"
              onClick={() => window.open(`${testPage}?pixel_debug=1`, '_blank')}
            >
              🧪 Buka dengan Mode Debug
            </button>
          </div>

          <div style={{ ...hintStyle, marginTop: 14, fontSize: 12 }}>
            <strong>Mode Debug:</strong> halaman terbuka dengan panel kecil di pojok kiri bawah yang mencatat tiap event
            yang terkirim (nama event, tujuan analitik, parameter) dan alasan kalau tidak ada yang terkirim.
            Debug aktif selama tab itu terbuka; tambahkan <code>?pixel_debug=0</code> di URL untuk mematikan.
          </div>
          <div style={{ ...hintStyle, fontSize: 12 }}>
            <strong>Cek di sisi Meta:</strong> Events Manager → pilih Pixel → tab <em>Test Events</em> → masukkan URL situs
            lalu buka. Event dari browser itu akan muncul di sana. Untuk event dari server (Conversion API), isi
            Kode Testing di analitik lalu klik &quot;Kirim Tes&quot; di tabel Analitik; hasilnya muncul di Test Events
            dengan sumber &quot;Server&quot;.
          </div>
        </div>
      </div>

      {/* Placeholder stats */}
      <div className="section">
        <div className="section-head">
          <span className="section-title">📊 Statistik Placeholder</span>
          <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: "'JetBrains Mono',monospace" }}>
            Data dari Meta Ads Manager
          </span>
        </div>
        <div className="section-body">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4,1fr)',
            gap: 16,
          }}>
            {[
              { label: 'Reach', val: '—', color: 'var(--text3)' },
              { label: 'Impressions', val: '—', color: 'var(--text3)' },
              { label: 'Click (Link)', val: '—', color: 'var(--text3)' },
              { label: 'Purchase Event', val: statsPurchase || '—', color: 'var(--green)' },
            ].map((s) => (
              <div key={s.label} className="stat-card">
                <div className="stat-lbl">{s.label}</div>
                <div className="stat-val" style={{ fontSize: 32, color: s.color }}>{s.val}</div>
                <div className="stat-sub">Lihat di Meta Ads Manager untuk data real-time</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Event log table */}
      <div className="section">
        <div className="section-head">
          <span className="section-title">📋 Event Log (pixel_events)</span>
          <button className="refresh-btn" onClick={loadEvents} disabled={eventsLoading}>
            {eventsLoading ? '⏳' : '🔄'} Refresh
          </button>
        </div>
        <div className="section-body" style={{ padding: 0 }}>
          {eventsLoading ? (
            <div className="empty-state">Memuat event log...</div>
          ) : events.length === 0 ? (
            <div className="empty-state">
              <div style={{ fontSize: 32, marginBottom: 12 }}>📡</div>
              <div>Belum ada event tercatat.</div>
              <div style={{ fontSize: 12, marginTop: 8 }}>
                Event akan muncul di sini setelah Pixel aktif dan halaman publik dibuka.
              </div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
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
                        <span
                          className="badge"
                          style={{
                            background: ev.event_name === 'PageView' ? 'var(--blue-bg)' : 'var(--green-bg)',
                            color: ev.event_name === 'PageView' ? 'var(--blue)' : 'var(--green)',
                            border: `1px solid ${ev.event_name === 'PageView' ? 'var(--blue-bd)' : 'var(--green-bd)'}`,
                          }}
                        >
                          {ev.event_name}
                        </span>
                      </td>
                      <td className="key-mono" style={{ fontSize: 11, letterSpacing: 0 }}>
                        {ev.page || '—'}
                      </td>
                      <td className="date-text">
                        {ev.metadata ? JSON.stringify(ev.metadata).slice(0, 40) : '—'}
                      </td>
                      <td className="date-text">{formatDate(ev.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ═══ MODAL TAMBAH / EDIT ANALITIK (gaya Scalev) ═══ */}
      {aForm && (
        <div
          onClick={() => { if (!savingAnalytics) setAForm(null); }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(520px, 100%)',
              background: 'var(--bg2, #121212)',
              border: '1px solid var(--border2, rgba(255,255,255,0.15))',
              borderRadius: 14,
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
              padding: '22px 24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text, #F8F4EC)' }}>
                {aForm.id ? 'Edit Analitik' : 'Tambah Analitik'}
              </span>
              <button
                onClick={() => setAForm(null)}
                disabled={savingAnalytics}
                style={{ background: 'transparent', border: 'none', color: 'var(--red, #E84040)', fontSize: 18, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={fieldLabel}>Jenis</label>
              <select
                style={fieldInput}
                value={aForm.type}
                onChange={(e) => setAForm({ ...aForm, type: e.target.value as PixelAnalyticsType })}
              >
                {ANALYTICS_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={fieldLabel}>Nama <span style={{ color: 'var(--red, #E84040)' }}>*</span></label>
              <input
                style={fieldInput}
                type="text"
                placeholder="Contoh: Pixel Utama"
                value={aForm.name}
                onChange={(e) => setAForm({ ...aForm, name: e.target.value })}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={fieldLabel}>Pixel ID <span style={{ color: 'var(--red, #E84040)' }}>*</span></label>
              <input
                style={{ ...fieldInput, letterSpacing: 1 }}
                type="text"
                inputMode="numeric"
                placeholder="Contoh: 123456789012345"
                value={aForm.pixelId}
                onChange={(e) => setAForm({ ...aForm, pixelId: e.target.value })}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={fieldLabel}>Conversion API Token (opsional)</label>
              <input
                style={fieldInput}
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
              <div style={hintStyle}>
                Events Manager → Settings → Conversions API → Generate access token. Disimpan hanya di browser ini.
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={fieldLabel}>Kode Testing (opsional)</label>
              <input
                style={fieldInput}
                type="text"
                placeholder="Contoh: TEST12345"
                value={aForm.testCode}
                onChange={(e) => setAForm({ ...aForm, testCode: e.target.value })}
              />
              <div style={hintStyle}>
                Dari Events Manager → Test Events. Hanya dipakai tombol &quot;Kirim Tes&quot;, tidak mempengaruhi
                event produksi.
              </div>
            </div>

            <div style={{ ...hintStyle, marginBottom: 6 }}>
              Token dan Kode Testing tidak dikirim ke database. Kalau kamu ganti browser atau membersihkan data
              browser, isi ulang di sini.
            </div>

            {aFormError && (
              <div style={{
                marginTop: 10,
                padding: '10px 14px',
                background: 'rgba(232,64,64,0.09)',
                border: '1px solid rgba(232,64,64,0.25)',
                borderRadius: 8,
                fontSize: 12,
                color: 'var(--red)',
              }}>
                ❌ {aFormError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button className="refresh-btn" onClick={() => setAForm(null)} disabled={savingAnalytics}>
                Cancel
              </button>
              <button className="gen-btn" onClick={handleSubmitAnalytics} disabled={savingAnalytics}>
                {savingAnalytics ? '⏳ Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}