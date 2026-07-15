// components/delivery/StepCard.tsx
// Dipindah dari delivery.html baris 232-283 — 3 step-card yang polanya
// sama (nomor, badge, judul, desc, note, tombol) disatukan jadi 1
// komponen reusable dengan props, bukan copy-paste markup 3x.
export default function StepCard({
  num,
  badgeClass,
  badgeLabel,
  title,
  desc,
  note,
  href,
  btnClass,
  btnIcon,
  btnLabel,
}: {
  num: number;
  badgeClass: string;
  badgeLabel: string;
  title: string;
  desc: string;
  note: string;
  href: string;
  btnClass: string;
  btnIcon: string;
  btnLabel: string;
}) {
  return (
    <div className="step-card">
      <div className="step-num">{num}</div>
      <div className="step-body">
        <span className={`step-badge ${badgeClass}`}>{badgeLabel}</span>
        <div className="step-title">{title}</div>
        <div className="step-desc">{desc}</div>
        <div className="step-note">
          <strong>⚠️ PENTING:</strong> {note}
        </div>
      </div>
      <div className="step-action">
        <a href={href} target="_blank" rel="noreferrer" className={`access-btn ${btnClass}`}>
          <span className="btn-icon">{btnIcon}</span>
          {btnLabel}
          <span className="btn-arr">→</span>
        </a>
      </div>
    </div>
  );
}
