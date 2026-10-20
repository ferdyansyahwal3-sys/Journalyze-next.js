'use client';

import { useEffect, useRef, useState } from 'react';

interface VideoBackgroundProps {
  src:     string;
  poster:  string;
  overlay?: boolean;
  children?: React.ReactNode;
}

/** True jika user prefer reduced motion */
function preferReducedMotion() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** True jika koneksi data-saver aktif */
function isSaveData() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return !!(navigator as any).connection?.saveData;
}

const MOBILE_VIDEO = typeof window !== 'undefined' && window.innerWidth <= 640;

export default function VideoBackground({
  src,
  poster,
  overlay = true,
  children,
}: VideoBackgroundProps) {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [usePoster, setUsePoster] = useState(false);

  const isPlaceholder = !src || src.includes('<CLOUD_NAME>');

  useEffect(() => {
    if (isPlaceholder || MOBILE_VIDEO || preferReducedMotion() || isSaveData()) {
      setUsePoster(true);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    // Fade-in saat canplay
    const onCanPlay = () => {
      setReady(true);
      video.play().catch(() => setUsePoster(true));
    };
    const onError = () => setUsePoster(true);

    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('error',   onError);

    // Pause saat tab tidak aktif
    const onVisibility = () => {
      if (document.hidden) video.pause();
      else video.play().catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisibility);

    // Pause saat keluar viewport
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.1 }
    );
    io.observe(video);

    return () => {
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('error',   onError);
      document.removeEventListener('visibilitychange', onVisibility);
      io.disconnect();
    };
  }, [isPlaceholder]);

  return (
    <div className="st-videobg" aria-hidden="true">
      {/* Video atau fallback poster */}
      {!usePoster && !isPlaceholder ? (
        <video
          ref={videoRef}
          className={`st-videobg-video${ready ? ' st-videobg-video--ready' : ''}`}
          src={src}
          poster={poster || undefined}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        />
      ) : (
        /* Fallback: gradien gold jika poster kosong */
        poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster}
            alt=""
            className="st-videobg-poster"
          />
        ) : (
          <div className="st-videobg-fallback" />
        )
      )}

      {/* Overlay gelap untuk keterbacaan */}
      {overlay && <div className="st-videobg-overlay" />}

      {/* Konten di atas video */}
      {children && (
        <div className="st-videobg-content">{children}</div>
      )}
    </div>
  );
}
