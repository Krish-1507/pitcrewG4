import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { setTimeout } from 'node:timers/promises';

export async function readOrders(storePath) {
  try {
    return JSON.parse(await readFile(storePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

export async function writeOrders(storePath, orders) {
  await mkdir(dirname(storePath), { recursive: true });
  await writeFile(storePath, JSON.stringify(orders, null, 2));
}

export const delay = (ms) => setTimeout(ms);
