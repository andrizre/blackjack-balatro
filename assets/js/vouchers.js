// Vouchers — modul murni.

export const VOUCHERS = [
  {
    id: 'promo', name: 'Kartu Promo', price: 8,
    effectText: 'Hand limit +1 pada ronde berikutnya dan seterusnya',
    effect: { handLimit: 1 },
  },
  {
    id: 'tandatangan', name: 'Tanda Tangan', price: 8,
    effectText: 'Slot joker +1',
    effect: { jokerSlots: 1 },
  },
  {
    id: 'dana', name: 'Dana Darurat', price: 8,
    effectText: 'Uang langsung $25',
    effect: { money: 25 },
  },
  {
    id: 'pelatih', name: 'Pelatih Meja', price: 8,
    effectText: 'Setiap hand menambah Chips sebesar jumlah joker yang dimiliki',
    effect: { chipsPerJoker: 1 },
  },
];

export const VOUCHER_BY_ID = new Map(VOUCHERS.map((v) => [v.id, v]));
