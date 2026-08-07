from pathlib import Path

chapter_path = Path("apps/opening-book-sicilian/app/content/chapters/chapter-1-sicilian.md")
chapter = chapter_path.read_text(encoding="utf-8")

replacements = [
    (
        "11...Qb6 12.Qe2 Bg4\n\n<!-- FEN: r4rk1/pp2ppbp/1qnp2p1/1B2P3/5Pb1/2P2N2/PP1BQ1PP/R3K2R w KQ - 6 13 -->\n13.Bxc6!",
        "11...Qb6 12.Qe2 Bg4 13.Bxc6!",
    ),
    (
        "15...Bxf3 16.Qxf3 Rad8 17.Qe2 Qb6 18.0-0-0 d5!\n\n<!-- FEN: 3r1rk1/p3ppbp/1qp3p1/3pP3/5P2/2B5/PPP1Q1PP/2KR3R w - - 0 19 -->\n19.Qd2 Rb8 20.Qd4 e6 21.Qxb6 axb6∓",
        "15...Bxf3 16.Qxf3 Rad8 17.Qe2 Qb6 18.0-0-0 d5! 19.Qd2 Rb8 20.Qd4 e6 21.Qxb6 axb6∓",
    ),
    (
        "13.Bf3 Qd7! 14.Qd3 Nc6!\n\n<!-- FEN: r4rk1/pb1qppbp/1pn3p1/8/1PPNn3/P2Q1B2/1B3PPP/RN3RK1 w - - 5 15 -->\n15.Bxe4",
        "13.Bf3 Qd7! 14.Qd3 Nc6! 15.Bxe4",
    ),
    (
        "15.Qxe4 Nxd4 16.Qxb7 Nxf3+ 17.Qxf3 Bxb2 18.Ra2 Be5+",
        "15.Qxe4 Nxd4 16.Qxb7 Nxf3+ 17.Qxf3 Bxb2 18.Ra2 Be5∓",
    ),
    (
        "6...cxb4 7.axb4 Nxb4\n\n<!-- FEN: r1bqk1nr/p2pppbp/1p4p1/8/1n2P3/2N2N2/1BPP1PPP/R2QKB1R w KQkq - 0 8 -->\n8.Bc4 is unclear.",
        "6...cxb4 7.axb4 Nxb4 8.Bc4∞ is unclear.",
    ),
]

for before, after in replacements:
    count = chapter.count(before)
    if count != 1:
        raise SystemExit(f"Expected exactly one occurrence, found {count}: {before[:100]!r}")
    chapter = chapter.replace(before, after, 1)

chapter_path.write_text(chapter, encoding="utf-8")

page17_test_path = Path("apps/opening-book-sicilian/tests/page17-content.test.mjs")
page17_test = page17_test_path.read_text(encoding="utf-8")
needle = '    "15...Qa4!?∓",\n    "20.Qd4 e6 21.Qxb6 axb6∓",\n'
addition = (
    '    "15...Qa4!?∓",\n'
    '    "11...Qb6 12.Qe2 Bg4 13.Bxc6!",\n'
    '    "15...Bxf3 16.Qxf3 Rad8 17.Qe2 Qb6 18.0-0-0 d5! 19.Qd2 Rb8 20.Qd4 e6 21.Qxb6 axb6∓",\n'
    '    "20.Qd4 e6 21.Qxb6 axb6∓",\n'
)
if needle not in page17_test:
    raise SystemExit("Could not locate Page 17 required-content insertion point")
page17_test = page17_test.replace(needle, addition, 1)
forbidden_needle = '    "20.Rd4 e6",\n    "axb6+ Black",\n'
forbidden_addition = (
    '    "20.Rd4 e6",\n'
    '    "11...Qb6 12.Qe2 Bg4\\n\\n<!-- FEN:",\n'
    '    "18.0-0-0 d5!\\n\\n<!-- FEN:",\n'
    '    "axb6+ Black",\n'
)
if forbidden_needle not in page17_test:
    raise SystemExit("Could not locate Page 17 forbidden-content insertion point")
page17_test = page17_test.replace(forbidden_needle, forbidden_addition, 1)
page17_test_path.write_text(page17_test, encoding="utf-8")

anchors_test_path = Path("apps/opening-book-sicilian/tests/page12-17-anchors.test.mjs")
anchors_test = anchors_test_path.read_text(encoding="utf-8")
needle = '  assert.ok(!corrected.includes("\\n4.Nc3!\\n\\n**FEN:**"));\n\n  const beforeWhiteSixth = '
addition = (
    '  assert.ok(!corrected.includes("\\n4.Nc3!\\n\\n**FEN:**"));\n'
    '  assert.ok(corrected.includes("13.Bf3 Qd7! 14.Qd3 Nc6! 15.Bxe4"));\n'
    '  assert.ok(corrected.includes("15.Qxe4 Nxd4 16.Qxb7 Nxf3+ 17.Qxf3 Bxb2 18.Ra2 Be5∓"));\n'
    '  assert.ok(!corrected.includes("18.Ra2 Be5+"));\n\n'
    '  const beforeWhiteSixth = '
)
if needle not in anchors_test:
    raise SystemExit("Could not locate Page 21 assertion insertion point")
anchors_test = anchors_test.replace(needle, addition, 1)
needle2 = '  assert.ok(corrected.includes(`<!-- FEN: ${afterBb2} -->\\n6...cxb4`));\n\n  const afterD6 = '
addition2 = (
    '  assert.ok(corrected.includes(`<!-- FEN: ${afterBb2} -->\\n6...cxb4`));\n'
    '  assert.ok(corrected.includes("6...cxb4 7.axb4 Nxb4 8.Bc4∞ is unclear."));\n'
    '  assert.doesNotThrow(() => playLine(afterBb2, ["cxb4", "axb4", "Nxb4", "Bc4"]));\n\n'
    '  const afterD6 = '
)
if needle2 not in anchors_test:
    raise SystemExit("Could not locate Page 23 assertion insertion point")
anchors_test = anchors_test.replace(needle2, addition2, 1)
anchors_test_path.write_text(anchors_test, encoding="utf-8")
