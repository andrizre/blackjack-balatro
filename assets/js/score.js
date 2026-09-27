// Evaluasi hand dan skor — modul murni. `drawCard` di-inject, bukan randomness internal.

export const CATEGORIES = [
  { key: 'straight_flush', name: 'Straight Flush', chips: 260, mult: 8 },
  { key: 'four_kind', name: 'Empat Kind', chips: 220, mult: 8 },
  { key: 'full_house', name: 'Full House', chips: 180, mult: 6 },
  { key: 'flush', name: 'Flush', chips: 140, mult: 4 },
  { key: 'straight', name: 'Straight', chips: 100, mult: 4 },
  { key: 'three_kind', name: 'Tiga Kind', chips: 80, mult: 3 },
  { key: 'two_pair', name: 'Dua Pasangan', chips: 60, mult: 2 },
  { key: 'pair', name: 'Pasangan', chips: 40, mult: 2 },
  { key: 'high', name: 'Kartu Biasa', chips: 30, mult: 1 },
];

const CATEGORY_BY_KEY = new Map(CATEGORIES.map((c) => [c.key, c]));
const RANK_ORDER = { A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13 };

export function handTotal(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.rank === 'A') {
      aces += 1;
      total += 11;
    } else {
      total += c.value;
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return { total, soft: aces > 0 };
}

export function isBust(cards) {
  return handTotal(cards).total > 21;
}

export function isNaturalBlackjack(cards) {
  if (cards.length !== 2) return false;
  const aces = cards.filter((c) => c.rank === 'A').length;
  const tens = cards.filter((c) => c.value === 10).length;
  return aces === 1 && tens === 1;
}

export function safeChips(cards) {
  const total = handTotal(cards).total;
  return total <= 21 ? Math.max(0, 100 - (21 - total) * 12) : 0;
}

function detectStraight(hand) {
  const orders = hand.map((c) => RANK_ORDER[c.rank]);
  if (new Set(orders).size !== 5) return false;
  const isRun = (arr) => arr.every((v, i) => i === 0 || v === arr[i - 1] + 1);
  const low = orders.slice().sort((a, b) => a - b);
  if (isRun(low)) return true;
  // Ace boleh tinggi: A-10-J-Q-K, tidak melingkar.
  const high = low.map((v) => (v === 1 ? 14 : v)).sort((a, b) => a - b);
  return isRun(high);
}

function evaluateFive(hand) {
  const counts = new Map();
  for (const c of hand) counts.set(c.rank, (counts.get(c.rank) || 0) + 1);
  const groups = [...counts.values()].sort((a, b) => b - a);
  const flush = hand.every((c) => c.suit === hand[0].suit);
  const straight = detectStraight(hand);
  if (straight && flush) return CATEGORY_BY_KEY.get('straight_flush');
  if (groups[0] === 4) return CATEGORY_BY_KEY.get('four_kind');
  if (groups[0] === 3 && groups[1] === 2) return CATEGORY_BY_KEY.get('full_house');
  if (flush) return CATEGORY_BY_KEY.get('flush');
  if (straight) return CATEGORY_BY_KEY.get('straight');
  if (groups[0] === 3) return CATEGORY_BY_KEY.get('three_kind');
  if (groups[0] === 2 && groups[1] === 2) return CATEGORY_BY_KEY.get('two_pair');
  if (groups[0] === 2) return CATEGORY_BY_KEY.get('pair');
  return CATEGORY_BY_KEY.get('high');
}

function combinations(arr, k) {
  const out = [];
  const walk = (start, acc) => {
    if (acc.length === k) {
      out.push(acc);
      return;
    }
    for (let i = start; i < arr.length; i++) walk(i + 1, acc.concat([arr[i]]));
  };
  walk(0, []);
  return out;
}

export function bestCategory(cards) {
  if (cards.length === 0) return CATEGORY_BY_KEY.get('high');
  const size = Math.min(5, cards.length);
  let best = null;
  for (const combo of combinations(cards, size)) {
    const cat = evaluateFive(combo);
    if (!best) best = cat;
    else {
      const bi = CATEGORIES.indexOf(cat);
      const bj = CATEGORIES.indexOf(best);
      if (bi >= 0 && (bj < 0 || bi < bj)) best = cat;
    }
  }
  return best || CATEGORY_BY_KEY.get('high');
}

function playDealer(dealerCards, drawCard, standOn, soft17) {
  const cards = dealerCards.slice();
  let t = handTotal(cards);
  let guard = 0;
  while (guard < 12 && (t.total < standOn || (soft17 && t.total === standOn && t.soft))) {
    const next = drawCard();
    if (!next) break;
    cards.push(next);
    t = handTotal(cards);
    guard += 1;
  }
  return cards;
}

export function resolveHand(ctx) {
  const {
    playerCards,
    dealerCards,
    doubled = false,
    jokers = [],
    vouchers = [],
    drawCard,
    standOn = 17,
    soft17 = false,
    winMult = 1,
  } = ctx;

  const { total } = handTotal(playerCards);
  const busted = total > 21;
  const playerBJ = isNaturalBlackjack(playerCards);
  const dealerBJ = isNaturalBlackjack(dealerCards);

  let finalDealer = dealerCards.slice();
  if (!busted && !dealerBJ) finalDealer = playDealer(dealerCards, drawCard, standOn, soft17);
  const dealerTotal = handTotal(finalDealer).total;

  let outcome;
  if (busted) outcome = 'BUST';
  else if (dealerBJ) outcome = 'DEALER_BJ';
  else if (playerBJ) outcome = 'PLAYER_BJ';
  else if (total > dealerTotal) outcome = 'WIN';
  else if (total === dealerTotal) outcome = 'PUSH';
  else outcome = 'LOSS';

  const category = bestCategory(playerCards);
  const scored = !busted && outcome !== 'DEALER_BJ';

  const baseChips = (playerBJ ? 300 : category.chips) + safeChips(playerCards);
  const baseMult = playerBJ ? 10 : category.mult;
  const doubleMult = doubled ? 2 : 1;

  let chipsAdd = 0;
  let multAdd = 0;
  let chipsMult = 1;
  let multMult = 1;
  let scoreMult = 1;
  let moneyDelta = 0;

  const jokerCtx = {
    cards: playerCards,
    total,
    busted,
    doubled,
    outcome,
    categoryKey: category.key,
    jokerCount: jokers.length,
  };

  const breakdown = [];
  breakdown.push({
    label: 'Kategori',
    detail: category.name,
    value: scored ? `${category.chips} x ${category.mult}` : '0 x 0',
  });
  breakdown.push({
    label: 'Safe Chips',
    detail: busted ? 'Bust' : `Total kartu ${total}`,
    value: scored ? safeChips(playerCards) : 0,
  });

  if (scored) {
    for (const joker of jokers) {
      // Joker deck-edit (mis. Bankir, Saring) tidak punya efek skor.
      const eff = typeof joker.score === 'function' ? joker.score(jokerCtx) || {} : {};
      const bits = [];
      if (eff.chipsAdd) { chipsAdd += eff.chipsAdd; bits.push(`+${eff.chipsAdd} Chips`); }
      if (eff.multAdd) { multAdd += eff.multAdd; bits.push(`+${eff.multAdd} Mult`); }
      if (eff.chipsMult && eff.chipsMult !== 1) { chipsMult *= eff.chipsMult; bits.push(`x${eff.chipsMult} Chips`); }
      if (eff.multMult && eff.multMult !== 1) { multMult *= eff.multMult; bits.push(`x${eff.multMult} Mult`); }
      if (eff.scoreMult && eff.scoreMult !== 1) { scoreMult *= eff.scoreMult; bits.push(`x${eff.scoreMult} Skor`); }
      if (eff.money) { moneyDelta += eff.money; bits.push(`+$${eff.money}`); }
      if (bits.length) breakdown.push({ label: joker.name, detail: joker.effectText, value: bits.join(', ') });
    }
    for (const voucher of vouchers) {
      const effect = voucher.effect || {};
      if (effect.chipsPerJoker) {
        const add = effect.chipsPerJoker * jokers.length;
        chipsAdd += add;
        breakdown.push({ label: voucher.name, detail: voucher.effectText, value: `+${add} Chips` });
      }
    }
  }

  let outcomeMult = 0;
  if (outcome === 'WIN' || outcome === 'PLAYER_BJ') outcomeMult = winMult;
  else if (outcome === 'PUSH') outcomeMult = 0.5;
  else if (outcome === 'LOSS') outcomeMult = 0.25;

  const chips = scored ? Math.floor(baseChips * doubleMult + chipsAdd) * chipsMult : 0;
  const mult = scored ? (baseMult + multAdd) * multMult : 0;
  const score = scored ? Math.floor(chips * mult * scoreMult * outcomeMult) : 0;

  let money = 0;
  if (outcome === 'WIN' || outcome === 'PLAYER_BJ') money = 4;
  else if (outcome === 'PUSH') money = 1;
  if (!scored) money = 0;
  money += scored ? moneyDelta : 0;

  const parts = [`Pengali double x${doubleMult}`];
  if (outcomeMult === winMult && winMult !== 1) parts.push(`pengali blind x${winMult}`);
  if (outcomeMult === 1) parts.push('hasil 1x');
  else if (outcomeMult !== 0) parts.push(`hasil ${outcomeMult}x`);
  breakdown.push({ label: 'Pengali', detail: parts.join(', '), value: outcomeMult });
  breakdown.push({ label: 'Hasil', detail: `${chips} x ${mult}`, value: score });

  return {
    outcome,
    category,
    total,
    dealerTotal,
    dealerCards: finalDealer,
    busted,
    doubled,
    baseChips,
    baseMult,
    doubleMult,
    chipsAdd,
    multAdd,
    chipsMult,
    multMult,
    scoreMult,
    outcomeMult,
    chips,
    mult,
    score,
    money,
    breakdown,
  };
}
