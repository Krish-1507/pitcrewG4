import { readOrders, writeOrders, delay } from './store.js';

const pending = new Map();

// Candidate A hypothesis: an application-level in-process mutex serializes
// concurrent checkouts that carry the same idempotency key.
export async function createOrder(storePath, key) {
  const slot = storePath + '#' + key;
  const flight = pending.get(slot);
  if (flight) return flight;
  const task = run(storePath, key);
  pending.set(slot, task);
  try {
    return await task;
  } finally {
    pending.delete(slot);
  }
}

async function run(storePath, key) {
  const orders = await readOrders(storePath);
  const existing = orders.find((order) => order.key === key);
  if (existing) return existing;
  await delay(80);
  const order = {
    key,
    id: 'ord_' + Math.random().toString(36).slice(2),
    createdAt: new Date().toISOString(),
  };
  const latest = await readOrders(storePath);
  latest.push(order);
  await writeOrders(storePath, latest);
  return order;
}

export async function countOrders(storePath, key) {
  return (await readOrders(storePath)).filter((order) => order.key === key)
    .length;
}
