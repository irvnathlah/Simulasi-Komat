import {examApi} from '@/lib/exam/api.server';
export const runtime = 'nodejs';
export async function GET(request: Request) { return examApi(request, 'results'); }
export async function POST(request: Request) { return examApi(request, 'results'); }
