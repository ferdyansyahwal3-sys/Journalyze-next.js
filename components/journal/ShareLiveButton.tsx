'use client'
// components/journal/ShareLiveButton.tsx
// Tombol "Share Live" yang muncul di header PageData / PageJournal

import { useState } from 'react'
import { useShareLive } from '@/hooks/useShareLive'
import ShareLiveModal from './ShareLiveModal'

export default function ShareLiveButton() {
  const [open, setOpen] = useState(false)
  const shareState = useShareLive()

  return (
    <>
      <button
        className="btn btn-ghost btn-sm" style={{ borderColor: "var(--gold-bd)", color: "var(--gold2)", fontSize: "11px" }}
        onClick={() => setOpen(true)}
        title="Share halaman Live kamu"
      >
        {/* Dot merah kalau sedang aktif */}
        {shareState.status === 'active' && (
          <span className="share-live-dot" aria-hidden="true" />
        )}
        ⚡ Share Live
      </button>

      {open && (
        <ShareLiveModal
          {...shareState}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}