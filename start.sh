#!/usr/bin/env bash
# Entrypoint: jalankan ttyd dengan UI kustom + autentikasi.
set -euo pipefail

PORT="${PORT:-8000}"
USERNAME="${TERM_USER:-admin}"
PASSWORD="${TERM_PASS:-}"
BASEPATH="${TERM_BASE_PATH:-}"
MAX_CLIENTS="${TERM_MAX_CLIENTS:-3}"
PAGE="${TERM_INDEX:-/opt/ttyd/index.html}"
SHELL_BIN="${TERM_SHELL:-/bin/bash}"

# --- password: kalau tidak diisi, buat acak dan tampilkan di log ---
if [[ -z "$PASSWORD" && "${TERM_NO_AUTH:-0}" != "1" ]]; then
  PASSWORD="$(head -c 18 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | cut -c1-12)"
  echo "[start] TERM_PASS belum diset -> password acak: ${PASSWORD}"
  echo "[start] (set env TERM_PASS agar password tetap sama)"
fi

args=(-p "$PORT" -i 0.0.0.0 -W -m "$MAX_CLIENTS" -P 30)
args+=(-t "disableLeaveAlert=true")
args+=(-t "titleFixed=Terminal")

if [[ -n "$BASEPATH" ]]; then
  [[ "$BASEPATH" == /* ]] || BASEPATH="/$BASEPATH"
  args+=(-b "${BASEPATH%/}")
  BASEPATH="${BASEPATH%/}"
else
  BASEPATH="/"
fi

if [[ "${TERM_NO_AUTH:-0}" == "1" ]]; then
  echo "[start] PERINGATAN: autentikasi MATI. Siapa pun yang punya URL bisa masuk."
elif [[ -n "$PASSWORD" ]]; then
  args+=(-c "${USERNAME}:${PASSWORD}")
else
  echo "[start] PERINGATAN: TERM_PASS kosong, server tanpa autentikasi."
fi

if [[ -f "$PAGE" ]]; then
  args+=(-I "$PAGE")
else
  echo "[start] UI tidak ditemukan ($PAGE), memakai UI bawaan ttyd."
fi

echo "[start] ttyd di 0.0.0.0:${PORT}, path ${BASEPATH}, user ${USERNAME:-'(tanpa auth)'}"
exec ttyd "${args[@]}" "$SHELL_BIN"
