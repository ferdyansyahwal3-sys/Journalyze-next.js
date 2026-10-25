// components/admin/DateRangePicker.tsx
// Pemilih rentang tanggal ala lynk.id: klik tanggal awal, lalu tanggal akhir.
// Semua tanggal berupa string 'YYYY-MM-DD' (zona waktu WIB). Gaya di dashboard.css (class lp-dp-*).
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface DateRange {
  from: string;
  to: string;
}

const TZ = 'Asia/Jakarta';
const MAX_DAYS = 366;
const WEEKDAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const pad = (n: number) => String(n).padStart(2, '0');
const keyOf = (y: number, m0: number, d: number) => `${y}-${pad(m0 + 1)}-${pad(d)}`;
const parse = (key: string) => ({
  y: Number(key.slice(0, 4)),
  m0: Number(key.slice(5, 7)) - 1,
  d: Number(key.slice(8, 10)),
});
const todayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });

function addDays(key: string, n: number): string {
  const { y, m0, d } = parse(key);
  const t = new Date(Date.UTC(y, m0, d + n));
  return keyOf(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
}

function diffDays(a: string, b: string): number {
  const A = parse(a);
  const B = parse(b);
  return Math.round((Date.UTC(B.y, B.m0, B.d) - Date.UTC(A.y, A.m0, A.d)) / 86400000);
}

function monthBounds(y: number, m0: number): DateRange {
  const t = new Date(Date.UTC(y, m0, 1));
  const year = t.getUTCFullYear();
  const month = t.getUTCMonth();
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return { from: keyOf(year, month, 1), to: keyOf(year, month, last) };
}

/** Bulan berjalan penuh (mis. Oktober → 1–31 Oktober), dihitung di WIB */
export function currentMonthRange(): DateRange {
  const { y, m0 } = parse(todayKey());
  return monthBounds(y, m0);
}

const fmt = (key: string) =>
  new Date(key + 'T12:00:00Z').toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });

export default function DateRangePicker({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (r: DateRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const [viewY, setViewY] = useState(() => parse(from).y);
  const [viewM0, setViewM0] = useState(() => parse(from).m0);
  const [pending, setPending] = useState<string | null>(null); // tanggal awal yang sudah diklik
  const [hover, setHover] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setPending(null);
    setHover(null);
  }, []);

  // Tutup saat klik di luar atau tekan Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  const toggle = () => {
    if (open) {
      close();
      return;
    }
    const p = parse(from);
    setViewY(p.y);
    setViewM0(p.m0);
    setOpen(true);
  };

  const shiftMonth = (delta: number) => {
    const t = new Date(Date.UTC(viewY, viewM0 + delta, 1));
    setViewY(t.getUTCFullYear());
    setViewM0(t.getUTCMonth());
  };

  const apply = (r: DateRange) => {
    onChange(r);
    close();
  };

  const pick = (key: string) => {
    if (!pending) {
      setPending(key);
      setHover(null);
      return;
    }
    let a = pending;
    let b = key;
    if (b < a) [a, b] = [b, a];
    if (diffDays(a, b) >= MAX_DAYS) b = addDays(a, MAX_DAYS - 1);
    apply({ from: a, to: b });
  };

  const presets = useMemo(() => {
    const today = todayKey();
    const { y, m0 } = parse(today);
    const lastN = (n: number): DateRange => ({ from: addDays(today, -(n - 1)), to: today });
    return [
      { id: 'month', label: 'Bulan ini', range: monthBounds(y, m0) },
      { id: 'last', label: 'Bulan lalu', range: monthBounds(y, m0 - 1) },
      { id: '7', label: '7 hari', range: lastN(7) },
      { id: '30', label: '30 hari', range: lastN(30) },
      { id: '90', label: '90 hari', range: lastN(90) },
    ];
  }, []);

  // Rentang yang disorot: pratinjau saat memilih, atau rentang aktif
  let hlFrom = from;
  let hlTo = to;
  if (pending) {
    const other = hover ?? pending;
    hlFrom = pending <= other ? pending : other;
    hlTo = pending <= other ? other : pending;
  }

  const firstWeekday = new Date(Date.UTC(viewY, viewM0, 1)).getUTCDay(); // 0 = Minggu
  const daysInMonth = new Date(Date.UTC(viewY, viewM0 + 1, 0)).getUTCDate();
  const today = todayKey();

  return (
    <div className="lp-dp" ref={wrapRef}>
      <button
        type="button"
        className={`lp-dp-btn${open ? ' open' : ''}`}
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
        <span>{fmt(from)} – {fmt(to)}</span>
      </button>

      {open && (
        <div className="lp-dp-pop" role="dialog" aria-label="Pilih rentang tanggal">
          <div className="lp-dp-presets">
            {presets.map((p) => (
              <button key={p.id} type="button" className="lp-dp-preset" onClick={() => apply(p.range)}>
                {p.label}
              </button>
            ))}
          </div>

          <div className="lp-dp-head">
            <button type="button" className="lp-dp-nav" onClick={() => shiftMonth(-1)} aria-label="Bulan sebelumnya">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
            <div className="lp-dp-title" aria-live="polite">{MONTHS[viewM0]} {viewY}</div>
            <button type="button" className="lp-dp-nav" onClick={() => shiftMonth(1)} aria-label="Bulan berikutnya">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          </div>

          <div className="lp-dp-grid lp-dp-wd" aria-hidden="true">
            {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
          </div>

          <div className="lp-dp-grid" onMouseLeave={() => setHover(null)}>
            {Array.from({ length: firstWeekday }, (_, i) => <span key={`b${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const d = i + 1;
              const key = keyOf(viewY, viewM0, d);
              const isStart = key === hlFrom;
              const isEnd = key === hlTo;
              const inRange = key > hlFrom && key < hlTo;
              const cls = [
                'lp-dp-day',
                isStart ? 'start' : '',
                isEnd ? 'end' : '',
                inRange ? 'in' : '',
                key === today ? 'today' : '',
              ].filter(Boolean).join(' ');
              return (
                <button
                  key={key}
                  type="button"
                  className={cls}
                  aria-label={fmt(key)}
                  aria-pressed={isStart || isEnd}
                  onClick={() => pick(key)}
                  onMouseEnter={() => { if (pending) setHover(key); }}
                >
                  {d}
                </button>
              );
            })}
          </div>

          <div className="lp-dp-foot">
            {pending ? `Awal: ${fmt(pending)} · pilih tanggal akhir` : 'Klik tanggal awal, lalu tanggal akhir'}
          </div>
        </div>
      )}
    </div>
  );
}
