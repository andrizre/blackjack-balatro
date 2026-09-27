// Bootstrap: memuat deck, memasang delegator aksi, menyimpan state di batas ronde.

import { Rng } from './rng.js';
import { fetchCanonicalDeck, preloadImages } from './cardapi.js';
import * as game from './game.js';
import * as ui from './ui.js';
import { initAudio, resumeAudio, setMuted, isMuted, sfx } from './audio.js';

const SAVE_KEY = 'bjbalatro.v1';
const META_KEY = 'bjbalatro.meta.v1';

let seed = randomSeed();
let state = null;
let rng = null;
let meta = { bestAnte: 0, bestScore: 0, muted: false };

function randomSeed() {
  return Math.random().toString(36).slice(2, 10);
}

function readMeta() {
  try {
    return JSON.parse(localStorage.getItem(META_KEY)) || meta;
  } catch (err) {
    return meta;
  }
}

function writeMeta() {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch (err) {
    // storage ditolak: rekor hanya bertahan di sesi ini
  }
}

function readSave() {
  try {
    return game.loadState(localStorage.getItem(SAVE_KEY));
  } catch (err) {
    return null;
  }
}

function writeSave() {
  if (!state) return;
  try {
    localStorage.setItem(SAVE_KEY, game.stateToJSON(state));
  } catch (err) {
    // abaikan
  }
}

function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (err) {
    // abaikan
  }
}

function draw() {
  if (state) ui.render(state);
}

function startRun(runSeed) {
  seed = runSeed;
  state = game.newRun(seed);
  rng = new Rng(state.rngState);
  game.startBlind(state, rng);
  sfx.deal();
  writeSave();
  draw();
}

function finishIfRunOver() {
  if (state.phase !== 'gameover' && state.phase !== 'win') return;
  const newBest = state.ante > (meta.bestAnte || 0) || state.score > (meta.bestScore || 0);
  if (state.ante > (meta.bestAnte || 0)) meta.bestAnte = state.ante;
  if (state.score > (meta.bestScore || 0)) meta.bestScore = state.score;
  ui.mount({ seed, saveAvailable: false, meta, newBest });
  writeMeta();
  clearSave();
}

function actHand(fn, sound) {
  if (!state || state.phase !== 'playing' || state.hand.over) return;
  fn();
  sound();
  if (state.hand.over) {
    const outcome = state.hand.result.outcome;
    if (outcome === 'WIN' || outcome === 'PLAYER_BJ') sfx.win();
    else sfx.lose();
  }
  finishIfRunOver();
  draw();
}

function respond(result) {
  if (result && result.ok === false) sfx.error();
  else sfx.coin();
  draw();
  if (state.phase === 'playing') writeSave();
}

const actions = {
  'new-run': () => startRun(randomSeed()),
  'new-run-seed': () => startRun(randomSeed()),
  retry: () => startRun(state.seed),
  continue: () => {
    const saved = readSave();
    if (!saved) return;
    state = saved;
    seed = state.seed;
    rng = new Rng(state.rngState);
    draw();
  },
  title: () => {
    state = null;
    ui.mount({ seed, saveAvailable: Boolean(readSave()), meta });
    ui.render(null);
  },
  mute: () => {
    initAudio();
    setMuted(!isMuted());
    meta.muted = isMuted();
    writeMeta();
    draw();
  },
  hit: () => actHand(() => game.hit(state, rng), sfx.hit),
  stand: () => actHand(() => game.stand(state, rng), sfx.stand),
  double: () => actHand(() => game.double(state, rng), sfx.hit),
  'next-hand': () => {
    game.dealHand(state, rng);
    sfx.deal();
    draw();
  },
  'open-shop': () => {
    ui.reopenModal();
    draw();
  },
  'buy-joker': (target) => respond(game.buyJoker(state, target.dataset.id)),
  'buy-voucher': (target) => respond(game.buyVoucher(state, target.dataset.id)),
  reroll: () => respond(game.rerollShop(state, rng)),
  'boss-reward': (target) => respond(game.chooseBossReward(state, Number(target.dataset.index))),
  advance: () => {
    const allowed = state.phase === 'shop' || (state.phase === 'bossReward' && state.bossRewardTaken);
    if (!allowed) return;
    game.advance(state, rng);
    if (state.phase === 'playing') {
      writeSave();
      sfx.deal();
    }
    finishIfRunOver();
    draw();
  },
};

function onAction(event) {
  const target = event.target.closest('[data-action]');
  if (!target || target.disabled) return;
  const handler = actions[target.dataset.action];
  if (!handler) return;
  event.preventDefault();
  handler(target);
}

function onKey(event) {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const key = event.key.toLowerCase();
  if (key === 'm') {
    actions.mute();
    return;
  }
  if (key === 'escape') {
    ui.dismissModal();
    return;
  }
  if (!state || state.phase !== 'playing') return;
  if (key === ' ' || key === 'spacebar') {
    event.preventDefault();
    actions.hit();
  } else if (key === 'enter') {
    event.preventDefault();
    actions.stand();
  } else if (key === 'd') {
    actions.double();
  }
}

async function boot() {
  const paramSeed = new URLSearchParams(location.search).get('seed');
  if (paramSeed) seed = paramSeed;

  meta = readMeta();
  ui.mount({ seed, saveAvailable: false, meta });
  ui.renderLoading(seed);

  const result = await fetchCanonicalDeck();
  game.setCanonicalDeck(result.cards, result.source);
  await preloadImages(result.cards);

  ui.mount({ seed, saveAvailable: Boolean(readSave()), meta });
  ui.render(null);
}

function firstGesture() {
  initAudio();
  resumeAudio();
}

document.addEventListener('pointerdown', firstGesture, { once: true });
document.addEventListener('keydown', firstGesture, { once: true });
document.addEventListener('click', onAction);
document.addEventListener('keydown', onKey);

boot();
