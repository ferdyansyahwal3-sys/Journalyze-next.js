// components/admin/PixelPanel.tsx
// Panel admin untuk manage Meta Pixel ID — simpan ke Supabase 'settings'
// Admin bisa ubah Pixel ID tanpa redeploy Vercel
'use client';

import { useEffect, useState, useCallback } from 'react';
import { _sbAdmin } from '@/lib/supabaseClient';

interface PixelEvent {
  id: string;
  event_name: string;
  page: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface Props { active: boolean }

export default function PixelPanel({ active }: Props) {
  const [pixelId, setPixelId] = useState('');
  const [pixelEnabled, setPixelEnabled] = useState(false);
  const [inputId, setInputId] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [events, setEvents] = useState<PixelEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [statsPageView, setStatsPageView] = useState(0);
  const [statsPurchase, setStatsPurchase] = useState(0);

  const showMsg = (msg: string) => {
    setSaveMsg(msg);
    setTimeout(() => setSaveMsg(''), 3000);
  };

  const loadSettings = useCallback(async () => {
    try {
      const { data, error } = await _sbAdmin
        .from('settings')
        .select('key, value')
        .in('key', ['pixel_id', 'pixel_enabled']);
      if (error) throw error;
      const pid = data?.find((r: { key: string }) => r.key === 'pixel_id')?.value || '';
      const pen = data?.find((r: { key: string }) => r.key === 'pixel_enabled')?.value === 'true';
      setPixelId(pid);
      setInputId(pid);
      setPixelEnabled(pen);
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

  const handleSavePixelId = async () => {
    setSaving(true);
    try {
      const { error } = await _sbAdmin
        .from('settings')
        .upsert([{ key: 'pixel_id', value: inputId.trim(), updated_at: new Date().toISOString() }], {
          onConflict: 'key',
        });
      if (error) throw error;
      setPixelId(inputId.trim());
      showMsg('✅ Pixel ID berhasil disimpan! Akan aktif di /home setelah refresh.');
    } catch (e: unknown) {
      showMsg('❌ Gagal menyimpan: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePixel = async (val: boolean) => {
    try {
      const { error } = await _sbAdmin
        .from('settings')
        .upsert([{ key: 'pixel_enabled', value: String(val), updated_at: new Date().toISOString() }], {
          onConflict: 'key',
        });
      if (error) throw error;
      setPixelEnabled(val);
      showMsg(val ? '✅ Pixel diaktifkan!' : '⚠️ Pixel dinonaktifkan.');
    } catch (e: unknown) {
      showMsg('❌ Gagal toggle: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const previewScript = pixelId
    ? `!function(f,b,e,v,n,t,s){...}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId}');
fbq('track', 'PageView');`
    : '(Masukkan Pixel ID terlebih dahulu)';

  const formatDate = (str: string) => {
    try {
      return new Date(str).toLocaleString('id-ID', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
      });
    } catch { return str; }
  };

  if (!active) return null;

  return (
    <div className="main">
      {/* Header stats */}
      <div className="stats-row" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="stat-card">
          <div className="stat-lbl">Status Pixel</div>
          <div className="stat-val" style={{ fontSize: 28, color: pixelEnabled ? 'var(--green)' : 'var(--text3)' }}>
            {pixelEnabled ? '● AKTIF' : '○ NONAKTIF'}
          </div>
          <div className="stat-sub">{pixelId || 'Belum ada Pixel ID'}</div>
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

      {/* Config section */}
      <div className="section">
        <div className="section-head">
          <span className="section-title">📡 Konfigurasi Meta Pixel</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: "'JetBrains Mono',monospace" }}>
              Status:
            </span>
            <button
              onClick={() => handleTogglePixel(!pixelEnabled)}
              style={{
                background: pixelEnabled ? 'var(--green-bg)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${pixelEnabled ? 'var(--green-bd)' : 'var(--border)'}`,
                color: pixelEnabled ? 'var(--green)' : 'var(--text3)',
                borderRadius: 99,
                padding: '5px 14px',
                fontSize: 11,
                fontWeight: 700,
                fontFamily: "'JetBrains Mono',monospace",
                cursor: 'pointer',
                letterSpacing: 1,
              }}
            >
              {pixelEnabled ? '● ON' : '○ OFF'}
            </button>
          </div>
        </div>
        <div className="section-body">
          <div className="gen-row">
            <div className="gen-field" style={{ flex: 1 }}>
              <label className="gen-field label" style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, display: 'block' }}>
                Meta Pixel ID
              </label>
              <input
                className="gen-input"
                type="text"
                placeholder="Contoh: 123456789012345"
                value={inputId}
                onChange={(e) => setInputId(e.target.value)}
                style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 16, letterSpacing: 2, minWidth: 280 }}
              />
            </div>
            <button
              className="gen-btn"
              onClick={handleSavePixelId}
              disabled={saving || !inputId.trim()}
            >
              {saving ? '⏳ Menyimpan...' : '💾 Simpan Pixel ID'}
            </button>
          </div>

          <div style={{
            marginTop: 20,
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
              Preview Script yang akan di-inject di /home
            </div>
            <pre style={{
              fontFamily: "'JetBrains Mono',monospace",
              fontSize: 11,
              color: pixelId ? 'var(--gold2)' : 'var(--text3)',
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
            <strong>ℹ️ Cara kerja:</strong> Pixel ID disimpan di Supabase tabel <code>settings</code>.
            Halaman <code>/home</code> membaca Pixel ID saat load — tidak perlu redeploy Vercel.
            Toggle OFF akan menonaktifkan inject script tanpa menghapus Pixel ID.
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
                Event akan muncul di sini setelah Pixel aktif dan halaman /home dibuka.
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
    </div>
  );
}