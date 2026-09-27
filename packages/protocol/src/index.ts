import { z } from 'zod';

export const verdictSchema = z.enum(['VERIFIED', 'BLOCKED', 'NOT_PROVEN']);
export type Verdict = z.infer<typeof verdictSchema>;
