import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createOrder, countOrders } from '../src/checkout.js';

test('creates one order for a new checkout key', async () => {
  const store = join(await mkdtemp(join(tmpdir(), 'checkout-')), 'orders.json');
  await createOrder(store, 'key-1');
  assert.equal(await countOrders(store, 'key-1'), 1);
});

test('sequential duplicate checkout returns the same order', async () => {
  const store = join(await mkdtemp(join(tmpdir(), 'checkout-')), 'orders.json');
  const first = await createOrder(store, 'key-2');
  const second = await createOrder(store, 'key-2');
  assert.equal(first.id, second.id);
  assert.equal(await countOrders(store, 'key-2'), 1);
});
