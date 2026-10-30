import {examApi} from '@/lib/exam/api.server';
export const runtime = 'nodejs';
export async function POST(request: Request) { return examApi(request, 'submit'); }
