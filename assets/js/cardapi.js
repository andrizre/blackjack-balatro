// Sumber kartu dari deckofcardsapi.com. Satu-satunya jalur jaringan di game ini.
// API hanya menyediakan katalog kartu + URL gambar; urutan deck ditentukan Rng lokal.

import { standardDeck, canonicalDeck } from './cards.js';

export const API_BASE = 'https://deckofcardsapi.com/api';
export const STATIC_BASE = 'https://deckofcardsapi.com/static/img';
export const BACK_IMAGE_URL = `${STATIC_BASE}/back.png`;
const CACHE_KEY = 'bjbalatro.api.v1';
const CACHE_TTL = 7 * 24 * 3600 * 1000;

export function imageUrl(card) {
  if (card.image) return card.image;
  return `${STATIC_BASE}/${card.id}.png`;
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.cards) || parsed.cards.length !== 52) return null;
    if (!(Date.now() - parsed.ts < CACHE_TTL)) return null;
    return parsed.cards;
  } catch (err) {
    return null;
  }
}

function writeCache(cards) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), cards }));
  } catch (err) {
    // cache penuh atau ditolak browser: abaikan, game tetap jalan
  }
}

export async function fetchCanonicalDeck({ timeoutMs = 8000 } = {}) {
  const cached = readCache();
  if (cached) return { cards: cached, source: 'cache' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const shuffleRes = await fetch(`${API_BASE}/deck/new/shuffle/`, { signal: controller.signal });
    if (!shuffleRes.ok) throw new Error(`HTTP ${shuffleRes.status}`);
    const shuffleJson = await shuffleRes.json();
    if (shuffleJson.success !== true || !shuffleJson.deck_id) throw new Error('respons shuffle tidak valid');

    const drawRes = await fetch(`${API_BASE}/deck/${shuffleJson.deck_id}/draw/?count=52`, { signal: controller.signal });
    if (!drawRes.ok) throw new Error(`HTTP ${drawRes.status}`);
    const drawJson = await drawRes.json();
    if (drawJson.success !== true || !Array.isArray(drawJson.cards) || drawJson.cards.length !== 52) {
      throw new Error('respons draw tidak valid');
    }
    const cards = canonicalDeck(drawJson.cards);
    writeCache(cards);
    return { cards, source: 'api' };
  } catch (err) {
    return { cards: standardDeck(), source: 'local' };
  } finally {
    clearTimeout(timer);
  }
}

export function preloadImages(cards) {
  const jobs = cards
    .filter((c) => c.image)
    .map((c) => new Promise((resolve) => {
      const img = new Image();
      img.onload = resolve;
      img.onerror = resolve;
      img.src = c.image;
    }));
  if (jobs.length === 0) return Promise.resolve();
  return Promise.race([
    Promise.all(jobs),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
}
