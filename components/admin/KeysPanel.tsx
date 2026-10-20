// components/admin/KeysPanel.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAdminStore } from '@/store/useAdminStore';
import { useLicenseKeys } from '@/hooks/useLicenseKeys';
import { fmtDate, encodeDeliveryToken } from '@/lib/adminHelpers';
import { DELIVERY_BASE } from '@/lib/supabaseClient';

export default function KeysPanel({ active }: { active: boolean }) {
  const { filteredKeys, pageKeys, stats, totalPages, goPage, loadKeys, generateKey, deleteKey } = useLicenseKeys();
  const searchQuery    = useAdminStore((s) => s.searchQuery);
  const setSearchQuery = useAdminStore((s) => s.setSearchQuery);
  const statusFilter   = useAdminStore((s) => s.statusFilter);
  const setStatusFilter= useAdminStore((s) => s.setStatusFilter);
  const currentPage    = useAdminStore((s) => s.currentPage);
  const setPendingAction = useAdminStore((s) => s.setPendingAction);

  const [loading, setLoading]       = useState(true);
  const [genName, setGenName]       = useState('');
  const [genQty, setGenQty]         = useState('1');
  const [genBusy, setGenBusy]       = useState(false);
  const [result, setResult]         = useState<{ key: string; url: string } | null>(null);
  const [bulkResult, setBulkResult] = useState<{ key: string; url: string }[] | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [isMobile, setIsMobile]     = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    (async () => { await loadKeys(); setLoading(false); })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const quickCopy = (text: string) => navigator.clipboard.writeText(text);

  const onGenerate = async () => {
    setGenBusy(true);
    const res = await generateKey(genName.trim(), parseInt(genQty));
    setGenBusy(false);
    if (!res) return;
    if (res.mode === 'single') { setResult({ key: res.key, url: res.url }); setBulkResult(null); }
    else { setBulkResult(res.bulk); setResult(null); }
  };

  const start = (currentPage - 1) * 20;
  const end   = Math.min(start + 20, filteredKeys.length);

  if (!active) return null;

  return (
    <div className="main">
      {/* STAT CARDS */}
      <div className="stats-row">
        <div className="stat-card"><div className="stat-lbl">Total Keys</div><div className="stat-val gold">{stats.total}</div><div className="stat-sub">Semua key</div></div>
        <div className="stat-card"><div className="stat-lbl">Aktif</div><div className="stat-val green">{stats.used}</div><div className="stat-sub">Customer aktif</div></div>
        <div className="stat-card"><div className="stat-lbl">Tersedia</div><div className="stat-val">{stats.unused}</div><div className="stat-sub">Belum aktivasi</div></div>
        <div className="stat-card"><div className="stat-lbl">Dicabut</div><div className="stat-val red">{stats.revoked}</div><div className="stat-sub">Dinonaktifkan</div></div>
      </div>

      {/* GENERATE FORM */}
      <div className="section">
        <div className="section-head">
          <span className="section-title">🔑 Generate License Key</span>
        </div>
        <div className="section-body">
          <div className="gen-row">
            <div className="gen-field">
              <label>Nama Customer (opsional)</label>
              <input type="text" className="gen-input" placeholder="contoh: Ferdy Santoso" value={genName} onChange={(e) => setGenName(e.target.value)} />
            </div>
            <div className="gen-field">
              <label>Jumlah Key</label>
              <select className="gen-select" value={genQty} onChange={(e) => setGenQty(e.target.value)}>
                <option value="1">1 key</option><option value="3">3 key</option>
                <option value="5">5 key</option><option value="10">10 key</option>
              </select>
            </div>
            <button className="gen-btn" disabled={genBusy} onClick={onGenerate}>
              {genBusy ? '⏳ Generating...' : '✦ Generate Key'}
            </button>
          </div>

          {result && (
            <div className="result-box show">
              <div>
                <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6, fontFamily: "'JetBrains Mono',monospace" }}>License Key Baru</div>
                <div className="result-key">{result.key}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6, fontFamily: "'JetBrains Mono',monospace", wordBreak: 'break-all' }}>{result.url}</div>
              </div>
              <div className="result-actions">
                <button className="copy-key-btn" onClick={() => quickCopy(result.key)}>📋 Copy Key</button>
                <button className="copy-url-btn" onClick={() => quickCopy(result.url)}>🔗 Copy URL</button>
              </div>
            </div>
          )}

          {bulkResult && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 10, fontFamily: "'JetBrains Mono',monospace" }}>Keys yang dibuat:</div>
              {bulkResult.map((b) => (
                <div className="bk-row" key={b.key}>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", color: 'var(--gold2)', letterSpacing: 3 }}>{b.key}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="copy-key-btn" style={{ fontSize: 11 }} onClick={() => quickCopy(b.key)}>📋 Key</button>
                    <button className="copy-url-btn" style={{ fontSize: 11 }} onClick={() => quickCopy(b.url)}>🔗 URL</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* TABLE / CARD LIST */}
      <div className="section">
        <div className="section-head">
          <span className="section-title">📋 Semua License Key</span>
          <div className="filter-bar">
            <input type="text" className="filter-input" placeholder="Cari key, email, nama..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
              <option value="all">Semua Status</option>
              <option value="unused">Belum Dipakai</option>
              <option value="used">Sudah Dipakai</option>
              <option value="revoked">Dicabut</option>
            </select>
            <button className="refresh-btn" onClick={async () => { setLoading(true); await loadKeys(); setLoading(false); }}>⟳ Refresh</button>
          </div>
        </div>

        {/* ── MOBILE card view ── */}
        {isMobile ? (
          <div style={{ padding: '12px 16px 16px' }}>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="mobile-card" style={{ animation: 'pulse 1.4s ease-in-out infinite' }}>
                  <div style={{ height: 18, width: '70%', borderRadius: 6, background: 'rgba(255,255,255,0.06)', marginBottom: 10 }} />
                  <div style={{ height: 10, width: '40%', borderRadius: 6, background: 'rgba(255,255,255,0.04)' }} />
                </div>
              ))
            ) : !pageKeys.length ? (
              <div className="empty-state"><div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div><div>Tidak ada data yang cocok</div></div>
            ) : pageKeys.map((k) => {
              const email  = k.profiles?.email || '—';
              const status = k.is_revoked ? 'revoked' : k.is_used ? 'used' : 'unused';
              const statusLabel = { revoked: 'Dicabut', used: 'Aktif', unused: 'Belum Dipakai' }[status];
              const statusColor = { revoked: 'var(--red)', used: 'var(--green)', unused: 'var(--text3)' }[status];
              const token  = encodeDeliveryToken(k.key, k.customer_name || '');
              const url    = `${DELIVERY_BASE}/delivery?token=${token}&name=${encodeURIComponent(k.customer_name || '')}`;
              const custEmail = k.profiles?.email;
              const isBlocked = k.profiles?.is_blocked === true;

              return (
                <div key={k.key} className="mobile-card">
                  {/* Key besar */}
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 700, color: 'var(--gold2)', letterSpacing: 3, marginBottom: 8 }}>
                    {k.key}
                  </div>
                  {/* Status + email */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: statusColor, fontFamily: "'JetBrains Mono', monospace" }}>● {statusLabel}</span>
                    <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: "'JetBrains Mono', monospace", wordBreak: 'break-all' }}>{email}</span>
                  </div>
                  {/* Dates */}
                  <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
                    {k.used_at && <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: "'JetBrains Mono', monospace" }}>Aktif: {fmtDate(k.used_at)}</span>}
                    <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: "'JetBrains Mono', monospace" }}>Dibuat: {k.created_at ? fmtDate(k.created_at) : '—'}</span>
                  </div>
                  {/* Aksi */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className="act-btn act-copy" onClick={() => quickCopy(k.key)}>📋 Key</button>
                    <button className="act-btn act-url"  onClick={() => quickCopy(url)}>🔗 URL</button>
                    <button className="act-btn act-delete" onClick={() => setPendingDelete(k.key)}>🗑️</button>
                    {k.is_revoked
                      ? <button className="act-btn act-restore" onClick={() => setPendingAction({ type: 'restore', key: k.key })}>♻️ Restore</button>
                      : <button className="act-btn act-revoke"  onClick={() => setPendingAction({ type: 'revoke',  key: k.key })}>⛔ Cabut</button>
                    }
                    {custEmail && (isBlocked
                      ? <button className="act-btn act-unblock" onClick={() => setPendingAction({ type: 'unblock', email: custEmail })}>🔓 Aktifkan</button>
                      : <button className="act-btn act-block"   onClick={() => setPendingAction({ type: 'block',   email: custEmail })}>🚫 Blokir</button>
                    )}
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
                  <th>License Key</th><th>Status</th><th>Email Customer</th>
                  <th>Dipakai Sejak</th><th>Dibuat</th><th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}><span className="spinner" />Memuat data...</td></tr>
                ) : !pageKeys.length ? (
                  <tr><td colSpan={6}><div className="empty-state"><div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div><div>Tidak ada data yang cocok</div></div></td></tr>
                ) : pageKeys.map((k) => {
                  const email  = k.profiles?.email || '—';
                  const status = k.is_revoked ? 'revoked' : k.is_used ? 'used' : 'unused';
                  const statusLabel = { revoked: '⛔ Dicabut', used: '✓ Aktif', unused: '○ Belum Dipakai' }[status];
                  const token  = encodeDeliveryToken(k.key, k.customer_name || '');
                  const url    = `${DELIVERY_BASE}/delivery?token=${token}&name=${encodeURIComponent(k.customer_name || '')}`;
                  const custEmail = k.profiles?.email;
                  const isBlocked = k.profiles?.is_blocked === true;
                  return (
                    <tr key={k.key}>
                      <td><div className="key-mono">{k.key}</div></td>
                      <td><span className={`badge ${status}`}><span className="dot" />{statusLabel}</span></td>
                      <td><div className="email-text" title={email}>{email}</div></td>
                      <td><div className="date-text">{k.used_at ? fmtDate(k.used_at) : '—'}</div></td>
                      <td><div className="date-text">{k.created_at ? fmtDate(k.created_at) : '—'}</div></td>
                      <td>
                        <div className="action-btns">
                          <button className="act-btn act-copy" onClick={() => quickCopy(k.key)}>📋</button>
                          <button className="act-btn act-url"  onClick={() => quickCopy(url)}>🔗</button>
                          <button className="act-btn act-delete" onClick={() => setPendingDelete(k.key)} style={{ background: '#1a1a1a', border: '1px solid #444' }}>🗑️</button>
                          {k.is_revoked
                            ? <button className="act-btn act-restore" onClick={() => setPendingAction({ type: 'restore', key: k.key })}>♻️ Restore</button>
                            : <button className="act-btn act-revoke"  onClick={() => setPendingAction({ type: 'revoke',  key: k.key })}>⛔ Cabut</button>
                          }
                          {custEmail && (isBlocked
                            ? <button className="act-btn act-unblock" onClick={() => setPendingAction({ type: 'unblock', email: custEmail })}>🔓 Aktifkan</button>
                            : <button className="act-btn act-block"   onClick={() => setPendingAction({ type: 'block',   email: custEmail })}>🚫 Blokir</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <div className="pag-info">Menampilkan {start + 1}–{end} dari {filteredKeys.length} key</div>
            <div className="pag-btns">
              <button className="pag-btn" disabled={currentPage === 1} onClick={() => goPage(currentPage - 1)}>← Prev</button>
              {Array.from({ length: Math.min(totalPages, currentPage + 2) - Math.max(1, currentPage - 2) + 1 }, (_, i) => Math.max(1, currentPage - 2) + i).map((i) => (
                <button key={i} className={`pag-btn${i === currentPage ? ' active' : ''}`} onClick={() => goPage(i)}>{i}</button>
              ))}
              <button className="pag-btn" disabled={currentPage === totalPages} onClick={() => goPage(currentPage + 1)}>Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* Modal hapus */}
      {pendingDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setPendingDelete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon">🗑️</div>
            <div className="modal-title">Hapus License Key?</div>
            <div className="modal-desc">Aksi ini tidak bisa dibatalkan.<br />Jika key sudah dipakai, akun journal terkait juga ikut dihapus.</div>
            <div className="modal-key">{pendingDelete}</div>
            <div className="modal-btns">
              <button className="modal-cancel" onClick={() => setPendingDelete(null)}>Batal</button>
              <button className="modal-confirm" onClick={async () => { await deleteKey(pendingDelete); setPendingDelete(null); }}>Ya, Hapus Permanen</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:.4}50%{opacity:.9}}`}</style>
    </div>
  );
}
