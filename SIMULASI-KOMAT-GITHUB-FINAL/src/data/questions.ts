import type { Question } from '@/types/question';
import data from './questions.json';
import { questionBankSchema } from '@/lib/validation/questions';
export const questions: readonly Question[] = questionBankSchema.parse(data);
