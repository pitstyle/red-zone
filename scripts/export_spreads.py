#!/usr/bin/env python3
"""Convert exported PNG spreads to WebP and write public/manifest.json."""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PNG_DIR = Path("/tmp/redzone_png")
OUT_DIR = ROOT / "public" / "spreads"
MANIFEST = ROOT / "public" / "manifest.json"

# Chapter start pages (1-indexed PDF pages)
CHAPTERS = [
    {"id": "01", "label": "01/11", "title": "Walizka ewakuacyjna", "page": 2},
    {"id": "02", "label": "02/11", "title": "Terra incognita", "page": 8},
    {"id": "03", "label": "03/11", "title": "Żona Lota", "page": 13},
    {"id": "04", "label": "04/11", "title": "Czerwona strefa", "page": 21},
    {"id": "05", "label": "05/11", "title": "Naczynia połączone", "page": 27},
    {"id": "06", "label": "06/11", "title": "Przed nami długa droga", "page": 34},
    {"id": "07", "label": "07/11", "title": "Ej, człowieku XXI wieku", "page": 41},
    {"id": "08", "label": "08/11", "title": "Połówki jabłka", "page": 47},
    {"id": "09", "label": "09/11", "title": "Bez twarzy", "page": 53},
    {"id": "10", "label": "10/11", "title": "Przesiedlenka", "page": 60},
    {"id": "11", "label": "11/11", "title": "Niteczka", "page": 68},
]


def page_files() -> list[Path]:
    files = sorted(PNG_DIR.glob("page-*.png"))
    if not files:
        raise SystemExit(f"No PNGs in {PNG_DIR}")
    return files


def is_likely_text_page(path: Path) -> bool:
    # Heuristic: small file size usually means mostly white text pages
    size_kb = path.stat().st_size / 1024
    return size_kb < 220


def convert(png: Path, out: Path, quality: int) -> None:
    subprocess.run(
        [
            "cwebp",
            "-q",
            str(quality),
            "-m",
            "6",
            "-mt",
            str(png),
            "-o",
            str(out),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    files = page_files()
    pages = []

    for png in files:
        m = re.search(r"page-(\d+)\.png$", png.name)
        if not m:
            continue
        n = int(m.group(1))
        name = f"page-{n:02d}.webp"
        out = OUT_DIR / name
        quality = 92 if is_likely_text_page(png) else 82
        convert(png, out, quality)
        pages.append(
            {
                "index": n - 1,
                "page": n,
                "src": f"./spreads/{name}",
                "bytes": out.stat().st_size,
            }
        )
        print(f"{name} q={quality} {out.stat().st_size // 1024}KB")

    chapter_by_page = {c["page"]: c for c in CHAPTERS}
    for p in pages:
        for c in CHAPTERS:
            if p["page"] >= c["page"]:
                p["chapter"] = c["id"]
        if p["page"] == 1:
            p["kind"] = "cover"
        elif p["page"] >= 77:
            p["kind"] = "credits"
        elif p["page"] in chapter_by_page:
            p["kind"] = "chapter-start"
        else:
            p["kind"] = "spread"

    manifest = {
        "title": "RED ZONE",
        "subtitle": "Gdańsk 2023",
        "authors": {
            "photos": "Tamara Wyrzykowska",
            "poems": "Iryna Ciłyk",
        },
        "pageCount": len(pages),
        "chapters": CHAPTERS,
        "pages": pages,
    }
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    total = sum(p["bytes"] for p in pages)
    print(f"Wrote {len(pages)} spreads, total {total / 1024 / 1024:.1f} MB")
    print(f"Manifest: {MANIFEST}")


if __name__ == "__main__":
    main()
