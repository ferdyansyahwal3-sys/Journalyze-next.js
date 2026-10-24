'use client';

// components/admin/UsersPanel.tsx  (v2)
// - Filter lewat chip (plan / menunggu aktivasi / diblokir) + cari (email, nama, key) + urutkan
// - Status dihitung dari plan + masa berlaku + blokir (bukan sekadar is_activated)
// - Kolom License Key + terakhir login; penanda akun yatim (profil ada, akun login hilang)
// - Klik baris -> panel detail: ubah plan (dengan konfirmasi), perpanjang trial, blokir, hapus
// - Hapus user = satu jalur: key milik user ikut terhapus & store License Keys ikut diperbarui
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useAdminStore } from '@/store/useAdminStore';
import type { UserProfile, UserPlan } from '@/store/useAdminStore';
import { _sbAdmin } from '@/lib/supabaseClient';
import { useLicenseKeys } from '@/hooks/useLicenseKeys';
import { genKeyString } from '@/lib/adminHelpers';

/* ───────────────────────── tipe & konstanta ───────────────────────── */

type Extra = {
  phone?: string | null;
  pending_plan?: string | null;
  admin_verified?: boolean | null;
  plan_expires_at?: string | null;
  trial_used?: boolean | null;
  is_blocked?: boolean | null;
  block_reason?: string | null;
  license_key?: string | null;
  is_admin?: boolean | null;
};
type U = UserProfile & Extra;
type Filter = 'all' | UserPlan | 'pending' | 'blocked' | 'nokey';
type Sort = 'newest' | 'oldest' | 'name' | 'expiry';
type StatusId = 'blocked' | 'pending' | 'trial' | 'trial_expired' | 'expired' | 'inactive' | 'active' | 'free';
type KeyInfo = { key: string; is_revoked: boolean };

const HOUR = 3600 * 1000;
const TRIAL_MS = 48 * HOUR;
const BASIC_MS = 90 * 24 * HOUR;
const PER_PAGE = 15;
const PLANS: UserPlan[] = ['free', 'trial', 'basic', 'pro', 'elite'];
const COLS =
  'id,email,display_name,phone,plan,plan_type,is_activated,created_at,pending_plan,admin_verified,plan_expires_at,trial_used,is_blocked,block_reason,license_key,is_admin';

const PLAN_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  free:  { label: 'Free',  color: '#8A7F6C', bg: 'rgba(138,127,108,0.12)', border: 'rgba(138,127,108,0.28)' },
  trial: { label: 'Trial', color: '#C084FC', bg: 'rgba(192,132,252,0.12)', border: 'rgba(192,132,252,0.32)' },
  basic: { label: 'Basic', color: '#60A5FA', bg: 'rgba(96,165,250,0.10)',  border: 'rgba(96,165,250,0.28)' },
  pro:   { label: 'Pro',   color: '#C9A84C', bg: 'rgba(201,168,76,0.12)',  border: 'rgba(201,168,76,0.34)' },
  elite: { label: 'Elite', color: '#F97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.34)' },
};

const STATUS_META: Record<StatusId, { label: string; tone: string }> = {
  blocked:       { label: 'Diblokir',          tone: 'red' },
  pending:       { label: 'Menunggu aktivasi', tone: 'amber' },
  trial:         { label: 'Trial berjalan',    tone: 'purple' },
  trial_expired: { label: 'Trial habis',       tone: 'dim' },
  expired:       { label: 'Kedaluwarsa',       tone: 'red' },
  inactive:      { label: 'Belum diaktivasi',  tone: 'amber' },
  active:        { label: 'Aktif',             tone: 'green' },
  free:          { label: 'Tanpa paket',       tone: 'dim' },
};

const CHIP_COLOR: Record<string, string> = {
  all: '#C9A84C',
  free: '#8A7F6C',
  trial: '#C084FC',
  basic: '#60A5FA',
  pro: '#C9A84C',
  elite: '#F97316',
  pending: '#FBBF24',
  blocked: '#F87171',
  nokey: '#FBBF24',
};

/* ───────────────────────── helper ───────────────────────── */

const isPending = (u: U) => !!u.pending_plan && !u.admin_verified;

function getStatus(u: U): StatusId {
  if (u.is_blocked) return 'blocked';
  if (isPending(u)) return 'pending';
  if (u.plan === 'free') return 'free';
  const exp = u.plan_expires_at ? new Date(u.plan_expires_at).getTime() : null;
  const expired = exp !== null && !isNaN(exp) && exp <= Date.now();
  if (u.plan === 'trial') return expired ? 'trial_expired' : 'trial';
  if (expired) return 'expired';
  if (!u.is_activated) return 'inactive';
  return 'active';
}

function fmtDate(s?: string | null) {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return s;
  }
}

function timeAgo(s?: string | null) {
  if (!s) return '—';
  const ms = Date.now() - new Date(s).getTime();
  if (isNaN(ms)) return '—';
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'baru saja';
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} hari lalu`;
  const mo = Math.floor(d / 30);
  return mo < 12 ? `${mo} bln lalu` : `${Math.floor(mo / 12)} thn lalu`;
}

function remainingLabel(expiresAt?: string | null) {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (isNaN(ms)) return null;
  if (ms <= 0) return { text: 'habis', expired: true };
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return { text: d > 0 ? `sisa ${d}h ${h}j` : `sisa ${h}j ${m}m`, expired: false };
}

function planSub(u: U): { text: string; warn?: boolean } | null {
  if (u.plan === 'free') return null;
  if (u.plan === 'trial') {
    const r = remainingLabel(u.plan_expires_at);
    return r ? { text: r.text, warn: r.expired } : null;
  }
  if (!u.plan_expires_at) return { text: 'tanpa expiry' };
  const expired = new Date(u.plan_expires_at).getTime() <= Date.now();
  return { text: `${expired ? 'berakhir' : 's.d.'} ${fmtDate(u.plan_expires_at)}`, warn: expired };
}

// Pola yang sama dengan PlanSelector lama, supaya perilaku trigger/DB tidak berubah.
function planPatch(plan: UserPlan): Record<string, unknown> {
  if (plan === 'free') {
    return { plan, plan_type: null, admin_verified: false, pending_plan: null, is_activated: false, plan_expires_at: null };
  }
  const now = Date.now();
  const exp =
    plan === 'trial' ? new Date(now + TRIAL_MS).toISOString()
    : plan === 'basic' ? new Date(now + BASIC_MS).toISOString()
    : null;
  return {
    plan,
    plan_type: plan,
    admin_verified: true,
    pending_plan: null,
    is_activated: true,
    plan_activated_at: new Date(now).toISOString(),
    plan_expires_at: exp,
    trial_used: true,
  };
}

function csvCell(v: unknown) {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // cegah formula injection di Excel/Sheets
  return '"' + s.replace(/"/g, '""') + '"';
}

function exportCsv(list: U[], keyOf: (u: U) => string) {
  const head = ['email', 'nama', 'plan', 'status', 'berakhir', 'license_key', 'bergabung'];
  const lines = [head.join(',')].concat(
    list.map((u) =>
      [u.email, u.display_name, u.plan, STATUS_META[getStatus(u)].label, u.plan_expires_at ?? '', keyOf(u), u.created_at]
        .map(csvCell)
        .join(',')
    )
  );
  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `journalyze-users-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function safe<T>(p: PromiseLike<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

/* ───────────────────────── komponen kecil ───────────────────────── */

function Icon({ name }: { name: 'search' | 'refresh' | 'download' | 'close' | 'chev' | 'copy' }) {
  const d: Record<string, string> = {
    search: 'M11 4a7 7 0 1 0 4.2 12.6l4.1 4.1 1.4-1.4-4.1-4.1A7 7 0 0 0 11 4zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10z',
    refresh: 'M12 5a7 7 0 0 1 6.3 4H16v2h6V5h-2v2.3A9 9 0 0 0 3 12h2a7 7 0 0 1 7-7zm7 7a7 7 0 0 1-13.3 3H8v-2H2v6h2v-2.3A9 9 0 0 0 21 12h-2z',
    download: 'M11 3h2v9.2l3.3-3.3 1.4 1.4L12 16l-5.7-5.7 1.4-1.4L11 12.2V3zM5 19h14v2H5v-2z',
    close: 'M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4 6.4 5z',
    chev: 'M9 6l6 6-6 6-1.4-1.4L12.2 12 7.6 7.4 9 6z',
    copy: 'M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z',
  };
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={d[name]} />
    </svg>
  );
}

function PlanBadge({ plan }: { plan: UserPlan }) {
  const m = PLAN_META[plan] ?? PLAN_META.free;
  return (
    <span className="um-badge" style={{ color: m.color, background: m.bg, borderColor: m.border }}>
      <i />
      {m.label}
    </span>
  );
}

function StatusPill({ id }: { id: StatusId }) {
  const m = STATUS_META[id];
  return (
    <span className={`um-st ${m.tone}`}>
      <i />
      {m.label}
    </span>
  );
}

/* ───────────────────────── drawer detail ───────────────────────── */

function UserDrawer({
  user, keyInfo, lastLogin, orphan, onClose, onChangePlan, onActivate, onExtendTrial, onToggleBlock, onToggleActivated, onDelete, onCreateKey, fontFamily,
}: {
  user: U;
  keyInfo: KeyInfo | null;
  lastLogin: string | null | undefined;
  orphan: boolean;
  onClose: () => void;
  onChangePlan: (p: UserPlan) => Promise<boolean>;
  onActivate: () => Promise<boolean>;
  onExtendTrial: () => Promise<boolean>;
  onToggleBlock: (reason: string) => Promise<boolean>;
  onToggleActivated: () => Promise<boolean>;
  onDelete: () => Promise<boolean>;
  onCreateKey: () => Promise<boolean>;
  fontFamily?: string;
}) {
  const showToast = useAdminStore((s) => s.showToast);
  const [busy, setBusy] = useState<string | null>(null);
  const [nextPlan, setNextPlan] = useState<UserPlan | null>(null);
  const [reason, setReason] = useState('');
  const [delText, setDelText] = useState('');
  const [trades, setTrades] = useState<number | null | undefined>(undefined);

  const status = getStatus(user);
  const key = keyInfo?.key ?? user.license_key ?? '';
  const confirmWord = (user.email || 'HAPUS').toLowerCase();
  const protectedAcc = !!user.is_admin;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let off = false;
    (async () => {
      const r = await safe(
        _sbAdmin.from('trades').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
      );
      if (!off) setTrades(r && !r.error ? r.count ?? 0 : null);
    })();
    return () => {
      off = true;
    };
  }, [user.id]);

  const run = async (id: string, fn: () => Promise<boolean>) => {
    setBusy(id);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(key);
      showToast('Key disalin', 'success');
    } catch {
      showToast('Gagal menyalin key', 'error');
    }
  };

  const node = (
    <div className="um" style={fontFamily ? { fontFamily } : undefined}>
      <div className="um-ov" onClick={onClose} />
      <aside className="um-dr" role="dialog" aria-label={`Detail ${user.email}`}>
        <div className="um-dr-top">
          <div className="um-user">
            <span className="um-av lg">{(user.display_name || user.email || '?').charAt(0).toUpperCase()}</span>
            <div className="um-user-t">
              <div className="um-name">{user.display_name || 'Tanpa nama'}</div>
              <div className="um-mail" title={user.email}>{user.email || '—'}</div>
            </div>
          </div>
          <button className="um-x" onClick={onClose} aria-label="Tutup detail"><Icon name="close" /></button>
        </div>

        <div className="um-dr-badges">
          <PlanBadge plan={user.plan} />
          <StatusPill id={status} />
          {user.is_admin && <span className="um-st amber"><i />Admin</span>}
          {orphan && <span className="um-st red" title="Profil ada, tapi akun login sudah tidak ada"><i />Akun login hilang</span>}
        </div>
        {user.is_blocked && user.block_reason && <p className="um-note">Alasan blokir: {user.block_reason}</p>}

        <dl className="um-grid">
          <div><dt>Bergabung</dt><dd>{fmtDate(user.created_at)}</dd></div>
          <div><dt>Terakhir login</dt><dd>{lastLogin === undefined ? '…' : lastLogin ? timeAgo(lastLogin) : 'belum pernah / tidak diketahui'}</dd></div>
          <div><dt>Jumlah trade</dt><dd>{trades === undefined ? '…' : trades === null ? '—' : trades}</dd></div>
          <div><dt>Telepon</dt><dd>{user.phone || '—'}</dd></div>
          <div><dt>Masa berlaku</dt><dd>{planSub(user)?.text ?? '—'}</dd></div>
          <div><dt>Trial pernah dipakai</dt><dd>{user.trial_used ? 'Ya' : 'Tidak'}</dd></div>
        </dl>

        <section className="um-sec">
          <h4>License key</h4>
          {key ? (
            <div className="um-keybox">
              <code>{key}</code>
              {keyInfo?.is_revoked && <span className="um-st red"><i />Dicabut</span>}
              <button className="um-btn sm" onClick={copyKey}>Salin</button>
            </div>
          ) : (
            <>
              <p className="um-dim">Akun ini belum punya key di tabel License Keys.</p>
              <button className="um-btn gold" disabled={busy !== null} onClick={() => run('mkkey', onCreateKey)}>
                {busy === 'mkkey' ? 'Membuat key…' : 'Buat license key'}
              </button>
            </>
          )}
        </section>

        {isPending(user) && (
          <section className="um-sec">
            <h4>Menunggu aktivasi: {user.pending_plan?.toUpperCase()}</h4>
            <button className="um-btn gold" disabled={busy !== null} onClick={() => run('act', onActivate)}>
              {busy === 'act' ? 'Mengaktifkan…' : `Aktifkan paket ${user.pending_plan}`}
            </button>
          </section>
        )}

        <section className="um-sec">
          <h4>Ubah plan</h4>
          <div className="um-seg">
            {PLANS.map((p) => (
              <button
                key={p}
                className={user.plan === p ? 'on' : nextPlan === p ? 'next' : ''}
                disabled={busy !== null || user.plan === p}
                onClick={() => setNextPlan(p)}
              >
                {PLAN_META[p].label}
              </button>
            ))}
          </div>
          {nextPlan && (
            <div className="um-confirm">
              <span>
                Ubah <b>{user.plan}</b> → <b>{nextPlan}</b>
                {nextPlan === 'free' ? '. Akses berbayar akan dicabut.' : '. Masa berlaku dihitung dari sekarang.'}
              </span>
              <div>
                <button className="um-btn sm" onClick={() => setNextPlan(null)}>Batal</button>
                <button
                  className="um-btn gold sm"
                  disabled={busy !== null}
                  onClick={() => run('plan', async () => {
                    const ok = await onChangePlan(nextPlan);
                    if (ok) setNextPlan(null);
                    return ok;
                  })}
                >
                  {busy === 'plan' ? 'Menyimpan…' : 'Terapkan'}
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="um-sec">
          <h4>Aksi cepat</h4>
          <div className="um-actions">
            {user.plan === 'trial' && (
              <button className="um-btn" disabled={busy !== null} onClick={() => run('ext', onExtendTrial)}>
                {busy === 'ext' ? 'Memperpanjang…' : 'Perpanjang trial +24 jam'}
              </button>
            )}
            <button className="um-btn" disabled={busy !== null} onClick={() => run('flag', onToggleActivated)}>
              {user.is_activated ? 'Tandai belum diaktivasi' : 'Tandai sudah diaktivasi'}
            </button>
          </div>
        </section>

        <section className="um-sec">
          <h4>{user.is_blocked ? 'Buka blokir' : 'Blokir akun'}</h4>
          {!user.is_blocked && (
            <input
              className="um-input"
              placeholder="Alasan blokir (opsional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          )}
          <button
            className={`um-btn${user.is_blocked ? '' : ' danger'}`}
            disabled={busy !== null || protectedAcc}
            onClick={() => run('block', () => onToggleBlock(reason.trim()))}
          >
            {busy === 'block' ? 'Menyimpan…' : user.is_blocked ? 'Buka blokir akun' : 'Blokir akun'}
          </button>
          {protectedAcc && <p className="um-dim">Akun admin tidak bisa diblokir atau dihapus dari sini.</p>}
        </section>

        <section className="um-sec danger">
          <h4>Hapus akun permanen</h4>
          <p className="um-dim">
            Menghapus akun login, profil, semua trade &amp; pengaturan, serta license key milik user ini. Tidak bisa dibatalkan.
            Kalau hanya ingin menghentikan akses, pakai blokir.
          </p>
          <input
            className="um-input"
            placeholder={`Ketik ${confirmWord} untuk konfirmasi`}
            value={delText}
            onChange={(e) => setDelText(e.target.value)}
            disabled={protectedAcc}
          />
          <p className="um-dim">Tombol hapus aktif setelah teks di atas diketik persis sama.</p>
          <button
            className="um-btn danger"
            disabled={busy !== null || protectedAcc || delText.trim().toLowerCase() !== confirmWord}
            onClick={() => run('del', onDelete)}
          >
            {busy === 'del' ? 'Menghapus…' : 'Hapus akun & semua datanya'}
          </button>
        </section>
      </aside>
    </div>
  );
  return typeof document === 'undefined' ? null : createPortal(node, document.body);
}

/* ───────────────────────── panel utama ───────────────────────── */

export default function UsersPanel({ active }: { active: boolean }) {
  const showToast = useAdminStore((s) => s.showToast);
  const allUsers = useAdminStore((s) => s.allUsers) as U[];
  const usersLoaded = useAdminStore((s) => s.usersLoaded);
  const setAllUsers = useAdminStore((s) => s.setAllUsers);
  const setUsersLoaded = useAdminStore((s) => s.setUsersLoaded);
  const { loadKeys } = useLicenseKeys();

  const [keyMap, setKeyMap] = useState<Record<string, KeyInfo>>({});
  const [lastSeen, setLastSeen] = useState<Record<string, string | null>>({});
  const [authLoaded, setAuthLoaded] = useState(false);
  const [keysReady, setKeysReady] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>('newest');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerFont, setDrawerFont] = useState<string>('');
  const rootRef = useRef<HTMLDivElement>(null);

  // Panel detail dirender di document.body, jadi font halaman admin perlu diteruskan.
  const openUser = (id: string) => {
    if (rootRef.current) setDrawerFont(getComputedStyle(rootRef.current).fontFamily);
    setSelectedId(id);
  };

  const copyText = async (t: string) => {
    try {
      await navigator.clipboard.writeText(t);
      showToast('Key disalin', 'success');
    } catch {
      showToast('Gagal menyalin', 'error');
    }
  };

  /* ── load: profiles (wajib) + license_keys + daftar akun login (opsional) ── */
  const loadUsers = useCallback(async () => {
    setUsersLoaded(false);
    try {
      const { data, error } = await _sbAdmin.from('profiles').select(COLS).order('created_at', { ascending: false });
      if (error) throw error;
      setAllUsers((data ?? []) as unknown as UserProfile[]);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Gagal memuat users', 'error');
      setUsersLoaded(true);
      return;
    }

    const [kRes, aRes] = await Promise.all([
      safe(_sbAdmin.from('license_keys').select('key,used_by,is_revoked')),
      safe(_sbAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })),
    ]);

    const km: Record<string, KeyInfo> = {};
    ((kRes?.data ?? []) as { key: string; used_by: string | null; is_revoked: boolean | null }[]).forEach((k) => {
      if (k.used_by && !km[k.used_by]) km[k.used_by] = { key: k.key, is_revoked: !!k.is_revoked };
    });
    setKeyMap(km);
    setKeysReady(!!kRes && !kRes.error);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authUsers: any[] | undefined = (aRes as any)?.data?.users;
    if (authUsers && authUsers.length < 1000) {
      const ls: Record<string, string | null> = {};
      authUsers.forEach((a) => {
        ls[a.id] = a.last_sign_in_at ?? null;
      });
      setLastSeen(ls);
      setAuthLoaded(true);
    } else {
      setLastSeen({});
      setAuthLoaded(false);
    }
    setUsersLoaded(true);
  }, [setAllUsers, setUsersLoaded, showToast]);

  useEffect(() => {
    if (active && !usersLoaded) loadUsers();
  }, [active, usersLoaded, loadUsers]);

  const keyOf = useCallback((u: U) => keyMap[u.id]?.key ?? u.license_key ?? '', [keyMap]);
  const isOrphan = useCallback((u: U) => authLoaded && !(u.id in lastSeen), [authLoaded, lastSeen]);

  /* ── mutasi ── */
  const applyPatch = (id: string, patch: Record<string, unknown>) => {
    const st = useAdminStore.getState();
    st.setAllUsers(st.allUsers.map((u) => (u.id === id ? ({ ...u, ...patch } as UserProfile) : u)));
  };

  const updateProfile = async (id: string, patch: Record<string, unknown>, okMsg: string) => {
    const { error } = await _sbAdmin.from('profiles').update(patch).eq('id', id);
    if (error) {
      showToast(error.message || 'Gagal menyimpan', 'error');
      return false;
    }
    applyPatch(id, patch);
    showToast(okMsg, 'success');
    return true;
  };

  const changePlan = (u: U, plan: UserPlan) =>
    updateProfile(u.id, planPatch(plan), `Plan diubah ke ${plan.toUpperCase()}`);

  const activatePending = (u: U) => {
    const p = (u.pending_plan || '') as UserPlan;
    if (!PLANS.includes(p)) {
      showToast('Plan pending tidak valid', 'error');
      return Promise.resolve(false);
    }
    return updateProfile(u.id, planPatch(p), `Akun diaktifkan — paket ${p.toUpperCase()}`);
  };

  const extendTrial = (u: U) => {
    const base = Math.max(Date.now(), u.plan_expires_at ? new Date(u.plan_expires_at).getTime() : 0);
    return updateProfile(u.id, { plan_expires_at: new Date(base + 24 * HOUR).toISOString() }, 'Trial diperpanjang 24 jam');
  };

  const toggleBlock = (u: U, reason: string) =>
    u.is_blocked
      ? updateProfile(u.id, { is_blocked: false, block_reason: null }, 'Blokir dibuka')
      : updateProfile(u.id, { is_blocked: true, block_reason: reason || 'Diblokir oleh admin' }, 'Akun diblokir');

  const toggleActivated = (u: U) =>
    updateProfile(u.id, { is_activated: !u.is_activated }, u.is_activated ? 'Ditandai belum diaktivasi' : 'Ditandai sudah diaktivasi');

  const createKey = async (u: U) => {
    const now = new Date().toISOString();
    for (let i = 0; i < 5; i++) {
      const key = genKeyString();
      const { error } = await _sbAdmin.from('license_keys').insert({
        key,
        is_used: true,
        is_revoked: false,
        customer_name: u.display_name?.trim() || null,
        used_by: u.id,
        used_at: now,
        created_at: now,
      });
      if (!error) {
        showToast(`Key dibuat: ${key}`, 'success');
        await loadKeys(); // muat ulang License Keys; daftar Users ikut dimuat ulang
        return true;
      }
      if (error.code !== '23505') {
        showToast(error.message || 'Gagal membuat key', 'error');
        return false;
      }
    }
    showToast('Gagal membuat key yang unik, coba lagi', 'error');
    return false;
  };

  const deleteUser = async (u: U) => {
    try {
      // 1) kumpulkan key milik user SEBELUM akun dihapus (used_by jadi NULL setelahnya)
      const { data: kr } = await _sbAdmin.from('license_keys').select('key').eq('used_by', u.id);
      const keys = new Set<string>(((kr ?? []) as { key: string }[]).map((k) => k.key));
      if (u.license_key) keys.add(u.license_key);

      // 2) hapus akun login (CASCADE: profiles, trades, settings, dst)
      const { error: aerr } = await _sbAdmin.auth.admin.deleteUser(u.id);
      if (aerr && !/not.?found/i.test(aerr.message)) throw new Error('Gagal hapus akun login: ' + aerr.message);

      // 3) pastikan profil benar-benar hilang (kasus akun yatim)
      const { error: perr } = await _sbAdmin.from('profiles').delete().eq('id', u.id);
      if (perr) throw new Error('Gagal hapus profil: ' + perr.message);

      // 4) hapus key
      if (keys.size) {
        const { error: kerr } = await _sbAdmin.from('license_keys').delete().in('key', Array.from(keys));
        if (kerr) throw new Error('Akun terhapus, tapi gagal hapus key: ' + kerr.message);
      }

      // 5) sinkronkan kedua store (Management & License Keys)
      const st = useAdminStore.getState();
      st.setAllUsers(st.allUsers.filter((x) => x.id !== u.id));
      st.setAllKeys(st.allKeys.filter((k) => !keys.has(k.key)));
      setSelectedId(null);
      showToast('Akun, data trade, dan key berhasil dihapus', 'success');
      return true;
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Gagal menghapus', 'error');
      return false;
    }
  };

  /* ── turunan data ── */
  const counts = useMemo(() => {
    const c = { all: allUsers.length, free: 0, trial: 0, basic: 0, pro: 0, elite: 0, pending: 0, blocked: 0, nokey: 0 };
    allUsers.forEach((u) => {
      if (u.plan in c) c[u.plan as UserPlan]++;
      if (isPending(u)) c.pending++;
      if (u.is_blocked) c.blocked++;
      if (keysReady && !keyOf(u)) c.nokey++;
    });
    return c;
  }, [allUsers, keysReady, keyOf]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = allUsers.filter((u) => {
      if (filter === 'pending' && !isPending(u)) return false;
      if (filter === 'blocked' && !u.is_blocked) return false;
      if (filter === 'nokey' && keyOf(u)) return false;
      if ((PLANS as string[]).includes(filter) && u.plan !== filter) return false;
      if (!q) return true;
      return (
        (u.email || '').toLowerCase().includes(q) ||
        (u.display_name || '').toLowerCase().includes(q) ||
        keyOf(u).toLowerCase().includes(q)
      );
    });
    const t = (s?: string | null) => (s ? new Date(s).getTime() : Infinity);
    list.sort((a, b) => {
      if (sort === 'oldest') return t(a.created_at) - t(b.created_at);
      if (sort === 'name') return (a.display_name || a.email || '').localeCompare(b.display_name || b.email || '');
      if (sort === 'expiry') return t(a.plan_expires_at) - t(b.plan_expires_at);
      return t(b.created_at) - t(a.created_at);
    });
    return list;
  }, [allUsers, filter, search, sort, keyOf]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);
  const selected = selectedId ? allUsers.find((u) => u.id === selectedId) ?? null : null;

  const chips: { id: Filter; label: string; n: number }[] = [
    { id: 'all', label: 'Semua', n: counts.all },
    { id: 'free', label: 'Free', n: counts.free },
    { id: 'trial', label: 'Trial', n: counts.trial },
    { id: 'basic', label: 'Basic', n: counts.basic },
    { id: 'pro', label: 'Pro', n: counts.pro },
    { id: 'elite', label: 'Elite', n: counts.elite },
    { id: 'pending', label: 'Menunggu aktivasi', n: counts.pending },
    { id: 'blocked', label: 'Diblokir', n: counts.blocked },
    { id: 'nokey', label: 'Tanpa key', n: counts.nokey },
  ];

  if (!active) return null;

  return (
    <div className="main um" ref={rootRef}>
      <style>{CSS}</style>

      <div className="um-head">
        <div>
          <h2>Users</h2>
          <p>
            {counts.all} akun terdaftar
            {counts.pending > 0 && <> — <b className="amber-t">{counts.pending} menunggu aktivasi</b></>}
          </p>
        </div>
        <div className="um-head-actions">
          <button className="um-btn" onClick={() => exportCsv(rows, keyOf)} disabled={!rows.length}>
            <Icon name="download" /> Ekspor CSV
          </button>
          <button className="um-btn" onClick={() => setUsersLoaded(false)} disabled={!usersLoaded}>
            <span className={usersLoaded ? undefined : 'um-spin'}><Icon name="refresh" /></span> Muat ulang
          </button>
        </div>
      </div>

      <div className="um-chips" role="tablist" aria-label="Filter user">
        {chips.filter((c) => c.id !== 'nokey' || c.n > 0 || filter === 'nokey').map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={filter === c.id}
            style={{ '--c': CHIP_COLOR[c.id] } as CSSProperties}
            className={`um-chip${filter === c.id ? ' on' : ''}${(c.id === 'pending' || c.id === 'nokey') && c.n > 0 ? ' amber' : ''}`}
            onClick={() => { setFilter(c.id); setPage(1); }}
          >
            {c.label} <b>{c.n}</b>
          </button>
        ))}
      </div>

      <div className="um-toolbar">
        <label className="um-search">
          <Icon name="search" />
          <input
            placeholder="Cari email, nama, atau license key"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            aria-label="Cari user"
          />
        </label>
        <select className="um-select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Urutkan">
          <option value="newest">Terbaru bergabung</option>
          <option value="oldest">Terlama bergabung</option>
          <option value="name">Nama / email A–Z</option>
          <option value="expiry">Masa berlaku terdekat</option>
        </select>
      </div>

      <div className="um-card" role="table" aria-label="Daftar user">
        <div className="um-row um-thead" role="row">
          <div>User</div><div>Plan</div><div>Status</div><div>License key</div><div>Bergabung</div><div />
        </div>

        {!usersLoaded ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="um-row"><div className="um-skel" /><div className="um-skel s" /><div className="um-skel s" /><div className="um-skel s" /><div className="um-skel s" /><div /></div>
          ))
        ) : pageRows.length === 0 ? (
          <div className="um-empty">
            {search || filter !== 'all'
              ? 'Tidak ada user yang cocok. Ubah kata kunci atau pilih filter “Semua”.'
              : 'Belum ada user terdaftar.'}
          </div>
        ) : (
          pageRows.map((u) => {
            const sub = planSub(u);
            const pend = isPending(u);
            const k = keyOf(u);
            return (
              <div
                key={u.id}
                role="row"
                tabIndex={0}
                className={`um-row um-body${pend ? ' pend' : ''}${u.is_blocked ? ' blocked' : ''}${selectedId === u.id ? ' sel' : ''}`}
                onClick={() => openUser(u.id)}
                onKeyDown={(e) => e.key === 'Enter' && openUser(u.id)}
              >
                <div className="um-user c-u">
                  <span className="um-av">{(u.display_name || u.email || '?').charAt(0).toUpperCase()}</span>
                  <div className="um-user-t">
                    <div className="um-name">{u.display_name || <span className="um-dim">Tanpa nama</span>}</div>
                    <div className="um-mail" title={u.email}>{u.email || '—'}</div>
                  </div>
                </div>
                <div className="c-p">
                  <PlanBadge plan={u.plan} />
                  {sub && <span className={`um-sub${sub.warn ? ' warn' : ''}`}>{sub.text}</span>}
                  {pend && (
                    <button
                      className="um-btn gold xs"
                      onClick={(e) => { e.stopPropagation(); activatePending(u); }}
                    >
                      Aktifkan {u.pending_plan}
                    </button>
                  )}
                </div>
                <div className="c-s">
                  <StatusPill id={getStatus(u)} />
                  {isOrphan(u) && <span className="um-st red" title="Profil ada, tapi akun login sudah tidak ada"><i />Akun login hilang</span>}
                </div>
                <div className="um-key c-k">
                  {k ? (
                    <>
                      <span>{k}</span>
                      <button
                        className="um-cp"
                        title="Salin key"
                        aria-label={`Salin key ${k}`}
                        onClick={(e) => { e.stopPropagation(); copyText(k); }}
                      >
                        <Icon name="copy" />
                      </button>
                    </>
                  ) : (
                    <span className="um-nokey">belum ada key</span>
                  )}
                </div>
                <div className="um-date c-d" title={fmtDate(u.created_at)}>
                  {timeAgo(u.created_at)}<span>{fmtDate(u.created_at)}</span>
                </div>
                <div className="um-chev c-x"><Icon name="chev" /></div>
              </div>
            );
          })
        )}
      </div>

      {usersLoaded && rows.length > PER_PAGE && (
        <div className="um-pag">
          <span>{rows.length} user — halaman {safePage} dari {totalPages}</span>
          <div>
            <button className="um-btn sm" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>Sebelumnya</button>
            <button className="um-btn sm" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>Berikutnya</button>
          </div>
        </div>
      )}

      {selected && (
        <UserDrawer
          key={selected.id}
          user={selected}
          keyInfo={keyMap[selected.id] ?? null}
          lastLogin={authLoaded ? lastSeen[selected.id] ?? null : undefined}
          orphan={isOrphan(selected)}
          onClose={() => setSelectedId(null)}
          onChangePlan={(p) => changePlan(selected, p)}
          onActivate={() => activatePending(selected)}
          onExtendTrial={() => extendTrial(selected)}
          onToggleBlock={(r) => toggleBlock(selected, r)}
          onToggleActivated={() => toggleActivated(selected)}
          onDelete={() => deleteUser(selected)}
          onCreateKey={() => createKey(selected)}
          fontFamily={drawerFont}
        />
      )}
    </div>
  );
}

/* ───────────────────────── style (scoped ke .um) ───────────────────────── */

const CSS = `
.um{--g:#C9A84C;--card:#121212;--card2:#171717;--line:rgba(255,255,255,.07);--tx:var(--text,#EDE6D3);--dim:var(--text3,#7A705D)}
.um .amber-t{color:#FBBF24;font-weight:600}
.um-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:16px}
.um-head h2{font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:600;color:var(--tx);margin:0;line-height:1.1}
.um-head p{margin:4px 0 0;font-size:12px;color:var(--dim)}
.um-head-actions{display:flex;gap:8px;flex-wrap:wrap}
.um-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;background:transparent;border:1px solid var(--line);color:var(--tx);border-radius:9px;padding:8px 13px;font-size:12px;font-family:inherit;cursor:pointer;transition:border-color .15s,color .15s}
.um-btn:hover:not(:disabled){border-color:rgba(201,168,76,.5);color:var(--g)}
.um-btn:focus-visible,.um-chip:focus-visible,.um-row:focus-visible,.um-seg button:focus-visible{outline:2px solid var(--g);outline-offset:2px}
.um-btn.gold{background:var(--g);color:#000;border-color:var(--g);font-weight:700}
.um-btn.gold:hover:not(:disabled){color:#000;filter:brightness(1.08)}
.um-btn.danger{color:#F87171;border-color:rgba(248,113,113,.38)}
.um-btn.danger:hover:not(:disabled){color:#fff;background:#B91C1C;border-color:#B91C1C}
.um-btn.sm{padding:6px 11px;font-size:11px}
.um-btn.xs{padding:4px 9px;font-size:10px;border-radius:7px;margin-top:2px;align-self:flex-start}
.um-btn:disabled{opacity:.45;cursor:not-allowed}
.um-chips{display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;margin-bottom:12px;scrollbar-width:thin}
.um-chip{flex:0 0 auto;display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line);background:var(--card);border-radius:99px;padding:7px 14px;cursor:pointer;color:var(--dim);font-size:12px;font-family:inherit;transition:border-color .15s,color .15s}
.um-chip b{font-size:13px;color:var(--tx);font-weight:700}
.um-chip:hover{border-color:rgba(201,168,76,.4)}
.um-chip.on{border-color:var(--g);background:rgba(201,168,76,.1);color:var(--g)}
.um-chip.on b{color:var(--g)}
.um-chip.amber{border-color:rgba(251,191,36,.45);color:#FBBF24}
.um-toolbar{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px}
.um-search{flex:1 1 260px;display:flex;align-items:center;gap:9px;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0 12px;color:var(--dim)}
.um-search:focus-within{border-color:rgba(201,168,76,.55)}
.um-search input{flex:1;background:transparent;border:0;outline:0;color:var(--tx);font-size:13px;padding:10px 0;font-family:inherit;min-width:0}
.um-select,.um-input{background:var(--card);border:1px solid var(--line);border-radius:10px;color:var(--tx);font-size:12px;padding:10px 12px;font-family:inherit}
.um-input{width:100%;margin-bottom:8px;box-sizing:border-box}
.um-input:focus,.um-select:focus{outline:0;border-color:rgba(201,168,76,.55)}
.um-card{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.um-row{display:grid;grid-template-columns:minmax(220px,2.2fr) 1.3fr 1.3fr 1.3fr 1fr 22px;gap:14px;align-items:center;padding:15px 18px;border-bottom:1px solid var(--line)}
.um-row:last-child{border-bottom:0}
.um-thead{background:var(--card2);font-size:11px;color:var(--dim);padding-top:10px;padding-bottom:10px;letter-spacing:.02em}
.um-body{cursor:pointer;transition:background .12s}
.um-body:hover,.um-body.sel{background:rgba(201,168,76,.05)}
.um-body.pend{box-shadow:inset 3px 0 0 rgba(251,191,36,.6);background:rgba(251,191,36,.03)}
.um-body.blocked{opacity:.72}
.um-user{display:flex;align-items:center;gap:11px;min-width:0}
.um-user-t{min-width:0;display:flex;flex-direction:column;gap:3px}
.um-name{font-size:13.5px;line-height:1.35;font-weight:600;color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.um-mail{font-size:12px;line-height:1.35;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.um-av{flex:0 0 auto;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font-weight:700;font-size:13px;color:var(--g);background:rgba(201,168,76,.12);border:1px solid rgba(201,168,76,.28)}
.um-av.lg{width:44px;height:44px;font-size:16px}
.um-dim{color:var(--dim);font-size:12px}
.um-nokey{font-size:12px;color:#FBBF24}
.c-p,.c-s{display:flex;flex-direction:column;gap:4px;align-items:flex-start}
.um-badge{display:inline-flex;align-items:center;gap:6px;border:1px solid;border-radius:99px;padding:3px 10px;font-size:11px;font-weight:600}
.um-badge i,.um-st i{width:5px;height:5px;border-radius:50%;background:currentColor;display:inline-block}
.um-sub{font-size:11px;color:var(--dim)}
.um-sub.warn{color:#F87171}
.um-st{display:inline-flex;align-items:center;gap:6px;border-radius:99px;padding:3px 10px;font-size:11px;font-weight:600;border:1px solid}
.um-st.green{color:#4ADE80;background:rgba(74,222,128,.08);border-color:rgba(74,222,128,.3)}
.um-st.red{color:#F87171;background:rgba(248,113,113,.08);border-color:rgba(248,113,113,.32)}
.um-st.amber{color:#FBBF24;background:rgba(251,191,36,.08);border-color:rgba(251,191,36,.34)}
.um-st.purple{color:#C084FC;background:rgba(192,132,252,.08);border-color:rgba(192,132,252,.3)}
.um-st.dim{color:var(--dim);background:transparent;border-color:var(--line)}
.um-key{font-family:'JetBrains Mono',monospace;font-size:11.5px;color:var(--tx)}
.um-date{font-size:12px;color:var(--tx);display:flex;flex-direction:column}
.um-date span{font-size:11px;color:var(--dim)}
.um-chev{color:var(--dim);display:flex;justify-content:flex-end}
.um-empty{padding:40px 20px;text-align:center;color:var(--dim);font-size:13px}
.um-skel{height:12px;width:70%;border-radius:6px;background:rgba(255,255,255,.06);animation:umPulse 1.4s ease-in-out infinite}
.um-skel.s{width:50%}
@keyframes umPulse{0%,100%{opacity:.4}50%{opacity:.9}}
.um-pag{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px;font-size:12px;color:var(--dim)}
.um-pag div{display:flex;gap:8px}
.um-ov{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9000}
.um-dr{position:fixed;top:0;right:0;bottom:0;width:min(440px,100%);background:#0F0F0F;border-left:1px solid var(--line);z-index:9001;overflow-y:auto;padding:20px;box-sizing:border-box;animation:umIn .18s ease-out}
@keyframes umIn{from{transform:translateX(24px);opacity:0}to{transform:none;opacity:1}}
@media (prefers-reduced-motion:reduce){.um-dr{animation:none}.um-skel{animation:none}}
.um-dr-top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:14px}
.um-x{background:transparent;border:1px solid var(--line);color:var(--dim);border-radius:8px;width:30px;height:30px;display:grid;place-items:center;cursor:pointer}
.um-x:hover{color:var(--tx)}
.um-dr-badges{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
.um-note{font-size:12px;color:#F87171;margin:0 0 12px}
.um-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 16px;margin:0 0 18px;padding:14px;background:var(--card);border:1px solid var(--line);border-radius:12px}
.um-grid dt{font-size:11px;color:var(--dim);margin-bottom:2px}
.um-grid dd{margin:0;font-size:13px;color:var(--tx)}
.um-sec{padding:14px 0;border-top:1px solid var(--line)}
.um-sec h4{margin:0 0 10px;font-size:13px;font-weight:600;color:var(--tx)}
.um-sec p{margin:0 0 10px;line-height:1.5}
.um-sec.danger h4{color:#F87171}
.um-keybox{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.um-keybox code{font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--g);background:rgba(201,168,76,.08);padding:6px 10px;border-radius:8px}
.um-seg{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
.um-seg button{background:var(--card);border:1px solid var(--line);color:var(--dim);border-radius:8px;padding:8px 0;font-size:12px;font-family:inherit;cursor:pointer}
.um-seg button.on{border-color:var(--g);color:var(--g);background:rgba(201,168,76,.1);cursor:default}
.um-seg button.next{border-color:#C084FC;color:#C084FC}
.um-seg button:disabled:not(.on){opacity:.5;cursor:not-allowed}
.um-confirm{margin-top:10px;padding:10px 12px;border:1px solid rgba(201,168,76,.3);background:rgba(201,168,76,.06);border-radius:10px;font-size:12px;color:var(--tx);display:flex;flex-direction:column;gap:10px}
.um-confirm div{display:flex;gap:8px;justify-content:flex-end}
.um-actions{display:flex;gap:8px;flex-wrap:wrap}
.um{--tx:#E6DCC2;--kg:var(--gold2,#E2C46A)}
.um-btn:hover:not(:disabled){background:rgba(201,168,76,.08)}
.um-btn:active:not(:disabled){transform:translateY(1px)}
.um-search:focus-within,.um-select:focus,.um-input:focus{box-shadow:0 0 0 3px rgba(201,168,76,.12)}
.um-chip{--c:var(--g);transition:border-color .15s,color .15s,background .15s,transform .15s}
.um-chip b{color:var(--c)}
.um-chip:hover{border-color:var(--c);color:var(--tx);transform:translateY(-1px)}
.um-chip.on{border-color:var(--c);background:rgba(201,168,76,.1);background:color-mix(in srgb,var(--c) 13%,transparent);color:var(--c)}
.um-chip.on b{color:var(--c)}
.um-chip.amber{border-color:rgba(251,191,36,.45)}
.um-body:hover,.um-body.sel{background:rgba(201,168,76,.07);box-shadow:inset 3px 0 0 var(--g)}
.um-body.pend{box-shadow:inset 3px 0 0 rgba(251,191,36,.6)}
.um-body.pend:hover{background:rgba(251,191,36,.07)}
.um-av{transition:border-color .15s,background .15s}
.um-body:hover .um-av{border-color:var(--g);background:rgba(201,168,76,.22)}
.um-name{transition:color .15s}
.um-body:hover .um-name{color:var(--g)}
.um-mail{color:#8F8570}
.um-chev{transition:color .15s,transform .15s}
.um-body:hover .um-chev{color:var(--g);transform:translateX(3px)}
.um-key{display:flex;align-items:center;gap:8px;color:var(--kg);letter-spacing:.06em;font-weight:600}
.um-cp{display:inline-grid;place-items:center;width:26px;height:26px;border-radius:7px;border:1px solid transparent;background:transparent;color:var(--dim);cursor:pointer;opacity:0;transition:opacity .15s,color .15s,border-color .15s,background .15s}
.um-body:hover .um-cp,.um-cp:focus-visible{opacity:1}
.um-cp:hover{color:var(--g);border-color:rgba(201,168,76,.45);background:rgba(201,168,76,.1)}
.um-date{gap:5px;line-height:1.3;color:#B3A88E}
.um-date span{color:var(--dim);font-size:11px}
.c-p,.c-s{gap:7px}
.um-sub{line-height:1.3}
.um-spin{display:inline-flex;animation:umSpin .8s linear infinite}
@keyframes umSpin{to{transform:rotate(360deg)}}
@media (hover:none){.um-cp{opacity:1}}
@media (prefers-reduced-motion:reduce){.um-spin{animation:none}.um-chip:hover{transform:none}}
@media (max-width:900px){
  .um-thead{display:none}
  .um-row{grid-template-columns:1fr auto;grid-template-areas:"u u" "p s" "k d";gap:8px 12px;padding:14px}
  .c-u{grid-area:u}.c-p{grid-area:p}.c-s{grid-area:s;align-items:flex-end}.c-k{grid-area:k}.c-d{grid-area:d;text-align:right;align-items:flex-end}
  .c-x{display:none}
}
`;