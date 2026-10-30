import {z} from 'zod';
import {candidateSchema, sessionSchema} from './session';

export const capabilitySchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const revisionSchema = z.number().int().min(0).max(2147483647);
export const snapshotSchema = z.object({
  revision: revisionSchema.min(1),
  answers: z.array(z.object({option: z.enum(['A','B','C','D']).nullable(), flagged: z.boolean()}).strict()).length(30),
  current: z.number().int().min(0).max(29),
}).strict();
export const startRequestSchema = z.object({candidate: candidateSchema, nonce: capabilitySchema}).strict();
export const summarySchema = z.object({
  correct: z.number().int().min(0).max(30), incorrect: z.number().int().min(0).max(30),
  unanswered: z.number().int().min(0).max(30), finalScore: z.number().int().min(0).max(120),
  maximumScore: z.literal(120), scorePercentage: z.number().min(0).max(100),
  accuracy: z.number().min(0).max(100), completion: z.number().min(0).max(100),
}).strict().refine(r => r.correct+r.incorrect+r.unanswered === 30 && r.finalScore === r.correct*4);
export const remoteSchema = z.object({
  serverNow: z.number().int().positive(), revision: revisionSchema,
  session: sessionSchema, result: summarySchema.nullable(),
}).strict().refine(r => (r.result === null) === (r.session.submittedAt === null));
export type Remote = z.infer<typeof remoteSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
