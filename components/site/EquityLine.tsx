'use client';

import { useEffect, useRef } from 'react';

interface EquityLineProps {
  width?:  number;
  height?: number;
  className?: string;
}

/**
 * EquityLine — kurva equity emas yang menggambar diri saat masuk viewport.
 * Menggunakan stroke-dashoffset animation via IntersectionObserver.
 */
export default function EquityLine({
  width  = 480,
  height = 120,
  className,
}: EquityLineProps) {
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;

    // Hitung panjang path
    const len = path.getTotalLength();
    path.style.strokeDasharray  = String(len);
    path.style.strokeDashoffset = String(len);

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        path.style.transition = 'stroke-dashoffset 2.4s cubic-bezier(.16,1,.3,1)';
        path.style.strokeDashoffset = '0';
        io.unobserve(path);
      },
      { threshold: 0.3 }
    );

    io.observe(path);
    return () => io.disconnect();
  }, []);

  /* Titik-titik kurva (normalized ke 0-100 vertikal, 0-width horisontal) */
  const pts = [
    [0,   90], [50,  80], [90,  85], [140, 62],
    [190, 70], [240, 48], [290, 36], [340, 22],
    [390, 28], [440, 14], [480, 8],
  ];

  /* Buat path smooth dengan perintah cubic bezier sederhana */
  const d = pts
    .map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`))
    .join(' ');

  /* Path area fill (gradient) */
  const dArea = `${d} L${width},${height} L0,${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      style={{ overflow: 'visible' }}
    >
      <defs>
        <linearGradient id="st-eq-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="var(--gold)"  stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--gold)"  stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Area fill */}
      <path d={dArea} fill="url(#st-eq-area)" />

      {/* Kurva utama — dianimasikan */}
      <path
        ref={pathRef}
        d={d}
        fill="none"
        stroke="var(--gold2)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
