import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sum } from './src/sum.js';
import { lineTotal } from './src/cart/line.js';
test('adds item totals', () => assert.equal(sum(2, 3), 5));
test('multiplies quantity by price', () => assert.equal(lineTotal(2, 3), 6));
test('empty cart line costs zero', () => assert.equal(lineTotal(4, 0), 0));
