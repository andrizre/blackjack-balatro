// Audio WebAudio sintetis, tanpa file aset. Kegagalan audio tidak boleh menghentikan game.

const META_KEY = 'bjbalatro.meta.v1';

let ctx = null;
let master = null;
let muted = false;

function readMeta() {
  try {
    return JSON.parse(localStorage.getItem(META_KEY)) || {};
  } catch (err) {
    return {};
  }
}

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = Boolean(value);
  try {
    const meta = readMeta();
    meta.muted = muted;
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch (err) {
    // storage ditolak: mute hanya berlaku di sesi ini
  }
}

export function initAudio() {
  if (ctx) return;
  muted = readMeta().muted === true;
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.2;
    master.connect(ctx.destination);
  } catch (err) {
    ctx = null;
    master = null;
  }
}

export function resumeAudio() {
  try {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  } catch (err) {
    // abaikan
  }
}

function tone(freq, duration, type = 'square', slideTo = null) {
  if (!ctx || !master || muted) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  } catch (err) {
    // abaikan: audio tidak boleh mematikan game
  }
}

export const sfx = {
  deal: () => tone(520, 0.09, 'triangle'),
  hit: () => tone(300, 0.12, 'square', 220),
  stand: () => tone(420, 0.12, 'sine'),
  win: () => tone(660, 0.22, 'triangle', 990),
  lose: () => tone(240, 0.24, 'sawtooth', 120),
  coin: () => tone(880, 0.1, 'square', 1320),
  error: () => tone(160, 0.15, 'square', 110),
};
