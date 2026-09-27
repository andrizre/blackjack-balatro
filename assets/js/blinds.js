// Blinds dan ante — modul murni. Kolom `target` satu-satunya angka yang boleh di-tuning lewat tools/sim.mjs.

export const BLINDS = [
  { id: 'a1-small', ante: 1, kind: 'small', name: 'Small Blind', target: 60, standOn: 17, soft17: false, allowDouble: true, winMult: 1, reward: 6 },
  { id: 'a1-big', ante: 1, kind: 'big', name: 'Big Blind', target: 84, standOn: 17, soft17: false, allowDouble: true, winMult: 1, reward: 10 },
  { id: 'a1-boss', ante: 1, kind: 'boss', name: 'Boss Blind', target: 103, standOn: 15, soft17: false, allowDouble: true, winMult: 1, reward: 15 },
  { id: 'a2-small', ante: 2, kind: 'small', name: 'Small Blind', target: 162, standOn: 17, soft17: false, allowDouble: true, winMult: 1, reward: 6 },
  { id: 'a2-big', ante: 2, kind: 'big', name: 'Big Blind', target: 209, standOn: 17, soft17: false, allowDouble: true, winMult: 1, reward: 10 },
  { id: 'a2-boss', ante: 2, kind: 'boss', name: 'Boss Blind', target: 255, standOn: 17, soft17: true, allowDouble: true, winMult: 1, reward: 15 },
  { id: 'a3-small', ante: 3, kind: 'small', name: 'Small Blind', target: 428, standOn: 17, soft17: false, allowDouble: true, winMult: 1, reward: 6 },
  { id: 'a3-big', ante: 3, kind: 'big', name: 'Big Blind', target: 568, standOn: 17, soft17: false, allowDouble: true, winMult: 1, reward: 10 },
  { id: 'a3-boss', ante: 3, kind: 'boss', name: 'Boss Blind', target: 557, standOn: 17, soft17: false, allowDouble: false, winMult: 0.75, reward: 15 },
];

export function blindAt(index) {
  return BLINDS[index];
}

export function isBoss(blind) {
  return blind.kind === 'boss';
}
