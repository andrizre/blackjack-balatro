// Render UI dari objek state. Semua aksi memakai atribut data-action yang
// ditangani satu delegator di main.js.

import { JOKER_BY_ID } from './jokers.js';
import { VOUCHER_BY_ID } from './vouchers.js';
import { currentBlind, canHit, canStand, canDouble } from './game.js';
import { cardLabel, SUIT_SYMBOL } from './cards.js';
import { imageUrl, BACK_IMAGE_URL } from './cardapi.js';
import { isMuted } from './audio.js';

const OUTCOME_LABEL = {
  WIN: 'MENANG',
  PUSH: 'SERI',
  LOSS: 'KALAH',
  BUST: 'BUST',
  PLAYER_BJ: 'BLACKJACK',
  DEALER_BJ: 'DEALER BLACKJACK',
};

const fmt = (n) => Math.round(n).toLocaleString('id-ID');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let el = {};
let ctx = { seed: '', saveAvailable: false, meta: { bestAnte: 0, bestScore: 0 } };
let localNoticeShown = false;
let modalDismissed = false;
let localMode = false;

export function mount(context) {
  ctx = { ...ctx, ...context };
  el = {
    title: document.getElementById('screen-title'),
    game: document.getElementById('screen-game'),
    gameover: document.getElementById('screen-gameover'),
    win: document.getElementById('screen-win'),
    modal: document.getElementById('modal-shop'),
  };
}

function show(screen, node) {
  el.modal.classList.remove('open');
  for (const key of ['title', 'game', 'gameover', 'win']) {
    if (el[key]) el[key].classList.toggle('active', key === screen);
  }
  const host = el[screen];
  host.innerHTML = node;
  return host;
}

function cardEl(card, { faceDown = false, dim = false, last = false } = {}) {
  const classes = ['card'];
  if (faceDown) {
    classes.push('back');
    const img = localMode
      ? ''
      : `<img class="card-img" src="${BACK_IMAGE_URL}" alt="kartu tertutup" decoding="async">`;
    return `<div class="${classes.join(' ')}">${img}</div>`;
  }
  if (dim) classes.push('dim');
  if (last) classes.push('last');
  const label = cardLabel(card);
  if (card.image) {
    return `<div class="${classes.join(' ')}" title="${label}"><img class="card-img" src="${imageUrl(card)}" alt="${label}" decoding="async"></div>`;
  }
  const red = card.suit === 'h' || card.suit === 'd';
  classes.push('fallback');
  if (red) classes.push('red');
  return `<div class="${classes.join(' ')}"><span class="rank">${esc(card.rank)}</span><span class="suit">${SUIT_SYMBOL[card.suit]}</span></div>`;
}

function renderTitle() {
  const best = ctx.meta || {};
  const bestLine = best.bestAnte
    ? `Terbaik: Ante ${best.bestAnte} - Skor ${fmt(best.bestScore || 0)}`
    : 'Belum ada run yang selesai';
  const html = `
    <div class="title-wrap">
      <h1>BLACKJACK BALATRO</h1>
      <p>Blackjack sungguhan, skor ala Balatro. Kumpulkan chip, ganti joker, tembus sembilan blind.</p>
      <p>Seed: <strong>${esc(ctx.seed)}</strong></p>
      <p>${esc(bestLine)}</p>
      <div class="title-actions">
        <button class="btn primary" data-action="new-run">Mulai Run</button>
        ${ctx.saveAvailable ? '<button class="btn ghost" data-action="continue">Lanjutkan</button>' : ''}
        <button class="btn ghost" data-action="mute">${isMuted() ? 'Suara: Mati' : 'Suara: Nyala'}</button>
      </div>
    </div>`;
  return show('title', html);
}

function renderRack(state) {
  const jokerItems = state.jokers.map((id) => {
    const j = JOKER_BY_ID.get(id);
    if (!j) return '';
    return `<div class="rack-item" title="${esc(j.effectText)}">
      <div class="name">${esc(j.name)}</div>
      <div class="effect">${esc(j.effectText)}</div>
    </div>`;
  }).join('');
  const voucherItems = state.vouchers.map((id) => {
    const v = VOUCHER_BY_ID.get(id);
    if (!v) return '';
    return `<div class="rack-item voucher" title="${esc(v.effectText)}">
      <div class="name">${esc(v.name)}</div>
      <div class="effect">${esc(v.effectText)}</div>
    </div>`;
  }).join('');
  return `
    <div class="panel">
      <h3>Joker ${state.jokers.length}/${state.jokerSlots}</h3>
      ${jokerItems || '<div class="rack-empty">Belum ada joker.</div>'}
      <h3 style="margin-top:10px">Voucher</h3>
      ${voucherItems || '<div class="rack-empty">Belum ada voucher.</div>'}
    </div>`;
}

function renderTable(state) {
  const hand = state.hand;
  const blind = currentBlind(state);
  const dealerFaceUp = hand.dealerTurn || hand.over;
  const lastIndex = hand.over ? -1 : hand.playerCards.length - 1;
  const dealerCards = hand.dealerCards.map((c, i) => cardEl(c, {
    faceDown: i === 1 && !dealerFaceUp,
    dim: i === 1 && !dealerFaceUp,
  })).join('');
  const playerCards = hand.playerCards.map((c, i) => cardEl(c, { last: i === lastIndex })).join('');

  const buttons = [];
  buttons.push(`<button class="btn primary" data-action="hit" ${canHit(state) ? '' : 'disabled'}>Hit</button>`);
  buttons.push(`<button class="btn" data-action="stand" ${canStand(state) ? '' : 'disabled'}>Stand</button>`);
  buttons.push(`<button class="btn ghost" data-action="double" ${canDouble(state) ? '' : 'disabled'}>Double</button>`);
  if (hand.over && state.phase === 'playing') {
    buttons.push('<button class="btn primary" data-action="next-hand">Hand Berikutnya</button>');
  }

  const progress = Math.max(0, Math.min(100, (state.score / blind.target) * 100));
  const result = hand.result;
  const breakdown = result
    ? result.breakdown.map((row, i) => `
      <div class="row${i === result.breakdown.length - 1 ? ' total' : ''}">
        <span>${esc(row.label)}${row.detail ? ` <span class="detail">(${esc(row.detail)})</span>` : ''}</span>
        <span class="value">${esc(row.value)}</span>
      </div>`).join('')
    : '<div class="rack-empty">Belum ada hand selesai di ronde ini.</div>';

  const history = state.history.slice(-8).reverse().map((h, i) => {
    const cls = (h.outcome === 'WIN' || h.outcome === 'PLAYER_BJ') ? 'win' : 'lose';
    const n = state.history.length - i;
    return `<div class="log-item">Hand ${n} - ${esc(h.category)} - ${fmt(h.score)} - <span class="${cls}">${OUTCOME_LABEL[h.outcome] || h.outcome}</span></div>`;
  }).join('') || '<div class="rack-empty">Riwayat kosong.</div>';

  return `
    <div class="table">
      <div>
        <div class="hand-label">Dealer: ${hand.over ? hand.dealerTotal : '?'}</div>
        <div class="hand-row">${dealerCards}</div>
      </div>
      <div>
        <div class="hand-label">Pemain: ${hand.total}${hand.doubled ? ' (double)' : ''}</div>
        <div class="hand-row">${playerCards}</div>
      </div>
      <div class="controls">${buttons.join('')}</div>
      <div class="panel">
        <h3>Skor ronde</h3>
        <div class="target">${fmt(state.score)} / ${fmt(blind.target)}</div>
        <div class="progress"><span style="width:${progress}%"></span></div>
        <div class="sub">Hand ke-${state.handsUsed} dari ${state.handLimit}${result ? ` - hasil ${OUTCOME_LABEL[result.outcome] || result.outcome} (+${fmt(result.score)})` : ''}</div>
      </div>
      <div class="panel breakdown"><h3>Breakdown</h3>${breakdown}</div>
      <div class="panel"><h3>Riwayat</h3>${history}</div>
    </div>`;
}

function renderSide(state) {
  const blind = currentBlind(state);
  const source = state.deckSource === 'api' || state.deckSource === 'cache' ? 'API' : 'LOKAL';
  const actions = [];
  if (state.phase === 'shop' && !modalDismissed) {
    actions.push('<button class="btn primary" data-action="open-shop">Toko</button>');
  }
  if (state.phase === 'shop' || (state.phase === 'bossReward' && state.bossRewardTaken)) {
    actions.push('<button class="btn" data-action="advance">Lanjut</button>');
  }
  return `
    <div class="panel">
      <h3>Ronde</h3>
      <div class="target">Ante ${blind.ante}/3</div>
      <div class="sub"><span class="blind-badge ${blind.kind}">${esc(blind.name)}</span></div>
      <div class="sub">Target: ${fmt(blind.target)}</div>
      <div class="sub">Uang: $${fmt(state.money)}</div>
      <div class="sub">Slot joker: ${state.jokers.length}/${state.jokerSlots}</div>
      <div class="sub">Sumber deck: <span class="deck-badge">${source}</span></div>
      ${actions.length ? `<div class="controls" style="margin-top:8px">${actions.join('')}</div>` : ''}
    </div>`;
}

function renderShop(state) {
  const shop = state.shop;
  const owned = new Set(state.jokers);
  const slotsFull = state.jokers.length >= state.jokerSlots;
  const jokerCards = (shop.jokers || []).map((id) => {
    const j = JOKER_BY_ID.get(id);
    if (!j) return '';
    const sold = owned.has(id);
    const label = sold ? 'Sold' : slotsFull ? 'Slot penuh' : `Beli $${j.price}`;
    const blocked = sold || slotsFull || state.money < j.price;
    return `<div class="shop-item${sold ? ' sold' : ''}">
      <div class="name">${esc(j.name)}</div>
      <div class="effect">${esc(j.effectText)}</div>
      <button class="btn small" data-action="buy-joker" data-id="${esc(id)}" ${blocked ? 'disabled' : ''}>
        ${label}
      </button>
    </div>`;
  }).join('');
  const voucher = shop.voucher ? VOUCHER_BY_ID.get(shop.voucher) : null;
  const voucherCard = voucher
    ? `<div class="shop-item">
        <div class="name">${esc(voucher.name)}</div>
        <div class="effect">${esc(voucher.effectText)}</div>
        <button class="btn small" data-action="buy-voucher" data-id="${esc(voucher.id)}" ${state.money < voucher.price ? 'disabled' : ''}>
          Beli $${voucher.price}
        </button>
      </div>`
    : '<div class="shop-item"><div class="effect">Semua voucher sudah dimiliki.</div></div>';
  return `
    <div class="shop-grid">${jokerCards}</div>
    <div class="shop-grid">${voucherCard}</div>
    <div class="controls">
      <button class="btn ghost" data-action="reroll" ${state.money < shop.rerollPrice ? 'disabled' : ''}>Reroll $${shop.rerollPrice}</button>
      <button class="btn primary" data-action="advance">Lanjut</button>
    </div>`;
}

export function reopenModal() {
  modalDismissed = false;
}

export function renderLoading(seed) {
  const html = `
    <div class="title-wrap">
      <h1>BLACKJACK BALATRO</h1>
      <p>Memuat dek kartu...</p>
      <p>Seed: <strong>${esc(seed)}</strong></p>
    </div>`;
  return show('title', html);
}

function renderBossReward(state) {
  if (state.bossRewardTaken) {
    return `<div class="sub">Hadiah boss sudah diambil.</div>
      <div class="controls"><button class="btn primary" data-action="advance">Lanjut</button></div>`;
  }
  const slots = state.jokers.length >= state.jokerSlots;
  const items = (state.bossChoices || []).map((id, index) => {
    const j = JOKER_BY_ID.get(id);
    if (!j) return '';
    return `<div class="shop-item">
      <div class="name">${esc(j.name)}</div>
      <div class="effect">${esc(j.effectText)}</div>
      <button class="btn small" data-action="boss-reward" data-index="${index}" ${slots ? 'disabled' : ''}>Ambil</button>
    </div>`;
  }).join('');
  const cash = slots
    ? '<div class="shop-item"><div class="name">Uang</div><div class="effect">Slot joker penuh, ambil $10.</div><button class="btn small" data-action="boss-reward" data-index="-1">Ambil $10</button></div>'
    : '';
  return `
    <div class="shop-grid">${items}${cash}</div>
    ${slots ? '' : '<div class="sub">Pilih satu joker gratis.</div>'}`;
}

function renderGame(state) {
  if (state.phase !== 'shop' && state.phase !== 'bossReward') modalDismissed = false;
  const html = `<div class="layout">${renderRack(state)}<div>${renderTable(state)}</div>${renderSide(state)}</div>
    <div id="banner-slot"></div>`;
  show('game', html);

  if (state.phase === 'shop' && !modalDismissed) {
    el.modal.innerHTML = `<div class="modal-inner">
      <h3>Toko</h3>
      <div class="sub">Uang: $${fmt(state.money)}</div>
      ${renderShop(state)}
    </div>`;
    el.modal.classList.add('open');
  } else if (state.phase === 'bossReward') {
    el.modal.innerHTML = `<div class="modal-inner">
      <h3>Hadiah Boss</h3>
      ${renderBossReward(state)}
    </div>`;
    el.modal.classList.add('open');
  } else {
    el.modal.innerHTML = '';
  }
  pumpBanner(state);
}

function renderGameover(state) {
  const blind = currentBlind(state);
  const html = `
    <div class="center-wrap">
      <h2>Kangker</h2>
      <div class="stat">Ante ${blind.ante}/3 - ${esc(blind.name)}</div>
      <div class="stat">Skor run: ${fmt(state.score)}</div>
      <div class="stat">Target blind: ${fmt(blind.target)}</div>
      <div class="stat">Hand: ${state.handsUsed} dari ${state.handLimit}</div>
      <div class="stat">Seed: ${esc(state.seed)}</div>
      <div class="title-actions">
        <button class="btn primary" data-action="retry">Coba Lagi</button>
        <button class="btn ghost" data-action="new-run-seed">Run Baru</button>
      </div>
    </div>`;
  show('gameover', html);
  pumpBanner(state);
}

function renderWin(state) {
  const html = `
    <div class="center-wrap">
      <h2>Run Selesai</h2>
      <div class="stat">Skor run: ${fmt(state.score)}</div>
      <div class="stat">Uang tersisa: $${fmt(state.money)}</div>
      <div class="stat">Joker: ${state.jokers.length}</div>
      <div class="stat">Seed: ${esc(state.seed)}</div>
      ${ctx.newBest ? '<div class="stat">Rekor skor baru!</div>' : ''}
      <div class="title-actions">
        <button class="btn primary" data-action="new-run-seed">Run Baru</button>
        <button class="btn ghost" data-action="title">Kembali ke Judul</button>
      </div>
    </div>`;
  show('win', html);
  pumpBanner(state);
}

function pumpBanner(state) {
  const slot = document.getElementById('banner-slot');
  if (!slot) return;
  if (!localNoticeShown && state.deckSource === 'local' && state.handsUsed === 0) {
    localNoticeShown = true;
    slot.innerHTML = '<div class="banner">MODE LOKAL - KARTU TANPA GAMBAR</div>';
    setTimeout(() => { slot.innerHTML = ''; }, 1600);
    return;
  }
  if (slot.firstChild) return;
  if (!state.banners || state.banners.length === 0) return;
  const banner = state.banners.shift();
  slot.innerHTML = `<div class="banner ${banner.tone === 'warn' ? 'warn' : ''}">${esc(banner.text)}</div>`;
  setTimeout(() => { slot.innerHTML = ''; pumpBanner(state); }, 1200);
}

export function dismissModal() {
  modalDismissed = true;
  el.modal.classList.remove('open');
}

export function render(state) {
  if (!state) return renderTitle();
  localMode = state.deckSource !== 'api' && state.deckSource !== 'cache';
  if (state.phase === 'gameover') return renderGameover(state);
  if (state.phase === 'win') return renderWin(state);
  return renderGame(state);
}
