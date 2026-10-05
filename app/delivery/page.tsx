// app/delivery/page.tsx
// Server Component — decode token + query license_keys di server.
// DeliveryPage hanya render, tidak pegang logic validasi.
import { createClient } from '@supabase/supabase-js';
import DeliveryPage from '@/components/delivery/DeliveryPage';

const DELIVERY_SECRET = process.env.NEXT_PUBLIC_DELIVERY_SECRET || 'JZ2025';

function decodeTokenServer(token: string): { key: string; name: string } | null {
  try {
    const decoded = atob(decodeURIComponent(token));
    const parts = decoded.split('|');
    if (parts.length < 4) return null;
    const [key, name, , salt] = parts;
    if (salt !== DELIVERY_SECRET) return null;
    return { key, name };
  } catch {
    return null;
  }
}

export default async function Page({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token;

  if (!token) {
    return <DeliveryPage status="invalid" />;
  }

  const decoded = decodeTokenServer(token);
  if (!decoded) {
    return <DeliveryPage status="invalid" />;
  }

  const surl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const skey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const sbServer = createClient(surl, skey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await sbServer
    .from('license_keys')
    .select('is_used, is_revoked, customer_name')
    .eq('key', decoded.key)
    .single();

  if (error || !data) {
    return <DeliveryPage status="invalid" />;
  }

  if (data.is_revoked) {
    return <DeliveryPage status="revoked" />;
  }

  if (data.is_used) {
    return (
      <DeliveryPage
        status="used"
        licenseKey={decoded.key}
        customerName={data.customer_name || decoded.name}
      />
    );
  }

  return (
    <DeliveryPage
      status="valid"
      licenseKey={decoded.key}
      customerName={data.customer_name || decoded.name}
    />
  );
}
