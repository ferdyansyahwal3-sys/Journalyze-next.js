'use client'
// hooks/useShareLive.ts
// State management untuk fitur Share Live — generate, reaktifkan, nonaktifkan

import { useState, useEffect, useCallback } from 'react'
import { _sb as supabase } from '@/lib/supabaseClient'
import { generateToken, buildShareUrl, type ShareRecord } from '@/lib/shareToken'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ShareStatus = 'idle' | 'loading' | 'active' | 'inactive' | 'error'

export interface UseShareLiveReturn {
  share:      ShareRecord | null
  status:     ShareStatus
  shareUrl:   string | null
  activate:   () => Promise<void>
  deactivate: () => Promise<void>
  copyUrl:    () => Promise<boolean>   // return true jika berhasil
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useShareLive(): UseShareLiveReturn {
  

  const [share,  setShare]  = useState<ShareRecord | null>(null)
  const [status, setStatus] = useState<ShareStatus>('loading')

  // ── Load share milik user yang sedang login ──────────────────────────────

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setStatus('idle'); return }

      const { data, error } = await supabase
        .from('live_shares')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (cancelled) return

      if (error) {
        setStatus('error')
        return
      }

      if (!data) {
        setStatus('idle')
        return
      }

      setShare(data as ShareRecord)
      setStatus(data.is_active ? 'active' : 'inactive')
    }

    load()
    return () => { cancelled = true }
  }, [])

  // ── Aktifkan share (buat baru atau reaktifkan yang sudah ada) ────────────

  const activate = useCallback(async () => {
    setStatus('loading')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setStatus('error'); return }

    let result: ShareRecord | null = null

    if (share) {
      // Reaktifkan record yang sudah ada
      const { data, error } = await supabase
        .from('live_shares')
        .update({ is_active: true })
        .eq('id', share.id)
        .select()
        .single()

      if (error) { setStatus('error'); return }
      result = data as ShareRecord
    } else {
      // Buat record baru dengan token random
      const token = generateToken()
      const { data, error } = await supabase
        .from('live_shares')
        .insert({
          user_id:   user.id,
          token,
          is_active: true,
        })
        .select()
        .single()

      if (error) { setStatus('error'); return }
      result = data as ShareRecord
    }

    setShare(result)
    setStatus('active')
  }, [share])

  // ── Nonaktifkan share ────────────────────────────────────────────────────

  const deactivate = useCallback(async () => {
    if (!share) return
    setStatus('loading')

    const { error } = await supabase
      .from('live_shares')
      .update({ is_active: false })
      .eq('id', share.id)

    if (error) { setStatus('error'); return }

    setShare(prev => prev ? { ...prev, is_active: false } : null)
    setStatus('inactive')
  }, [share])

  // ── Copy URL ke clipboard ────────────────────────────────────────────────

  const copyUrl = useCallback(async (): Promise<boolean> => {
    if (!share?.token) return false
    try {
      await navigator.clipboard.writeText(buildShareUrl(share.token))
      return true
    } catch {
      return false
    }
  }, [share])

  // ── Derived values ────────────────────────────────────────────────────────

  const shareUrl = share?.token ? buildShareUrl(share.token) : null

  return { share, status, shareUrl, activate, deactivate, copyUrl }
}