# Terminal-web

Terminal `bash` di browser yang **ramah layar sentuh** — dibuat untuk dipakai dari HP
atau tablet, bukan cuma dari laptop.

Dibangun dari [ttyd](https://github.com/tsl0922/ttyd) + [xterm.js](https://xtermjs.org/),
dengan halaman UI sendiri yang sudah dioptimalkan untuk jari: tombol `Ctrl` `Esc` `Tab`
panah `^C` dll. tersedia di layar, karena keyboard HP tidak punya tombol-tombol itu.

Satu container, satu halaman HTML, **tanpa CDN** — semua aset di-inline saat build,
jadi tetap jalan di jaringan yang memblokir jsdelivr/unpkg.

```
┌──────────────────────────────────────────┐
│ ● tersambung      A−  A+  ⌨              │  ← status koneksi + font
├──────────────────────────────────────────┤
│ user@term:~$ htop                        │
│                                          │  ← terminal (geser untuk scroll,
│                                          │     cubit 2 jari = ubah font)
├──────────────────────────────────────────┤
│ Tempel Salin │ Esc Tab ⇧Tab Ctrl Alt ◀▲▼▶ │  ← bar tombol sentuh
│ ^C ^D ^Z ^L ^R ^U ^K ^W │ | ~ / - │ Home…│
└──────────────────────────────────────────┘
```

## Fitur

- **Bar tombol sentuh** — `Esc` `Tab` `⇧Tab` `Ctrl` `Alt` `←↑↓→` `^C` `^D` `^Z` `^L`
  `^R` `^U` `^K` `^W` `|` `~` `/` `-` `Home` `End` `PgUp` `PgDn` `Del`.
  Tombol `Ctrl`/`Alt` bersifat *sticky* (nyala → ketuk huruf).
- **Tempel & Salin sekali ketuk** — kalau tidak ada seleksi, "Salin" menyalin seluruh
  teks di layar; kalau ada seleksi, menyalin seleksi.
- **Font bisa diatur** — `A−` / `A+` atau cubit dua jari (10–30 px), tersimpan di browser.
- **Tata letak mengikuti keyboard** — memakai `visualViewport`, jadi bar tombol tidak
  tertutup keyboard layar; safe-area iPhone ikut diperhitungkan.
- **Auto-reconnect** — kalau koneksi putus, UI menyambung ulang otomatis (ketuk teks
  status untuk mencoba lagi sekarang).
- **Tombol "ke bawah"** muncul saat kamu menggulir ke atas.
- **Satu file HTML** — tidak ada permintaan ke domain lain, cocok untuk jaringan ketat.

## Isi repo

| Path | Keterangan |
|---|---|
| `Dockerfile` | Multi-stage: inline aset → image Debian + ttyd |
| `start.sh` | Menjalankan ttyd (`-W`, basic-auth, `-I` halaman kustom, `$PORT`) |
| `web/index.html` | Kerangka halaman + tombol bar sentuh |
| `web/app.js` | Klien protokol ttyd, input, copy/paste, pinch-zoom |
| `web/style.css` | Tema gelap + tata letak layar sentuh |
| `web/vendor/` | xterm.js, addon-fit, xterm.css (MIT) |
| `tools/build_index.py` | Menggabungkan semuanya jadi satu `index.html` |
| `bashrc` | Prompt berwarna + alias untuk user container |
| `docker-compose.yml` | Menjalankan lokal dengan mudah |

## Jalankan lokal

**Docker (paling gampang):**

```bash
git clone https://github.com/tasirin1/Terminal-web.git
cd Terminal-web
docker compose up -d --build
# buka http://localhost:8000  (login: admin / ganti-password-ini)
```

atau tanpa compose:

```bash
docker build -t terminal-web .
docker run --rm -p 8000:8000 -e TERM_USER=admin -e TERM_PASS=rahasia terminal-web
```

**Tanpa Docker** (butuh `ttyd` ≥ 1.7 dan Python 3):

```bash
python3 tools/build_index.py --web web --out dist/index.html
ttyd -p 8000 -W -c admin:rahasia -I dist/index.html bash
```

## Deploy ke Koyeb

Instance `free` Koyeb (0.1 vCPU / 512 MB RAM) sudah lebih dari cukup untuk ttyd.

### Lewat panel (GitHub)

1. Repo ini sudah siap — tidak perlu ubah apa pun.
2. Masuk <https://app.koyeb.com> → **Create Service** → **GitHub**.
3. Pilih repo `tasirin1/Terminal-web`, branch `main`.
4. **Builder**: `Dockerfile`, **Dockerfile location**: `Dockerfile`.
5. **Exposed ports**: `8000`, **Public** ✔, protocol **HTTP**, path `/`.
6. **Environment variables**:

   | Name | Value |
   |---|---|
   | `TERM_USER` | `admin` |
   | `TERM_PASS` | password kuat pilihanmu |

7. **Instance**: `Free`, pilih region terdekat → **Deploy**.
8. Setelah status *Healthy*, buka `https://<nama>-<org>.koyeb.app`, isi login.
   Ketuk layar terminal → keyboard muncul.

Setiap `git push` ke `main` akan otomatis memicu deploy ulang.

### Lewat CLI

```bash
# sekali saja
curl -fsSL https://raw.githubusercontent.com/koyeb/koyeb-cli/master/install.sh | sh
koyeb login

# dari folder repo
koyeb deploy . terminal/web \
  --archive-builder docker \
  --instance-type free \
  --ports 8000:http \
  --routes /:8000 \
  --env PORT=8000 \
  --env TERM_USER=admin \
  --env TERM_PASS='password-kuat' \
  --min-scale 1 --max-scale 1
```

> Nama flag bisa berbeda antar versi CLI; kalau ditolak, cek `koyeb deploy --help`.
> `--min-scale 1` penting supaya instance tidak tidur dan sesi tidak terputus.

Health check default Koyeb memakai **TCP** pada port yang di-expose, jadi basic-auth
(yang membalas `401` di `/`) tidak membuat deployment dianggap gagal.

## Variabel lingkungan

| Variabel | Default | Fungsi |
|---|---|---|
| `PORT` | `8000` | Port yang didengar ttyd (Koyeb mengisinya otomatis) |
| `TERM_USER` | `admin` | Username basic-auth |
| `TERM_PASS` | *(kosong)* | Password. Kalau kosong → dibuat acak dan dicetak di log |
| `TERM_NO_AUTH` | `0` | `1` = matikan autentikasi (jangan, kecuali jaringan internal) |
| `TERM_BASE_PATH` | *(kosong)* | Taruh terminal di path rahasia, mis. `/t-9f3a2` |
| `TERM_MAX_CLIENTS` | `3` | Jumlah tab terminal bersamaan |
| `TERM_SHELL` | `/bin/bash` | Shell yang dijalankan |
| `TERM_INDEX` | `/opt/ttyd/index.html` | Halaman UI |

Contoh: `TERM_BASE_PATH=/t-9f3a2` → URL jadi `https://….koyeb.app/t-9f3a2`.

## Keamanan — baca ini

- Ini **shell penuh** di server. Tanpa password, siapa pun yang menemukan URL bisa
  menjalankan perintah. Selalu set `TERM_PASS` yang kuat.
- Ingin lapisan tambahan? Pakai `TERM_BASE_PATH` acak, atau taruh di belakang
  Cloudflare Access / reverse proxy ber-auth.
- ttyd mencetak kredensial (base64) di log, jadi batasi siapa yang bisa melihat log
  service di dashboard.
- Container berjalan sebagai user non-root `dev` (punya `sudo`), dan **tidak punya
  storage permanen** — file hilang saat container dibuat ulang.

## Kustomisasi

- **Tambah tombol**: salin satu baris `<button data-seq="…">` di `web/index.html`,
  lalu tambahkan kode escape-nya di `SEQ` pada `web/app.js`.
  Contoh `Ctrl+X` → `<button data-seq="c-x">^X</button>` + `'c-x': '\x18'`.
- **Warna/tema**: variabel CSS di `web/style.css` dan `theme` pada `web/app.js`.
- **Font default**: `fontSize` di `web/app.js` (bawaan 16 px).
- **Paket tambahan**: tambahkan ke `apt-get install` di `Dockerfile`.
- Setelah mengubah apa pun: `docker compose up -d --build` atau push ke GitHub.

## Troubleshooting

| Gejala | Solusi |
|---|---|
| `502` / service `Unhealthy` | Port di panel harus sama dengan `PORT` (8000); ttyd harus dengar di `0.0.0.0` |
| Halaman putih | Lihat konsol browser; pastikan `dist/index.html`/image ter-build (aset inline) |
| Login muncul terus | Password salah, atau pakai `:` di password (tidak didukung basic-auth) |
| Terminal read-only | Opsi `-W` hilang — jangan hapus dari `start.sh` |
| Putus tiap beberapa menit | Instance di-scale-to-zero / idle; set `min-scale = max-scale = 1` |
| Lupa password | Set ulang `TERM_PASS` lalu redeploy, atau cek log (password acak dicetak) |

## Lisensi

Kode di repo ini: MIT — lihat [LICENSE](LICENSE).
Bundel `web/vendor/`: xterm.js & addon-fit © The xterm.js authors, MIT.

Terima kasih untuk [tsl0922/ttyd](https://github.com/tsl0922/ttyd).
