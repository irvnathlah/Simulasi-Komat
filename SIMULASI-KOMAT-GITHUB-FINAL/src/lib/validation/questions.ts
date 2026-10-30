import { z } from 'zod';
const option = z.object({ id: z.enum(['A','B','C','D']), text: z.string().min(1) });
export const questionSchema = z.object({
 id:z.string(), originalNumber:z.number().int().min(1).max(30), topic:z.string().min(1), originalTopic:z.string(), statement:z.string().min(1),
 options:z.tuple([option,option,option,option]).refine(v=>v.map(o=>o.id).join('')==='ABCD','Opsi harus A–D'),
 mathExpressions:z.array(z.string()), cryptarithm:z.object({addends:z.array(z.string()),sum:z.string()}).nullable(),
 diagram:z.object({src:z.string(),caption:z.string(),alt:z.string(),sourcePhysicalPage:z.number(),cropPixels:z.tuple([z.number(),z.number(),z.number(),z.number()]),renderSize:z.tuple([z.number(),z.number()]),provenance:z.string()}).nullable(),
 source:z.object({physicalPage:z.number(),printedPage:z.number(),originalText:z.string()}),auditFlags:z.array(z.string())
});
export const questionBankSchema = z.array(questionSchema).length(30).refine(v=>v.every((q,i)=>q.originalNumber===i+1) && new Set(v.map(q=>q.id)).size===30,'Nomor dan ID harus unik serta berurutan');
