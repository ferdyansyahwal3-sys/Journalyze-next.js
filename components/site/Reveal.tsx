'use client';

import { useEffect, useRef, type ReactNode, type CSSProperties, type ElementType } from 'react';

interface RevealProps {
  children:  ReactNode;
  /** Delay stagger: 1–4 */
  delay?:    1 | 2 | 3 | 4;
  className?: string;
  style?:    CSSProperties;
  as?:       ElementType;
  threshold?: number;
}

/**
 * Reveal — fade + naik 24px saat masuk viewport.
 * Memakai class .st-reveal / .st-in agar tidak bentrok
 * dengan .reveal / .visible di home.css.
 * prefers-reduced-motion diatasi di CSS (opacity:1, transform:none).
 */
export default function Reveal({
  children,
  delay,
  className = '',
  style,
  as: Tag = 'div',
  threshold = 0.12,
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('st-in');
          io.unobserve(el);
        }
      },
      { threshold }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  const delayClass = delay ? ` st-reveal-d${delay}` : '';

  return (
    <Tag
      ref={ref}
      className={`st-reveal${delayClass}${className ? ` ${className}` : ''}`}
      style={style}
    >
      {children}
    </Tag>
  );
}
