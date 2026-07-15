// components/admin/KeysPanel.tsx
// Gabungan dari admin.html baris 204-267:
// stats-row, generate key form, tabel keys + pagination.
// Logic: loadKeys/generateKey/applyFilter/goPage — lihat hooks/useLicenseKeys.ts
'use client';

import { useEffect, useState } from 'react';
import { useAdminStore } from '@/store/useAdminStore';
import { useLicenseKeys } from '@/hooks/useLicenseKeys';
import { fmtDate, encodeDeliveryToken } from '@/lib/adminHelpers';
import { DELIVERY_BASE } from '@/lib/supabaseClient';

export default function KeysPanel({ active }: { active: boolean }) {
  const { filteredKeys, pageKeys, stats, totalPages, goPage, loadKeys, generateKey } =
    useLicenseKeys();
  const searchQuery = useAdminStore((s) => s.searchQuery);
  const setSearchQuery = useAdminStore((s) => s.setSearchQuery);
  const statusFilter = useAdminStore((s) => s.statusFilter);
  const setStatusFilter = useAdminStore((s) => s.setStatusFilter);
  const currentPage = useAdminStore((s) => s.currentPage);
  const setPendingAction = useAdminStore((s) => s.setPendingAction);
  const showToast = useAdminStore((s) => s.showToast);

  const [loading, setLoading] = useState(true);
  const [genName, setGenName] = useState('');
  const [genQty, setGenQty] = useState('1');
  const [genBusy, setGenBusy] = useState(false);
  const [result, setResult] = useState<{ key: string; url: string } | null>(null);
  const [bulkResult, setBulkResult] = useState<{ key: string; url: string }[] | null>(null);

  useEffect(() => {
    (async () => {
      await loadKeys();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const quickCopy = (text: string) => navigator.clipboard.writeText(text);

  const onGenerate = async () => {
    setGenBusy(true);
    const res = await generateKey(genName.trim(), parseInt(genQty));
    setGenBusy(false);
    if (!res) return;
    if (res.mode === 'single') {
      setResult({ key: res.key, url: res.url });
      setBulkResult(null);
    } else {
      setBulkResult(res.bulk);
      setResult(null);
    }
  };

  const start = (currentPage - 1) * 20;
  const end = Math.min(start + 20, filteredKeys.length);

  return (
    <div className={`tab-pane ${active ? 'active' : ''}`} id="tab-keys">
      <div className="main">
        {/* STATS ROW — admin.html baris 206-211 */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-lbl">Total License Key</div>
            <div className="stat-val gold">{stats.total}</div>
            <div className="stat-sub">Semua key yang pernah dibuat</div>
          </div>
          <div className="stat-card">
            <div className="stat-lbl">Sudah Dipakai</div>
            <div className="stat-val green">{stats.used}</div>
            <div className="stat-sub">Customer aktif terdaftar</div>
          </div>
          <div className="stat-card">
            <div className="stat-lbl">Belum Dipakai</div>
            <div className="stat-val">{stats.unused}</div>
            <div className="stat-sub">Key tersedia / belum aktivasi</div>
          </div>
          <div className="stat-card">
            <div className="stat-lbl">Dicabut</div>
            <div className="stat-val red">{stats.revoked}</div>
            <div className="stat-sub">Key yang dinonaktifkan</div>
          </div>
        </div>

        {/* GENERATE — admin.html baris 213-237 */}
        <div className="section">
          <div className="section-head">
            <span className="section-title">🔑 Generate License Key Manual</span>
          </div>
          <div className="section-body">
            <div className="gen-row">
              <div className="gen-field">
                <label>Nama Customer (opsional)</label>
                <input
                  type="text"
                  className="gen-input"
                  placeholder="contoh: Ferdy Santoso"
                  value={genName}
                  onChange={(e) => setGenName(e.target.value)}
                />
              </div>
              <div className="gen-field">
                <label>Jumlah Key</label>
                <select className="gen-select" value={genQty} onChange={(e) => setGenQty(e.target.value)}>
                  <option value="1">1 key</option>
                  <option value="3">3 key</option>
                  <option value="5">5 key</option>
                  <option value="10">10 key</option>
                </select>
              </div>
              <button className="gen-btn" disabled={genBusy} onClick={onGenerate}>
                {genBusy ? '⏳ Generating...' : '✦ Generate Key'}
              </button>
            </div>

            {result && (
              <div className="result-box show">
                <div>
                  <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6, fontFamily: "'JetBrains Mono',monospace" }}>
                    License Key Baru
                  </div>
                  <div className="result-key">{result.key}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6, fontFamily: "'JetBrains Mono',monospace", wordBreak: 'break-all' }}>
                    {result.url}
                  </div>
                </div>
                <div className="result-actions">
                  <button className="copy-key-btn" onClick={() => quickCopy(result.key)}>
                    📋 Copy Key
                  </button>
                  <button className="copy-url-btn" onClick={() => quickCopy(result.url)}>
                    🔗 Copy URL
                  </button>
                </div>
              </div>
            )}

            {bulkResult && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 10, fontFamily: "'JetBrains Mono',monospace" }}>
                  Keys yang dibuat:
                </div>
                <div>
                  {bulkResult.map((b) => (
                    <div className="bk-row" key={b.key}>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", color: 'var(--gold2)', letterSpacing: 3 }}>
                        {b.key}
                      </span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="copy-key-btn" style={{ fontSize: 11 }} onClick={() => quickCopy(b.key)}>
                          📋 Key
                        </button>
                        <button className="copy-url-btn" style={{ fontSize: 11 }} onClick={() => quickCopy(b.url)}>
                          🔗 URL
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* TABLE — admin.html baris 239-263 */}
        <div className="section">
          <div className="section-head">
            <span className="section-title">📋 Semua License Key</span>
            <div className="filter-bar">
              <input
                type="text"
                className="filter-input"
                placeholder="Cari key, email, nama..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
                <option value="all">Semua Status</option>
                <option value="unused">Belum Dipakai</option>
                <option value="used">Sudah Dipakai</option>
                <option value="revoked">Dicabut</option>
              </select>
              <button
                className="refresh-btn"
                onClick={async () => {
                  setLoading(true);
                  await loadKeys();
                  setLoading(false);
                }}
              >
                ⟳ Refresh
              </button>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>License Key</th>
                  <th>Status</th>
                  <th>Email Customer</th>
                  <th>Dipakai Sejak</th>
                  <th>Dibuat</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
                      <span className="spinner"></span>Memuat data...
                    </td>
                  </tr>
                ) : !pageKeys.length ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty-state">
                        <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
                        <div>Tidak ada data yang cocok</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pageKeys.map((k) => {
                    const email = k.profiles?.email || '—';
                    const status = k.is_revoked ? 'revoked' : k.is_used ? 'used' : 'unused';
                    const statusLabel = { revoked: '⛔ Dicabut', used: '✓ Aktif', unused: '○ Belum Dipakai' }[status];
                    const token = encodeDeliveryToken(k.key, k.customer_name || '');
                    const url = `${DELIVERY_BASE}/delivery.html?token=${token}&name=${encodeURIComponent(k.customer_name || '')}`;
                    const custEmail = k.profiles?.email;
                    const isBlocked = k.profiles?.is_blocked === true;
                    return (
                      <tr key={k.key}>
                        <td>
                          <div className="key-mono">{k.key}</div>
                        </td>
                        <td>
                          <span className={`badge ${status}`}>
                            <span className="dot"></span>
                            {statusLabel}
                          </span>
                        </td>
                        <td>
                          <div className="email-text" title={email}>
                            {email}
                          </div>
                        </td>
                        <td>
                          <div className="date-text">{k.used_at ? fmtDate(k.used_at) : '—'}</div>
                        </td>
                        <td>
                          <div className="date-text">{k.created_at ? fmtDate(k.created_at) : '—'}</div>
                        </td>
                        <td>
                          <div className="action-btns">
                            <button className="act-btn act-copy" title="Copy key" onClick={() => quickCopy(k.key)}>
                              📋
                            </button>
                            <button className="act-btn act-url" title="Copy URL" onClick={() => quickCopy(url)}>
                              🔗
                            </button>
                            {k.is_revoked ? (
                              <button
                                className="act-btn act-restore"
                                onClick={() => setPendingAction({ type: 'restore', key: k.key })}
                              >
                                ♻️ Restore
                              </button>
                            ) : (
                              <button
                                className="act-btn act-revoke"
                                onClick={() => setPendingAction({ type: 'revoke', key: k.key })}
                              >
                                ⛔ Cabut
                              </button>
                            )}
                            {custEmail &&
                              (isBlocked ? (
                                <button
                                  className="act-btn act-unblock"
                                  onClick={() => setPendingAction({ type: 'unblock', email: custEmail })}
                                >
                                  🔓 Aktifkan
                                </button>
                              ) : (
                                <button
                                  className="act-btn act-block"
                                  onClick={() => setPendingAction({ type: 'block', email: custEmail })}
                                >
                                  🚫 Blokir
                                </button>
                              ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <div className="pag-info">
                Menampilkan {start + 1}–{end} dari {filteredKeys.length} key
              </div>
              <div className="pag-btns">
                <button className="pag-btn" disabled={currentPage === 1} onClick={() => goPage(currentPage - 1)}>
                  ← Prev
                </button>
                {Array.from(
                  { length: Math.min(totalPages, currentPage + 3) - Math.max(1, currentPage - 3) + 1 },
                  (_, i) => Math.max(1, currentPage - 3) + i
                ).map((i) => (
                  <button key={i} className={`pag-btn ${i === currentPage ? 'active' : ''}`} onClick={() => goPage(i)}>
                    {i}
                  </button>
                ))}
                <button className="pag-btn" disabled={currentPage === totalPages} onClick={() => goPage(currentPage + 1)}>
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
