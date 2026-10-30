import {z} from 'zod';
export const candidateSchema=z.object({name:z.string().trim().min(1,'Nama Lengkap wajib diisi').max(100,'Nama maksimal 100 karakter'),school:z.string().trim().min(1,'Asal Sekolah wajib diisi').max(150,'Sekolah maksimal 150 karakter')}).strict();
// Known legacy field is discarded only at the session boundary. Missing legacy
// identity stays incomplete until the participant explicitly supplies it.
const savedCandidate=z.preprocess(value=>{if(value && typeof value==='object' && !Array.isArray(value)){const {number: legacyNumber,...rest}=value as Record<string,unknown>;void legacyNumber;return rest}return value},z.object({name:z.string().trim().max(100),school:z.string().trim().max(150).default('')}).strict());
export type Candidate=z.infer<typeof candidateSchema>;
const index=z.number().int().min(0).max(29);
export const sessionSchema=z.object({id:z.string().uuid(),candidate:savedCandidate.optional(),startedAt:z.number().int().positive(),deadlineAt:z.number().int().positive(),answers:z.array(z.enum(['A','B','C','D']).nullable()).length(30),marked:z.array(z.boolean()).length(30),current:index,submittedAt:z.number().int().nullable(),reason:z.enum(['manual','expired']).nullable()}).strict().refine(s=>s.deadlineAt-s.startedAt===7200000 && (s.submittedAt===null)===(s.reason===null) && (s.submittedAt===null || (s.submittedAt>=s.startedAt && s.submittedAt<=s.deadlineAt)));
export type Session=z.infer<typeof sessionSchema>;
export const KEY='mgmp-session-v1';
export function remaining(s:Session,now=Date.now()){return Math.max(0,Math.ceil((s.deadlineAt-now)/1000))}
export function start(now=Date.now()):Session{return {id:crypto.randomUUID(),startedAt:now,deadlineAt:now+7200000,answers:Array(30).fill(null),marked:Array(30).fill(false),current:0,submittedAt:null,reason:null}}
export function finalize(s:Session,reason:'manual'|'expired',now=Date.now()):Session{return s.submittedAt!==null?s:{...s,submittedAt:reason==='expired'?s.deadlineAt:Math.min(now,s.deadlineAt),reason:now>=s.deadlineAt?'expired':reason}}
export function load(raw:string,now=Date.now()){const s=sessionSchema.parse(JSON.parse(raw));return now>=s.deadlineAt?finalize(s,'expired',now):s}
export function clock(n:number){return [Math.floor(n/3600),Math.floor(n%3600/60),n%60].map(v=>String(v).padStart(2,'0')).join(':')}
