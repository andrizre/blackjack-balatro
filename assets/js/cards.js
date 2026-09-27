// Kartu dan deck — modul murni, tanpa DOM dan tanpa jaringan.

export const SUITS = ['h', 'd', 'c', 's'];
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const SUIT_SYMBOL = { h: '♥', d: '♦', c: '♣', s: '♠' };
export const SUIT_NAME = { h: 'Hati', d: 'Belanga', c: 'Keriting', s: 'Sekop' };
export const SUIT_CODE = { c: 'C', d: 'D', h: 'H', s: 'S' };

const API_SUIT_CODE = { CLUBS: 'c', DIAMONDS: 'd', HEARTS: 'h', SPADES: 's' };
const API_RANK = { ACE: 'A', JACK: 'J', QUEEN: 'Q', KING: 'K', '10': '10' };

// deckofcardsapi.com memakai digit '0' untuk kartu 10 (mis. 0H.png, bukan 10H.png).
export function codeOf(rank, suit) {
  return (rank === '10' ? '0' : rank) + SUIT_CODE[suit];
}

export function cardValue(rank) {
  if (rank === 'A') return 11;
  if (rank === '10' || rank === 'J' || rank === 'Q' || rank === 'K') return 10;
  return Number(rank);
}

export function makeCard(rank, suit, image = null) {
  return Object.freeze({
    id: codeOf(rank, suit),
    rank,
    suit,
    value: cardValue(rank),
    image,
  });
}

export function standardDeck() {
  const cards = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) cards.push(makeCard(rank, suit));
  }
  return cards;
}

// Respons deckofcardsapi.com tidak punya field `rank`; rank datang di `value`
// (ACE/JACK/QUEEN/KING/angka) dan selalu bisa diturunkan dari `code`.
function rankFromCode(code) {
  const head = String(code).slice(0, -1).toUpperCase();
  return head === '0' ? '10' : head;
}

export function canonicalDeck(apiCards) {
  return apiCards.map((api) => {
    const suit = API_SUIT_CODE[String(api.suit || '').toUpperCase()]
      || SUIT_BY_CODE[String(api.code).slice(-1).toUpperCase()];
    const raw = String(api.rank || api.value || rankFromCode(api.code)).toUpperCase();
    const rank = API_RANK[raw] || raw;
    if (!suit || !RANKS.includes(rank)) throw new Error('Kartu API tidak dikenal: ' + JSON.stringify(api.code));
    return makeCard(rank, suit, (api.images && api.images.png) || null);
  });
}

export function cardLabel(card) {
  return card.rank + SUIT_SYMBOL[card.suit];
}

export function attachImages(cards, canonical) {
  if (!canonical || canonical.length === 0) return cards;
  const byId = new Map();
  for (const c of canonical) if (c.image && !byId.has(c.id)) byId.set(c.id, c.image);
  return cards.map((c) => {
    if (c.image !== null || !byId.has(c.id)) return c;
    return { ...c, image: byId.get(c.id) };
  });
}

const SUIT_BY_CODE = { C: 'c', D: 'd', H: 'h', S: 's' };

function makeCardById(id) {
  const code = String(id);
  const suit = SUIT_BY_CODE[code.slice(-1).toUpperCase()];
  const rankChar = code.slice(0, -1).toUpperCase();
  const rank = rankChar === '0' ? '10' : rankChar;
  if (!suit || !RANKS.includes(rank)) throw new Error('id kartu tidak dikenal: ' + id);
  return makeCard(rank, suit);
}

export function deckEdits(deck, edits) {
  const next = deck.map((c) => ({ ...c }));
  const present = new Set(next.map((c) => c.id));
  if (edits && edits.addCards) {
    for (const id of edits.addCards) {
      if (present.has(id)) continue;
      const card = makeCardById(id);
      next.push(card);
      present.add(card.id);
    }
  }
  let out = next;
  if (edits && edits.removeRanks) {
    const kill = new Set(edits.removeRanks.map((r) => String(r).toUpperCase()));
    out = out.filter((c) => !kill.has(c.rank));
  }
  if (edits && edits.removeFace) {
    out = out.filter((c) => c.rank !== 'J' && c.rank !== 'Q' && c.rank !== 'K');
  }
  return out;
}
