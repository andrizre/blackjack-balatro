// State machine run — modul murni, tanpa DOM, jaringan, atau storage.

import { Rng } from './rng.js';
import { standardDeck, attachImages, deckEdits } from './cards.js';
import * as score from './score.js';
import { JOKER_BY_ID, handLimitBonus } from './jokers.js';
import { VOUCHER_BY_ID } from './vouchers.js';
import { BLINDS, isBoss } from './blinds.js';
import { makeShop } from './shop.js';

export const STATE_VERSION = 1;
export const BASE_HAND_LIMIT = 4;
export const BASE_JOKER_SLOTS = 5;
export const MAX_JOKER_SLOTS = 8;
export const START_MONEY = 12;

let canonical = null;
let canonicalSource = 'local';

export function setCanonicalDeck(cards, source) {
  canonical = cards && cards.length ? cards : null;
  canonicalSource = canonical ? (source || 'local') : 'local';
}

function freshDeck() {
  const base = canonical ? canonical.map((c) => ({ ...c })) : standardDeck();
  return canonical ? attachImages(base, canonical) : base;
}

export function jokersOf(state) {
  return state.jokers.map((id) => JOKER_BY_ID.get(id)).filter(Boolean);
}

export function vouchersOf(state) {
  return state.vouchers.map((id) => VOUCHER_BY_ID.get(id)).filter(Boolean);
}

export function currentBlind(state) {
  return BLINDS[state.blindIndex];
}

function pushBanner(state, text, tone = 'warn') {
  state.banners.push({ text, tone });
}

function dealFrom(state, rng) {
  if (state.draw.length === 0) {
    if (state.discard.length > 0) {
      state.draw = rng.shuffle(state.discard.splice(0, state.discard.length));
    } else {
      state.draw = rng.shuffle(state.deck.map((c) => ({ ...c })));
      pushBanner(state, 'DECK DIACAK ULANG');
    }
  }
  return state.draw.pop();
}

export function dealHand(state, rng) {
  if (state.draw.length < 6) {
    if (state.discard.length > 0) {
      state.draw = rng.shuffle(state.draw.concat(state.discard.splice(0, state.discard.length)));
    } else {
      state.draw = rng.shuffle(state.deck.map((c) => ({ ...c })));
    }
    pushBanner(state, 'DECK DIACAK ULANG');
  }
  const playerCards = [dealFrom(state, rng), dealFrom(state, rng)];
  const dealerCards = [dealFrom(state, rng), dealFrom(state, rng)];
  state.hand = {
    playerCards,
    dealerCards,
    dealerTotal: score.handTotal(dealerCards).total,
    total: score.handTotal(playerCards).total,
    dealerTurn: false,
    stood: false,
    doubled: false,
    over: false,
    result: null,
  };
  state.rngState = rng.state;
  return state.hand;
}

function mergedDeckEdits(state) {
  const edits = { addCards: [], removeRanks: [], removeFace: false };
  for (const e of state.pendingDeckEdits) {
    if (e.addCards) edits.addCards.push(...e.addCards);
    if (e.removeRanks) edits.removeRanks.push(...e.removeRanks);
    if (e.removeFace) edits.removeFace = true;
  }
  return edits;
}

export function startBlind(state, rng) {
  // Edit deck dari joker yang dibeli di toko ronde sebelumnya sudah masuk state.deck
  // lewat pendingDeckEdits; cukup antrean itu yang perlu diterapkan di sini.
  const edits = mergedDeckEdits(state);
  if (edits.addCards.length > 0 || edits.removeRanks.length > 0 || edits.removeFace) {
    state.deck = deckEdits(state.deck, edits);
    pushBanner(state, 'DECK BERUBAH');
  }
  state.pendingDeckEdits = [];
  state.draw = rng.shuffle(state.deck.map((c) => ({ ...c })));
  pushBanner(state, 'DECK DIACAK ULANG');
  state.discard = [];
  state.score = 0;
  state.handsUsed = 0;
  state.rerollsUsed = 0;
  const promo = state.vouchers.filter((id) => id === 'promo').length;
  state.handLimit = BASE_HAND_LIMIT + handLimitBonus(jokersOf(state)) + promo;
  state.phase = 'playing';
  dealHand(state, rng);
  return state;
}

export function canHit(state) {
  const h = state.hand;
  return state.phase === 'playing' && h && !h.over && !h.stood && !h.dealerTurn && h.total <= 21;
}

export function canStand(state) {
  const h = state.hand;
  return state.phase === 'playing' && h && !h.over && !h.dealerTurn;
}

export function canDouble(state) {
  const h = state.hand;
  return state.phase === 'playing' && h && !h.over && !h.stood && !h.dealerTurn
    && h.playerCards.length === 2 && !h.doubled && currentBlind(state).allowDouble;
}

export function hit(state, rng) {
  if (!canHit(state)) return null;
  const card = dealFrom(state, rng);
  state.hand.playerCards.push(card);
  state.hand.total = score.handTotal(state.hand.playerCards).total;
  if (state.hand.total > 21) return resolve(state, rng);
  state.rngState = rng.state;
  return null;
}

export function stand(state, rng) {
  if (!canStand(state)) return null;
  state.hand.stood = true;
  return resolve(state, rng);
}

export function double(state, rng) {
  if (!canDouble(state)) return null;
  state.hand.doubled = true;
  const card = dealFrom(state, rng);
  state.hand.playerCards.push(card);
  state.hand.total = score.handTotal(state.hand.playerCards).total;
  return resolve(state, rng);
}

export function resolve(state, rng) {
  const h = state.hand;
  if (h.over) return h.result;
  const blind = currentBlind(state);
  const result = score.resolveHand({
    playerCards: h.playerCards,
    dealerCards: h.dealerCards,
    doubled: h.doubled,
    jokers: jokersOf(state),
    vouchers: vouchersOf(state),
    drawCard: () => dealFrom(state, rng),
    standOn: blind.standOn,
    soft17: blind.soft17,
    allowDouble: blind.allowDouble,
    winMult: blind.winMult,
  });
  h.over = true;
  h.dealerTurn = true;
  h.dealerCards = result.dealerCards;
  h.dealerTotal = result.dealerTotal;
  h.result = result;
  state.score += result.score;
  state.money += result.money;
  state.handsUsed += 1;
  state.discard.push(...h.playerCards, ...h.dealerCards);
  state.history.push({
    blind: blind.name,
    blindIndex: state.blindIndex,
    outcome: result.outcome,
    category: result.category.name,
    score: result.score,
  });
  if (state.history.length > 40) state.history.splice(0, state.history.length - 40);
  if (result.outcome === 'PLAYER_BJ') pushBanner(state, 'BLACKJACK!');
  else if (result.busted) pushBanner(state, 'BUST', 'warn');

  if (state.score >= blind.target) {
    state.money += blind.reward;
    state.bestAnte = Math.max(state.bestAnte || 0, state.ante);
    state.bestScore = Math.max(state.bestScore || 0, state.score);
    if (isBoss(blind)) {
      if (state.ante >= 3) {
        state.phase = 'win';
      } else {
        state.bossChoices = pickBossChoices(state, rng);
        state.bossRewardTaken = false;
        state.phase = 'bossReward';
      }
    } else {
      state.shop = makeShop(state, rng);
      state.phase = 'shop';
    }
  } else if (state.handsUsed >= state.handLimit) {
    state.phase = 'gameover';
  }
  state.rngState = rng.state;
  return result;
}

function pickBossChoices(state, rng) {
  const owned = new Set(state.jokers);
  const pool = [];
  for (const j of JOKER_BY_ID.values()) if (!owned.has(j.id)) pool.push(j.id);
  rng.shuffle(pool);
  return pool.slice(0, 3);
}

export function advance(state, rng) {
  if (state.phase === 'bossReward') {
    state.bossChoices = null;
    state.shop = makeShop(state, rng);
    state.phase = 'shop';
    state.rngState = rng.state;
    return state;
  }
  if (state.phase === 'shop') {
    state.shop = null;
    state.blindIndex += 1;
    if (state.blindIndex >= BLINDS.length) {
      state.phase = 'win';
      return state;
    }
    if (state.blindIndex % 3 === 0) {
      state.ante += 1;
      state.jokerSlots = Math.min(MAX_JOKER_SLOTS, state.jokerSlots + 1);
    }
    startBlind(state, rng);
    return state;
  }
  return state;
}

export function buyJoker(state, jokerId) {
  const joker = JOKER_BY_ID.get(jokerId);
  if (!joker) return { ok: false, reason: 'Joker tidak dikenal' };
  if (state.jokers.includes(jokerId)) return { ok: false, reason: 'Sudah dimiliki' };
  if (state.jokers.length >= state.jokerSlots) return { ok: false, reason: 'Slot joker penuh' };
  if (state.money < joker.price) return { ok: false, reason: 'Uang tidak cukup' };
  state.money -= joker.price;
  state.jokers.push(jokerId);
  if (joker.deckEdit) {
    state.pendingDeckEdits.push({ ...joker.deckEdit });
    pushBanner(state, 'DECK BERUBAH - berlaku ronde berikutnya');
  }
  if (state.shop) {
    state.shop.jokers = state.shop.jokers.filter((id) => id !== jokerId);
  }
  return { ok: true };
}

export function buyVoucher(state, voucherId) {
  const voucher = VOUCHER_BY_ID.get(voucherId);
  if (!voucher) return { ok: false, reason: 'Voucher tidak dikenal' };
  if (state.vouchers.includes(voucherId)) return { ok: false, reason: 'Sudah dimiliki' };
  if (state.money < voucher.price) return { ok: false, reason: 'Uang tidak cukup' };
  state.money -= voucher.price;
  state.vouchers.push(voucherId);
  const effect = voucher.effect || {};
  if (effect.money) state.money += effect.money;
  if (effect.jokerSlots) state.jokerSlots = Math.min(MAX_JOKER_SLOTS, state.jokerSlots + effect.jokerSlots);
  if (state.shop && state.shop.voucher === voucherId) state.shop.voucher = null;
  return { ok: true };
}

export function rerollShop(state, rng) {
  if (!state.shop) return { ok: false, reason: 'Tidak ada toko' };
  const price = 5 + 3 * state.rerollsUsed;
  if (state.money < price) return { ok: false, reason: 'Uang tidak cukup' };
  state.money -= price;
  state.rerollsUsed += 1;
  state.shop = makeShop(state, rng);
  state.rngState = rng.state;
  return { ok: true };
}

export function chooseBossReward(state, index) {
  if (state.phase !== 'bossReward' || state.bossRewardTaken) {
    return { ok: false, reason: 'Hadiah boss sudah diambil' };
  }
  const choices = state.bossChoices || [];
  let jokerId = choices[index] || null;
  // Slot penuh: hadiah joker otomatis jatuh ke uang, jangan melebihi kapasitas.
  if (jokerId && state.jokers.length >= state.jokerSlots) {
    jokerId = null;
    pushBanner(state, 'SLOT JOKER PENUH - hadiah jadi $10', 'warn');
  }
  if (jokerId) {
    state.jokers.push(jokerId);
    const joker = JOKER_BY_ID.get(jokerId);
    if (joker && joker.deckEdit) {
      state.pendingDeckEdits.push({ ...joker.deckEdit });
      pushBanner(state, 'DECK BERUBAH - berlaku ronde berikutnya');
    }
  } else {
    state.money += 10;
  }
  state.bossChoices = null;
  state.bossRewardTaken = true;
  return { ok: true, jokerId, money: jokerId ? 0 : 10 };
}

export function newRun(seed) {
  const rng = new Rng(seed);
  const state = {
    version: STATE_VERSION,
    seed: String(seed),
    deckSource: canonicalSource,
    rngState: rng.state,
    phase: 'playing',
    ante: 1,
    blindIndex: 0,
    money: START_MONEY,
    jokers: [],
    vouchers: [],
    jokerSlots: BASE_JOKER_SLOTS,
    handLimit: BASE_HAND_LIMIT,
    score: 0,
    handsUsed: 0,
    rerollsUsed: 0,
    deck: freshDeck(),
    draw: [],
    discard: [],
    hand: null,
    shop: null,
    bossChoices: null,
    bossRewardTaken: false,
    pendingDeckEdits: [],
    banners: [],
    history: [],
    bestAnte: 0,
    bestScore: 0,
  };
  state.rngState = rng.state;
  return state;
}

export function stateToJSON(state) {
  return JSON.stringify(state);
}

export function loadState(json) {
  if (!json) return null;
  let parsed;
  try {
    parsed = typeof json === 'string' ? JSON.parse(json) : json;
  } catch (err) {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  if (parsed.version !== STATE_VERSION) return null;
  if (!Array.isArray(parsed.draw) || !Array.isArray(parsed.deck) || !Array.isArray(parsed.jokers)) return null;
  if (typeof parsed.blindIndex !== 'number' || parsed.blindIndex < 0 || parsed.blindIndex >= BLINDS.length) return null;
  if (!parsed.hand || !Array.isArray(parsed.hand.playerCards)) return null;
  return parsed;
}
