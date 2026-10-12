import { readOrders, writeOrders, delay } from './store.js';

// Known-bad baseline: check-then-act without mutual exclusion. Concurrent
// checkouts carrying the same idempotency key all observe an empty store
// during the awaited authorization window and each appends its own order,
// so one checkout becomes several orders.
export async function createOrder(storePath, key) {
  const orders = await readOrders(storePath);
  const existing = orders.find((order) => order.key === key);
  if (existing) return existing;
  // Authorization I/O widens the race window between check and act.
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
