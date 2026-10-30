import {EXAM} from '@/lib/exam/config';
import type {OptionId} from '@/types/question';
export const SCORING_RULES={...EXAM.scoring,totalQuestions:EXAM.questionCount,maximumScore:EXAM.maximumScore} as const;
export function score(answers:readonly (OptionId|null)[],key:readonly OptionId[]){
 if(answers.length!==30||key.length!==30)throw new Error('Jumlah jawaban harus 30');
 let correct=0,incorrect=0,unanswered=0;
 answers.forEach((a,i)=>{if(a===null)unanswered++;else if(a===key[i])correct++;else incorrect++});
 const answered=correct+incorrect,finalScore=correct*SCORING_RULES.correct;
 return {correct,incorrect,unanswered,finalScore,maximumScore:SCORING_RULES.maximumScore,scorePercentage:finalScore/120*100,accuracy:answered?correct/answered*100:0,completion:answered/30*100};
}
