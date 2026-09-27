import { expect, test } from 'vitest';
import { verdictSchema } from './index.js';

test('only explicit evidence outcomes are accepted', () => {
  expect(verdictSchema.safeParse('done').success).toBe(false);
  expect(verdictSchema.parse('NOT_PROVEN')).toBe('NOT_PROVEN');
});
