/**
 * app/live/page.tsx
 * Phase 10 — /live route entry point (Server Component)
 *
 * Pola sama dengan (journal)/page.tsx:
 *   page.tsx (server, default) → <LiveApp /> (client, 'use client')
 *
 * useSearchParams() wajib dibungkus <Suspense> di Next.js 14 App Router.
 * Dynamic import dengan ssr:false supaya tidak ada hydration mismatch
 * dari localStorage (theme) dan searchParams.
 */

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { LiveLoadingSkeleton } from '../../components/live/LiveLoadingSkeleton';

const LiveApp = dynamic(
  () => import('../../components/live/LiveApp'),
  {
    ssr: false,
    loading: () => <LiveLoadingSkeleton />,
  }
);

export default function LivePage() {
  return (
    <Suspense fallback={<LiveLoadingSkeleton />}>
      <LiveApp />
    </Suspense>
  );
}