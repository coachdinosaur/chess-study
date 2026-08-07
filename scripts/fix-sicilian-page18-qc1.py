from pathlib import Path

markdown_path = Path("apps/opening-book-sicilian/app/content/chapters/chapter-1-sicilian.md")
markdown = markdown_path.read_text(encoding="utf-8")
before = "18.Bxd4 Rc1+ 19.Ke2 Qxh1 20.Bxh8 Qxg2+-+"
after = "18.Bxd4 Qc1+ 19.Ke2 Qxh1 20.Bxh8 Qxg2+-+"
if markdown.count(before) != 1:
    raise SystemExit(f"Expected one stale Page 18 continuation, found {markdown.count(before)}")
markdown_path.write_text(markdown.replace(before, after, 1), encoding="utf-8")

test_path = Path("apps/opening-book-sicilian/tests/page12-17-anchors.test.mjs")
test_text = test_path.read_text(encoding="utf-8")
needle = "  assert.ok(corrected.includes(`<!-- FEN: ${beforeNxc3} -->\\n13...Nxc3!!`));\n"
addition = needle + '''  const afterBxd4 = playLine(beforeNxc3, [
    "Nxc3", "Qxc3", "Bxd3", "Qxd3", "Nxe5", "Qb5+", "Nd7", "Nd4", "Bxd4", "Bxd4",
  ]);
  assert.equal(
    playLine(afterBxd4, ["Qc1+", "Ke2", "Qxh1", "Bxh8", "Qxg2"]),
    "4k2B/pp2pp1p/6p1/4P3/1P6/8/P5qP/R3K2R w KQ - 0 21",
  );
  assert.ok(corrected.includes("18.Bxd4 Qc1+ 19.Ke2 Qxh1 20.Bxh8 Qxg2+-+"));
  assert.ok(!corrected.includes("18.Bxd4 Rc1+"));
'''
if needle not in test_text:
    raise SystemExit("Could not find the Page 18 test insertion point")
if "18.Bxd4 Qc1+ 19.Ke2" not in test_text:
    test_path.write_text(test_text.replace(needle, addition, 1), encoding="utf-8")
