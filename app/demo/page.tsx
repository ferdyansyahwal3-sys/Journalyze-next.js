/**
 * app/demo/page.tsx
 * Route /demo — full journal experience, no auth, no cloud save
 * Data hanya di localStorage, tidak sync ke Supabase
 */
import DemoApp from '@/components/demo/DemoApp';

export default function DemoPage() {
  return <DemoApp />;
}