 'use client';

import {useEffect,useState,useRef} from 'react';

import {ConfirmDialog} from '@/components/ui/confirm-dialog';

import {Dashboard} from '@/components/results/dashboard';

import {candidateSchema} from '@/lib/exam/session';

import {Diagram} from '@/components/exam/diagram';
import {MathText} from '@/components/exam/math';

import {questions} from '@/data/questions';

import {KEY,start,load,remaining,finalize,clock,type Session} from '@/lib/exam/session';

function Exam(){

const [name,setName]=useState(''),[school,setSchool]=useState('');

const [session,setSession]=useState<Session|null>(null),[ready,setReady]=useState(false),[error,setError]=useState(''),[now,setNow]=useState(0),[confirm,setConfirm]=useState(false);const ref=useRef<Session|null>(null);

function commit(s:Session){try{localStorage.setItem(KEY,JSON.stringify(s));ref.current=s;setSession(s);setError('')}catch{if(s.submittedAt){ref.current=s;setSession(s)}setError('Penyimpanan gagal. Jawaban belum tersimpan; periksa ruang dan izin browser.')}}

useEffect(()=>{try{const raw=localStorage.getItem(KEY);if(raw){const s=load(raw);ref.current=s;setSession(s);localStorage.setItem(KEY,JSON.stringify(s))}}catch{setError('Data sesi rusak. Sesi lama tidak dapat dipulihkan. Mulai sesi baru untuk melanjutkan.')}setNow(Date.now());setReady(true);

const tick=()=>{setNow(Date.now());const s=ref.current;if(s && !s.submittedAt && remaining(s)===0)commit(finalize(s,'expired'))};const timer=setInterval(tick,500);window.addEventListener('focus',tick);document.addEventListener('visibilitychange',tick);const sync=(e:StorageEvent)=>{if(e.key===KEY && e.newValue){try{const next=load(e.newValue);ref.current=next;setSession(next)}catch{setError('Perubahan storage tidak valid. Muat ulang untuk memulihkan sesi.')}}};window.addEventListener('storage',sync);return()=>{clearInterval(timer);window.removeEventListener('focus',tick);document.removeEventListener('visibilitychange',tick);window.removeEventListener('storage',sync)}},[]);

function update(f:(s:Session)=>Session){const s=ref.current;if(!s||s.submittedAt)return;if(!remaining(s)){commit(finalize(s,'expired'));return}commit(f(s))}

if(!ready)return <main id="main">Memulihkan sesi…</main>;

if(!session)return <main id="main" className="instructions"><h1>Siap untuk tantangannya?</h1>{error&&<p role="alert">{error}</p>}<p>30 soal · 120 menit · Benar +4, salah 0, kosong 0. Timer baru berjalan saat dimulai.</p><form onSubmit={e=>{e.preventDefault();const parsed=candidateSchema.safeParse({name,school});if(!parsed.success){setError('Nama Lengkap dan Asal Sekolah wajib diisi. Periksa batas panjang isian.');return}setNow(Date.now());commit({...start(),candidate:parsed.data})}}><label className="identity-field">Nama Lengkap<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label><label className="identity-field">Asal Sekolah<input required maxLength={150} value={school} onChange={e=>setSchool(e.target.value)}/></label><button className="button button-primary" type="submit">Mulai Ujian</button></form></main>;

if(!session.candidate?.name || !session.candidate?.school)return <main id="main" className="instructions"><h1>Lengkapi identitas sesi lama</h1><p>Jawaban, UUID dan waktu ujian dipertahankan. Sisa waktu {clock(remaining(session,now))}. Lengkapi hanya informasi yang belum ada.</p>{error&&<p role="alert">{error}</p>}<form onSubmit={e=>{e.preventDefault();const parsed=candidateSchema.safeParse({name:session.candidate?.name||name,school:session.candidate?.school||school});if(!parsed.success){setError('Nama Lengkap dan Asal Sekolah wajib diisi.');return}commit({...session,candidate:parsed.data})}}><label className="identity-field">Nama Lengkap<input required maxLength={100} disabled={!!session.candidate?.name} value={session.candidate?.name||name} onChange={e=>setName(e.target.value)}/></label><label className="identity-field">Asal Sekolah<input required maxLength={150} disabled={!!session.candidate?.school} value={session.candidate?.school||school} onChange={e=>setSchool(e.target.value)}/></label><button className="button button-primary" type="submit">Simpan Identitas dan Lanjutkan</button></form></main>;
if(session.submittedAt)return <main id="main"><Dashboard session={session} onRestart={()=>{ref.current=null;setSession(null);setName('');setSchool('')}}/>{error&&<p role="alert">{error}</p>}</main>;

const q=questions[session.current],answered=session.answers.filter(Boolean).length;

return <main id="main"><p className="sr-only" role="status">{remaining(session,now)<=60?'Sisa waktu satu menit atau kurang.':remaining(session,now)<=300?'Sisa waktu lima menit atau kurang.':remaining(session,now)<=900?'Sisa waktu lima belas menit atau kurang.':''}</p><header className="exam-clock"><strong role="timer" aria-live="off" aria-label="Sisa waktu ujian">Sisa waktu {clock(remaining(session,now))}</strong><span>{session.candidate?.name||'Sesi lama tanpa identitas'} · {answered}/30 dijawab</span></header>{error&&<p role="alert">{error}</p>}<div className="exam-grid"><article className="instruction-card"><small>Soal {session.current+1} · {q.topic}</small><h2 tabIndex={-1} id="question-heading">{q.statement}</h2>{q.mathExpressions.map((expression,i)=><div key={i}><MathText expression={expression}/></div>)}{q.cryptarithm&&<pre>{q.cryptarithm.addends.join(' +\n')}<br/>────<br/>{q.cryptarithm.sum}</pre>}{q.diagram&&<Diagram diagram={q.diagram}/>}<fieldset><legend>Pilih satu jawaban</legend>{q.options.map(o=><label className="exam-option" key={o.id}><input type="radio" name={q.id} checked={session.answers[session.current]===o.id} onChange={()=>update(s=>({...s,answers:s.answers.map((a,i)=>i===s.current?o.id:a)}))}/>{o.id}. {o.text}</label>)}</fieldset><div className="exam-controls"><button onClick={()=>update(s=>({...s,current:Math.max(0,s.current-1)}))}>Sebelumnya</button><button onClick={()=>update(s=>({...s,marked:s.marked.map((m,i)=>i===s.current?!m:m)}))} aria-pressed={session.marked[session.current]}>Ragu-ragu</button><button onClick={()=>update(s=>({...s,answers:s.answers.map((a,i)=>i===s.current?null:a)}))}>Hapus Jawaban</button><button onClick={()=>update(s=>({...s,current:Math.min(29,s.current+1)}))}>Berikutnya</button></div></article><aside className="instruction-card"><h2>Navigasi soal</h2><p>Abu: kosong · Biru: dijawab · Emas: ragu-ragu · Bingkai: aktif</p><div className="question-nav">{questions.map((q,i)=><button key={q.id} aria-label={`Soal ${i+1}${session.answers[i]?', dijawab':''}${session.marked[i]?', ragu-ragu':''}`} aria-current={i===session.current?'step':undefined} className={(session.answers[i]?'answered ':'')+(session.marked[i]?'marked':'')} onClick={()=>update(s=>({...s,current:i}))}>{i+1}</button>)}</div><button className="button button-primary" onClick={e=>{e.currentTarget.focus();setConfirm(true)}}>Selesaikan Ujian</button></aside></div>{confirm&&<ConfirmDialog title="Kumpulkan jawaban?" onClose={()=>setConfirm(false)}><p>Benar +4 · Salah 0 · Kosong 0</p><p>{answered} dijawab · {30-answered} kosong · {session.marked.filter(Boolean).length} ragu-ragu</p><p>Sisa waktu {clock(remaining(session,now))}</p><button autoFocus className="button" onClick={()=>setConfirm(false)}>Kembali ke Soal</button><button className="button button-primary" onClick={()=>{update(s=>finalize(s,'manual'));setConfirm(false)}}>Ya, Kumpulkan</button></ConfirmDialog>}</main>

}



export default function LockedExam(){const [state,setState]=useState<'waiting'|'owner'|'blocked'>('waiting');useEffect(()=>{let disposed=false;let release:()=>void=()=>{};if(!navigator.locks){setState('blocked');return}void navigator.locks.request('mgmp-exam-exclusive',{ifAvailable:true},async lock=>{if(disposed)return;if(!lock){setState('blocked');return}setState('owner');await new Promise<void>(resolve=>{release=resolve;if(disposed)resolve()})});return()=>{disposed=true;release()}},[]);return state==='owner'?<Exam/>:<main id="main" className="instructions"><h1>{state==='waiting'?'Menyiapkan sesi…':'Sesi terkunci'}</h1><p>{state==='blocked'?'Tutup tab ujian lain lalu muat ulang. Browser harus mendukung Web Locks pada localhost/HTTPS.':'Memeriksa akses tab.'}</p></main>}

