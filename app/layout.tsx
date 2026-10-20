// app/layout.tsx — root layout (WAJIB ada, satu-satunya tempat <html>/<body suppressHydrationWarning>)
import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import PixelTracker from '@/components/PixelTracker'
import AffiliateTracker from '@/components/AffiliateTracker';
import './globals.css';

export const metadata: Metadata = {
  title: 'Journalyze',
  description: 'Jurnal trading profesional dengan analisis AI',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Journalyze',
  },
};

// Next.js 14: themeColor & viewportFit wajib di viewport export
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',   // WAJIB biar env(safe-area-inset-*) dapat nilai nyata di iOS
  themeColor: '#C9A84C',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#C9A84C" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Journalyze" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />

        {/*
          ===== PWA SAFE AREA — global CSS =====
          Di-inject langsung di <head> karena globals.css belum ada.
          Kalau nanti kamu buat globals.css, pindahkan blok ini ke sana
          dan hapus tag <style> ini.
        */}
      </head>

      <body suppressHydrationWarning>
        {children}
        <PixelTracker />
        <AffiliateTracker />

        {/* Service Worker Registration */}
        <Script
          id="sw-register"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js', { scope: '/' })
                    .then(function(reg) {
                      console.log('[SW] Registered — scope:', reg.scope);
                      reg.addEventListener('updatefound', function() {
                        var nw = reg.installing;
                        if (nw) {
                          nw.addEventListener('statechange', function() {
                            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
                              nw.postMessage('SKIP_WAITING');
                            }
                          });
                        }
                      });
                    })
                    .catch(function(err) { console.warn('[SW] Gagal:', err); });

                  var refreshing = false;
                  navigator.serviceWorker.addEventListener('controllerchange', function() {
                    if (!refreshing) { refreshing = true; window.location.reload(); }
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}