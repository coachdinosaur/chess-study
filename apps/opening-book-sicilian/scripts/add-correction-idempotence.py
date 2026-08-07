from pathlib import Path

PATHS = [
    "apps/opening-book-sicilian/app/lib/chapter-content-corrections.ts",
    "apps/opening-book-sicilian/app/lib/chapter-page10-corrections.ts",
    "apps/opening-book-sicilian/app/lib/chapter-page15-corrections.ts",
    "apps/opening-book-sicilian/app/lib/chapter-page16-corrections.ts",
    "apps/opening-book-sicilian/app/lib/chapter-page17-corrections.ts",
    "apps/opening-book-sicilian/app/lib/chapter-pages1-8-anchor-corrections.ts",
    "apps/opening-book-sicilian/app/lib/chapter-pages9-11-anchor-corrections.ts",
    "apps/opening-book-sicilian/app/lib/chapter-pages12-17-anchor-corrections.ts",
]

NEEDLE = '  if (filename !== "chapter-1-sicilian.md") return content;\n'
GUARD = '''

  // The canonical Markdown may already contain these verified PDF-derived
  // corrections. Keep this correction function available for older source
  // content, but do not apply the same replacements twice.
  if (
    content.includes(
      "<!-- FEN: r2q1rk1/p4pbp/bpn1p1p1/2pn2B1/8/NBPP1N2/PP2QPPP/R3R1K1 b - - 1 12 -->\\n12...Qc7N∓",
    ) &&
    content.includes(
      "<!-- FEN: r1bqkb1r/pp2pp1p/2n3p1/3pP3/4nP2/4B3/PPP3PP/RN1QKBNR w KQkq d6 0 8 -->\\n8.Bd3",
    )
  ) {
    return content;
  }
'''

for filename in PATHS:
    path = Path(filename)
    text = path.read_text(encoding="utf-8")
    if "The canonical Markdown may already contain" in text:
        continue
    count = text.count(NEEDLE)
    if count != 1:
        raise SystemExit(f"Expected one Chapter 1 guard in {filename}, found {count}")
    path.write_text(text.replace(NEEDLE, NEEDLE + GUARD, 1), encoding="utf-8")
