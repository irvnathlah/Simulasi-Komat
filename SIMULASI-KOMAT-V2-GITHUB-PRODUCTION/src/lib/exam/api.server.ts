import 'server-only';
import {createHash, createHmac} from 'node:crypto';
import {NextResponse} from 'next/server';
import {z} from 'zod';
import {createSupabaseServerClient, DatabaseError} from '@/lib/supabase/server';
import {examVersion} from '../../../private/exam-version.server';
import {capabilitySchema, remoteSchema, revisionSchema, snapshotSchema, startRequestSchema} from './contracts';
import {allowsExamOrigin} from './origin.server';

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
function secret() {
  const value = process.env.KOMAT_SESSION_SECRET;
  if (!value || !/^[0-9a-f]{64,}$/i.test(value)) throw new HttpError(503, 'Konfigurasi sesi server belum tersedia.');
  return value;
}
export function tokenHash(token: string) { return createHash('sha256').update(token).digest('hex'); }
export function issueCapability(nonce: string) {
  // PRF output has 256 bits; unpredictable without the server secret. Determinism
  // permits safe retry after a lost creation response, without storing raw tokens.
  return createHmac('sha256', secret()).update(`komat-capability-v2:${nonce}`).digest('base64url');
}
async function jsonBody(request: Request): Promise<unknown> {
  if (!request.body) throw new HttpError(400, 'Payload tidak valid.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    for (;;) {
      const {value,done} = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > 16384) { await reader.cancel(); throw new HttpError(413, 'Payload terlalu besar.'); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch (e) { if (e instanceof HttpError) throw e; throw new HttpError(400, 'Payload tidak valid.'); }
}
const headers = {'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer'};
type Action = 'start' | 'read' | 'save' | 'submit' | 'results';
export async function examApi(request: Request, action: Action) {
  try {
    if (!allowsExamOrigin(request)) throw new HttpError(403, 'Origin tidak diizinkan.');
    let token = '';
    if (action !== 'start') {
      const parsed = capabilitySchema.safeParse(request.headers.get('authorization')?.replace(/^Bearer /, ''));
      if (!parsed.success) throw new HttpError(401, 'Otorisasi sesi diperlukan.');
      token = parsed.data;
    }
    const db = createSupabaseServerClient();
    // Platform-forwarded IP is a rate signal, never session authorization.
    // Also enable Vercel Firewall limits: this DB quota is not DDoS protection.
    const ip = (request.headers.get('x-vercel-forwarded-for') ?? request.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim().slice(0,128);
    const bucket = createHmac('sha256', secret()).update(`quota:${action}:${ip}`).digest('hex');
    // Shared school networks need room for concurrent students. Enforce both
    // an IP quota and a tighter per-capability quota for authenticated traffic.
    const allowed = await db.rpc('komat_rate_limit', {p_bucket: bucket, p_limit: action==='start'?100:3000, p_seconds: action==='start'?600:60});
    const sessionAllowed = allowed === true && (action === 'start' || await db.rpc('komat_rate_limit', {
      p_bucket: createHmac('sha256',secret()).update(`session-quota:${action}:${tokenHash(token)}`).digest('hex'), p_limit:120, p_seconds:60,
    }) === true);
    if (!sessionAllowed) return NextResponse.json({error: 'Terlalu banyak permintaan. Coba lagi nanti.'}, {status:429, headers:{...headers, 'Retry-After':action==='start'?'600':'60'}});
    if (action === 'start') {
      const {candidate,nonce} = startRequestSchema.parse(await jsonBody(request));
      token = issueCapability(nonce);
      const data = remoteSchema.parse(await db.rpc('komat_session_start', {
        p_name: candidate.name, p_school: candidate.school, p_version: examVersion, p_hash: tokenHash(token),
      }));
      return NextResponse.json({...data, capability: token}, {headers});
    }
    const p_hash = tokenHash(token);
    let raw: unknown;
    if (action === 'save') {
      const data = snapshotSchema.parse(await jsonBody(request));
      raw = await db.rpc('komat_session_save', {p_hash, p_revision:data.revision, p_answers:data.answers, p_current:data.current});
    } else if (action === 'submit') {
      const data = z.object({revision:revisionSchema}).strict().parse(await jsonBody(request));
      raw = await db.rpc('komat_session_submit', {p_hash, p_revision:data.revision});
    } else {
      // GET/POST results intentionally ignores browser session/score claims.
      raw = await db.rpc('komat_session_read', {p_hash});
    }
    const data = remoteSchema.parse(raw);
    if (action === 'results' && data.result === null) throw new HttpError(409, 'Sesi belum dikumpulkan.');
    return NextResponse.json(data, {headers});
  } catch (error) {
    if (error instanceof HttpError) return NextResponse.json({error:error.message}, {status:error.status, headers});
    if (error instanceof DatabaseError && error.code === '28000') return NextResponse.json({error:'Otorisasi sesi tidak valid.'}, {status:401, headers});
    if (error instanceof DatabaseError && error.code === '40001') return NextResponse.json({error:'Versi penyimpanan berbeda. Muat ulang untuk memulihkan sesi.'}, {status:409, headers});
    if (error instanceof z.ZodError) return NextResponse.json({error:'Data sesi tidak valid.'}, {status:400, headers});
    return NextResponse.json({error:'Layanan penyimpanan belum tersedia. Jawaban lokal tetap dipertahankan.'}, {status:503, headers});
  }
}
