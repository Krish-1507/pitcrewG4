import { mkdir, rm } from 'node:fs/promises';
import { readOrders, writeOrders, delay } from './store.js';

// Candidate C hypothesis: the check and the act must share one atomic
// filesystem lock, so concurrent checkouts serialize across processes and
// the idempotency key is re-checked inside the critical section.
async function withStoreLock(storePath, fn) {
  const lock = storePath + '.lock';
  for (let i = 0; i < 400; i++) {
    try {
      await mkdir(lock);
      try {
        return await fn();
      } finally {
        await rm(lock, { recursive: true, force: true });
      }
    } catch (error) {
      if (error?.code === 'EEXIST') {
        await delay(10);
        continue;
      }
      throw error;
    }
  }
  throw new Error('store lock timeout');
}

export async function createOrder(storePath, key) {
  return withStoreLock(storePath, async () => {
    const orders = await readOrders(storePath);
    const existing = orders.find((order) => order.key === key);
    if (existing) return existing;
    await delay(80);
    const fresh = await readOrders(storePath);
    const raced = fresh.find((order) => order.key === key);
    if (raced) return raced;
    const order = {
      key,
      id: 'ord_' + Math.random().toString(36).slice(2),
      createdAt: new Date().toISOString(),
    };
    fresh.push(order);
    await writeOrders(storePath, fresh);
    return order;
  });
}

export async function countOrders(storePath, key) {
  return (await readOrders(storePath)).filter((order) => order.key === key)
    .length;
}
