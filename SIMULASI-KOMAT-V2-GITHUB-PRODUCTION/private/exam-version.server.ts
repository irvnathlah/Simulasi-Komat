import 'server-only';
import {createHash} from 'node:crypto';
import questions from '../src/data/questions.json';
import answers from './answer-key.json';

// Migration pins this hash to an immutable private scoring-key snapshot.
// Retain source releases in Git by this version to trace full questions/explanations.
// Never send this archive or
// the answer module to students. Future scoring must resolve the stored version,
// never silently regrade an old attempt using the newest bank.
export const examVersion = `komat-sha256-${createHash('sha256')
  .update(JSON.stringify({questions, answers}))
  .digest('hex')}`;
