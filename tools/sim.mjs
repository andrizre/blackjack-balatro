// Harness balance — dijalankan dengan `node tools/sim.mjs`.
// Hanya mengimpor modul murni assets/js/, tanpa jaringan dan tanpa DOM.

import * as game from '../assets/js/game.js';
import { Rng } from '../assets/js/rng.js';
import { BLINDS } from '../assets/js/blinds.js';
import { JOKER_BY_ID } from '../assets/js/jokers.js';

const SEEDS = 200;
const LOADOUTS = [
  { key: 'tanpa joker', jokerIds: [] },
  { key: 'keping+roda+palu', jokerIds: ['keping', 'roda', 'palu'] },
];

const fmt = (n) => n.toLocaleString('id-ID');

function playHand(state, rng) {
  // Policy deterministik: double di 11-15, hit sampai 17 ke atas.
  let guard = 0;
  while (!state.hand.over && guard < 12) {
    guard += 1;
    const total = state.hand.total;
    if (state.hand.playerCards.length === 2 && !state.hand.doubled && total >= 11 && total <= 15
        && game.canDouble(state)) {
      game.double(state, rng);
      break;
    }
    if (total >= 17 || !game.canHit(state)) {
      game.stand(state, rng);
      break;
    }
    if (total < 12) {
      if (rng.int(3) === 0) game.stand(state, rng);
      else game.hit(state, rng);
    } else {
      game.hit(state, rng);
    }
  }
  if (!state.hand.over) game.stand(state, rng);
}

function shopPhase(state, rng, jokerIds) {
  let rerolls = 0;
  const wanted = (id) => jokerIds.includes(id) && !state.jokers.includes(id);
  for (let i = 0; i < state.shop.jokers.length; i++) {
    const id = state.shop.jokers[i];
    if (wanted(id) && game.buyJoker(state, id).ok) {
      // joker list-nya sudah diperbarui oleh buyJoker
    }
  }
  while (jokerIds.some(wanted) && rerolls < 2 && state.money >= state.shop.rerollPrice) {
    game.rerollShop(state, rng);
    rerolls += 1;
    for (const id of state.shop.jokers) {
      if (wanted(id)) game.buyJoker(state, id);
    }
  }
  if (state.shop.voucher) game.buyVoucher(state, state.shop.voucher);
  game.advance(state, rng);
}

export function simulate(seed, { jokerIds = [] } = {}) {
  const state = game.newRun(seed);
  const rng = new Rng(state.rngState);
  game.startBlind(state, rng);
  const cleared = new Array(BLINDS.length).fill(false);
  const scoreSum = new Array(BLINDS.length).fill(0);
  const handSum = new Array(BLINDS.length).fill(0);
  const broken = [];

  for (let guard = 0; guard < 400; guard++) {
    if (state.phase === 'playing') {
      const blindIndex = state.blindIndex;
      playHand(state, rng);
      const res = state.hand.result;
      if (res && (typeof res.score !== 'number' || Number.isNaN(res.score))) {
        broken.push({ seed, blindIndex, score: res.score });
      }
      if (res) {
        scoreSum[blindIndex] += res.score;
        handSum[blindIndex] += 1;
      }
      if (state.phase === 'shop' || state.phase === 'bossReward' || state.phase === 'win') cleared[blindIndex] = true;
      else if (state.hand.over) game.dealHand(state, rng);
      continue;
    }
    if (state.phase === 'shop') {
      shopPhase(state, rng, jokerIds);
      continue;
    }
    if (state.phase === 'bossReward') {
      game.chooseBossReward(state, 0);
      game.advance(state, rng);
      continue;
    }
    break;
  }

  return { phase: state.phase, ante: state.ante, blindIndex: state.blindIndex, cleared, scoreSum, handSum, broken, state };
}

function main() {
  const results = LOADOUTS.map((loadout) => {
    const clear = new Array(BLINDS.length).fill(0);
    const scoreSum = new Array(BLINDS.length).fill(0);
    const handSum = new Array(BLINDS.length).fill(0);
    const broken = [];
    let wins = 0;
    for (let i = 0; i < SEEDS; i++) {
      const run = simulate(`sim-${i}`, { jokerIds: loadout.jokerIds });
      for (let b = 0; b < BLINDS.length; b++) {
        if (run.cleared[b]) clear[b] += 1;
        scoreSum[b] += run.scoreSum[b];
        handSum[b] += run.handSum[b];
      }
      if (run.phase === 'win') wins += 1;
      broken.push(...run.broken);
    }
    return { loadout, clear, scoreSum, handSum, broken, wins };
  });

  const failures = [];

  for (const r of results) {
    console.log(`\n== Loadout: ${r.loadout.key} (${SEEDS} seed) ==`);
    console.log('ante  blind          target   clear rate   skor/hand');
    for (let b = 0; b < BLINDS.length; b++) {
      const blind = BLINDS[b];
      const rate = r.clear[b] / SEEDS;
      const perHand = r.handSum[b] ? r.scoreSum[b] / r.handSum[b] : 0;
      console.log(
        `${String(blind.ante).padStart(2)}    ${blind.name.padEnd(12)}  ${fmt(blind.target).padStart(8)}`
        + `   ${(rate * 100).toFixed(1).padStart(6)}%    ${fmt(Math.round(perHand)).padStart(8)}`,
      );
    }
    console.log(`win rate run penuh: ${(r.wins / SEEDS * 100).toFixed(1)}%  (${r.wins}/${SEEDS})`);
  }

  if (results.some((r) => r.broken.length)) {
    failures.push(`NaN/undefined pada score: ${JSON.stringify(results.flatMap((r) => r.broken).slice(0, 3))}`);
  }

  for (const r of results) {
    if (r.clear[0] / SEEDS < 0.9) {
      failures.push(`${r.loadout.key}: clear rate ante 1 small ${(r.clear[0] / SEEDS * 100).toFixed(1)}% < 90% (target ${BLINDS[0].target})`);
    }
  }

  const b = results[1];
  for (let i = 1; i < BLINDS.length; i++) {
    const prev = b.clear[i - 1] / SEEDS;
    const cur = b.clear[i] / SEEDS;
    if (prev - cur > 0.05) {
      failures.push(`${b.loadout.key}: regresi clear rate ${BLINDS[i - 1].name} ${(prev * 100).toFixed(1)}% -> ${BLINDS[i].name} ${(cur * 100).toFixed(1)}% (>5%)`);
    }
  }

  const winRate = b.wins / SEEDS;
  if (winRate < 0.1 || winRate > 0.6) {
    failures.push(`${b.loadout.key}: win rate ${(winRate * 100).toFixed(1)}% di luar 10%-60%`);
  }

  if (failures.length) {
    console.error('\nGATE GAGAL:');
    for (const f of failures) console.error(` - ${f}`);
    process.exit(1);
  }
  console.log('\nGATE HIJAU: semua pemeriksaan lolos.');
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('sim.mjs');
if (invokedDirectly) main();
