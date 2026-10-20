import { SITE, PLANS, waUrl } from './siteData';
import {
  InstagramLogo,
  WhatsappLogo,
  EnvelopeSimple,
} from '@phosphor-icons/react/dist/ssr';

const year = new Date().getFullYear();

const COL_PRODUK = [
  { label: 'Fitur',      href: '/fitur'      },
  { label: 'Cara Kerja', href: '/cara-kerja' },
  { label: 'Harga',      href: '/harga'      },
  { label: 'Demo Gratis',href: '/demo'       },
];

const COL_PERUSAHAAN = [
  { label: 'Tentang',    href: '/tentang' },
  { label: 'Blog',       href: '/blog'    },
  { label: 'Kontak',     href: '/kontak'  },
  { label: 'FAQ',        href: '/faq'     },
];

const COL_LEGAL = [
  { label: 'Syarat & Ketentuan',  href: '/syarat-ketentuan'  },
  { label: 'Kebijakan Privasi',   href: '/kebijakan-privasi' },
  { label: 'Disclaimer Risiko',   href: '/disclaimer-risiko' },
];

// Harga Pro untuk tombol CTA
const proPlan = PLANS.find(p => p.key === 'pro')!;

export default function SiteFooter() {
  return (
    <footer className="st-footer" aria-labelledby="st-footer-heading">
      <span id="st-footer-heading" className="st-visually-hidden">Footer</span>

      {/* Watermark */}
      <div className="st-footer-watermark" aria-hidden="true">JOURNALYZE</div>

      {/* CTA penutup */}
      <div className="st-footer-cta">
        <p className="st-label" style={{ marginBottom: 20 }}>Mulai Hari Ini</p>
        <h2 className="st-footer-cta-title">
          Mulai catat dengan<br />
          lebih <em>cerdas</em> hari ini.
        </h2>
        <a
          href={`/order?paket=${proPlan.key}`}
          className="st-btn st-btn-gold"
          style={{ marginTop: 32 }}
        >
          Dapatkan Akses — Rp {proPlan.price}
        </a>
      </div>

      {/* Body footer */}
      <div className="st-footer-body">
        <div className="st-footer-grid">
          {/* Brand */}
          <div>
            <div className="st-footer-brand-name">
              <span style={{ color: 'var(--text)' }}>Journal</span>
              <em style={{ color: 'var(--gold2)' }}>yze</em>
            </div>
            <p className="st-footer-tagline">{SITE.tagline}</p>

            {/* Sosial */}
            <div className="st-footer-social" role="list">
              {SITE.whatsapp && (
                <a
                  href={waUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="st-footer-social-link"
                  aria-label="WhatsApp Journalyze"
                  role="listitem"
                >
                  <WhatsappLogo size={16} weight="fill" />
                </a>
              )}
              {SITE.instagram && (
                <a
                  href={`https://instagram.com/${SITE.instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="st-footer-social-link"
                  aria-label={`Instagram @${SITE.instagram}`}
                  role="listitem"
                >
                  <InstagramLogo size={16} weight="fill" />
                </a>
              )}
              {SITE.email && (
                <a
                  href={`mailto:${SITE.email}`}
                  className="st-footer-social-link"
                  aria-label={`Email ${SITE.email}`}
                  role="listitem"
                >
                  <EnvelopeSimple size={16} weight="fill" />
                </a>
              )}
            </div>
          </div>

          {/* Produk */}
          <div>
            <p className="st-footer-col-title">Produk</p>
            <ul className="st-footer-links" role="list">
              {COL_PRODUK.map(l => (
                <li key={l.href}>
                  <a href={l.href}>{l.label}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Perusahaan */}
          <div>
            <p className="st-footer-col-title">Perusahaan</p>
            <ul className="st-footer-links" role="list">
              {COL_PERUSAHAAN.map(l => (
                <li key={l.href}>
                  <a href={l.href}>{l.label}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <p className="st-footer-col-title">Legal</p>
            <ul className="st-footer-links" role="list">
              {COL_LEGAL.map(l => (
                <li key={l.href}>
                  <a href={l.href}>{l.label}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="st-footer-bottom">
          <p className="st-footer-copy">
            © {year} {SITE.name}. All rights reserved.
          </p>
          <p className="st-footer-disclaimer">
            Trading forex dan produk derivatif berisiko tinggi dan tidak cocok untuk semua orang.
            Journalyze adalah alat pencatatan dan analisis — bukan nasihat keuangan dan tidak menjamin hasil trading.
          </p>
        </div>
      </div>
    </footer>
  );
}
