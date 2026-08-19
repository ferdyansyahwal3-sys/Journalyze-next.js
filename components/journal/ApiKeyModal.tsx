'use client';

import { useState, useCallback, useEffect } from 'react';
import { useApiKey, AiProvider } from '@/hooks/useApiKey';

interface ApiKeyModalProps {
  isOpen:  boolean;
  onClose: () => void;
  onSaved: (hasKey: boolean) => void;
  onToast: (msg: string, type: 'success' | 'error') => void;
}

export default function ApiKeyModal({ isOpen, onClose, onSaved, onToast }: ApiKeyModalProps) {
  const {
    provider, geminiKey, geminiNewsKey, claudeKey,
    status, statusMsg,
    switchProvider, validateInput, saveApiKey, deleteApiKey,
  } = useApiKey();

  const [inputGemini,     setInputGemini]     = useState('');
  const [inputGeminiNews, setInputGeminiNews] = useState('');
  const [inputClaude,     setInputClaude]     = useState('');
  const [visGemini,       setVisGemini]       = useState(false);
  const [visGeminiNews,   setVisGeminiNews]   = useState(false);
  const [visClaude,       setVisClaude]       = useState(false);

  useEffect(() => {
    if (isOpen) {
      setInputGemini(localStorage.getItem('jz_gemini_key') || '');
      setInputGeminiNews(localStorage.getItem('jz_gemini_news_key') || '');
      setInputClaude(localStorage.getItem('jz_anthropic_key') || '');
    }
  }, [isOpen]);



  const activeKey = provider === 'gemini' ? inputGemini : inputClaude;
  const showDel = !!activeKey;

  const handleSwitchTab = useCallback((prov: AiProvider) => switchProvider(prov), [switchProvider]);

  const handleInput = useCallback((prov: AiProvider | 'gemini-news', val: string) => {
    if (prov === 'gemini') setInputGemini(val);
    else if (prov === 'gemini-news') setInputGeminiNews(val);
    else setInputClaude(val);
    if (prov !== 'gemini-news') validateInput(prov as AiProvider, val);
  }, [validateInput]);

  const handleSave = useCallback(() => {
    const keyVal = provider === 'gemini' ? inputGemini : inputClaude;
    saveApiKey(provider, keyVal, inputGeminiNews,
      () => { onSaved(true); onToast('API key tersimpan 🎉', 'success'); onClose(); },
      (msg) => onToast(msg, 'error'),
    );
  }, [provider, inputGemini, inputGeminiNews, inputClaude, saveApiKey, onSaved, onToast, onClose]);

  const handleDelete = useCallback(() => {
    const label = provider === 'gemini' ? 'Gemini' : 'Claude';
    if (!confirm('Hapus ' + label + ' API key?')) return;
    deleteApiKey(provider, () => { onSaved(false); onToast(label + ' API key dihapus', 'success'); onClose(); });
  }, [provider, deleteApiKey, onSaved, onToast, onClose]);

  const handleOverlayClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  const statusClass = status === 'ok' ? 's-ok' : status === 'error' ? 's-err' : 's-none';

  return (
    <div className={`apikey-overlay${isOpen ? ' open' : ''}`} onClick={handleOverlayClick}>
      <div className="apikey-modal">
        <div className="akm-head">
          <div>
            <div className="akm-label">⚙ Pengaturan AI</div>
            <div className="akm-title">Koneksi <em>Analisis Foto</em></div>
            <div className="akm-sub">Pilih provider AI & masukkan API key untuk aktifkan pembaca foto MT4/MT5</div>
          </div>
          <button className="btn-x" onClick={onClose}>✕</button>
        </div>
        <div className="akm-body">
          <div className={`akm-status ${statusClass}`}>
            <span className="akm-sdot"></span>
            <span>{statusMsg}</span>
          </div>
          <div className="akm-tabs">
            <button className={`akm-tab${provider === 'gemini' ? ' active' : ''}`} onClick={() => handleSwitchTab('gemini')}>
              🔵 Gemini <span style={{fontSize:'10px',opacity:.6}}>(Gratis)</span>
            </button>
            <button className={`akm-tab${provider === 'claude' ? ' active' : ''}`} onClick={() => handleSwitchTab('claude')}>
              🟡 Claude <span style={{fontSize:'10px',opacity:.6}}>(~Rp15/foto)</span>
            </button>
          </div>

          <div className={`akm-tab-pane${provider === 'gemini' ? ' active' : ''}`}>
            <div className="akm-provider-badge badge-gemini">Google AI Studio — Gemini</div>
            <div className="akm-field-lbl">🔑 Gemini API Key</div>
            <div className="akm-input-wrap">
              <input className="akm-input" type={visGemini ? 'text' : 'password'} placeholder="AIzaSy... atau AQ...." autoComplete="off" value={inputGemini} onChange={e => handleInput('gemini', e.target.value)} />
              <button className="akm-vis" onClick={() => setVisGemini(v => !v)}>👁</button>
            </div>
            <div className="akm-hint">💡 <strong>Gratis</strong> — limit 1.500 request/hari. Daftar di <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a></div>
            <div className="akm-steps">
              <div className="akm-steps-lbl">Cara dapat Gemini API key</div>
              <div className="akm-step"><div className="akm-snum">1</div><div className="akm-stxt">Buka <strong>aistudio.google.com/apikey</strong> → login Google</div></div>
              <div className="akm-step"><div className="akm-snum">2</div><div className="akm-stxt">Klik <strong>Create API Key</strong> → pilih project</div></div>
              <div className="akm-step"><div className="akm-snum">3</div><div className="akm-stxt">Copy key (format: <code>AIzaSy...</code> atau <code>AQ....</code>)</div></div>
              <div className="akm-step"><div className="akm-snum">4</div><div className="akm-stxt">Paste di kolom atas → klik <strong>Simpan & Aktifkan</strong> ✅</div></div>
            </div>
            <div style={{marginTop:'14px',paddingTop:'14px',borderTop:'1px solid var(--border)'}}>
              <div className="akm-field-lbl">🗞️ Gemini API Key Khusus Berita <span style={{fontSize:'9px',padding:'2px 7px',borderRadius:'4px',background:'var(--bg4)',color:'var(--text3)'}}>OPSIONAL</span></div>
              <div className="akm-input-wrap">
                <input className="akm-input" type={visGeminiNews ? 'text' : 'password'} placeholder="Kosongkan = pakai key yang sama" autoComplete="off" value={inputGeminiNews} onChange={e => handleInput('gemini-news', e.target.value)} />
                <button className="akm-vis" onClick={() => setVisGeminiNews(v => !v)}>👁</button>
              </div>
              <div className="akm-hint" style={{marginTop:'6px'}}>💡 <strong>Saran hemat quota:</strong> Buat key ke-2 dari akun Google berbeda → paste di sini.</div>
            </div>
          </div>

          <div className={`akm-tab-pane${provider === 'claude' ? ' active' : ''}`}>
            <div className="akm-provider-badge badge-claude">Anthropic — Claude</div>
            <div className="akm-field-lbl">🔑 Anthropic API Key</div>
            <div className="akm-input-wrap">
              <input className="akm-input" type={visClaude ? 'text' : 'password'} placeholder="sk-ant-api03-..." autoComplete="off" value={inputClaude} onChange={e => handleInput('claude', e.target.value)} />
              <button className="akm-vis" onClick={() => setVisClaude(v => !v)}>👁</button>
            </div>
            <div className="akm-hint">💡 Berbayar ~<strong>Rp 15/foto</strong>. Daftar di <a href="https://console.anthropic.com" target="_blank" rel="noopener">console.anthropic.com</a></div>
            <div className="akm-steps">
              <div className="akm-steps-lbl">Cara dapat Claude API key</div>
              <div className="akm-step"><div className="akm-snum">1</div><div className="akm-stxt">Buka <strong>console.anthropic.com</strong> → daftar akun</div></div>
              <div className="akm-step"><div className="akm-snum">2</div><div className="akm-stxt">Klik menu <strong>API Keys</strong> → klik <strong>Create Key</strong></div></div>
              <div className="akm-step"><div className="akm-snum">3</div><div className="akm-stxt">Copy key (format: <code>sk-ant-api03-...</code>)</div></div>
              <div className="akm-step"><div className="akm-snum">4</div><div className="akm-stxt">Paste di kolom atas → klik <strong>Simpan & Aktifkan</strong> ✅</div></div>
            </div>
          </div>

          <div className="akm-actions">
            <button className="akm-cancel" onClick={onClose}>Batal</button>
            {showDel && <button className="akm-del" onClick={handleDelete}>🗑 Hapus</button>}
            <button className="akm-save" onClick={handleSave}>Simpan & Aktifkan</button>
          </div>
        </div>
      </div>
    </div>
  );
}
