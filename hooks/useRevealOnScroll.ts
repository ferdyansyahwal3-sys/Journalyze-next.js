// hooks/useRevealOnScroll.ts
// Dipindah dari delivery.html baris 402-407.
// Attach ke elemen manapun yang punya class="reveal" — sama seperti
// aslinya (IntersectionObserver, unobserve setelah kelihatan sekali).
// Reusable untuk halaman lain yang butuh animasi sama (index.html juga
// pakai pola reveal serupa di beberapa tempat).
'use client';

import { useEffect } from 'react';

export function useRevealOnScroll(deps: React.DependencyList = []) {
  useEffect(() => {
    const revealEls = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('on');
            observer.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    revealEls.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
