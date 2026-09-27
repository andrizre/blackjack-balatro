// Jokers — modul murni. Tidak merender apa pun.

export const JOKERS = [
  {
    id: 'keping', name: 'Keping Tembaga', price: 4, effectText: '+50 Chips',
    score: () => ({ chipsAdd: 50 }),
  },
  {
    id: 'roda', name: 'Roda Keberuntungan', price: 4, effectText: '+2 Mult',
    score: () => ({ multAdd: 2 }),
  },
  {
    id: 'hati', name: 'Hati Hangat', price: 4, effectText: '+60 Chips jika hand memuat kartu Hati',
    score: (ctx) => (ctx.cards.some((c) => c.suit === 'h') ? { chipsAdd: 60 } : {}),
  },
  {
    id: 'sekop', name: 'Sekop Tajam', price: 4, effectText: '+3 Mult jika hand memuat kartu Sekop',
    score: (ctx) => (ctx.cards.some((c) => c.suit === 's') ? { multAdd: 3 } : {}),
  },
  {
    id: 'keriting', name: 'Keriting Kaku', price: 4, effectText: '+100 Chips jika hand memuat kartu Keriting',
    score: (ctx) => (ctx.cards.some((c) => c.suit === 'c') ? { chipsAdd: 100 } : {}),
  },
  {
    id: 'belang', name: 'Belanga Berduit', price: 4, effectText: '+4 Mult jika hand memuat kartu Belanga',
    score: (ctx) => (ctx.cards.some((c) => c.suit === 'd') ? { multAdd: 4 } : {}),
  },
  {
    id: 'liar', name: 'Joker Liar', price: 4, effectText: '+1 Mult untuk setiap kartu di hand',
    score: (ctx) => ({ multAdd: ctx.cards.length }),
  },
  {
    id: 'kancil', name: 'Kancil', price: 4, effectText: '+5 Mult jika total kartu 15 atau kurang',
    score: (ctx) => (ctx.total <= 15 ? { multAdd: 5 } : {}),
  },
  {
    id: 'palu', name: 'Palu Berat', price: 5, effectText: 'Pengali 1.4 Mult',
    score: () => ({ multMult: 1.4 }),
  },
  {
    id: 'kaca', name: 'Kaca Jernih', price: 5, effectText: 'Pengali 2 Mult untuk Straight, Flush, Straight Flush',
    score: (ctx) => (['straight', 'flush', 'straight_flush'].includes(ctx.categoryKey) ? { multMult: 2 } : {}),
  },
  {
    id: 'as_murni', name: 'As Murni', price: 5, effectText: '+2 Mult untuk setiap kartu As',
    score: (ctx) => ({ multAdd: ctx.cards.filter((c) => c.rank === 'A').length * 2 }),
  },
  {
    id: 'raja_tua', name: 'Raja Tua', price: 5, effectText: 'Pengali 1.5 Mult jika total kartu 16 atau lebih',
    score: (ctx) => (ctx.total >= 16 ? { multMult: 1.5 } : {}),
  },
  {
    id: 'ratu', name: 'Ratu Adil', price: 5, effectText: '+8 Mult untuk Pasangan, Dua Pasangan, Tiga Kind',
    score: (ctx) => (['pair', 'two_pair', 'three_kind'].includes(ctx.categoryKey) ? { multAdd: 8 } : {}),
  },
  {
    id: 'sirkus', name: 'Sirkus', price: 6, effectText: '+1 Mult untuk setiap joker yang dimiliki',
    score: (ctx) => ({ multAdd: ctx.jokerCount }),
  },
  {
    id: 'bintang', name: 'Bintang Pata', price: 6, effectText: 'Pengali 1.2 Mult untuk setiap kelipatan dua kartu',
    score: (ctx) => ({ multMult: Math.pow(1.2, Math.floor(ctx.cards.length / 2)) }),
  },
  {
    id: 'jam', name: 'Jam Pasir', price: 6, effectText: 'Hand limit +1 dan pengali skor 0.8',
    handLimit: 1,
    score: () => ({ scoreMult: 0.8 }),
  },
  {
    id: 'uang', name: 'Kotak Uang', price: 6, effectText: '+5 uang jika menang',
    score: (ctx) => (ctx.outcome === 'WIN' || ctx.outcome === 'PLAYER_BJ' ? { money: 5 } : {}),
  },
  {
    id: 'bank', name: 'Bankir', price: 5, effectText: 'Deck Adds kartu 5 dan 6 ganda',
    deckEdit: { addCards: ['5c', '5d', '5h', '5s', '6c', '6d', '6h', '6s'] },
  },
  {
    id: 'pabrik', name: 'Pabrik Kartu', price: 5, effectText: 'Deck Adds tiga kartu 2',
    deckEdit: { addCards: ['2c', '2d', '2h'] },
  },
  {
    id: 'tukang_besi', name: 'Tukang Besi', price: 6, effectText: 'Deck Removes semua kartu 9 dan 10',
    deckEdit: { removeRanks: ['9', '10'] },
  },
  {
    id: 'filter', name: 'Saring', price: 6, effectText: 'Deck Removes semua J, Q, K',
    deckEdit: { removeFace: true },
  },
  {
    id: 'timbangan', name: 'Timbangan', price: 6, effectText: 'Deck Removes semua kartu 2, 3, 4, 5',
    deckEdit: { removeRanks: ['2', '3', '4', '5'] },
  },
];

export const JOKER_BY_ID = new Map(JOKERS.map((j) => [j.id, j]));

export function handLimitBonus(jokers) {
  return jokers.reduce((sum, j) => sum + (j.handLimit || 0), 0);
}
