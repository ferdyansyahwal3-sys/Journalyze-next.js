'use client';

import { useState, useEffect, useCallback } from 'react';

export type AiProvider = 'gemini' | 'claude';
export type ApiKeyStatus = 'none' | 'ok' | 'error';

const LS_PROVIDER   = 'jz_ai_provider';
const LS_GEMINI     = 'jz_gemini_key';
const LS_GEMINI_NEWS= 'jz_gemini_news_key';
const LS_ANTHROPIC  = 'jz_anthropic_key';

function readLS(key: string): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(key) || '';
}

export function useApiKey() {
  const [provider,  setProviderState]  = useState<AiProvider>('gemini');
  const [geminiKey,  setGeminiKey]     = useState('');
  const [geminiNewsKey, setGeminiNewsKey] = useState('');
  const [claudeKey,  setClaudeKey]     = useState('');
  const [status,    setStatus]         = useState<ApiKeyStatus>('none');
  const [statusMsg, setStatusMsg]      = useState('API key belum diset — fitur analisis foto belum aktif');
  const [hasAnyKey, setHasAnyKey]      = useState(false);

  // Compute derived status from keys
  const _recomputeStatus = useCallback((prov: AiProvider, gKey: string, cKey: string) => {
    const activeKey = prov === 'gemini' ? gKey : cKey;
    if (activeKey) {
      setStatus('ok');
      setStatusMsg('✅ API key terhubung — fitur analisis foto aktif');
    } else {
      setStatus('none');
      setStatusMsg('API key belum diset — fitur analisis foto belum aktif');
    }
    setHasAnyKey(!!(gKey || cKey));
  }, []);

  // Load from localStorage on mount
  useEffect(() => {
    const prov    = (readLS(LS_PROVIDER) as AiProvider) || 'gemini';
    const gKey    = readLS(LS_GEMINI);
    const gNews   = readLS(LS_GEMINI_NEWS);
    const cKey    = readLS(LS_ANTHROPIC);
    setProviderState(prov);
    setGeminiKey(gKey);
    setGeminiNewsKey(gNews);
    setClaudeKey(cKey);
    _recomputeStatus(prov, gKey, cKey);
  }, [_recomputeStatus]);

  const switchProvider = useCallback((prov: AiProvider) => {
    setProviderState(prov);
    if (typeof window !== 'undefined') localStorage.setItem(LS_PROVIDER, prov);
    const gKey = readLS(LS_GEMINI);
    const cKey = readLS(LS_ANTHROPIC);
    _recomputeStatus(prov, gKey, cKey);
  }, [_recomputeStatus]);

  // Validate input format on the fly (mirrors onAkmInput)
  const validateInput = useCallback((prov: AiProvider, val: string) => {
    if (prov === 'gemini') {
      if (val.startsWith('AIzaSy') || val.startsWith('AQ.')) {
        setStatus('ok');
        setStatusMsg('✅ Format key valid — klik Simpan untuk mengaktifkan');
      } else if (val) {
        setStatus('error');
        setStatusMsg('⚠️ Format tidak dikenali — key Gemini harus dimulai AIzaSy... atau AQ...');
      } else {
        setStatus('none');
        setStatusMsg('API key belum diset — fitur analisis foto belum aktif');
      }
    } else {
      if (val.startsWith('sk-ant') || val.startsWith('sk-')) {
        setStatus('ok');
        setStatusMsg('✅ Format key valid — klik Simpan untuk mengaktifkan');
      } else if (val) {
        setStatus('error');
        setStatusMsg('⚠️ Format tidak dikenali — key harus dimulai sk-ant-api03-...');
      } else {
        setStatus('none');
        setStatusMsg('API key belum diset — fitur analisis foto belum aktif');
      }
    }
  }, []);

  // Save key to localStorage (and optionally Supabase if user is logged in)
  const saveApiKey = useCallback((
    prov: AiProvider,
    keyValue: string,
    newsKeyValue: string,
    onSuccess: () => void,
    onError: (msg: string) => void,
  ) => {
    const key = keyValue.trim();
    if (!key) { onError('Masukkan API key dulu'); return; }

    if (prov === 'gemini') {
      if (!key.startsWith('AIzaSy') && !key.startsWith('AQ.') && key.length < 20) {
        onError('Format key Gemini tidak valid'); return;
      }
      localStorage.setItem(LS_GEMINI, key);
      setGeminiKey(key);
      const nk = newsKeyValue.trim();
      if (nk) {
        localStorage.setItem(LS_GEMINI_NEWS, nk);
        setGeminiNewsKey(nk);
      } else {
        localStorage.removeItem(LS_GEMINI_NEWS);
        setGeminiNewsKey('');
      }
    } else {
      if (!key.startsWith('sk-') && key.length < 20) {
        onError('Format key Claude tidak valid'); return;
      }
      localStorage.setItem(LS_ANTHROPIC, key);
      setClaudeKey(key);
    }
    localStorage.setItem(LS_PROVIDER, prov);
    setProviderState(prov);
    _recomputeStatus(prov, prov === 'gemini' ? key : readLS(LS_GEMINI), prov === 'claude' ? key : readLS(LS_ANTHROPIC));
    onSuccess();
  }, [_recomputeStatus]);

  const deleteApiKey = useCallback((
    prov: AiProvider,
    onSuccess: () => void,
  ) => {
    if (prov === 'gemini') {
      localStorage.removeItem(LS_GEMINI);
      localStorage.removeItem(LS_GEMINI_NEWS);
      setGeminiKey('');
      setGeminiNewsKey('');
    } else {
      localStorage.removeItem(LS_ANTHROPIC);
      setClaudeKey('');
    }
    const remaining = prov === 'gemini' ? readLS(LS_ANTHROPIC) : readLS(LS_GEMINI);
    setHasAnyKey(!!remaining);
    setStatus('none');
    setStatusMsg('API key belum diset — fitur analisis foto belum aktif');
    onSuccess();
  }, []);

  return {
    provider,
    geminiKey,
    geminiNewsKey,
    claudeKey,
    status,
    statusMsg,
    hasAnyKey,
    switchProvider,
    validateInput,
    saveApiKey,
    deleteApiKey,
  };
}