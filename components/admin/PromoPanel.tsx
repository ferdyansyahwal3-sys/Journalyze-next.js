'use client';

// components/admin/PromoPanel.tsx
// Fitur: CRUD promo codes dengan tabel, modal tambah, toggle aktif, hapus

import { useEffect, useState, useCallback, useMemo } from 'react';
import { _sbAdmin } from '@/lib/supabaseClient';
import { useAdminStore } from '@/store/useAdminStore';

// ── Types ────────────────────────────────────────────────────
interface PromoCode {
  id: string;
  code: string;
  discount_type: 'fixed' | 'percent';
  discount_value: number;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  description: string | null;
}

interface FormState {
  code: string;
  discount_type: 'fixed' | 'percent';
  discount_value: string;
  max_uses: string;
  expires_at: string;
  description: string;
}

const EMPTY_FORM: FormState = {
  code: '',
  discount_type: 'fixed',
  discount_value: '',
  max_uses: '',
  expires_at: '',
  description: '',
};

// ── Status Badge ─────────────────────────────────────────────
function StatusBadge({ promo }: { promo: PromoCode }) {
  const isExpired = promo.expires_at && new Date(promo.expires_at) < new Date();
  const isMaxed = promo.max_uses !== null && promo.used_count >= promo.max_uses;

  if (isExpired) {
    return (
      <span className="badge" style={{
        background: 'rgba(106,96,80,0.12)', color: '#6A6050',
        border: '1px solid rgba(106,96,80,0.25)',
      }}>
        <span className="dot" /> Expired
      </span>
    );
  }
  if (isMaxed) {
    return (
      <span className="badge" style={{
        background: 'rgba(106,96,80,0.12)', color: '#6A6050',
        border: '1px solid rgba(106,96,80,0.25)',
      }}>
        <span className="dot" /> Habis
      </span>
    );
  }
  if (promo.is_active) {
    return <span className="badge used"><span className="dot" /> Aktif</span>;
  }
  return <span className="badge revoked"><span className="dot" /> Nonaktif</span>;
}

// ── Discount Display ─────────────────────────────────────────
function DiscountDisplay({ type, value }: { type: 'fixed' | 'percent'; value: number }) {
  return (
    <span style={{
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 13,
      color: 'var(--gold2)',
      fontWeight: 700,
    }}>
      {type === 'fixed'
        ? `Rp${value.toLocaleString('id-ID')}`
        : `${value}%`}
    </span>
  );
}

// ── Skeleton Row ─────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr>
      {[120, 80, 90, 80, 80, 100, 80, 90].map((w, i) => (
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

// ── Modal Tambah Promo ───────────────────────────────────────
function AddPromoModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (promo: PromoCode) => void;
}) {
  const showToast = useAdminStore((s) => s.showToast);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const setField = (key: keyof FormState, val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async () => {
    setError('');
    const code = form.code.trim().toUpperCase();
    if (!code) return setError('Kode promo wajib diisi.');
    const val = parseFloat(form.discount_value);
    if (isNaN(val) || val <= 0) return setError('Nilai diskon harus angka positif.');
    if (form.discount_type === 'percent' && val > 100)
      return setError('Diskon persen maksimal 100%.');

    const payload = {
      code,
      discount_type: form.discount_type,
      discount_value: val,
      max_uses: form.max_uses.trim() ? parseInt(form.max_uses) || null : null,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      description: form.description.trim() || null,
      is_active: true,
    };

    setLoading(true);
    try {
      const { data, error: err } = await _sbAdmin
        .from('promo_codes')
        .insert(payload)
        .select()
        .single();
      if (err) throw err;
      onSaved(data as PromoCode);
      showToast(`Promo "${code}" berhasil ditambahkan`, 'success');
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal menyimpan';
      if (msg.includes('unique') || msg.includes('duplicate')) {
        setError('Kode promo sudah digunakan. Coba kode lain.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 14,
    color: 'var(--text)',
    fontFamily: "'Outfit', sans-serif",
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    color: 'var(--text3)',
    marginBottom: 6,
    display: 'block',
  };

  return (
    <div
      onClick={handleOverlayClick}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.75)',
        zIndex: 8000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 18,
        padding: '32px 28px',
        width: '100%', maxWidth: 460,
        maxHeight: '90vh',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9, letterSpacing: 2, textTransform: 'uppercase',
            color: 'var(--gold2)',
          }}>
            🎟️ Tambah Kode Promo
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'var(--text3)',
              fontSize: 20, cursor: 'pointer', lineHeight: 1,
            }}
          >✕</button>
        </div>

        {/* Kode */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Kode Promo *</label>
          <input
            style={{
              ...inputStyle,
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
            placeholder="HEMAT50"
            value={form.code}
            onChange={(e) => setField('code', e.target.value.toUpperCase())}
          />
        </div>

        {/* Tipe + Nilai */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Tipe Diskon *</label>
            <select
              className="filter-select"
              style={{ width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 10 }}
              value={form.discount_type}
              onChange={(e) => setField('discount_type', e.target.value as 'fixed' | 'percent')}
            >
              <option value="fixed">Fixed Rp</option>
              <option value="percent">Persen %</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>
              Nilai Diskon * {form.discount_type === 'fixed' ? '(Rp)' : '(%)'}
            </label>
            <input
              style={inputStyle}
              type="number"
              min="0"
              placeholder={form.discount_type === 'fixed' ? '50000' : '20'}
              value={form.discount_value}
              onChange={(e) => setField('discount_value', e.target.value)}
            />
          </div>
        </div>

        {/* Maks Pakai */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Maks Penggunaan (kosongkan = unlimited)</label>
          <input
            style={inputStyle}
            type="number"
            min="0"
            placeholder="100"
            value={form.max_uses}
            onChange={(e) => setField('max_uses', e.target.value)}
          />
        </div>

        {/* Expired */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Tanggal Expired (opsional)</label>
          <input
            style={inputStyle}
            type="datetime-local"
            value={form.expires_at}
            onChange={(e) => setField('expires_at', e.target.value)}
          />
        </div>

        {/* Deskripsi */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Deskripsi (opsional)</label>
          <input
            style={inputStyle}
            placeholder="Promo akhir tahun untuk semua paket"
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
          />
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'var(--red-bg)', border: '1px solid var(--red-bd)',
            borderRadius: 8, padding: '10px 14px',
            fontSize: 12, color: 'var(--red)', marginBottom: 16,
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="modal-cancel" onClick={onClose} disabled={loading}>
            Batal
          </button>
          <button
            className="gen-btn"
            onClick={handleSubmit}
            disabled={loading}
            style={{ padding: '10px 24px', fontSize: 13 }}
          >
            {loading ? (
              <>
                <span style={{
                  width: 12, height: 12,
                  border: '2px solid rgba(8,8,8,0.3)',
                  borderTopColor: '#080808',
                  borderRadius: '50%',
                  animation: 'spin .7s linear infinite',
                  display: 'inline-block',
                }} />
                Menyimpan...
              </>
            ) : '✓ Simpan Kode'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Panel ───────────────────────────────────────────────
export default function PromoPanel({ active }: { active: boolean }) {
  const showToast = useAdminStore((s) => s.showToast);
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'expired'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadPromos = useCallback(async () => {
    setLoaded(false);
    try {
      const { data, error } = await _sbAdmin
        .from('promo_codes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPromos((data ?? []) as PromoCode[]);
      setLoaded(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal memuat promo';
      showToast(msg, 'error');
      setLoaded(true);
    }
  }, [showToast]);

  useEffect(() => {
    if (!active || loaded) return;
    loadPromos();
  }, [active, loaded, loadPromos]);

  const handleRefresh = () => {
    setLoaded(false);
    loadPromos();
  };

  const handleToggle = async (promo: PromoCode) => {
    setTogglingId(promo.id);
    try {
      const { error } = await _sbAdmin
        .from('promo_codes')
        .update({ is_active: !promo.is_active })
        .eq('id', promo.id);
      if (error) throw error;
      setPromos((prev) =>
        prev.map((p) => p.id === promo.id ? { ...p, is_active: !p.is_active } : p)
      );
      showToast(
        `Promo "${promo.code}" ${!promo.is_active ? 'diaktifkan' : 'dinonaktifkan'}`,
        'success'
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal mengubah status';
      showToast(msg, 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (promo: PromoCode) => {
    if (!confirm(`Hapus kode promo "${promo.code}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    setDeletingId(promo.id);
    try {
      const { error } = await _sbAdmin
        .from('promo_codes')
        .delete()
        .eq('id', promo.id);
      if (error) throw error;
      setPromos((prev) => prev.filter((p) => p.id !== promo.id));
      showToast(`Promo "${promo.code}" dihapus`, 'success');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal menghapus';
      showToast(msg, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = useMemo(() => {
    const now = new Date();
    return promos.filter((p) => {
      const q = search.trim().toLowerCase();
      const matchSearch = !q ||
        p.code.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q);

      const isExpired = p.expires_at && new Date(p.expires_at) < now;
      let matchStatus = true;
      if (filterStatus === 'active') matchStatus = p.is_active && !isExpired;
      if (filterStatus === 'inactive') matchStatus = !p.is_active;
      if (filterStatus === 'expired') matchStatus = !!isExpired;

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

  const formatDate = (iso: string | null) => {
    if (!iso) return <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>—</span>;
    try {
      return new Date(iso).toLocaleDateString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric',
      });
    } catch { return '-'; }
  };

  if (!active) return null;

  return (
    <div className="main">
      {/* ── Stats mini bar ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12,
        marginBottom: 24,
      }}>
        {[
          { label: 'TOTAL KODE', val: stats.total, color: 'var(--text)' },
          { label: 'AKTIF', val: stats.active, color: 'var(--green)' },
          { label: 'TOTAL PAKAI', val: stats.totalUsed, color: 'var(--gold2)' },
          { label: 'EXPIRED', val: stats.expired, color: 'var(--text3)' },
        ].map((s) => (
          <div key={s.label} className="stat-card" style={{ padding: '16px 20px' }}>
            <div className="stat-lbl">{s.label}</div>
            <div className="stat-val" style={{ fontSize: 32, color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* ── Table section ── */}
      <div className="section">
        <div className="section-head">
          <span className="section-title">🎟️ Promo Codes</span>
          <div className="filter-bar">
            <input
              className="filter-input"
              placeholder="🔍 Cari kode atau deskripsi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="filter-select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
            >
              <option value="all">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
              <option value="expired">Expired</option>
            </select>
            <button className="refresh-btn" onClick={handleRefresh}>
              ↻ Refresh
            </button>
            <button
              className="gen-btn"
              onClick={() => setShowModal(true)}
              style={{ padding: '8px 16px', fontSize: 12 }}
            >
              + Tambah Kode
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>KODE</th>
                <th>TIPE</th>
                <th>NILAI DISKON</th>
                <th>MAKS PAKAI</th>
                <th>SUDAH PAKAI</th>
                <th>EXPIRED AT</th>
                <th>STATUS</th>
                <th>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {!loaded ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">
                      {search || filterStatus !== 'all'
                        ? '🔍 Tidak ada kode yang cocok dengan filter.'
                        : '🎟️ Belum ada kode promo. Klik "+ Tambah Kode" untuk mulai.'}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((promo) => {
                  const isDeleting = deletingId === promo.id;
                  const isToggling = togglingId === promo.id;
                  return (
                    <tr
                      key={promo.id}
                      style={{ opacity: isDeleting ? 0.4 : 1, transition: 'opacity .2s' }}
                    >
                      {/* Kode */}
                      <td>
                        <span className="key-mono" style={{ fontSize: 12, letterSpacing: 1.5 }}>
                          {promo.code}
                        </span>
                        {promo.description && (
                          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
                            {promo.description}
                          </div>
                        )}
                      </td>
                      {/* Tipe */}
                      <td>
                        <span style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 10, letterSpacing: 1,
                          color: promo.discount_type === 'fixed' ? 'var(--blue)' : 'var(--gold2)',
                          background: promo.discount_type === 'fixed' ? 'var(--blue-bg)' : 'var(--gold-bg)',
                          border: `1px solid ${promo.discount_type === 'fixed' ? 'var(--blue-bd)' : 'var(--gold-bd)'}`,
                          borderRadius: 99, padding: '3px 10px', fontWeight: 700,
                        }}>
                          {promo.discount_type === 'fixed' ? 'FIXED Rp' : 'PERSEN %'}
                        </span>
                      </td>
                      {/* Nilai */}
                      <td>
                        <DiscountDisplay type={promo.discount_type} value={promo.discount_value} />
                      </td>
                      {/* Maks pakai */}
                      <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>
                        {promo.max_uses === null
                          ? <span style={{ color: 'var(--text3)', fontStyle: 'italic', fontSize: 11 }}>unlimited</span>
                          : promo.max_uses}
                      </td>
                      {/* Sudah pakai */}
                      <td style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 13, color: 'var(--gold2)',
                      }}>
                        {promo.used_count}
                      </td>
                      {/* Expired at */}
                      <td className="date-text">{formatDate(promo.expires_at)}</td>
                      {/* Status */}
                      <td><StatusBadge promo={promo} /></td>
                      {/* Aksi */}
                      <td>
                        <div className="action-btns">
                          <button
                            className={`act-btn ${promo.is_active ? 'act-revoke' : 'act-restore'}`}
                            onClick={() => handleToggle(promo)}
                            disabled={isToggling || isDeleting}
                          >
                            {isToggling ? (
                              <span style={{
                                width: 8, height: 8,
                                border: '1.5px solid currentColor',
                                borderTopColor: 'transparent',
                                borderRadius: '50%',
                                animation: 'spin .7s linear infinite',
                                display: 'inline-block',
                              }} />
                            ) : promo.is_active ? '⏸' : '▶'}
                            {promo.is_active ? 'Nonaktif' : 'Aktifkan'}
                          </button>
                          <button
                            className="act-btn act-revoke"
                            onClick={() => handleDelete(promo)}
                            disabled={isDeleting || isToggling}
                          >
                            {isDeleting ? (
                              <span style={{
                                width: 8, height: 8,
                                border: '1.5px solid currentColor',
                                borderTopColor: 'transparent',
                                borderRadius: '50%',
                                animation: 'spin .7s linear infinite',
                                display: 'inline-block',
                              }} />
                            ) : '🗑'}
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <AddPromoModal
          onClose={() => setShowModal(false)}
          onSaved={(promo) => setPromos((prev) => [promo, ...prev])}
        />
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: .4; }
          50% { opacity: .9; }
        }
      `}</style>
    </div>
  );
}