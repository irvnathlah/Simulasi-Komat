import 'server-only';

type Environment = Record<string,string|undefined>;
const loopback = new Set(['localhost','127.0.0.1','[::1]']);
function exactOrigin(value: string): URL | null {
  try {
    const url=new URL(value);
    // Origin is a serialized origin, never a path, credentials, wildcard, list
    // or opaque "null". Match scheme, hostname and port together.
    if (!['http:','https:'].includes(url.protocol) || url.origin!==value) return null;
    return url;
  } catch { return null; }
}

export function allowsExamOrigin(request: Request, env: Environment = process.env): boolean {
  // Fetch Metadata is browser-controlled. Reject explicit cross-site traffic,
  // including requests that suppress Origin. It is not session authentication.
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  const raw=request.headers.get('origin');
  if (raw === null) {
    // Browser GET recovery normally has no Origin. Non-browser clients with an
    // explicit capability can also omit it: Bearer is not an ambient cookie.
    // Public unauthenticated session creation must always provide Origin.
    return ['GET','HEAD'].includes(request.method) ||
      /^Bearer [A-Za-z0-9_-]{43}$/.test(request.headers.get('authorization')??'');
  }
  const origin=exactOrigin(raw);
  if (!origin) return false;
  const target=new URL(request.url);
  if (env.NODE_ENV==='development' && loopback.has(target.hostname)) {
    // NextRequest normalizes 127.0.0.1 (and ::1) to localhost. Only that local
    // alias is allowed, with the exact protocol and effective port preserved.
    return loopback.has(origin.hostname) && origin.protocol===target.protocol && origin.port===target.port;
  }
  const allowed=new Set<string>();
  for (const value of (env.KOMAT_ALLOWED_ORIGINS??'').split(',').map(s=>s.trim()).filter(Boolean)) {
    const configured=exactOrigin(value);
    if(configured?.protocol==='https:' && !loopback.has(configured.hostname)) allowed.add(configured.origin);
  }
  // These values come from server deployment configuration, never Host or
  // X-Forwarded-Host. Exact domains only; no *.vercel.app acceptance.
  if (env.VERCEL==='1') {
    for (const host of [env.VERCEL_URL,env.VERCEL_BRANCH_URL,env.VERCEL_PROJECT_PRODUCTION_URL]) {
      if(!host || host.includes('/') || host.includes('@') || host.includes('*')) continue;
      const configured=exactOrigin(`https://${host}`);
      if(configured && !loopback.has(configured.hostname)) allowed.add(configured.origin);
    }
  }
  return allowed.has(origin.origin);
}
