'use client';

import { useEffect, useRef, useState } from 'react';

interface CountUpProps {
  /** Nilai akhir (angka atau string seperti "68%", "Rp 1.2jt") */
  value: string | number;
  /** Durasi animasi dalam ms (default 1400) */
  duration?: number;
  /** Class tambahan pada span angka */
  className?: string;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * CountUp — jika value adalah angka murni, animasikan 0→value.
 * Jika value adalah string dengan trailing non-angka (mis. "68%", "2.400+"),
 * ekstrak angka, animasikan bagiannya, pertahankan suffix.
 * Aktif saat masuk viewport (IntersectionObserver).
 */
export default function CountUp({ value, duration = 1400, className }: CountUpProps) {
  const ref    = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState('');
  const hasAnimated = useRef(false);

  // Parse angka dan suffix dari value
  const raw       = String(value);
  const numMatch  = raw.match(/^([^\d]*)(\d[\d.,]*)(.*)$/);
  const prefix    = numMatch?.[1] ?? '';
  const numStr    = numMatch?.[2] ?? '';
  const suffix    = numMatch?.[3] ?? '';
  const target    = numStr ? parseFloat(numStr.replace(/[.,]/g, '')) : NaN;
  const hasDecimal = numStr.includes('.');
  const hasComma   = numStr.includes(',');

  useEffect(() => {
    if (isNaN(target)) {
      setDisplay(raw);
      return;
    }

    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || hasAnimated.current) return;
      hasAnimated.current = true;
      io.unobserve(el);

      const start = performance.now();
      let raf: number;

      const tick = (now: number) => {
        const t      = Math.min((now - start) / duration, 1);
        const eased  = easeOutCubic(t);
        const current = Math.round(eased * target);

        let formatted: string;
        if (hasComma) {
          formatted = current.toLocaleString('id-ID');
        } else if (hasDecimal) {
          formatted = (eased * target).toFixed(1);
        } else {
          formatted = String(current);
        }

        setDisplay(`${prefix}${formatted}${suffix}`);
        if (t < 1) raf = requestAnimationFrame(tick);
      };

      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }, { threshold: 0.2 });

    io.observe(el);
    return () => io.disconnect();
  }, [target, duration, raw, prefix, suffix, hasDecimal, hasComma]);

  return (
    <span ref={ref} className={className}>
      {display || raw}
    </span>
  );
}
