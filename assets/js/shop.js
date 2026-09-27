// Isi toko — modul murni.

import { JOKERS } from './jokers.js';
import { VOUCHERS } from './vouchers.js';

export function makeShop(state, rng) {
  const owned = new Set(state.jokers);
  const pool = JOKERS.filter((j) => !owned.has(j.id)).map((j) => j.id);
  rng.shuffle(pool);
  const jokers = pool.slice(0, 2);
  const voucherPool = VOUCHERS.filter((v) => !state.vouchers.includes(v.id)).map((v) => v.id);
  rng.shuffle(voucherPool);
  return {
    jokers,
    voucher: voucherPool.length ? voucherPool[0] : null,
    rerollPrice: 5 + 3 * state.rerollsUsed,
  };
}
