// components/admin/LeadsPanel.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { _sbAdmin } from '@/lib/supabaseClient';

/* ── TYPES ── */
type LeadStatus = 'new' | 'contacted' | 'converted' | 'dead';

interface Lead {
  id: string;
  created_at: string;
  nama: string;
  email: string;
  whatsapp: string | null;
  q1_profil: string | null;
  q2_masalah: string | null;
  q3_frekuensi: string | null;
  q4_journal_sekarang: string | null;
  source: string | null;
  status: LeadStatus;
  notes: string | null;
  is_converted: boolean;
}

type StatusFilter = 'all' | LeadStatus;

/* ── LABEL MAPS ── */
const Q1_LABELS: Record<string, string> = {
  pemula: 'Pemula', scalper: 'Scalper', swing: 'Swing', investor: 'Investor',
};
const Q2_LABELS: Record<string, string> = {
  'tidak-tahu-salah': 'Tidak Tahu Salah', emosi: 'Emosi',
  'win-rate': 'Win Rate', rekap: 'Rekap',
};
const Q3_LABELS: Record<string, string> = {
  rendah: '1–10/bln', sedang: '10–50/bln', tinggi: '50+/bln',
};
const Q4_LABELS: Record<string, string> = {
  manual: 'Manual', excel: 'Excel', screenshot: 'Screenshot', 'tidak-ada': 'Tidak Ada',
};

const STATUS_COLORS: Record<LeadStatus, { bg: string; color: string; border: string }> = {
  new:       { bg: 'rgba(96,165,250,0.1)',   color: '#60A5FA', border: 'rgba(96,165,250,0.3)' },
  contacted: { bg: 'rgba(201,168,76,0.1)',   color: '#C9A84C', border: 'rgba(201,168,76,0.3)' },
  converted: { bg: 'rgba(34,197,94,0.1)',    color: '#22C55E', border: 'rgba(34,197,94,0.3)' },
  dead:      { bg: 'rgba(106,96,80,0.1)',    color: '#6A6050', border: 'rgba(106,96,80,0.25)' },
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

function exportCSV(leads: Lead[]) {
  const headers = ['Nama','Email','WhatsApp','Profil','Masalah','Frekuensi','Journal Skrg','Tanggal','Status','Notes'];
  const rows = leads.map(l => [
    l.nama, l.email, l.whatsapp ?? '',
    Q1_LABELS[l.q1_profil ?? ''] ?? l.q1_profil ?? '',
    Q2_LABELS[l.q2_masalah ?? ''] ?? l.q2_masalah ?? '',
    Q3_LABELS[l.q3_frekuensi ?? ''] ?? l.q3_frekuensi ?? '',
    Q4_LABELS[l.q4_journal_sekarang ?? ''] ?? l.q4_journal_sekarang ?? '',
    fmtDate(l.created_at), l.status, l.notes ?? '',
  ]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `leads-journalyze-${Date.now()}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

/* ════════════════════════════
   COMPONENT
════════════════════════════ */
export default function LeadsPanel({ active }: { active: boolean }) {
  const [leads, setLeads]             = useState<Lead[]>([]);
  const [loading, setLoading]         = useState(false);
  const [loaded, setLoaded]           = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [updatingId, setUpdatingId]   = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteValue, setNoteValue]     = useState('');

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const { data, error } = await _sbAdmin
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setLeads(data as Lead[]);
    setLoading(false);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (active && !loaded) fetchLeads();
  }, [active, loaded, fetchLeads]);

  /* ── FILTER ── */
  const filtered = statusFilter === 'all' ? leads : leads.filter(l => l.status === statusFilter);

  /* ── STATS ── */
  const stats = {
    total:     leads.length,
    new:       leads.filter(l => l.status === 'new').length,
    contacted: leads.filter(l => l.status === 'contacted').length,
    converted: leads.filter(l => l.status === 'converted').length,
  };

  /* ── UPDATE STATUS ── */
  async function updateStatus(id: string, status: LeadStatus) {
    setUpdatingId(id);
    const { error } = await _sbAdmin.from('leads').update({ status }).eq('id', id);
    if (!error) {
      setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
    }
    setUpdatingId(null);
  }

  /* ── SAVE NOTE ── */
  async function saveNote(id: string) {
    await _sbAdmin.from('leads').update({ notes: noteValue }).eq('id', id);
    setLeads(prev => prev.map(l => l.id === id ? { ...l, notes: noteValue } : l));
    setEditingNoteId(null);
  }

  /* ── RENDER ── */
  return (
    <div className="main">

      {/* ── STAT CARDS ── */}
      <div className="stats-row" style={{ marginBottom: 20 }}>
        {[
          { lbl: 'Total Leads', val: stats.total, cls: '' },
          { lbl: 'New',         val: stats.new,       cls: 'blue' },
          { lbl: 'Contacted',   val: stats.contacted, cls: 'gold' },
          { lbl: 'Converted',   val: stats.converted, cls: 'green' },
        ].map(s => (
          <div key={s.lbl} className="stat-card">
            <div className="stat-lbl">{s.lbl}</div>
            <div className={`stat-val${s.cls ? ` ${s.cls}` : ''}`}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* ── SECTION ── */}
      <div className="section">
        <div className="section-head">
          <span className="section-title">Leads Onboarding</span>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Filter */}
            <div className="filter-bar">
              <select
                className="filter-select"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as StatusFilter)}
              >
                <option value="all">Semua Status</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="converted">Converted</option>
                <option value="dead">Dead</option>
              </select>
            </div>
            {/* Export */}
            <button className="gen-btn" onClick={() => exportCSV(filtered)}>
              ↓ Export CSV
            </button>
            {/* Refresh */}
            <button className="refresh-btn" onClick={fetchLeads} disabled={loading}>
              {loading ? '⟳ Memuat...' : '⟳ Refresh'}
            </button>
          </div>
        </div>

        {/* TABLE */}
        <div className="table-wrap">
          {loading && !loaded ? (
            <div className="empty-state">
              <span className="spinner" />Memuat data leads...
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              {statusFilter === 'all' ? 'Belum ada lead. Bagikan link /uji-coba untuk mulai.' : `Tidak ada lead dengan status "${statusFilter}".`}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Email</th>
                  <th>WhatsApp</th>
                  <th>Profil</th>
                  <th>Masalah</th>
                  <th>Frekuensi</th>
                  <th>Journal</th>
                  <th>Tanggal</th>
                  <th>Status</th>
                  <th>Catatan</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(lead => (
                  <>
                    {/* ── MAIN ROW ── */}
                    <tr
                      key={lead.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                    >
                      <td>
                        <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13 }}>
                          {lead.nama}
                        </span>
                      </td>
                      <td>
                        <span
                          className="email-text"
                          title={lead.email}
                          onClick={e => { e.stopPropagation(); copyToClipboard(lead.email); }}
                          style={{ cursor: 'copy' }}
                        >
                          {lead.email}
                        </span>
                      </td>
                      <td>
                        {lead.whatsapp ? (
                          <span
                            style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 12, color: 'var(--text2)', cursor: 'copy' }}
                            onClick={e => { e.stopPropagation(); copyToClipboard(lead.whatsapp!); }}
                            title="Klik untuk copy"
                          >
                            {lead.whatsapp}
                          </span>
                        ) : <span style={{ color: 'var(--text4)' }}>—</span>}
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: 'var(--text2)' }}>
                          {Q1_LABELS[lead.q1_profil ?? ''] ?? '—'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: 'var(--text2)' }}>
                          {Q2_LABELS[lead.q2_masalah ?? ''] ?? '—'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: 'var(--text2)' }}>
                          {Q3_LABELS[lead.q3_frekuensi ?? ''] ?? '—'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: 'var(--text2)' }}>
                          {Q4_LABELS[lead.q4_journal_sekarang ?? ''] ?? '—'}
                        </span>
                      </td>
                      <td>
                        <span className="date-text">{fmtDate(lead.created_at)}</span>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <select
                          value={lead.status}
                          disabled={updatingId === lead.id}
                          onChange={e => updateStatus(lead.id, e.target.value as LeadStatus)}
                          style={{
                            background: (STATUS_COLORS[lead.status as LeadStatus] ?? STATUS_COLORS["new"]).bg,
                            border: `1px solid ${(STATUS_COLORS[lead.status as LeadStatus] ?? STATUS_COLORS["new"]).border}`,
                            color: (STATUS_COLORS[lead.status as LeadStatus] ?? STATUS_COLORS["new"]).color,
                            borderRadius: 6,
                            padding: '4px 8px',
                            fontFamily: 'var(--font-jetbrains)',
                            fontSize: 10,
                            letterSpacing: 1,
                            textTransform: 'uppercase',
                            cursor: 'pointer',
                            outline: 'none',
                          }}
                        >
                          <option value="new">New</option>
                          <option value="contacted">Contacted</option>
                          <option value="converted">Converted</option>
                          <option value="dead">Dead</option>
                        </select>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        {editingNoteId === lead.id ? (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <input
                              value={noteValue}
                              onChange={e => setNoteValue(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') saveNote(lead.id); if (e.key === 'Escape') setEditingNoteId(null); }}
                              autoFocus
                              style={{
                                background: 'var(--input-bg)',
                                border: '1px solid var(--gold-bd)',
                                borderRadius: 6,
                                padding: '4px 8px',
                                color: 'var(--text)',
                                fontFamily: 'var(--font-jetbrains)',
                                fontSize: 11,
                                width: 140,
                                outline: 'none',
                              }}
                            />
                            <button
                              onClick={() => saveNote(lead.id)}
                              style={{ background: 'var(--green-bg)', border: '1px solid var(--green-bd)', color: 'var(--green)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11 }}
                            >
                              ✓
                            </button>
                          </div>
                        ) : (
                          <span
                            style={{ fontSize: 12, color: lead.notes ? 'var(--text2)' : 'var(--text4)', cursor: 'pointer', maxWidth: 160, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            title={lead.notes ?? 'Klik untuk tambah catatan'}
                            onClick={() => { setEditingNoteId(lead.id); setNoteValue(lead.notes ?? ''); }}
                          >
                            {lead.notes || '+ catatan'}
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* ── EXPANDED ROW ── */}
                    {expandedId === lead.id && (
                      <tr key={`${lead.id}-expanded`}>
                        <td colSpan={10} style={{ background: 'rgba(201,168,76,0.03)', padding: '16px 20px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                            {[
                              { label: 'ID Lead', value: lead.id },
                              { label: 'Source', value: lead.source ?? '—' },
                              { label: 'Q1 Profil', value: lead.q1_profil ?? '—' },
                              { label: 'Q2 Masalah', value: lead.q2_masalah ?? '—' },
                              { label: 'Q3 Frekuensi', value: lead.q3_frekuensi ?? '—' },
                              { label: 'Q4 Journal', value: lead.q4_journal_sekarang ?? '—' },
                              { label: 'Tanggal Daftar', value: fmtDate(lead.created_at) },
                              { label: 'Converted', value: lead.is_converted ? 'Ya' : 'Tidak' },
                            ].map(({ label, value }) => (
                              <div key={label}>
                                <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 4 }}>{label}</div>
                                <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 12, color: 'var(--text2)', wordBreak: 'break-all' }}>{value}</div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* PAGINATION INFO */}
        {filtered.length > 0 && (
          <div className="pagination">
            <span className="pag-info">{filtered.length} lead ditampilkan</span>
          </div>
        )}
      </div>
    </div>
  );
}