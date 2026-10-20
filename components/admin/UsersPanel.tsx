'use client';

// components/admin/UsersPanel.tsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useAdminStore, PAGE_SIZE } from '@/store/useAdminStore';
import type { UserProfile, UserPlan } from '@/store/useAdminStore';
import { _sbAdmin } from '@/lib/supabaseClient';

interface UserProfileExtended extends UserProfile {
  pending_plan: string | null;
  admin_verified: boolean;
  plan_expires_at: string | null;
  trial_used: boolean | null;
}

const TRIAL_MS = 48 * 60 * 60 * 1000;
const BASIC_MS = 90 * 24 * 60 * 60 * 1000;
const PLANS: UserPlan[] = ['free', 'trial', 'basic', 'pro', 'elite'];

const PLAN_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  free:  { label: 'FREE',  color: '#6A6050', bg: 'rgba(106,96,80,0.12)',   border: 'rgba(106,96,80,0.25)'  },
  trial: { label: 'TRIAL', color: '#C084FC', bg: 'rgba(192,132,252,0.12)', border: 'rgba(192,132,252,0.32)' },
  basic: { label: 'BASIC', color: '#60A5FA', bg: 'rgba(96,165,250,0.09)',  border: 'rgba(96,165,250,0.25)' },
  pro:   { label: 'PRO',   color: '#C9A84C', bg: 'rgba(201,168,76,0.12)',  border: 'rgba(201,168,76,0.32)' },
  elite: { label: 'ELITE', color: '#F97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.32)' },
};

function trialRemainingLabel(expiresAt: string | null | undefined) {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (isNaN(ms)) return null;
  if (ms <= 0) return { text: 'habis', expired: true };
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return { text: d > 0 ? `sisa ${d}h ${h}j` : `sisa ${h}j ${m}m`, expired: false };
}

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

function PendingBadge({ pendingPlan }: { pendingPlan: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      borderRadius: 99, padding: '4px 11px',
      fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap',
      fontFamily: "'JetBrains Mono', monospace",
      color: '#FBBF24', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.35)',
      animation: 'pendingPulse 2s ease-in-out infinite',
    }}>
      <span style={{ fontSize: 10 }}>⏳</span>
      MENUNGGU — {pendingPlan.toUpperCase()}
    </span>
  );
}

function ActivateButton({ userId, pendingPlan, onActivated }: {
  userId: string; pendingPlan: string; onActivated: (expiresAt: string | null) => void;
}) {
  const [loading, setLoading] = useState(false);
  const showToast = useAdminStore((s) => s.showToast);

  const handleActivate = useCallback(async () => {
    setLoading(true);
    try {
      const expiresAt = pendingPlan === 'basic' ? new Date(Date.now() + BASIC_MS).toISOString() : null;
      const { error } = await _sbAdmin.from('profiles').update({
        plan: pendingPlan, plan_type: pendingPlan, admin_verified: true,
        pending_plan: null, is_activated: true,
        plan_activated_at: new Date().toISOString(),
        plan_expires_at: expiresAt, trial_used: true,
      }).eq('id', userId);
      if (error) throw error;
      showToast(`✅ Akun diaktifkan — paket ${pendingPlan.toUpperCase()}`, 'success');
      onActivated(expiresAt);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Gagal aktivasi', 'error');
    } finally {
      setLoading(false);
    }
  }, [userId, pendingPlan, onActivated, showToast]);

  return (
    <button onClick={handleActivate} disabled={loading} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: loading ? 'rgba(201,168,76,0.2)' : '#C9A84C',
      color: loading ? '#C9A84C' : '#000', border: '1px solid #C9A84C',
      borderRadius: 8, padding: '6px 14px', fontSize: 11, fontWeight: 700,
      fontFamily: "'JetBrains Mono', monospace",
      cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.15s ease', whiteSpace: 'nowrap',
    }}>
      {loading ? <span style={{ width: 10, height: 10, border: '2px solid rgba(201,168,76,0.3)', borderTopColor: '#C9A84C', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} /> : '⚡'}
      {loading ? 'Mengaktifkan...' : 'Aktivasi Sekarang'}
    </button>
  );
}

function PlanSelector({ userId, currentPlan, onChanged }: {
  userId: string; currentPlan: UserPlan; onChanged: (plan: UserPlan, expiresAt: string | null) => void;
}) {
  const [loading, setLoading] = useState(false);
  const updateUserPlan = useAdminStore((s) => s.updateUserPlan);
  const showToast = useAdminStore((s) => s.showToast);

  const handleChange = useCallback(async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPlan = e.target.value as UserPlan;
    if (newPlan === currentPlan) return;
    setLoading(true);
    try {
      const updates: Record<string, unknown> = { plan: newPlan };
      let expiresAt: string | null = null;
      if (newPlan !== 'free') {
        if (newPlan === 'trial')      expiresAt = new Date(Date.now() + TRIAL_MS).toISOString();
        else if (newPlan === 'basic') expiresAt = new Date(Date.now() + BASIC_MS).toISOString();
        updates.plan_type = newPlan; updates.admin_verified = true; updates.pending_plan = null;
        updates.is_activated = true; updates.plan_activated_at = new Date().toISOString();
        updates.plan_expires_at = expiresAt; updates.trial_used = true;
      } else {
        updates.plan_type = null; updates.admin_verified = false; updates.pending_plan = null;
        updates.is_activated = false; updates.plan_expires_at = null;
      }
      const { error } = await _sbAdmin.from('profiles').update(updates).eq('id', userId);
      if (error) throw error;
      updateUserPlan(userId, newPlan);
      onChanged(newPlan, expiresAt);
      showToast(`✅ Plan diubah ke ${newPlan.toUpperCase()}`, 'success');
    } catch (err: unknown) {
      console.error('[PlanSelector] update gagal:', err);
      showToast((err as { message?: string })?.message || 'Gagal mengubah plan', 'error');
    } finally {
      setLoading(false);
    }
  }, [userId, currentPlan, updateUserPlan, onChanged, showToast]);

  return (
    <select
      value={currentPlan}
      onChange={handleChange}
      disabled={loading}
      className="filter-select"
      style={{ fontSize: 11, padding: '6px 10px', minWidth: 90, opacity: loading ? 0.5 : 1 }}
    >
      {PLANS.map((p) => <option key={p} value={p}>{p.toUpperCase()}</option>)}
    </select>
  );
}

function ToggleActivated({ userId, isActivated }: { userId: string; isActivated: boolean }) {
  const [active, setActive] = useState(isActivated);
  const [loading, setLoading] = useState(false);
  const showToast = useAdminStore((s) => s.showToast);

  const toggle = async () => {
    setLoading(true);
    try {
      const { error } = await _sbAdmin.from('profiles').update({ is_activated: !active }).eq('id', userId);
      if (error) throw error;
      setActive((v) => !v);
      showToast(!active ? '✅ Akun diaktifkan' : '⚠️ Akun dinonaktifkan', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Gagal', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={toggle} disabled={loading} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      borderRadius: 99, padding: '4px 10px', fontSize: 10, fontWeight: 700,
      fontFamily: "'JetBrains Mono', monospace", cursor: loading ? 'not-allowed' : 'pointer',
      border: `1px solid ${active ? 'var(--green-bd)' : 'var(--border)'}`,
      background: active ? 'var(--green-bg)' : 'transparent',
      color: active ? 'var(--green)' : 'var(--text3)',
      opacity: loading ? 0.5 : 1, transition: 'all .2s',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
      {active ? 'Aktif' : 'Nonaktif'}
    </button>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {[160, 100, 70, 100, 90, 70, 80].map((w, i) => (
        <td key={i} style={{ padding: '14px 16px' }}>
          <div style={{ height: 12, width: w, borderRadius: 6, background: 'rgba(255,255,255,0.05)', animation: 'pulse 1.4s ease-in-out infinite' }} />
        </td>
      ))}
    </tr>
  );
}

// ── Mobile card per user ─────────────────────────────────────
function UserCard({ user, localPlans, localPending, localExpiry, setLocalPlans, setLocalPending, setLocalExpiry }: {
  user: UserProfile;
  localPlans: Record<string, UserPlan>;
  localPending: Record<string, string | null>;
  localExpiry: Record<string, string | null>;
  setLocalPlans: React.Dispatch<React.SetStateAction<Record<string, UserPlan>>>;
  setLocalPending: React.Dispatch<React.SetStateAction<Record<string, string | null>>>;
  setLocalExpiry: React.Dispatch<React.SetStateAction<Record<string, string | null>>>;
}) {
  const extUser = user as UserProfileExtended;
  const displayPlan = localPlans[user.id] ?? user.plan;
  const currentPending = localPending[user.id] !== undefined ? localPending[user.id] : extUser.pending_plan;
  const hasPending = !!currentPending && !extUser.admin_verified;
  const currentExpiry = localExpiry[user.id] !== undefined ? localExpiry[user.id] : extUser.plan_expires_at;
  const trialInfo = displayPlan === 'trial' ? trialRemainingLabel(currentExpiry) : null;

  const formatDate = (s: string) => {
    try { return new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return s; }
  };

  return (
    <div className="mobile-card" style={hasPending ? { borderColor: 'rgba(251,191,36,0.4)', background: 'rgba(251,191,36,0.02)' } : undefined}>
      {/* Header: email + plan */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', wordBreak: 'break-all', lineHeight: 1.4 }}>
            {user.email || '—'}
          </div>
          {extUser.display_name && (
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{extUser.display_name}</div>
          )}
        </div>
        <div style={{ flexShrink: 0 }}>
          <PlanBadge plan={displayPlan} />
          {trialInfo && (
            <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: trialInfo.expired ? 'var(--red)' : 'var(--text3)', marginTop: 4, textAlign: 'right' }}>
              {trialInfo.text}
            </div>
          )}
        </div>
      </div>

      {/* Pending aktivasi */}
      {hasPending && (
        <div style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <PendingBadge pendingPlan={currentPending!} />
          <ActivateButton
            userId={user.id}
            pendingPlan={currentPending!}
            onActivated={(expiresAt) => {
              setLocalPending(prev => ({ ...prev, [user.id]: null }));
              setLocalPlans(prev => ({ ...prev, [user.id]: currentPending as UserPlan }));
              setLocalExpiry(prev => ({ ...prev, [user.id]: expiresAt }));
              extUser.admin_verified = true;
            }}
          />
        </div>
      )}

      {/* Row: ubah plan + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <PlanSelector
          userId={user.id}
          currentPlan={displayPlan}
          onChanged={(p, expiresAt) => {
            setLocalPlans((prev) => ({ ...prev, [user.id]: p }));
            setLocalPending((prev) => ({ ...prev, [user.id]: null }));
            setLocalExpiry((prev) => ({ ...prev, [user.id]: expiresAt }));
          }}
        />
        <ToggleActivated userId={user.id} isActivated={user.is_activated} />
        <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: "'JetBrains Mono', monospace", marginLeft: 'auto' }}>
          {formatDate(user.created_at)}
        </span>
      </div>
    </div>
  );
}

export default function UsersPanel({ active }: { active: boolean }) {
  const showToast       = useAdminStore((s) => s.showToast);
  const allUsers        = useAdminStore((s) => s.allUsers);
  const usersLoaded     = useAdminStore((s) => s.usersLoaded);
  const usersSearch     = useAdminStore((s) => s.usersSearch);
  const usersPlanFilter = useAdminStore((s) => s.usersPlanFilter);
  const usersPage       = useAdminStore((s) => s.usersPage);
  const setAllUsers     = useAdminStore((s) => s.setAllUsers);
  const setUsersLoaded  = useAdminStore((s) => s.setUsersLoaded);
  const setUsersSearch  = useAdminStore((s) => s.setUsersSearch);
  const setUsersPlanFilter = useAdminStore((s) => s.setUsersPlanFilter);
  const setUsersPage    = useAdminStore((s) => s.setUsersPage);

  const [localPlans,   setLocalPlans]   = useState<Record<string, UserPlan>>({});
  const [localPending, setLocalPending] = useState<Record<string, string | null>>({});
  const [localExpiry,  setLocalExpiry]  = useState<Record<string, string | null>>({});
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const loadUsers = useCallback(async () => {
    setUsersLoaded(false);
    try {
      const { data, error } = await _sbAdmin
        .from('profiles')
        .select('id, email, display_name, plan, is_activated, created_at, pending_plan, admin_verified, plan_expires_at, trial_used')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAllUsers((data ?? []) as UserProfile[]);
      setUsersLoaded(true);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Gagal memuat users', 'error');
      setUsersLoaded(true);
    }
  }, [setAllUsers, setUsersLoaded, showToast]);

  useEffect(() => {
    if (active && !usersLoaded) loadUsers();
  }, [active, usersLoaded, loadUsers]);

  const filtered = useMemo(() => {
    return allUsers.filter((u) => {
      const q = usersSearch.trim().toLowerCase();
      const matchSearch = !q || u.email?.toLowerCase().includes(q) || (u.display_name || '').toLowerCase().includes(q);
      const matchPlan = usersPlanFilter === 'all' || u.plan === usersPlanFilter;
      return matchSearch && matchPlan;
    });
  }, [allUsers, usersSearch, usersPlanFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(usersPage, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const planCounts = useMemo(() => {
    const counts: Record<string, number> = { free: 0, trial: 0, basic: 0, pro: 0, elite: 0 };
    allUsers.forEach((u) => { if (counts[u.plan] !== undefined) counts[u.plan]++; });
    const pending = allUsers.filter((u) => {
      const ext = u as UserProfileExtended;
      return ext.pending_plan && !ext.admin_verified;
    }).length;
    return { free: counts.free, trial: counts.trial, basic: counts.basic, pro: counts.pro, elite: counts.elite, pending };
  }, [allUsers]);

  const formatDate = (s: string) => {
    try { return new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return s; }
  };

  if (!active) return null;

  return (
    <div className="main">
      {/* STAT PILLS — scroll horizontal di mobile */}
      <div className="plan-stat-scroll">
        {[
          { label: 'TOTAL', val: allUsers.length, color: 'var(--text)' },
          { label: 'FREE',  val: planCounts.free,  color: 'var(--text3)' },
          { label: 'TRIAL', val: planCounts.trial, color: '#C084FC' },
          { label: 'BASIC', val: planCounts.basic, color: 'var(--blue)' },
          { label: 'PRO',   val: planCounts.pro,   color: 'var(--gold2)' },
          { label: 'ELITE', val: planCounts.elite, color: '#F97316' },
          { label: 'PENDING', val: planCounts.pending, color: '#FBBF24' },
        ].map((s) => (
          <div key={s.label} className="plan-stat-pill">
            <div className="plan-stat-lbl">{s.label}</div>
            <div className="plan-stat-val" style={{ color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* FILTER */}
      <div className="section">
        <div className="section-head">
          <span className="section-title">👥 User Management</span>
          <button className="refresh-btn" onClick={() => { setUsersLoaded(false); loadUsers(); }}>⟳ Refresh</button>
        </div>
        <div className="section-body">
          <div className="filter-bar">
            <input
              className="filter-input"
              placeholder="🔍 Cari email atau nama..."
              value={usersSearch}
              onChange={(e) => setUsersSearch(e.target.value)}
            />
            <select className="filter-select" value={usersPlanFilter} onChange={(e) => setUsersPlanFilter(e.target.value as typeof usersPlanFilter)}>
              <option value="all">Semua Plan</option>
              {PLANS.map((p) => <option key={p} value={p}>{p.toUpperCase()}</option>)}
            </select>
          </div>
        </div>

        {/* ── MOBILE: card list ── */}
        {isMobile ? (
          <div style={{ padding: '0 16px 16px' }}>
            {!usersLoaded ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="mobile-card" style={{ animation: 'pulse 1.4s ease-in-out infinite' }}>
                  <div style={{ height: 14, width: '60%', borderRadius: 6, background: 'rgba(255,255,255,0.06)', marginBottom: 10 }} />
                  <div style={{ height: 10, width: '40%', borderRadius: 6, background: 'rgba(255,255,255,0.04)' }} />
                </div>
              ))
            ) : paginated.length === 0 ? (
              <div className="empty-state">
                {usersSearch || usersPlanFilter !== 'all' ? '🔍 Tidak ada user yang cocok.' : '👤 Belum ada user terdaftar.'}
              </div>
            ) : (
              paginated.map((user) => (
                <UserCard
                  key={user.id}
                  user={user}
                  localPlans={localPlans}
                  localPending={localPending}
                  localExpiry={localExpiry}
                  setLocalPlans={setLocalPlans}
                  setLocalPending={setLocalPending}
                  setLocalExpiry={setLocalExpiry}
                />
              ))
            )}
          </div>
        ) : (
          /* ── DESKTOP: tabel ── */
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>EMAIL</th><th>NAMA</th><th>PLAN</th>
                  <th>PENDING / AKTIVASI</th><th>UBAH PLAN</th>
                  <th>STATUS</th><th>BERGABUNG</th>
                </tr>
              </thead>
              <tbody>
                {!usersLoaded ? (
                  Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                ) : paginated.length === 0 ? (
                  <tr><td colSpan={7}><div className="empty-state">{usersSearch || usersPlanFilter !== 'all' ? '🔍 Tidak ada user yang cocok.' : '👤 Belum ada user terdaftar.'}</div></td></tr>
                ) : (
                  paginated.map((user) => {
                    const extUser = user as UserProfileExtended;
                    const displayPlan = localPlans[user.id] ?? user.plan;
                    const currentPending = localPending[user.id] !== undefined ? localPending[user.id] : extUser.pending_plan;
                    const hasPending = !!currentPending && !extUser.admin_verified;
                    const currentExpiry = localExpiry[user.id] !== undefined ? localExpiry[user.id] : extUser.plan_expires_at;
                    const trialInfo = displayPlan === 'trial' ? trialRemainingLabel(currentExpiry) : null;
                    return (
                      <tr key={user.id} style={hasPending ? { background: 'rgba(251,191,36,0.04)', borderLeft: '2px solid rgba(251,191,36,0.4)' } : undefined}>
                        <td><span className="email-text" title={user.email}>{user.email || '-'}</span></td>
                        <td style={{ fontSize: 13, color: 'var(--text)' }}>{user.display_name || <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>—</span>}</td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <PlanBadge plan={displayPlan} />
                            {trialInfo && <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: trialInfo.expired ? '#EF4444' : 'var(--text3)' }}>{trialInfo.text}</span>}
                          </div>
                        </td>
                        <td>
                          {hasPending ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <PendingBadge pendingPlan={currentPending!} />
                              <ActivateButton userId={user.id} pendingPlan={currentPending!} onActivated={(expiresAt) => {
                                setLocalPending(prev => ({ ...prev, [user.id]: null }));
                                setLocalPlans(prev => ({ ...prev, [user.id]: currentPending as UserPlan }));
                                setLocalExpiry(prev => ({ ...prev, [user.id]: expiresAt }));
                                extUser.admin_verified = true;
                              }} />
                            </div>
                          ) : <span style={{ color: 'var(--text3)', fontSize: 11 }}>—</span>}
                        </td>
                        <td>
                          <PlanSelector userId={user.id} currentPlan={displayPlan} onChanged={(p, expiresAt) => {
                            setLocalPlans((prev) => ({ ...prev, [user.id]: p }));
                            setLocalPending((prev) => ({ ...prev, [user.id]: null }));
                            setLocalExpiry((prev) => ({ ...prev, [user.id]: expiresAt }));
                          }} />
                        </td>
                        <td><ToggleActivated userId={user.id} isActivated={user.is_activated} /></td>
                        <td className="date-text">{formatDate(user.created_at)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {usersLoaded && filtered.length > PAGE_SIZE && (
          <div className="pagination">
            <span className="pag-info">{filtered.length} user · hal {safePage}/{totalPages}</span>
            <div className="pag-btns">
              <button className="pag-btn" disabled={safePage <= 1} onClick={() => setUsersPage(safePage - 1)}>← Prev</button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((pg) => (
                <button key={pg} className={`pag-btn${safePage === pg ? ' active' : ''}`} onClick={() => setUsersPage(pg)}>{pg}</button>
              ))}
              <button className="pag-btn" disabled={safePage >= totalPages} onClick={() => setUsersPage(safePage + 1)}>Next →</button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.9} }
        @keyframes pendingPulse { 0%,100%{opacity:1} 50%{opacity:.6} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}
