import {z} from 'zod';
import {candidateSchema, sessionSchema, type Candidate, type Session} from './session';
import {capabilitySchema, remoteSchema, revisionSchema, summarySchema, type Remote} from './contracts';

export const ACTIVE_KEY = 'komat-session-v2';
export const START_KEY = 'komat-start-v2';
export const localSchema = z.object({
  capability: capabilitySchema, session: sessionSchema,
  revision: revisionSchema, confirmedRevision: revisionSchema,
  pendingSubmit: z.boolean(), result: summarySchema.nullable(), unsavedBackup: z.boolean().default(false),
}).strict().refine(s => s.confirmedRevision <= s.revision);
export type LocalAttempt = z.infer<typeof localSchema>;
type Store = Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export type Transport = (action: 'read'|'save'|'submit', token: string, body?: unknown) => Promise<Remote>;
export async function requestSession(action: 'read'|'save'|'submit', token: string, body?: unknown) {
  const response = await fetch(action==='submit'?'/api/exam/submit':'/api/exam/session', {
    method: action==='read'?'GET':action==='save'?'PUT':'POST',
    headers: {Authorization:`Bearer ${token}`, 'Content-Type':'application/json'},
    body:body===undefined?undefined:JSON.stringify(body), cache:'no-store', signal:AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(response.status===401?'Token sesi tidak valid. Cadangan lokal tetap disimpan.':'Koneksi penyimpanan terganggu. Akan mencoba lagi; cadangan lokal tetap disimpan.');
  return remoteSchema.parse(await response.json());
}
export function loadLocal(store: Store) {
  const raw = store.getItem(ACTIVE_KEY);
  return raw ? localSchema.parse(JSON.parse(raw)) : null;
}
const pendingStartSchema = z.object({candidate:candidateSchema,nonce:capabilitySchema}).strict();
export function pendingStart(store: Store) {
  const raw=store.getItem(START_KEY);
  return raw?pendingStartSchema.parse(JSON.parse(raw)):null;
}
export async function beginAttempt(candidate: Candidate, store: Store) {
  let pending=pendingStart(store);
  if (!pending) {
    const nonce=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
    pending={candidate:candidateSchema.parse(candidate),nonce};
    // Persist idempotency material BEFORE creating anything remotely.
    store.setItem(START_KEY,JSON.stringify(pending));
  }
  const response=await fetch('/api/exam/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(pending),signal:AbortSignal.timeout(15000)});
  if(!response.ok) throw new Error('Sesi belum dapat dimulai. Periksa koneksi dan konfigurasi server, lalu coba lagi.');
  const raw: unknown=await response.json();
  const combined=z.object({capability:capabilitySchema}).passthrough().parse(raw);
  const {capability,...rest}=combined;
  const remote=remoteSchema.parse(rest);
  const local:LocalAttempt={capability,session:remote.session,revision:remote.revision,confirmedRevision:remote.revision,pendingSubmit:false,result:remote.result,unsavedBackup:false};
  store.setItem(ACTIVE_KEY,JSON.stringify(local));
  store.removeItem(START_KEY);
  return local;
}

// One transport request at a time, including submit. DB revisions also protect
// against a delayed request from a previous tab/process after a refresh.
export class PersistentExam {
  authenticated=false;
  message='Memverifikasi sesi server…';
  private running:Promise<void>|null=null;
  private anchor:{server:number;mono:number}|null=null;
  constructor(public local:LocalAttempt,private store:Store,private changed:()=>void,
    private transport:Transport=requestSession,private mono:()=>number=()=>performance.now()) {}
  time() { return this.anchor?this.anchor.server+this.mono()-this.anchor.mono:null; }
  private persist() {
    try {this.store.setItem(ACTIVE_KEY,JSON.stringify(this.local));}
    catch {this.message='Cadangan lokal gagal disimpan. Tetap buka tab ini sampai penyimpanan server terkonfirmasi.';}
    this.changed();
  }
  private accept(remote:Remote) {
    if(remote.session.id!==this.local.session.id) throw new Error('Identitas sesi server tidak sesuai.');
    this.anchor={server:remote.serverNow,mono:this.mono()};
    this.authenticated=true;
    const dirty=this.local.revision>this.local.confirmedRevision;
    if(remote.session.submittedAt!==null && dirty && remote.revision<this.local.revision) {
      // Never discard an unacknowledged local snapshot when a late submit was
      // graded from previously committed answers. Retain a separate backup.
      this.store.setItem(`komat-unsynced-${this.local.session.id}-${this.local.revision}`,JSON.stringify(this.local));
      this.local.unsavedBackup=true;
    }
    if(remote.session.submittedAt===null && this.local.revision>remote.revision) {
      this.local.session={...remote.session,answers:this.local.session.answers,marked:this.local.session.marked,current:this.local.session.current};
      this.local.confirmedRevision=remote.revision;
    } else {
      this.local.session=remote.session;
      this.local.revision=remote.revision;
      this.local.confirmedRevision=remote.revision;
    }
    this.local.result=remote.result;
    if(remote.session.submittedAt!==null) this.local.pendingSubmit=false;
    this.message=this.local.unsavedBackup?'Sebagian perubahan lokal tidak sempat terkonfirmasi sebelum deadline. Cadangannya tetap disimpan; nilai memakai jawaban yang tersimpan di server.':this.local.revision>this.local.confirmedRevision?'Menunggu penyimpanan server…':'Tersimpan di server.';
    this.persist();
  }
  edit(update:(s:Session)=>Session) {
    if(!this.authenticated || this.local.session.submittedAt!==null || this.local.pendingSubmit) return;
    const now=this.time();
    if(now===null || now>=this.local.session.deadlineAt) {void this.submit();return;}
    this.local.session=update(this.local.session);
    this.local.revision++;
    this.message='Menunggu penyimpanan server…';
    this.persist();
  }
  recover() {
    if(this.running)return this.running;
    this.running=(async()=>{try {this.accept(await this.transport('read',this.local.capability));}
      catch(e){this.message=e instanceof Error?e.message:'Pemulihan sesi gagal.';this.changed();}
    })().finally(()=>{this.running=null;});
    return this.running;
  }
  sync() {
    if(this.running)return this.running;
    this.running=(async()=>{
      try {
        if(!this.authenticated) this.accept(await this.transport('read',this.local.capability));
        while(this.local.session.submittedAt===null && this.local.revision>this.local.confirmedRevision) {
          // Capture immutable snapshot; edits during await get a newer revision.
          const s=this.local.session, revision=this.local.revision;
          this.accept(await this.transport('save',this.local.capability,{revision,current:s.current,
            answers:s.answers.map((option,i)=>({option,flagged:s.marked[i]}))}));
        }
        if(this.local.pendingSubmit && this.local.session.submittedAt===null) {
          this.accept(await this.transport('submit',this.local.capability,{revision:this.local.confirmedRevision}));
        }
      } catch(e) {
        // A save can cross deadline. Read finalizes only previously committed
        // answers and never accepts the late browser snapshot.
        const now=this.time();
        if(now!==null && now>=this.local.session.deadlineAt) {
          try {this.accept(await this.transport('read',this.local.capability));return;} catch {/* retry later */}
        }
        this.message=e instanceof Error?e.message:'Penyimpanan gagal. Akan dicoba lagi.';this.changed();
      }
    })().finally(()=>{this.running=null;});
    return this.running;
  }
  async submit() {
    if(this.local.session.submittedAt!==null)return;
    this.local.pendingSubmit=true;
    this.message='Mengonfirmasi penyimpanan dan mengumpulkan jawaban…';
    this.persist();
    // An in-flight autosave may finish just before pendingSubmit was set.
    if(this.running)await this.running;
    await this.sync();
  }
  restart() {
    if(!this.authenticated || this.local.session.submittedAt===null || !this.local.result)throw new Error('Hasil belum terkonfirmasi.');
    this.store.setItem(`komat-archive-${this.local.session.id}`,JSON.stringify(this.local));
    this.store.removeItem(ACTIVE_KEY);
  }
}
