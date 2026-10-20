'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChartLineUp, TrendUp, Lightning, ChartBar, Bank,
  SmileyXEyes, Brain, ChartLineDown, ClipboardText,
  Plant, Rocket, Fire, NotePencil, Table,
  DeviceMobileCamera, XCircle, Star, Gift,
  Eye, EyeSlash, ArrowLeft, ArrowRight,
  ShieldCheck, Newspaper, CheckCircle,
} from '@phosphor-icons/react';
import { _sb } from '@/lib/supabaseClient';
import { fireEvent, getAffiliateCode } from '@/components/AffiliateTracker';
import './uji-coba.css';

interface Answers { q1:string|null; q2:string|null; q3:string|null; q4:string|null; }
interface Form    { nama:string; email:string; wa:string; pw:string; }
interface Errs    { nama?:string; email?:string; wa?:string; pw?:string; }

const Q1 = [
  { v:'pemula',   icon:TrendUp,   t:'Trader Pemula',           d:'Baru mulai, masih belajar strategi & manajemen risiko' },
  { v:'scalper',  icon:Lightning, t:'Scalper / Day Trader',    d:'Buka-tutup posisi dalam hitungan menit–jam, frekuensi tinggi' },
  { v:'swing',    icon:ChartBar,  t:'Swing Trader',            d:'Hold posisi 1–7 hari, analisa lebih matang' },
  { v:'investor', icon:Bank,      t:'Investor Jangka Panjang', d:'Hold mingguan–bulanan, fokus fundamental' },
];
const Q2 = [
  { v:'tdk-tau',  icon:SmileyXEyes,  t:'Tidak tahu apa yang salah',  d:'Trade sering rugi tapi tidak tahu penyebabnya' },
  { v:'emosi',    icon:Brain,         t:'Susah kontrol emosi',        d:'FOMO, revenge trading, cut loss terlambat' },
  { v:'winrate',  icon:ChartLineDown, t:'Win rate rendah',            d:'Lebih banyak kalah dari menang, strategi belum konsisten' },
  { v:'rekap',    icon:ClipboardText, t:'Tidak punya rekap performa', d:'Tidak tahu equity curve, pair terbaik, atau sesi terkuat' },
];
const Q3 = [
  { v:'rendah', icon:Plant,  t:'1–10 trade/bulan',  d:'Baru mulai atau sangat selektif' },
  { v:'sedang', icon:Rocket, t:'10–50 trade/bulan', d:'Aktif, butuh pencatatan yang rapi' },
  { v:'tinggi', icon:Fire,   t:'50+ trade/bulan',   d:'Volume tinggi, butuh analisis otomatis' },
];
const Q4 = [
  { v:'manual',     icon:NotePencil,         t:'Catat manual di buku/notes',        d:'Tidak ada analisis, susah dilacak' },
  { v:'excel',      icon:Table,              t:'Spreadsheet Excel / Google Sheets', d:'Ada data tapi rumus manual, tidak ada grafik otomatis' },
  { v:'screenshot', icon:DeviceMobileCamera, t:'Screenshot MT4/MT5 aja',            d:'Tidak ada rekap, tidak tahu pola kemenangan' },
  { v:'tidak-ada',  icon:XCircle,            t:'Tidak punya jurnal sama sekali',    d:'Langsung coba lagi tanpa evaluasi' },
];
const FEATS = [
  { k:'plan',   icon:ShieldCheck, t:'Trading Plan Otomatis',    d:'Trading plan dibuat berdasarkan modal, risiko, dan karakter trading kamu.' },
  { k:'mood',   icon:Brain,       t:'Mood & Emosi Tracker',     d:'Catat kondisi psikologis kamu di setiap trade untuk analisis pola.' },
  { k:'import', icon:Table,       t:'Import & Grafik Otomatis', d:'Masukkan data trading dan biarkan Journalyze mengolahnya otomatis.' },
];

/* ── Teks hasil yang menyesuaikan jawaban ── */
// Q2 (masalah terbesar) → headline
const HERO: Record<string,{a:string;b:string}> = {
  'tdk-tau': { a:'Kamu belum tahu kenapa trade kamu sering rugi',  b:'Journalyze bantu menemukan penyebabnya' },
  'emosi':   { a:'Emosi masih ikut menentukan trade kamu',          b:'Journalyze bantu melacak dan mengendalikannya' },
  'winrate': { a:'Win rate kamu belum stabil',                      b:'Journalyze tunjukkan pola menang dan kalahmu' },
  'rekap':   { a:'Performa trading kamu belum terekap rapi',        b:'Journalyze rapikan semuanya otomatis' },
  'default': { a:'Journal trading kamu belum optimal',              b:'ini yang bisa Journalyze perbaiki' },
};
// Q1 (profil) + Q4 (cara mencatat) → sub judul
const PROFIL: Record<string,string> = {
  pemula:'trader pemula', scalper:'scalper & day trader', swing:'swing trader', investor:'investor jangka panjang',
};
const JURNAL: Record<string,string> = {
  'manual':'masih mencatat manual', 'excel':'masih pakai spreadsheet',
  'screenshot':'hanya mengandalkan screenshot', 'tidak-ada':'belum punya jurnal',
};
// Q2 → urutan kartu fitur (yang paling relevan di atas)
const FEAT_ORDER: Record<string,string[]> = {
  'tdk-tau': ['import','mood','plan'],
  'emosi':   ['mood','plan','import'],
  'winrate': ['plan','import','mood'],
  'rekap':   ['import','plan','mood'],
};
const NEWS = [
  { impact:'hi', tag:'usd', title:'Fed Interest Rate Decision — High Impact', time:'Hari ini · 21:00 WIB' },
  { impact:'md', tag:'usd', title:'US Non-Farm Payrolls (NFP)',               time:'Jumat · 20:30 WIB' },
  { impact:'lo', tag:'eur', title:'ECB Press Conference',                     time:'Kemarin · Selesai' },
];
const BARS = [65,80,45,90,70,55,85];

function validate(f:Form): Errs {
  const e:Errs={};
  if(!f.nama.trim()) e.nama='Nama wajib diisi';
  if(!f.email.trim()||!/\S+@\S+\.\S+/.test(f.email)) e.email='Email tidak valid';
  const wa=f.wa.replace(/\D/g,'');
  if(!wa||wa.length<9||wa.length>13) e.wa='Nomor WhatsApp tidak valid';
  if(f.pw.length<8) e.pw='Password minimal 8 karakter';
  return e;
}

function Opt({icon:Icon,t,d,sel,onClick}:{icon:React.ElementType;t:string;d:string;sel:boolean;onClick:()=>void}) {
  return (
    <button className={`qopt${sel?' sel':''}`} onClick={onClick}>
      <span className="qopt-left">
        <span className="qopt-icon"><Icon size={22} weight="duotone"/></span>
        <span className="qopt-text">
          <span className="qopt-title">{t}</span>
          <span className="qopt-desc">{d}</span>
        </span>
      </span>
      <span className="qopt-radio">
        <svg className="qopt-check" fill="none" stroke="currentColor" strokeWidth="2.6" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
        </svg>
      </span>
    </button>
  );
}

export default function UjiCobaPage() {
  const router = useRouter();
  const [step,setStep]      = useState<0|1|2|3|4|5>(0);
  const [ans,setAns]        = useState<Answers>({q1:null,q2:null,q3:null,q4:null});
  const [form,setForm]      = useState<Form>({nama:'',email:'',wa:'',pw:''});
  const [touched,setTouched]= useState<Record<string,boolean>>({});
  const [showPw,setShowPw]  = useState(false);
  const [loading,setLoading]= useState(false);
  const [errMsg,setErrMsg]  = useState<string|null>(null);
  const [mockTab,setMockTab]= useState<'risk'|'news'>('risk');
  const [showForm,setShowForm]= useState(false);

  const allErrs = validate(form);
  const errs:Errs = Object.fromEntries(Object.entries(allErrs).filter(([k])=>touched[k])) as Errs;

  function pick(q:keyof Answers,v:string){
    setAns(p=>({...p,[q]:v}));
  }
  function back(){ if(step>0) setStep(p=>(p-1) as typeof step); }
  const curAns:{[k:number]:string|null}={1:ans.q1,2:ans.q2,3:ans.q3,4:ans.q4};
  const canNext = step>=1&&step<=4 ? curAns[step]!==null : true;

  async function submit(){
    setTouched({nama:true,email:true,wa:true,pw:true});
    if(Object.keys(validate(form)).length>0) return;
    setLoading(true); setErrMsg(null);
    try {
      const waClean=form.wa.replace(/\D/g,'');
      const reg=await fetch('/api/auth/register',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({nama:form.nama.trim(),email:form.email.trim(),password:form.pw,source:'uji-coba'}),
      });
      const rd=await reg.json();
      if(!reg.ok){ setErrMsg(rd.error||'Gagal mendaftar.'); setLoading(false); return; }
      const p=new URLSearchParams(window.location.search);
      await _sb.from('leads').insert({
        nama:form.nama.trim(),email:form.email.trim(),whatsapp:waClean,
        q1_profil:ans.q1,q2_masalah:ans.q2,q3_frekuensi:ans.q3,q4_journal_sekarang:ans.q4,
        source:'quiz-onboarding',utm_source:p.get('utm_source'),utm_medium:p.get('utm_medium'),status:'new',
      });
      // Track registrasi via affiliate
      const affCode = getAffiliateCode();
      if (affCode) {
        fireEvent(affCode, 'checkout_start', 'order');
      }

      const login=await fetch('/api/auth/login',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({email:form.email.trim(),password:form.pw}),
      });
      const ld=await login.json();
      if(ld.session){
        await _sb.auth.setSession({access_token:ld.session.access_token,refresh_token:ld.session.refresh_token});
      }
      router.push('/journal?welcome=trial');
    } catch { setErrMsg('Terjadi kesalahan. Silakan coba lagi.'); setLoading(false); }
  }

  function Prog(){
    if(step===0||step===5) return null;
    return(
      <div className="qprog-wrap">
        <div className="qprog">
          {[1,2,3,4].map(i=>(<div key={i} className={`qprog-seg${step>=i?' on':''}`}/>))}
        </div>
      </div>
    );
  }

  // teks hasil dinamis (berdasarkan jawaban)
  const hero   = HERO[ans.q2 ?? ''] ?? HERO['default'];
  const profil = ans.q1 ? PROFIL[ans.q1] : null;
  const jurnal = ans.q4 ? JURNAL[ans.q4] : null;
  const subTxt = profil ? `buat ${profil}${jurnal?` yang ${jurnal}`:''}` : 'buat kamu';
  const order  = FEAT_ORDER[ans.q2 ?? ''] ?? ['plan','mood','import'];
  const feats  = [...FEATS]
    .sort((x,y)=>order.indexOf(x.k)-order.indexOf(y.k))
    .map(f=> f.k==='import' && ans.q3==='tinggi'
      ? {...f, d:'Volume 50+ trade/bulan? Biarkan Journalyze mengolah datanya otomatis.'}
      : f);

  function qhead(n:number){
    return(
      <div className="qq-head">
        <div className="qq-label">Pertanyaan {n} dari 4</div>
        {n>1&&<button className="qback" onClick={back}><ArrowLeft size={13}/>Kembali</button>}
      </div>
    );
  }

  function renderStep(){
    switch(step){
      case 0: return(
        <div className="qstep qstep-intro" style={{textAlign:'center'}}>
          <div className="qintro-icon"><ChartLineUp size={60} weight="duotone"/></div>
          <h1 className="qintro-h">Jurnal Trading Kamu<br/><em>Selama Ini Efektif?</em></h1>
          <p className="qintro-sub">Jawab 4 pertanyaan singkat. Kami analisis kebiasaan trading kamu dan kasih akses Demo 2 Hari Gratis ke semua fitur Journalyze.</p>
          <div className="qbadges">
            <span className="qbadge">⏱ 1 menit</span>
            <span className="qbadge"><CheckCircle size={12} weight="fill"/> Gratis</span>
            <span className="qbadge"><Star size={12} weight="fill"/> AI-Powered</span>
          </div>
        </div>
      );
      case 1: return(
        <div className="qstep">
          {qhead(1)}
          <h2 className="qq-h">Apa profil trading kamu?</h2>
          <div className="qopts">{Q1.map(o=><Opt key={o.v} icon={o.icon} t={o.t} d={o.d} sel={ans.q1===o.v} onClick={()=>pick('q1',o.v)}/>)}</div>
        </div>
      );
      case 2: return(
        <div className="qstep">
          {qhead(2)}
          <h2 className="qq-h">Apa masalah terbesar kamu saat trading?</h2>
          <div className="qopts">{Q2.map(o=><Opt key={o.v} icon={o.icon} t={o.t} d={o.d} sel={ans.q2===o.v} onClick={()=>pick('q2',o.v)}/>)}</div>
        </div>
      );
      case 3: return(
        <div className="qstep">
          {qhead(3)}
          <h2 className="qq-h">Seberapa sering kamu trading per bulan?</h2>
          <div className="qopts">{Q3.map(o=><Opt key={o.v} icon={o.icon} t={o.t} d={o.d} sel={ans.q3===o.v} onClick={()=>pick('q3',o.v)}/>)}</div>
        </div>
      );
      case 4: return(
        <div className="qstep">
          {qhead(4)}
          <h2 className="qq-h">Sekarang pakai cara apa untuk jurnal trading?</h2>
          <div className="qopts">{Q4.map(o=><Opt key={o.v} icon={o.icon} t={o.t} d={o.d} sel={ans.q4===o.v} onClick={()=>pick('q4',o.v)}/>)}</div>
        </div>
      );
      case 5: return(
        <div className="qstep">
          {/* HERO — besar dan dominan */}
          <div className="qresult-badge"><Star size={11} weight="fill"/> Analisis selesai</div>
          <h2 className="qresult-h">
            {hero.a}
            <em>{hero.b}</em>
          </h2>
          <p className="qresult-sub">Fitur <strong>Journalyze</strong> yang paling pas {subTxt}:</p>

          {/* 3 Feature Cards */}
          <div className="qfeat-cards">
            {feats.map((f,i)=>{ const Icon=f.icon; return(
              <div key={i} className="qfeat-card">
                <div className="qfeat-icon"><Icon size={20} weight="duotone"/></div>
                <div className="qfeat-text">
                  <div className="qfeat-title">{f.t}</div>
                  <div className="qfeat-desc">{f.d}</div>
                </div>
              </div>
            );})}
          </div>

          {/* Mock Card — white container */}
          <div className="qmock-wrap">
            <div className="qmock-tabs">
              <button className={`qmock-tab${mockTab==='risk'?' on':''}`} onClick={()=>setMockTab('risk')}>
                <ShieldCheck size={12} weight={mockTab==='risk'?'fill':'regular'}/> Risk Management
              </button>
              <button className={`qmock-tab${mockTab==='news'?' on':''}`} onClick={()=>setMockTab('news')}>
                <Newspaper size={12} weight={mockTab==='news'?'fill':'regular'}/> Market News
              </button>
            </div>
            <div className="qmock-window">
              <div className="qmock-chrome">
                <div className="qmock-dots">
                  <span className="qmock-dot" style={{background:'#FF5F56'}}/>
                  <span className="qmock-dot" style={{background:'#FFBD2E'}}/>
                  <span className="qmock-dot" style={{background:'#27C93F'}}/>
                </div>
                <div className="qmock-url">
                  <span className="qmock-url-lock">🔒</span>
                  <span className="qmock-url-text">{mockTab==='risk'?'app.journalyze.id/risk-management':'app.journalyze.id/market-news'}</span>
                </div>
              </div>
              {mockTab==='risk'&&(
                <div className="qmock-body">
                  <div className="qrisk-input-row">
                    <div className="qrisk-cell"><div className="qrisk-lbl">Modal</div><div className="qrisk-val">$10,000</div></div>
                    <div className="qrisk-cell"><div className="qrisk-lbl">Risk %</div><div className="qrisk-val">2%</div></div>
                    <div className="qrisk-cell"><div className="qrisk-lbl">Stop Loss</div><div className="qrisk-val">50 pips</div></div>
                  </div>
                  <div className="qrisk-divider"/>
                  <div className="qrisk-result-row">
                    <div className="qrisk-result"><div className="qrisk-result-lbl">Lot Size</div><div className="qrisk-result-val gld">0.40</div></div>
                    <div className="qrisk-result"><div className="qrisk-result-lbl">Max Loss</div><div className="qrisk-result-val red">-$200</div></div>
                    <div className="qrisk-result"><div className="qrisk-result-lbl">R:R Ratio</div><div className="qrisk-result-val grn">1 : 2.5</div></div>
                  </div>
                  <div className="qrisk-bars">
                    {BARS.map((h,i)=>(<div key={i} className="qrisk-bar-w"><div className="qrisk-bar" style={{height:`${h}%`}}/></div>))}
                  </div>
                </div>
              )}
              {mockTab==='news'&&(
                <div className="qmock-body">
                  <div className="qnews-list">
                    {NEWS.map((n,i)=>(
                      <div key={i} className="qnews-item">
                        <div className={`qnews-impact ${n.impact}`}/>
                        <div>
                          <div className="qnews-title">{n.title}</div>
                          <div className="qnews-meta">
                            <span className={`qnews-tag ${n.tag}`}>{n.tag.toUpperCase()}</span>
                            <span className="qnews-time">{n.time}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="qstats-row" style={{marginTop:12}}>
              <div className="qstat-col"><div className="qstat-lbl">Hemat waktu analisis</div><div className="qstat-val">~10 jam/minggu</div></div>
              <div className="qstat-col"><div className="qstat-lbl">Akurasi refleksi AI</div><div className="qstat-val dark">85%</div></div>
            </div>

            {/* CTA Card gold */}
            <div className="qcta-card" style={{marginTop:14}}>
              <div className="qcta-glow"/>
              {!showForm&&(
                <div className="qcta-promo">
                  <div className="qcta-pill"><Gift size={12} weight="fill"/> Demo 2 Hari · Tanpa Kartu Kredit</div>
                  <div className="qcta-head">
                    <div className="qcta-h">Coba Journalyze gratis<br/>untuk trading kamu</div>
                    <div className="qcta-sub" style={{marginTop:6}}>Setup 30 detik · semua fitur aktif</div>
                  </div>
                  <div className="qcta-features">
                    {['Dashboard & Jurnal Trade lengkap','AI Refleksi per trade (5×)','Kalkulator Risiko & Trading Plan','Filter & Analisa Performa'].map(f=>(
                      <div key={f} className="qcta-feat"><span className="qcta-feat-check">✓</span><span>{f}</span></div>
                    ))}
                  </div>
                  <button className="qcta-btn" onClick={()=>setShowForm(true)}>
                    Mulai Demo Gratis 2 Hari <ArrowRight size={16}/>
                  </button>
                  <div className="qcta-divider"/>
                  <p className="qcta-link">Mau langsung beli? <a href="/order">Lihat paket berbayar</a></p>
                </div>
              )}
              {showForm&&(
                <div className="qcta-form active">
                  <div className="qcta-form-h">Daftar Demo 2 Hari Gratis</div>
                  <div className="qcta-form-sub">Isi data, langsung masuk dashboard</div>
                  {errMsg&&<div className="qcta-err">⚠️ {errMsg}</div>}
                  <div className="qcta-field">
                    <input className="qcta-input" type="text" placeholder="Nama lengkap" aria-label="Nama lengkap"
                      value={form.nama} onChange={e=>setForm(p=>({...p,nama:e.target.value}))}
                      onBlur={()=>setTouched(t=>({...t,nama:true}))} autoComplete="name"/>
                    {errs.nama&&<div style={{fontSize:11,color:'#EF4444',marginTop:2}}>{errs.nama}</div>}
                  </div>
                  <div className="qcta-field">
                    <input className="qcta-input" type="tel" placeholder="Nomor WhatsApp (08xxx)" aria-label="Nomor WhatsApp"
                      value={form.wa} onChange={e=>setForm(p=>({...p,wa:e.target.value}))}
                      onBlur={()=>setTouched(t=>({...t,wa:true}))} autoComplete="tel"/>
                    {errs.wa&&<div style={{fontSize:11,color:'#EF4444',marginTop:2}}>{errs.wa}</div>}
                  </div>
                  <div className="qcta-field">
                    <input className="qcta-input" type="email" placeholder="Alamat email" aria-label="Alamat email"
                      value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))}
                      onBlur={()=>setTouched(t=>({...t,email:true}))} autoComplete="email"/>
                    {errs.email&&<div style={{fontSize:11,color:'#EF4444',marginTop:2}}>{errs.email}</div>}
                  </div>
                  <div className="qcta-field">
                    <div className="qcta-pw-wrap">
                      <input className="qcta-input" type={showPw?'text':'password'} placeholder="Buat password (min. 8 karakter)" aria-label="Password"
                        value={form.pw} onChange={e=>setForm(p=>({...p,pw:e.target.value}))}
                        onBlur={()=>setTouched(t=>({...t,pw:true}))} autoComplete="new-password"/>
                      <button type="button" className="qcta-pw-toggle" onClick={()=>setShowPw(p=>!p)} tabIndex={-1}>
                        {showPw?<EyeSlash size={16}/>:<Eye size={16}/>}
                      </button>
                    </div>
                    {errs.pw&&<div style={{fontSize:11,color:'#EF4444',marginTop:2}}>{errs.pw}</div>}
                  </div>
                  <button className="qcta-submit" onClick={submit} disabled={loading}>
                    {loading?<><span className="qcta-spinner"/><span>Membuat akun...</span></>:<><span>Aktifkan Demo Gratis</span><ArrowRight size={16}/></>}
                  </button>
                  <p className="qcta-terms">Dengan mendaftar kamu setuju dengan T&C Journalyze</p>
                  <button className="qcta-back" onClick={()=>{setShowForm(false);setErrMsg(null);}}><ArrowLeft size={12}/>Kembali</button>
                </div>
              )}
            </div>

            <div style={{display:'flex',justifyContent:'center',paddingTop:12,paddingBottom:4}}>
              <button onClick={()=>{setStep(0);setAns({q1:null,q2:null,q3:null,q4:null});setShowForm(false);}}
                style={{display:'inline-flex',alignItems:'center',gap:5,background:'none',border:'none',cursor:'pointer',fontSize:12,color:'var(--text3)',fontFamily:'var(--sans)'}}>
                ↺ Ulangi quiz dari awal
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  function Bar(){
    if(step===5) return null;
    if(step===0) return(
      <div className="qbar">
        <button className="qbtn" onClick={()=>setStep(1)}>Mulai Analisis <ArrowRight size={15}/></button>
      </div>
    );
    if(step>=1&&step<=4) return(
      <div className="qbar">
        <button className="qbtn" disabled={!canNext} onClick={()=>setStep(p=>(p+1) as typeof step)}>
          {canNext?<>Lanjut <ArrowRight size={15}/></>:'Pilih salah satu dulu'}
        </button>
      </div>
    );
    return null;
  }

  return(
    <div className="quiz-root">
      <nav className="qnav">
        <a href="/home" className="qnav-logo">Journal<em>yze</em><span className="qnav-badge">DEMO</span></a>
        <button className="qnav-back" onClick={()=>router.push('/home')}><ArrowLeft size={13}/>Kembali</button>
      </nav>
      <Prog/>
      <main className={`qmain${step===5?' qmain-result':''}`}>{renderStep()}</main>
      <Bar/>
      <footer className="qfooter">
        <span>© 2025 Journalyze. All rights reserved.</span>
        <div style={{display:'flex',gap:18}}>
          <a href="#">Kebijakan Privasi</a>
          <a href="#">Syarat &amp; Ketentuan</a>
        </div>
      </footer>
    </div>
  );
}