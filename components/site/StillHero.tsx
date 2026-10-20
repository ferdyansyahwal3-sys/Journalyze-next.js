'use client';

/**
 * StillHero — latar hero beranda.
 * Jika src kosong/placeholder → render gradien radial gold halus di atas --bg.
 * Jika src terisi → next/image dengan animasi ambient + overlay keterbacaan.
 */

import Image from 'next/image';

interface StillHeroProps {
  src: string;
  alt: string;
}

const isPlaceholder = (src: string) =>
  !src || src.includes('<CLOUD_NAME>') || src.includes('<PUBLIC_ID>');

export default function StillHero({ src, alt }: StillHeroProps) {
  if (isPlaceholder(src)) {
    return (
      <div className="st-hero-bg st-hero-bg--fallback" aria-hidden="true">
        <div className="st-hero-bg-orb" />
        <div className="st-hero-grid" />
      </div>
    );
  }

  return (
    <div className="st-hero-bg" aria-hidden="true">
      {/* Gambar utama */}
      <div className="st-hero-img-wrap">
        <Image
          src={src}
          alt={alt}
          fill
          priority
          sizes="100vw"
          style={{ objectFit: 'cover', filter: 'brightness(0.75)' }}
        />
      </div>

      {/* Lapisan kilau diagonal */}
      <div className="st-hero-sheen" />

      {/* Overlay keterbacaan: kiri pekat, kanan transparan */}
      <div className="st-hero-overlay-h" />
      {/* Overlay vertikal atas-bawah */}
      <div className="st-hero-overlay-v" />
    </div>
  );
}
