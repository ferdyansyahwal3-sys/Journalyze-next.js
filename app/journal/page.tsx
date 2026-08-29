// app/(journal)/page.tsx
// Route group (journal) tidak menambah segment URL, jadi ini tetap
// nyambung ke "/" — GANTIKAN app/page.tsx placeholder yang lama.
import JournalApp from '@/components/journal/JournalApp';

export default function Page() {
  return <JournalApp />;
}