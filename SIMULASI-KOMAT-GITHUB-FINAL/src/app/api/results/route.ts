import {NextResponse} from 'next/server';
import {sessionSchema,candidateSchema} from '@/lib/exam/session';
import {validatedAnswers} from '../../../../private/answers.server';
import {score} from '@/lib/scoring/score';
import type {OptionId} from '@/types/question';
export async function POST(request:Request){
 try{const raw=await request.text();if(raw.length>20000)return NextResponse.json({error:'Data terlalu besar'},{status:413});const s=sessionSchema.parse(JSON.parse(raw));
 if(!candidateSchema.safeParse(s.candidate).success || s.submittedAt===null || s.submittedAt>Date.now())return NextResponse.json({error:'Sesi belum dikumpulkan atau tidak valid'},{status:403});
 return NextResponse.json({result:score(s.answers,validatedAnswers.map(a=>a.correctOption as OptionId)),review:validatedAnswers},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Data sesi tidak valid'},{status:400})}
}
