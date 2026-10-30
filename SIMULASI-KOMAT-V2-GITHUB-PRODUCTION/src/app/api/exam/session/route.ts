import {examApi} from '@/lib/exam/api.server';
export const runtime = 'nodejs';
export async function GET(request: Request) { return examApi(request, 'read'); }
export async function PUT(request: Request) { return examApi(request, 'save'); }
