import 'server-only';
import {z} from 'zod';
import type {Snapshot} from '@/lib/exam/contracts';

export class DatabaseError extends Error {
  constructor(public readonly code: string) { super('Permintaan database gagal.'); }
}

// Supabase PostgREST client using native fetch; no new runtime dependency.
// Lazy configuration keeps builds working before credentials are provisioned.
const configuration = z.object({
  SUPABASE_URL: z.url().refine(value => new URL(value).protocol === 'https:'),
  SUPABASE_SECRET_KEY: z.string().trim().min(1),
});
type Table = 'exam_attempts' | 'attempt_answers' | 'admin_users';
type RpcArguments = {
  komat_rate_limit: {p_bucket: string; p_limit: number; p_seconds: number};
  komat_session_start: {p_name: string; p_school: string; p_version: string; p_hash: string};
  komat_session_read: {p_hash: string};
  komat_session_save: {p_hash: string; p_revision: number; p_answers: Snapshot['answers']; p_current: number};
  komat_session_submit: {p_hash: string; p_revision: number};
  komat_create_attempt: {p_name: string; p_school: string; p_version: string};
  komat_save_answers: {p_attempt: string; p_answers: {option: 'A' | 'B' | 'C' | 'D' | null; flagged: boolean}[]};
  komat_finalize_attempt: {p_attempt: string};
};

export function createSupabaseServerClient() {
  const parsed = configuration.safeParse({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  });
  if (!parsed.success) throw new Error('Konfigurasi Supabase server belum tersedia atau tidak valid.');
  const {SUPABASE_URL, SUPABASE_SECRET_KEY} = parsed.data;
  const base = new URL(SUPABASE_URL);
  if (base.username || base.password || base.search || base.hash || base.pathname !== '/') {
    throw new Error('SUPABASE_URL harus berupa origin HTTPS proyek Supabase.');
  }
  const transport = {
    // Privileged client bypasses RLS: only call from trusted server code after
    // validating the request. Never forward browser-controlled credentials here.
    async request(path: string, options: {
      method?: 'GET' | 'POST' | 'PATCH';
      query?: URLSearchParams;
      body?: unknown;
    } = {}): Promise<unknown> {
      const url = new URL(`/rest/v1/${path}`, base);
      url.search = options.query?.toString() ?? '';
      const response = await fetch(url, {
        method: options.method ?? 'GET',
        headers: {
          apikey: SUPABASE_SECRET_KEY,
          // Legacy service_role JWT needs Authorization; modern sb_secret keys
          // authenticate through apikey and must not be sent as Bearer tokens.
          ...(SUPABASE_SECRET_KEY.startsWith('eyJ') ? {Authorization: `Bearer ${SUPABASE_SECRET_KEY}`} : {}),
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      });
      // Do not echo DB errors, requests or secrets into public responses/logs.
      if (!response.ok) {
        const error: unknown = await response.json().catch(() => null);
        const code = z.object({code: z.string()}).safeParse(error);
        throw new DatabaseError(code.success ? code.data.code : 'DATABASE_UNAVAILABLE');
      }
      return response.status === 204 ? null : response.json() as Promise<unknown>;
    },
  };
  return {
    // Database table writes are revoked; use bounded transactional RPCs.
    read(table: Table, query?: URLSearchParams) {
      return transport.request(table, {query});
    },
    rpc<Name extends keyof RpcArguments>(name: Name, args: RpcArguments[Name]) {
      return transport.request(`rpc/${name}`, {method: 'POST', body: args});
    },
  };
}
