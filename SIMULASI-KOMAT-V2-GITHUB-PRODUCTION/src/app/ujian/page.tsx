 'use client';
import {useEffect,useState,useRef} from 'react';
import {ConfirmDialog} from '@/components/ui/confirm-dialog';
import {Dashboard} from '@/components/results/dashboard';
import {candidateSchema} from '@/lib/exam/session';
import {Diagram} from '@/components/exam/diagram';
import {MathText} from '@/components/exam/math';
import {questions} from '@/data/questions';
import {KEY,remaining,clock,type Session} from '@/lib/exam/session';
import {PersistentExam,loadLocal,pendingStart,beginAttempt} from '@/lib/exam/persistent';
import {acquireExamTabLock,type TabLockState} from '@/lib/exam/tab-lock';
function Exam(){
const [name,setName]=useState(''),[school,setSchool]=useState('');
const [session,setSession]=useState<Session|null>(null),[ready,setReady]=useState(false),[error,setError]=useState(''),[now,setNow]=useState(0),[confirm,setConfirm]=useState(false);
const [busy,setBusy]=useState(false),[legacy,setLegacy]=useState(false),[invalid,setInvalid]=useState(false);
const [,render]=useState(0);const controller=useRef<PersistentExam|null>(null);
function refresh(){const c=controller.current;if(c){setSession({...c.local.session});setNow(c.time()??c.local.session.startedAt);render(n=>n+1)}}
async function begin(){
 const parsed=candidateSchema.safeParse({name,school});if(!parsed.success){setError('Nama Lengkap dan Asal Sekolah wajib diisi. Periksa batas panjang isian.');return}
 setBusy(true);setError('');
 try {const local=await beginAttempt(parsed.data,localStorage);const c=new PersistentExam(local,localStorage,refresh);controller.current=c;refresh();await c.recover();}
 catch(e){setError(e instanceof Error?e.message:'Sesi belum dapat dimulai.');}finally{setBusy(false)}
}
useEffect(()=>{
 let disposed=false;
 const attach=async()=>{try{
  setLegacy(!!localStorage.getItem(KEY));
  const local=loadLocal(localStorage);
  if(local){const c=new PersistentExam(local,localStorage,refresh);controller.current=c;refresh();await c.recover();}
  else {const pending=pendingStart(localStorage);if(pending){setName(pending.candidate.name);setSchool(pending.candidate.school);setError('Permintaan mulai sebelumnya belum terkonfirmasi. Tekan Mulai Ujian untuk memulihkannya tanpa membuat sesi ganda.');}}
 }catch{setInvalid(true);setError('Cadangan sesi tidak valid. Data tetap dipertahankan dan tidak ditimpa.');}finally{if(!disposed)setReady(true)}};
 void attach();
 const tick=()=>{const c=controller.current;if(!c)return;const t=c.time();if(t!==null)setNow(t);if(c.authenticated && !c.local.pendingSubmit && t!==null && t>=c.local.session.deadlineAt && c.local.session.submittedAt===null)void c.submit()};
 const sync=()=>{const c=controller.current;if(c && c.local.session.submittedAt===null)void c.sync();else if(c&&!c.authenticated)void c.recover()};
 const timer=setInterval(tick,500),retry=setInterval(sync,5000);
 const reconnect=()=>{const c=controller.current;if(c)void c.recover().then(()=>c.sync())};
 window.addEventListener('online',reconnect);window.addEventListener('focus',reconnect);document.addEventListener('visibilitychange',reconnect);
 return()=>{disposed=true;clearInterval(timer);clearInterval(retry);window.removeEventListener('online',reconnect);window.removeEventListener('focus',reconnect);document.removeEventListener('visibilitychange',reconnect)};
 // Controller owns the mutable state; callbacks read its latest snapshot.
},[]);
useEffect(()=>{if(!session)return;const timer=setTimeout(()=>{void controller.current?.sync()},350);return()=>clearTimeout(timer)},[session]);
function update(f:(s:Session)=>Session){controller.current?.edit(f)}
function restart(){try{controller.current?.restart();controller.current=null;setSession(null);setName('');setSchool('');setError('')}catch{setError('Hasil belum terkonfirmasi atau cadangan gagal dibuat. Sesi tetap dipertahankan.')}}
if(invalid)return <main id="main" className="instructions"><h1>Pemulihan sesi diperlukan</h1><p role="alert">{error}</p></main>;
if(!ready)return <main id="main">Memulihkan sesi…</main>;
if(!session)return <main id="main" className="instructions"><h1>Siap untuk tantangannya?</h1>{error&&<p role="alert">{error}</p>}{legacy&&<p role="status">Cadangan sesi versi lama tetap disimpan di browser. Jawaban lama tidak diimpor sebagai percobaan baru.</p>}<p>30 soal · 120 menit · Benar +4, salah 0, kosong 0. Timer baru berjalan saat dimulai.</p><form onSubmit={e=>{e.preventDefault();void begin()}}><label className="identity-field">Nama Lengkap<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label><label className="identity-field">Asal Sekolah<input required maxLength={150} value={school} onChange={e=>setSchool(e.target.value)}/></label><button disabled={busy} className="button button-primary" type="submit">{busy?'Menyiapkan sesi…':'Mulai Ujian'}</button></form></main>;
const c=controller.current;
if(!c?.authenticated)return <main id="main" className="instructions"><h1>Memulihkan sesi server…</h1><p role="status">{c?.message}</p><button className="button" onClick={()=>void c?.recover()}>Coba Lagi</button></main>;
if(session.submittedAt!==null)return <main id="main"><Dashboard session={session} result={c.local.result!} onRestart={restart}/>{c.local.unsavedBackup&&<p role="alert">{c.message}</p>}{error&&<p role="alert">{error}</p>}</main>;
const q=questions[session.current],answered=session.answers.filter(Boolean).length;
return <main id="main"><p className="sr-only" role="status">{remaining(session,now)<=60?'Sisa waktu satu menit atau kurang.':remaining(session,now)<=300?'Sisa waktu lima menit atau kurang.':remaining(session,now)<=900?'Sisa waktu lima belas menit atau kurang.':''}</p><header className="exam-clock"><strong role="timer" aria-live="off" aria-label="Sisa waktu ujian">Sisa waktu {clock(remaining(session,now))}</strong><span>{session.candidate?.name||'Sesi lama tanpa identitas'} · {answered}/30 dijawab</span></header>{error&&<p role="alert">{error}</p>}<p role="status">{c.message}</p>{c.local.pendingSubmit&&<button className="button" onClick={()=>void c.submit()}>Coba Kumpulkan Lagi</button>}<div className="exam-grid"><article className="instruction-card"><small>Soal {session.current+1} · {q.topic}</small><h2 tabIndex={-1} id="question-heading">{q.statement}</h2>{q.mathExpressions.map((expression,i)=><div key={i}><MathText expression={expression}/></div>)}{q.cryptarithm&&<pre>{q.cryptarithm.addends.join(' +\n')}<br/>────<br/>{q.cryptarithm.sum}</pre>}{q.diagram&&<Diagram diagram={q.diagram}/>}<fieldset disabled={c.local.pendingSubmit}><legend>Pilih satu jawaban</legend>{q.options.map(o=><label className="exam-option" key={o.id}><input type="radio" name={q.id} checked={session.answers[session.current]===o.id} onChange={()=>update(s=>({...s,answers:s.answers.map((a,i)=>i===s.current?o.id:a)}))}/>{o.id}. {o.text}</label>)}</fieldset><div className="exam-controls"><button onClick={()=>update(s=>({...s,current:Math.max(0,s.current-1)}))}>Sebelumnya</button><button onClick={()=>update(s=>({...s,marked:s.marked.map((m,i)=>i===s.current?!m:m)}))} aria-pressed={session.marked[session.current]}>Ragu-ragu</button><button onClick={()=>update(s=>({...s,answers:s.answers.map((a,i)=>i===s.current?null:a)}))}>Hapus Jawaban</button><button onClick={()=>update(s=>({...s,current:Math.min(29,s.current+1)}))}>Berikutnya</button></div></article><aside className="instruction-card"><h2>Navigasi soal</h2><p>Abu: kosong · Biru: dijawab · Emas: ragu-ragu · Bingkai: aktif</p><div className="question-nav">{questions.map((q,i)=><button key={q.id} aria-label={`Soal ${i+1}${session.answers[i]?', dijawab':''}${session.marked[i]?', ragu-ragu':''}`} aria-current={i===session.current?'step':undefined} className={(session.answers[i]?'answered ':'')+(session.marked[i]?'marked':'')} onClick={()=>update(s=>({...s,current:i}))}>{i+1}</button>)}</div><button disabled={c.local.pendingSubmit} className="button button-primary" onClick={e=>{e.currentTarget.focus();setConfirm(true)}}>Selesaikan Ujian</button></aside></div>{confirm&&<ConfirmDialog title="Kumpulkan jawaban?" onClose={()=>setConfirm(false)}><p>Benar +4 · Salah 0 · Kosong 0</p><p>{answered} dijawab · {30-answered} kosong · {session.marked.filter(Boolean).length} ragu-ragu</p><p>Sisa waktu {clock(remaining(session,now))}</p><button autoFocus className="button" onClick={()=>setConfirm(false)}>Kembali ke Soal</button><button className="button button-primary" onClick={()=>{void c.submit();setConfirm(false)}}>Ya, Kumpulkan</button></ConfirmDialog>}</main>
}
export default function LockedExam(){
 const [state,setState]=useState<TabLockState>('waiting'),[retry,setRetry]=useState(0);
 useEffect(()=>acquireExamTabLock(navigator.locks,setState),[retry]);
 if(state==='owner')return <Exam/>;
 const title=state==='blocked'?'Sesi sedang digunakan di tab lain':state==='unsupported'?'Browser belum mendukung penguncian sesi':state==='error'?'Akses sesi belum dapat disiapkan':'Menyiapkan sesi...';
 const message=state==='blocked'?'Tutup tab ujian yang lain. Halaman ini akan melanjutkan secara otomatis setelah akses dilepas.':state==='unsupported'?'Gunakan browser yang mendukung Web Locks pada localhost atau HTTPS.':state==='error'?'Permintaan penguncian browser gagal. Coba lagi untuk memulihkan akses.':'Memeriksa akses tab. Mohon tunggu.';
 return <main id="main" className="instructions"><h1>{title}</h1><p role="status">{message}</p>{state==='error'&&<button className="button" onClick={()=>setRetry(n=>n+1)}>Coba Lagi</button>}</main>;
}
