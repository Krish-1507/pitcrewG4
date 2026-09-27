import assert from 'node:assert/strict';
import test from 'node:test';
import { sum } from '../src/sum.js';

test('adds two positive numbers', () => assert.equal(sum(2, 3), 5));
test('adds negative numbers', () => assert.equal(sum(-2, -3), -5));
test('adding zero preserves a number', () => assert.equal(sum(7, 0), 7));
