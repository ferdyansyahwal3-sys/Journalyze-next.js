// app/delivery/page.tsx
// Suspense wajib di App Router untuk komponen yang pakai useSearchParams(),
// supaya /delivery tidak bikin seluruh app jadi fully client-rendered.
import { Suspense } from 'react';
import DeliveryPage from '@/components/delivery/DeliveryPage';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <DeliveryPage />
    </Suspense>
  );
}
