// hooks/usePlan.ts
'use client';

import { useJournalStore } from '@/store/useJournalStore';

export function usePlan() {
  const userPlan = useJournalStore((s) => s.userPlan);

  return {
    userPlan,
    isFree:    userPlan === 'free',
    isBasic:   userPlan === 'basic',
    isPro:     userPlan === 'pro' || userPlan === 'elite',
    isElite:   userPlan === 'elite',
    isPremium: userPlan !== 'free',

    // Fitur yang dikunci untuk Free & Basic — tersedia mulai Pro/Elite
    canFilter:    userPlan !== 'free' && userPlan !== 'basic',
    canMonthly:   userPlan !== 'free' && userPlan !== 'basic',
    canAI:        userPlan !== 'free' && userPlan !== 'basic',
    canPhotoMT5:  userPlan !== 'free' && userPlan !== 'basic',
    canShare:     userPlan !== 'free' && userPlan !== 'basic',
    canExport:    userPlan !== 'free' && userPlan !== 'basic',
    canLive:      userPlan !== 'free' && userPlan !== 'basic',
  };
}
