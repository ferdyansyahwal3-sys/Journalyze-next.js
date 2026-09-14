#!/bin/bash
# Patch PageProfile.tsx — tambah isBasic, isFree, dan detail fitur per plan
# Jalankan dari root project journalyze-nextjs

FILE="components/journal/PageProfile.tsx"

# 1. Tambah isBasic dan isFree setelah baris isPro
sed -i '' 's/  const isPro      = subscription?.plan !== '"'"'Free'"'"' \&\& subscription?.plan != null;/  const isPro      = subscription?.plan !== '"'"'Free'"'"' \&\& subscription?.plan != null;\n  const isBasic    = subscription?.plan === '"'"'Basic'"'"';\n  const isFree     = !subscription || subscription.plan === '"'"'Free'"'"';/' "$FILE"

echo "✅ Step 1 — isBasic \& isFree ditambah"
grep -n "isPro\|isBasic\|isFree" "$FILE" | head -5

# 2. Ganti block fitur yang lama (hanya muncul kalau isPro) dengan versi baru per-plan
# Cari dan replace block isPro features
OLD='{isPro && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '"'"'1px solid var(--border)'"'"', display: '"'"'flex'"'"', flexWrap: '"'"'wrap'"'"', gap: 8 }}>
                {['"'"'✅ Akses Lifetime'"'"', '"'"'✅ Semua Fitur'"'"', '"'"'✅ 2 E-Book Premium'"'"', '"'"'✅ Komunitas Trader'"'"', '"'"'✅ Support WA'"'"'].map(f => (
                  <span key={f} className="chip chip-gold" style={{ fontSize: 9 }}>{f}</span>
                ))}
              </div>
            )}'

NEW='<div style={{ marginTop: 16, paddingTop: 14, borderTop: '"'"'1px solid var(--border)'"'"' }}>
                {/* FREE */}
                {isFree && (
                  <div>
                    <div style={{ fontSize: 10, color: '"'"'var(--text3)'"'"', marginBottom: 8, fontWeight: 600, letterSpacing: 1, textTransform: '"'"'uppercase'"'"' }}>Yang kamu dapat sekarang</div>
                    <div style={{ display: '"'"'flex'"'"', flexWrap: '"'"'wrap'"'"', gap: 6 }}>
                      {['"'"'✅ Catat trade manual'"'"', '"'"'✅ Rekap mingguan'"'"', '"'"'✅ Statistik dasar'"'"', '"'"'✅ Risk kalkulator'"'"'].map(f => (
                        <span key={f} className="chip chip-blue" style={{ fontSize: 9 }}>{f}</span>
                      ))}
                    </div>
                    <div style={{ fontSize: 10, color: '"'"'var(--text3)'"'"', marginBottom: 8, marginTop: 12, fontWeight: 600, letterSpacing: 1, textTransform: '"'"'uppercase'"'"' }}>Tersedia di Basic & atas</div>
                    <div style={{ display: '"'"'flex'"'"', flexWrap: '"'"'wrap'"'"', gap: 6 }}>
                      {['"'"'🔒 Simpan data permanen'"'"', '"'"'🔒 Rekap bulanan'"'"', '"'"'🔒 Filter lanjutan'"'"', '"'"'🔒 Export data'"'"', '"'"'🔒 AI analisis'"'"', '"'"'🔒 Foto MT5'"'"', '"'"'🔒 Share live'"'"'].map(f => (
                        <span key={f} className="chip" style={{ fontSize: 9, opacity: 0.5 }}>{f}</span>
                      ))}
                    </div>
                  </div>
                )}
                {/* BASIC */}
                {isBasic && (
                  <div>
                    <div style={{ fontSize: 10, color: '"'"'var(--text3)'"'"', marginBottom: 8, fontWeight: 600, letterSpacing: 1, textTransform: '"'"'uppercase'"'"' }}>Yang kamu dapat</div>
                    <div style={{ display: '"'"'flex'"'"', flexWrap: '"'"'wrap'"'"', gap: 6 }}>
                      {['"'"'✅ Simpan data permanen'"'"', '"'"'✅ Catat trade manual'"'"', '"'"'✅ Rekap mingguan'"'"', '"'"'✅ Statistik dasar'"'"', '"'"'✅ Risk kalkulator'"'"'].map(f => (
                        <span key={f} className="chip chip-blue" style={{ fontSize: 9 }}>{f}</span>
                      ))}
                    </div>
                    <div style={{ fontSize: 10, color: '"'"'var(--text3)'"'"', marginBottom: 8, marginTop: 12, fontWeight: 600, letterSpacing: 1, textTransform: '"'"'uppercase'"'"' }}>Upgrade ke Pro untuk</div>
                    <div style={{ display: '"'"'flex'"'"', flexWrap: '"'"'wrap'"'"', gap: 6 }}>
                      {['"'"'🔒 Rekap bulanan'"'"', '"'"'🔒 Filter lanjutan'"'"', '"'"'🔒 AI analisis'"'"', '"'"'🔒 Foto MT5'"'"', '"'"'🔒 Share live'"'"', '"'"'🔒 Export data'"'"'].map(f => (
                        <span key={f} className="chip" style={{ fontSize: 9, opacity: 0.5 }}>{f}</span>
                      ))}
                    </div>
                  </div>
                )}
                {/* PRO / ELITE */}
                {isPro && !isBasic && (
                  <div style={{ display: '"'"'flex'"'"', flexWrap: '"'"'wrap'"'"', gap: 6 }}>
                    {['"'"'✅ Semua Fitur'"'"', '"'"'✅ Simpan Permanen'"'"', '"'"'✅ Rekap Bulanan'"'"', '"'"'✅ Filter Lanjutan'"'"', '"'"'✅ AI Analisis'"'"', '"'"'✅ Foto MT5'"'"', '"'"'✅ Share Live'"'"', '"'"'✅ Export Data'"'"', '"'"'✅ 2 E-Book Premium'"'"', '"'"'✅ Support WA'"'"'].map(f => (
                      <span key={f} className="chip chip-gold" style={{ fontSize: 9 }}>{f}</span>
                    ))}
                  </div>
                )}
              </div>'

python3 - "$FILE" "$OLD" "$NEW" << 'PYEOF'
import sys

filepath = sys.argv[1]

with open(filepath, 'r') as f:
    content = f.read()

old = """{isPro && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {['✅ Akses Lifetime', '✅ Semua Fitur', '✅ 2 E-Book Premium', '✅ Komunitas Trader', '✅ Support WA'].map(f => (
                  <span key={f} className="chip chip-gold" style={{ fontSize: 9 }}>{f}</span>
                ))}
              </div>
            )}"""

new = """<div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                {/* FREE */}
                {isFree && (
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 8, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>Yang kamu dapat sekarang</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {['✅ Catat trade manual', '✅ Rekap mingguan', '✅ Statistik dasar', '✅ Risk kalkulator'].map(f => (
                        <span key={f} className="chip chip-blue" style={{ fontSize: 9 }}>{f}</span>
                      ))}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 8, marginTop: 12, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>Tersedia di Basic ke atas</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {['🔒 Simpan data permanen', '🔒 Rekap bulanan', '🔒 Filter lanjutan', '🔒 Export data', '🔒 AI analisis', '🔒 Foto MT5', '🔒 Share live'].map(f => (
                        <span key={f} className="chip" style={{ fontSize: 9, opacity: 0.5 }}>{f}</span>
                      ))}
                    </div>
                  </div>
                )}
                {/* BASIC */}
                {isBasic && (
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 8, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>Yang kamu dapat</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {['✅ Simpan data permanen', '✅ Catat trade manual', '✅ Rekap mingguan', '✅ Statistik dasar', '✅ Risk kalkulator'].map(f => (
                        <span key={f} className="chip chip-blue" style={{ fontSize: 9 }}>{f}</span>
                      ))}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 8, marginTop: 12, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>Upgrade ke Pro untuk</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {['🔒 Rekap bulanan', '🔒 Filter lanjutan', '🔒 AI analisis', '🔒 Foto MT5', '🔒 Share live', '🔒 Export data'].map(f => (
                        <span key={f} className="chip" style={{ fontSize: 9, opacity: 0.5 }}>{f}</span>
                      ))}
                    </div>
                  </div>
                )}
                {/* PRO / ELITE */}
                {isPro && !isBasic && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {['✅ Semua Fitur', '✅ Simpan Permanen', '✅ Rekap Bulanan', '✅ Filter Lanjutan', '✅ AI Analisis', '✅ Foto MT5', '✅ Share Live', '✅ Export Data', '✅ 2 E-Book Premium', '✅ Support WA'].map(f => (
                      <span key={f} className="chip chip-gold" style={{ fontSize: 9 }}>{f}</span>
                    ))}
                  </div>
                )}
              </div>"""

if old in content:
    content = content.replace(old, new)
    with open(filepath, 'w') as f:
        f.write(content)
    print("✅ Step 2 — Fitur per plan berhasil di-patch!")
else:
    print("❌ String lama tidak ditemukan — cek manual baris 437-444")
PYEOF
