#!/usr/bin/env python3
"""Gabungkan CSS/JS ke satu file index.html.

ttyd hanya menyajikan satu halaman kustom (opsi -I), bukan berkas statis lain.
Karena itu xterm.css, xterm.js, addon-fit.js, style.css, dan app.js di-inline
ke dalam HTML saat build, sehingga tidak butuh CDN maupun file terpisah.

Pemakaian:
    python3 tools/build_index.py --web web --out dist/index.html
"""
from __future__ import annotations

import argparse
import pathlib
import sys

# penanda di web/index.html -> berkas sumber
MARKERS = {
    "/*__XTERM_CSS__*/": "vendor/xterm.css",
    "/*__STYLE_CSS__*/": "style.css",
    "//__XTERM_JS__": "vendor/xterm.js",
    "//__ADDON_FIT_JS__": "vendor/addon-fit.js",
    "//__APP_JS__": "app.js",
}


def read(web: pathlib.Path, rel: str) -> str:
    path = web / rel
    if not path.is_file():
        sys.exit(f"berkas tidak ditemukan: {path}")
    return path.read_text(encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser(description="Inline aset web ke satu index.html")
    ap.add_argument("--web", default="web", help="folder sumber (default: web)")
    ap.add_argument("--out", default="dist/index.html", help="berkas hasil")
    args = ap.parse_args()

    web = pathlib.Path(args.web)
    html = (web / "index.html").read_text(encoding="utf-8")

    for marker, rel in MARKERS.items():
        content = read(web, rel)
        if "</script" in content.lower() and rel.endswith(".js"):
            # jaga-jaga: jangan sampai menutup tag <script> terlalu awal
            content = content.replace("</script", "<\\/script")
        if "</style" in content.lower() and rel.endswith(".css"):
            sys.exit(f"{rel} berisi '</style>' — tidak bisa di-inline")
        if marker not in html:
            sys.exit(f"penanda {marker} tidak ada di index.html")
        html = html.replace(marker, content)

    leftovers = [m for m in MARKERS if m in html]
    if leftovers:
        sys.exit(f"penanda belum terganti: {leftovers}")

    out = pathlib.Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print(f"✓ {out} ({out.stat().st_size / 1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
