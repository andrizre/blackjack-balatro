# Blackjack Balatro

Game kartu blackjack dengan sistem skor ala Balatro. Blackjack sungguhan
melawan dealer (hit / stand / double, bust, 21 menang), tapi setiap hand yang
selesai menghasilkan **skor**, dan ronde blind baru selesai bila skor kumulatif
mencapai target blind sebelum hand ronde habis.

Joker memodifikasi chips/mult, isi deck, dan batas hand. Sembilan blind
disusun dalam tiga ante; tiap boss blind punya modifier sendiri
(dealer berhenti di 15, dealer hit pada soft 17, atau double dimatikan).

## Menjalankan

Tidak ada build step — seluruh kode adalah ES modules statis.

```bash
python3 -m http.server 8000
# buka http://localhost:8000/blackjack.html?seed=12345
```

Parameter `?seed=` opsional: dipakai sebagai seed run pertama, kalau kosong
dipakai seed acak yang ditampilkan di layar judul.

Kartu diambil dari [deckofcardsapi.com](https://deckofcardsapi.com) (katalog
kartu + URL gambar; urutan deck ditentukan RNG lokal supaya seed deterministik
dan simulasi jalan offline). Bila API tidak terjangkau, timeout, atau
skemanya berubah, game otomatis jatuh ke deck lokal berisi kartu tanpa
gambar dan tetap playable penuh.

Butuh Node 18+ hanya untuk menjalankan gate balance. Python 3 (atau server
statis apa pun) untuk penyajiannya.

## Kontrol

| Aksi | Tombol | Keyboard |
|---|---|---|
| Ambil kartu | Hit | `Space` |
| Berhenti | Stand | `Enter` |
| Ganda | Double | `D` |
| Mute | Suara | `M` |
| Tutup modal toko | — | `Escape` |

## Struktur

```
blackjack.html          shell statis
assets/css/game.css     tema
assets/js/rng.js        RNG deterministik (semua randomness game lewat sini)
assets/js/cards.js      kartu, deck, deckEdits
assets/js/cardapi.js    satu-satunya jalur jaringan + cache + fallback
assets/js/score.js      evaluasi hand, kategori, safeChips, resolveHand
assets/js/jokers.js     22 joker (efek skor, deckEdit, handLimit)
assets/js/vouchers.js   4 voucher
assets/js/blinds.js     9 blind + modifier
assets/js/game.js       state machine run + save/load
assets/js/shop.js       isi toko
assets/js/ui.js         render
assets/js/main.js       bootstrap, delegator aksi, shortcut
tools/sim.mjs           harness balance headless
```

Modul di `assets/js/` selain `cardapi.js`, `ui.js`, `audio.js`, dan
`main.js` tidak menyentuh `document`, `window`, `localStorage`, `fetch`,
atau `AudioContext` — itulah yang membuat `tools/sim.mjs` bisa jalan di Node
tanpa jaringan.

## Gate balance

```bash
node tools/sim.mjs
```

Menjalankan 400 run headless (200 seed x 2 loadout), mencetak clear rate per
blind dan skor rata-rata per hand, lalu keluar dengan kode 1 bila:

1. ada skor `NaN`/`undefined`,
2. clear rate ante 1 small di bawah 90% pada salah satu loadout,
3. pada loadout ber-joker, clear rate blind berikutnya turun lebih dari 5 poin
   dibanding blind sebelumnya,
4. win rate run penuh di luar 10%-60%.

Kolom `target` di `assets/js/blinds.js` adalah satu-satunya angka yang boleh
di-tuning lewat gate ini.
