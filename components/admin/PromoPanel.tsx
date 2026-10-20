'use client';
// components/admin/PromoPanel.tsx

import { useEffect, useState, useCallback, useMemo } from 'react';
import { _sbAdmin } from '@/lib/supabaseClient';
import { useAdminStore } from '@/store/useAdminStore';

interface PromoCode {
  id: string; code: string; discount_type: 'fixed' | 'percent';
  discount_value: number; max_uses: number | null; used_count: number;
  expires_at: string | null; is_active: boolean; created_at: string; description: string | null;
}
interface FormState {
  code: string; discount_type: 'fixed' | 'percent'; discount_value: string;
  max_uses: string; expires_at: string; description: string;
}
const EMPTY_FORM: FormState = { code: '', discount_type: 'fixed', discount_value: '', max_uses: '', expires_at: '', description: '' };

function isExpiredFn(p: PromoCode) { return !!(p.expires_at && new Date(p.expires_at) < new Date()); }
function isMaxedFn(p: PromoCode)   { return p.max_uses !== null && p.used_count >= p.max_uses; }

function StatusBadge({ promo }: { promo: PromoCode }) {
  if (isExpiredFn(promo)) return <span className="badge revoked"><span className="dot" />Expired</span>;
  if (isMaxedFn(promo))   return <span className="badge revoked"><span className="dot" />Habis</span>;
  if (promo.is_active)    return <span className="badge used"><span className="dot" />Aktif</span>;
  return <span className="badge unused"><span className="dot" />Nonaktif</span>;
}

function AddPromoModal({ onClose, onSaved }: { onClose: () => void; onSaved: (p: PromoCode) => void }) {
  const showToast = useAdminStore((s) => s.showToast);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    setError('');
    const code = form.code.trim().toUpperCase();
    if (!code) return setError('Kode promo wajib diisi.');
    const val = parseFloat(form.discount_value);
    if (isNaN(val) || val <= 0) return setError('Nilai diskon harus angka positif.');
    if (form.discount_type === 'percent' && val > 100) return setError('Diskon persen maksimal 100%.');
    const payload = {
      code, discount_type: form.discount_type, discount_value: val,
      max_uses: form.max_uses.trim() ? parseInt(form.max_uses) || null : null,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      description: form.description.trim() || null, is_active: true,
    };
    setLoading(true);
    try {
      const { data, error: err } = await _sbAdmin.from('promo_codes').insert(payload).select().single();
      if (err) throw err;
      onSaved(data as PromoCode);
      showToast(`Promo "${code}" berhasil ditambahkan`, 'success');
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal menyimpan';
      setError(msg.includes('unique') || msg.includes('duplicate') ? 'Kode promo sudah digunakan.' : msg);
    } finally { setLoading(false); }
  };

  const inp: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '10px 14px', fontSize: 14, color: 'var(--text)',
    fontFamily: "'Outfit', sans-serif", outline: 'none',
  };
  const lbl: React.CSSProperties = { fontSize: 11, color: 'var(--text3)', marginBottom: 6, display: 'block' };

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 8000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 18, padding: '28px 24px', width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--gold2)' }}>🎟️ Tambah Kode Promo</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Kode Promo *</label>
          <input style={{ ...inp, fontFamily: "'JetBrains Mono', monospace", letterSpacing: 2, textTransform: 'uppercase' }} placeholder="HEMAT50" value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={lbl}>Tipe Diskon *</label>
            <select className="filter-select" style={{ width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 10 }} value={form.discount_type} onChange={(e) => set('discount_type', e.target.value as 'fixed' | 'percent')}>
              <option value="fixed">Fixed Rp</option><option value="percent">Persen %</option>
            </select>
          </div>
          <div>
            <label style={lbl}>Nilai * {form.discount_type === 'fixed' ? '(Rp)' : '(%)'}</label>
            <input style={inp} type="number" min="0" placeholder={form.discount_type === 'fixed' ? '50000' : '20'} value={form.discount_value} onChange={(e) => set('discount_value', e.target.value)} />
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Maks Penggunaan (kosongkan = unlimited)</label>
          <input style={inp} type="number" min="0" placeholder="100" value={form.max_uses} onChange={(e) => set('max_uses', e.target.value)} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Tanggal Expired (opsional)</label>
          <input style={inp} type="datetime-local" value={form.expires_at} onChange={(e) => set('expires_at', e.target.value)} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={lbl}>Deskripsi (opsional)</label>
          <input style={inp} placeholder="Promo akhir tahun" value={form.description} onChange={(e) => set('description', e.target.value)} />
        </div>
        {error && <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-bd)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--red)', marginBottom: 14 }}>⚠️ {error}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="modal-cancel" onClick={onClose} disabled={loading}>Batal</button>
          <button className="gen-btn" onClick={handleSubmit} disabled={loading} style={{ padding: '10px 24px', fontSize: 13 }}>
            {loading ? '⏳ Menyimpan...' : '✓ Simpan Kode'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PromoPanel({ active }: { active: boolean }) {
  const showToast = useAdminStore((s) => s.showToast);
  const [promos, setPromos]         = useState<PromoCode[]>([]);
  const [loaded, setLoaded]         = useState(false);
  const [showModal, setShowModal]   = useState(false);
  const [search, setSearch]         = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'expired'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [isMobile, setIsMobile]     = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const loadPromos = useCallback(async () => {
    setLoaded(false);
    try {
      const { data, error } = await _sbAdmin.from('promo_codes').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setPromos((data ?? []) as PromoCode[]);
      setLoaded(true);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Gagal memuat promo', 'error');
      setLoaded(true);
    }
  }, [showToast]);

  useEffect(() => { if (!active || loaded) return; loadPromos(); }, [active, loaded, loadPromos]);

  const handleToggle = async (promo: PromoCode) => {
    setTogglingId(promo.id);
    try {
      const { error } = await _sbAdmin.from('promo_codes').update({ is_active: !promo.is_active }).eq('id', promo.id);
      if (error) throw error;
      setPromos((prev) => prev.map((p) => p.id === promo.id ? { ...p, is_active: !p.is_active } : p));
      showToast(`Promo "${promo.code}" ${!promo.is_active ? 'diaktifkan' : 'dinonaktifkan'}`, 'success');
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : 'Gagal', 'error'); }
    finally { setTogglingId(null); }
  };

  const handleDelete = async (promo: PromoCode) => {
    if (!confirm(`Hapus kode promo "${promo.code}"?`)) return;
    setDeletingId(promo.id);
    try {
      const { error } = await _sbAdmin.from('promo_codes').delete().eq('id', promo.id);
      if (error) throw error;
      setPromos((prev) => prev.filter((p) => p.id !== promo.id));
      showToast(`Promo "${promo.code}" dihapus`, 'success');
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : 'Gagal menghapus', 'error'); }
    finally { setDeletingId(null); }
  };

  const filtered = useMemo(() => {
    const now = new Date();
    return promos.filter((p) => {
      const q = search.trim().toLowerCase();
      const matchSearch = !q || p.code.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q);
      const expired = p.expires_at && new Date(p.expires_at) < now;
      let matchStatus = true;
      if (filterStatus === 'active')   matchStatus = p.is_active && !expired;
      if (filterStatus === 'inactive') matchStatus = !p.is_active;
      if (filterStatus === 'expired')  matchStatus = !!expired;
      return matchSearch && matchStatus;
    });
  }, [promos, search, filterStatus]);

  const stats = useMemo(() => {
    const now = new Date();
    return {
      total: promos.length,
      active: promos.filter((p) => p.is_active && (!p.expires_at || new Date(p.expires_at) >= now)).length,
      totalUsed: promos.reduce((s, p) => s + p.used_count, 0),
      expired: promos.filter((p) => p.expires_at && new Date(p.expires_at) < now).length,
    };
  }, [promos]);

  const fmtDate = (iso: string | null) => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return '-'; }
  };

  if (!active) return null;

  return (
    <div className="main">
      {/* STAT CARDS */}
      <div className="stats-row">
        <div className="stat-card"><div className="stat-lbl">TOTAL KODE</div><div className="stat-val">{stats.total}</div></div>
        <div className="stat-card"><div className="stat-lbl">AKTIF</div><div className="stat-val green">{stats.active}</div></div>
        <div className="stat-card"><div className="stat-lbl">TOTAL PAKAI</div><div className="stat-val gold">{stats.totalUsed}</div></div>
        <div className="stat-card"><div className="stat-lbl">EXPIRED</div><div className="stat-val" style={{ color: 'var(--text3)' }}>{stats.expired}</div></div>
      </div>

      <div className="section">
        <div className="section-head">
          <span className="section-title">🎟️ Promo Codes</span>
          <div className="filter-bar">
            <input className="filter-input" placeholder="🔍 Cari kode atau deskripsi..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="filter-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}>
              <option value="all">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
              <option value="expired">Expired</option>
            </select>
            <button className="refresh-btn" onClick={() => { setLoaded(false); loadPromos(); }}>↻ Refresh</button>
            <button className="gen-btn" onClick={() => setShowModal(true)} style={{ padding: '8px 16px', fontSize: 12 }}>+ Tambah Kode</button>
          </div>
        </div>

        {/* ── MOBILE: card list ── */}
        {isMobile ? (
          <div style={{ padding: '12px 16px 16px' }}>
            {!loaded ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="mobile-card" style={{ animation: 'pulse 1.4s ease-in-out infinite' }}>
                  <div style={{ height: 16, width: '50%', borderRadius: 6, background: 'rgba(255,255,255,0.06)', marginBottom: 10 }} />
                  <div style={{ height: 10, width: '30%', borderRadius: 6, background: 'rgba(255,255,255,0.04)' }} />
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="empty-state">{search || filterStatus !== 'all' ? '🔍 Tidak ada kode yang cocok.' : '🎟️ Belum ada kode promo.'}</div>
            ) : filtered.map((promo) => {
              const isDeleting  = deletingId  === promo.id;
              const isToggling  = togglingId  === promo.id;
              return (
                <div key={promo.id} className="mobile-card" style={{ opacity: isDeleting ? 0.4 : 1, transition: 'opacity .2s' }}>
                  {/* Kode + tipe */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, color: 'var(--gold2)', letterSpacing: 2 }}>{promo.code}</div>
                      {promo.description && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{promo.description}</div>}
                    </div>
                    <StatusBadge promo={promo} />
                  </div>
                  {/* Info row */}
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12, fontSize: 12 }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--gold2)' }}>
                      {promo.discount_type === 'fixed' ? `Rp${promo.discount_value.toLocaleString('id-ID')}` : `${promo.discount_value}%`}
                    </span>
                    <span style={{ color: 'var(--text3)' }}>
                      {promo.used_count}/{promo.max_uses ?? '∞'} pakai
                    </span>
                    {promo.expires_at && (
                      <span style={{ color: isExpiredFn(promo) ? 'var(--red)' : 'var(--text3)' }}>Exp: {fmtDate(promo.expires_at)}</span>
                    )}
                  </div>
                  {/* Aksi */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className={`act-btn ${promo.is_active ? 'act-revoke' : 'act-restore'}`} onClick={() => handleToggle(promo)} disabled={isToggling || isDeleting}>
                      {isToggling ? '⏳' : promo.is_active ? '⏸ Nonaktif' : '▶ Aktifkan'}
                    </button>
                    <button className="act-btn act-revoke" onClick={() => handleDelete(promo)} disabled={isDeleting || isToggling}>
                      {isDeleting ? '⏳' : '🗑 Hapus'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── DESKTOP tabel ── */
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>KODE</th><th>TIPE</th><th>NILAI DISKON</th>
                  <th>MAKS PAKAI</th><th>SUDAH PAKAI</th><th>EXPIRED AT</th>
                  <th>STATUS</th><th>AKSI</th>
                </tr>
              </thead>
              <tbody>
                {!loaded ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 8 }).map((__, j) => (
                      <td key={j} style={{ padding: '14px 16px' }}>
                        <div style={{ height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.05)', animation: 'pulse 1.4s ease-in-out infinite' }} />
                      </td>
                    ))}</tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8}><div className="empty-state">{search || filterStatus !== 'all' ? '🔍 Tidak ada kode yang cocok.' : '🎟️ Belum ada kode promo. Klik "+ Tambah Kode" untuk mulai.'}</div></td></tr>
                ) : filtered.map((promo) => {
                  const isDeleting = deletingId === promo.id;
                  const isToggling = togglingId === promo.id;
                  return (
                    <tr key={promo.id} style={{ opacity: isDeleting ? 0.4 : 1, transition: 'opacity .2s' }}>
                      <td>
                        <span className="key-mono" style={{ fontSize: 12, letterSpacing: 1.5 }}>{promo.code}</span>
                        {promo.description && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{promo.description}</div>}
                      </td>
                      <td>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: 1, color: promo.discount_type === 'fixed' ? 'var(--blue)' : 'var(--gold2)', background: promo.discount_type === 'fixed' ? 'var(--blue-bg)' : 'var(--gold-bg)', border: `1px solid ${promo.discount_type === 'fixed' ? 'var(--blue-bd)' : 'var(--gold-bd)'}`, borderRadius: 99, padding: '3px 10px', fontWeight: 700 }}>
                          {promo.discount_type === 'fixed' ? 'FIXED Rp' : 'PERSEN %'}
                        </span>
                      </td>
                      <td><span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: 'var(--gold2)', fontWeight: 700 }}>{promo.discount_type === 'fixed' ? `Rp${promo.discount_value.toLocaleString('id-ID')}` : `${promo.discount_value}%`}</span></td>
                      <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>{promo.max_uses === null ? <span style={{ color: 'var(--text3)', fontStyle: 'italic', fontSize: 11 }}>unlimited</span> : promo.max_uses}</td>
                      <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: 'var(--gold2)' }}>{promo.used_count}</td>
                      <td className="date-text">{fmtDate(promo.expires_at)}</td>
                      <td><StatusBadge promo={promo} /></td>
                      <td>
                        <div className="action-btns">
                          <button className={`act-btn ${promo.is_active ? 'act-revoke' : 'act-restore'}`} onClick={() => handleToggle(promo)} disabled={isToggling || isDeleting}>
                            {isToggling ? '⏳' : promo.is_active ? '⏸ Nonaktif' : '▶ Aktifkan'}
                          </button>
                          <button className="act-btn act-revoke" onClick={() => handleDelete(promo)} disabled={isDeleting || isToggling}>
                            {isDeleting ? '⏳' : '🗑 Hapus'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && <AddPromoModal onClose={() => setShowModal(false)} onSaved={(p) => setPromos((prev) => [p, ...prev])} />}
      <style>{`@keyframes pulse{0%,100%{opacity:.4}50%{opacity:.9}}`}</style>
    </div>
  );
}
