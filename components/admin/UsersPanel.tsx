'use client';

// components/admin/UsersPanel.tsx
// Fitur: list semua user, ubah plan, badge pending, tombol aktivasi admin

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useAdminStore, PAGE_SIZE } from '@/store/useAdminStore';
import type { UserProfile, UserPlan } from '@/store/useAdminStore';
import { _sbAdmin } from '@/lib/supabaseClient';

// ── Extended type untuk pending activation ───────────────────
interface UserProfileExtended extends UserProfile {
  pending_plan: string | null;
  admin_verified: boolean;
}

// ── Plan config ──────────────────────────────────────────────
const PLANS: UserPlan[] = ['free', 'basic', 'pro', 'elite'];

const PLAN_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  free:  { label: 'FREE',  color: '#6A6050', bg: 'rgba(106,96,80,0.12)',   border: 'rgba(106,96,80,0.25)'  },
  basic: { label: 'BASIC', color: '#60A5FA', bg: 'rgba(96,165,250,0.09)',  border: 'rgba(96,165,250,0.25)' },
  pro:   { label: 'PRO',   color: '#C9A84C', bg: 'rgba(201,168,76,0.12)',  border: 'rgba(201,168,76,0.32)' },
  elite: { label: 'ELITE', color: '#F97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.32)' },
};

// ── Plan Badge ───────────────────────────────────────────────
function PlanBadge({ plan }: { plan: UserPlan }) {
  const m = PLAN_META[plan] ?? PLAN_META['free'];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      borderRadius: 99, padding: '4px 11px',
      fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap',
      fontFamily: "'JetBrains Mono', monospace",
      color: m.color, background: m.bg, border: `1px solid ${m.border}`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
      {m.label}
    </span>
  );
}

// ── Pending Activation Badge ─────────────────────────────────
function PendingBadge({ pendingPlan }: { pendingPlan: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      borderRadius: 99, padding: '4px 11px',
      fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap',
      fontFamily: "'JetBrains Mono', monospace",
      color: '#FBBF24',
      background: 'rgba(251,191,36,0.1)',
      border: '1px solid rgba(251,191,36,0.35)',
      animation: 'pendingPulse 2s ease-in-out infinite',
    }}>
      <span style={{ fontSize: 10 }}>⏳</span>
      MENUNGGU — {pendingPlan.toUpperCase()}
    </span>
  );
}

// ── Activate Now Button ──────────────────────────────────────
function ActivateButton({
  userId,
  pendingPlan,
  onActivated,
}: {
  userId: string;
  pendingPlan: string;
  onActivated: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const showToast = useAdminStore((s) => s.showToast);

  const handleActivate = useCallback(async () => {
    setLoading(true);
    try {
      const { error } = await _sbAdmin
        .from('profiles')
        .update({
          plan:             'premium',
          plan_type:        pendingPlan,
          admin_verified:   true,
          pending_plan:     null,
          is_activated:     true,
          plan_activated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) throw error;
      showToast(`✅ Akun diaktifkan — paket ${pendingPlan.toUpperCase()}`, 'success');
      onActivated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal aktivasi';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [userId, pendingPlan, onActivated, showToast]);

  return (
    <button
      onClick={handleActivate}
      disabled={loading}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: loading ? 'rgba(201,168,76,0.2)' : '#C9A84C',
        color: loading ? '#C9A84C' : '#000',
        border: '1px solid #C9A84C',
        borderRadius: 8,
        padding: '6px 14px',
        fontSize: 11, fontWeight: 700,
        fontFamily: "'JetBrains Mono', monospace",
        cursor: loading ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s ease',
        whiteSpace: 'nowrap',
      }}
    >
      {loading ? (
        <span style={{
          width: 10, height: 10,
          border: '2px solid rgba(201,168,76,0.3)',
          borderTopColor: '#C9A84C',
          borderRadius: '50%',
          animation: 'spin .7s linear infinite',
          display: 'inline-block',
        }} />
      ) : '⚡'}
      {loading ? 'Mengaktifkan...' : 'Aktivasi Sekarang'}
    </button>
  );
}

// ── Plan Selector (dropdown inline) ─────────────────────────
function PlanSelector({
  userId, currentPlan, onChanged,
}: { userId: string; currentPlan: UserPlan; onChanged: (plan: UserPlan) => void }) {
  const [loading, setLoading] = useState(false);
  const updateUserPlan = useAdminStore((s) => s.updateUserPlan);
  const showToast = useAdminStore((s) => s.showToast);

  const handleChange = useCallback(async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPlan = e.target.value as UserPlan;
    if (newPlan === currentPlan) return;
    setLoading(true);
    try {
      // Admin override manual — set admin_verified true sekaligus
      const updates: Record<string, unknown> = { plan: newPlan };
      if (newPlan !== 'free') {
        updates.plan_type      = newPlan;
        updates.admin_verified = true;
        updates.pending_plan   = null;
        updates.is_activated   = true;
        updates.plan_activated_at = new Date().toISOString();
      } else {
        // downgrade ke free
        updates.plan_type      = null;
        updates.admin_verified = false;
        updates.pending_plan   = null;
        updates.is_activated   = false;
      }

      const { error } = await _sbAdmin
        .from('profiles')
        .update(updates)
        .eq('id', userId);
      if (error) throw error;
      updateUserPlan(userId, newPlan);
      onChanged(newPlan);
      showToast(`Plan diubah ke ${newPlan.toUpperCase()}`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal update plan';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [currentPlan, userId, updateUserPlan, showToast, onChanged]);

  const safePlan = PLAN_META[currentPlan] ? currentPlan : 'free';
  const m = PLAN_META[safePlan];

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {loading && (
        <span style={{
          width: 12, height: 12, border: '2px solid rgba(201,168,76,0.2)',
          borderTopColor: '#C9A84C', borderRadius: '50%',
          animation: 'spin .7s linear infinite', display: 'inline-block',
        }} />
      )}
      <select
        value={currentPlan}
        onChange={handleChange}
        disabled={loading}
        style={{
          background: m.bg,
          border: `1px solid ${m.border}`,
          borderRadius: 8,
          padding: '5px 28px 5px 10px',
          fontSize: 11,
          fontWeight: 700,
          fontFamily: "'JetBrains Mono', monospace",
          color: m.color,
          cursor: loading ? 'not-allowed' : 'pointer',
          outline: 'none',
          appearance: 'none',
          WebkitAppearance: 'none',
          opacity: loading ? 0.6 : 1,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='${encodeURIComponent(m.color)}' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 8px center',
          minWidth: 80,
        }}
      >
        {PLANS.map((p) => (
          <option key={p} value={p} style={{ background: '#141414', color: PLAN_META[p].color }}>
            {PLAN_META[p].label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Toggle Activated Button ──────────────────────────────────
function ToggleActivated({ userId, isActivated }: { userId: string; isActivated: boolean }) {
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(isActivated);
  const showToast = useAdminStore((s) => s.showToast);

  const handleToggle = async () => {
    setLoading(true);
    try {
      const { error } = await _sbAdmin
        .from('profiles')
        .update({ is_activated: !active })
        .eq('id', userId);
      if (error) throw error;
      setActive(!active);
      showToast(`Status diubah ke ${!active ? 'Aktif' : 'Nonaktif'}`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal update status';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`badge ${active ? 'used' : 'unused'}`}
      style={{ cursor: loading ? 'not-allowed' : 'pointer', border: 'none', gap: 6 }}
    >
      {loading
        ? <span style={{ width: 8, height: 8, border: '1.5px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} />
        : <span className="dot" />}
      {active ? 'Aktif' : 'Belum Aktif'}
    </button>
  );
}

// ── Skeleton Row ─────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr>
      {[180, 120, 80, 140, 90, 100, 80].map((w, i) => (
        <td key={i} style={{ padding: '14px 16px' }}>
          <div style={{
            height: 12, width: w, borderRadius: 6,
            background: 'rgba(255,255,255,0.05)',
            animation: 'pulse 1.4s ease-in-out infinite',
          }} />
        </td>
      ))}
    </tr>
  );
}

// ── Main Panel ───────────────────────────────────────────────
export default function UsersPanel({ active }: { active: boolean }) {
  const {
    allUsers, usersLoaded, usersSearch, usersPlanFilter, usersPage,
    setAllUsers, setUsersLoaded, setUsersSearch, setUsersPlanFilter, setUsersPage,
    showToast,
  } = useAdminStore();

  const [localPlans, setLocalPlans] = useState<Record<string, UserPlan>>({});
  // State lokal untuk track pending_plan per user (setelah aktivasi)
  const [localPending, setLocalPending] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (!active || usersLoaded) return;
    loadUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const loadUsers = useCallback(async () => {
    setUsersLoaded(false);
    try {
      const { data, error } = await _sbAdmin
        .from('profiles')
        .select('id, email, display_name, plan, is_activated, created_at, pending_plan, admin_verified')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAllUsers(((data ?? []) as UserProfileExtended[]).map(u => ({
        ...u,
        plan: (u.plan ?? 'free') as UserPlan,
      })));
      setUsersLoaded(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memuat users';
      showToast(msg, 'error');
      setUsersLoaded(true);
    }
  }, [setAllUsers, setUsersLoaded, showToast]);

  const handleRefresh = () => {
    setUsersLoaded(false);
    setLocalPending({});
    loadUsers();
  };

  // Count pending aktivasi
  const pendingCount = useMemo(() => {
    return (allUsers as UserProfileExtended[]).filter(
      u => (localPending[u.id] !== undefined ? localPending[u.id] : u.pending_plan) && !u.admin_verified
    ).length;
  }, [allUsers, localPending]);

  const filtered = useMemo(() => {
    const q = usersSearch.trim().toLowerCase();
    return (allUsers as UserProfileExtended[]).filter((u) => {
      const matchSearch = !q ||
        u.email?.toLowerCase().includes(q) ||
        (u.display_name ?? '').toLowerCase().includes(q);
      const matchPlan = usersPlanFilter === 'all' || u.plan === usersPlanFilter;
      return matchSearch && matchPlan;
    });
  }, [allUsers, usersSearch, usersPlanFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(usersPage, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const planCounts = useMemo(() => {
    const counts = { free: 0, basic: 0, pro: 0, elite: 0 };
    allUsers.forEach((u) => { if (u.plan in counts) counts[u.plan as keyof typeof counts]++; });
    return counts;
  }, [allUsers]);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return '-'; }
  };

  if (!active) return null;

  return (
    <div className="main">
      {/* ── Stats mini bar ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 24,
      }}>
        {[
          { label: 'TOTAL USERS', val: allUsers.length,    color: 'var(--text)' },
          { label: 'FREE',        val: planCounts.free,    color: PLAN_META.free.color  },
          { label: 'BASIC',       val: planCounts.basic,   color: PLAN_META.basic.color },
          { label: 'PRO',         val: planCounts.pro,     color: PLAN_META.pro.color   },
          { label: 'ELITE',       val: planCounts.elite,   color: PLAN_META.elite.color },
          { label: '⏳ PENDING',  val: pendingCount,       color: '#FBBF24'             },
        ].map((s) => (
          <div key={s.label} className="stat-card" style={{ padding: '16px 20px' }}>
            <div className="stat-lbl">{s.label}</div>
            <div className="stat-val" style={{ fontSize: 28, color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* ── Alert banner kalau ada pending ── */}
      {pendingCount > 0 && (
        <div style={{
          background: 'rgba(251,191,36,0.07)',
          border: '1px solid rgba(251,191,36,0.25)',
          borderRadius: 10,
          padding: '12px 18px',
          marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 13, color: '#FBBF24',
        }}>
          <span style={{ fontSize: 18 }}>⚡</span>
          <span>
            Ada <strong>{pendingCount} pembayaran</strong> yang menunggu aktivasi manual.
            Scroll ke bawah untuk melihat dan mengaktifkan.
          </span>
        </div>
      )}

      {/* ── Table section ── */}
      <div className="section">
        <div className="section-head">
          <span className="section-title">👥 User Management</span>
          <div className="filter-bar">
            <input
              className="filter-input"
              placeholder="🔍 Cari email atau nama..."
              value={usersSearch}
              onChange={(e) => setUsersSearch(e.target.value)}
            />
            <select
              className="filter-select"
              value={usersPlanFilter}
              onChange={(e) => setUsersPlanFilter(e.target.value as 'all' | UserPlan)}
            >
              <option value="all">Semua Plan</option>
              {PLANS.map((p) => (
                <option key={p} value={p}>{PLAN_META[p].label}</option>
              ))}
            </select>
            <button className="refresh-btn" onClick={handleRefresh}>
              ↻ Refresh
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>EMAIL</th>
                <th>NAMA</th>
                <th>PLAN</th>
                <th>PENDING / AKTIVASI</th>
                <th>UBAH PLAN</th>
                <th>STATUS</th>
                <th>BERGABUNG</th>
              </tr>
            </thead>
            <tbody>
              {!usersLoaded ? (
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      {usersSearch || usersPlanFilter !== 'all'
                        ? '🔍 Tidak ada user yang cocok dengan filter.'
                        : '👤 Belum ada user terdaftar.'}
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((user) => {
                  const extUser = user as UserProfileExtended;
                  const displayPlan = localPlans[user.id] ?? user.plan;

                  // Gunakan localPending untuk reflect setelah aktivasi tanpa reload
                  const currentPending = localPending[user.id] !== undefined
                    ? localPending[user.id]
                    : extUser.pending_plan;

                  const hasPending = !!currentPending && !extUser.admin_verified;

                  return (
                    <tr
                      key={user.id}
                      style={hasPending ? {
                        background: 'rgba(251,191,36,0.04)',
                        borderLeft: '2px solid rgba(251,191,36,0.4)',
                      } : undefined}
                    >
                      {/* Email */}
                      <td>
                        <span className="email-text" title={user.email}>
                          {user.email || '-'}
                        </span>
                      </td>

                      {/* Nama */}
                      <td style={{ fontSize: 13, color: 'var(--text)' }}>
                        {user.display_name || <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>—</span>}
                      </td>

                      {/* Badge plan saat ini */}
                      <td><PlanBadge plan={displayPlan} /></td>

                      {/* Kolom Pending / Aktivasi */}
                      <td>
                        {hasPending ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <PendingBadge pendingPlan={currentPending!} />
                            <ActivateButton
                              userId={user.id}
                              pendingPlan={currentPending!}
                              onActivated={() => {
                                // Update lokal tanpa reload
                                setLocalPending(prev => ({ ...prev, [user.id]: null }));
                                setLocalPlans(prev => ({ ...prev, [user.id]: currentPending as UserPlan }));
                                // Update admin_verified di object (workaround tanpa reload)
                                extUser.admin_verified = true;
                              }}
                            />
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text3)', fontSize: 11 }}>—</span>
                        )}
                      </td>

                      {/* Selector override plan manual */}
                      <td>
                        <PlanSelector
                          userId={user.id}
                          currentPlan={displayPlan}
                          onChanged={(p) => {
                            setLocalPlans((prev) => ({ ...prev, [user.id]: p }));
                            setLocalPending((prev) => ({ ...prev, [user.id]: null }));
                          }}
                        />
                      </td>

                      {/* Status aktivasi */}
                      <td>
                        <ToggleActivated userId={user.id} isActivated={user.is_activated} />
                      </td>

                      {/* Tanggal */}
                      <td className="date-text">{formatDate(user.created_at)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {usersLoaded && filtered.length > PAGE_SIZE && (
          <div className="pagination">
            <span className="pag-info">
              {filtered.length} user · halaman {safePage} dari {totalPages}
            </span>
            <div className="pag-btns">
              <button
                className="pag-btn"
                disabled={safePage <= 1}
                onClick={() => setUsersPage(safePage - 1)}
              >← Prev</button>
              {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                const pg = i + 1;
                return (
                  <button
                    key={pg}
                    className={`pag-btn ${safePage === pg ? 'active' : ''}`}
                    onClick={() => setUsersPage(pg)}
                  >{pg}</button>
                );
              })}
              <button
                className="pag-btn"
                disabled={safePage >= totalPages}
                onClick={() => setUsersPage(safePage + 1)}
              >Next →</button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: .4; }
          50% { opacity: .9; }
        }
        @keyframes pendingPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}