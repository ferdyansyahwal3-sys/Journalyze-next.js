import type { ReactNode } from 'react';
import Reveal from './Reveal';

interface SectionHeadProps {
  /** Label kecil uppercase di atas judul */
  label:    string;
  /** Judul utama — bisa memakai JSX (em, span, br) */
  heading:  ReactNode;
  /** Kalimat sub — opsional */
  sub?:     ReactNode;
  /** Perataan: center (default) atau left */
  align?:   'center' | 'left';
  className?: string;
}

/**
 * SectionHead — komponen header section standar.
 * Label mono kecil → heading serif besar → sub body.
 * Sudah dibungkus Reveal dengan stagger bawaan.
 */
export default function SectionHead({
  label,
  heading,
  sub,
  align = 'center',
  className,
}: SectionHeadProps) {
  const textAlign = align === 'left' ? 'left' : 'center';
  const itemAlign = align === 'left' ? 'flex-start' : 'center';

  return (
    <div
      className={className}
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     itemAlign,
        textAlign,
        marginBottom:   'clamp(40px, 7vw, 72px)',
      }}
    >
      <Reveal>
        <span className="st-badge">
          <span className="st-badge-dot" aria-hidden="true" />
          {label}
        </span>
      </Reveal>

      <Reveal delay={1} as="h2" className="st-heading" style={{ marginTop: 20 }}>
        {heading}
      </Reveal>

      {sub && (
        <Reveal delay={2} as="p" className="st-sub" style={{ marginTop: 16 }}>
          {sub}
        </Reveal>
      )}
    </div>
  );
}
