from pathlib import Path

popup_path = Path("focus-analysis-popup.mjs")
source = popup_path.read_text(encoding="utf-8")

old_normalizer = """  function normalizedLines(element) {
    // Focus mode hides the control pane with display:none. textContent still
    // exposes the rendered PV/tablebase text, while innerText becomes empty.
    return String(element?.textContent || '')
      .split(/\\r?\\n/)
      .map((line) => line.replace(/\\s+/g, ' ').trim())
      .filter(Boolean);
  }
"""

new_normalizer = """  function normalizedText(element) {
    return String(element?.textContent || '').replace(/\\s+/g, ' ').trim();
  }

  function normalizedLines(element) {
    return String(element?.textContent || '')
      .split(/\\r?\\n/)
      .map((line) => line.replace(/\\s+/g, ' ').trim())
      .filter(Boolean);
  }
"""

if old_normalizer not in source:
    raise SystemExit("normalizer not found")
source = source.replace(old_normalizer, new_normalizer, 1)

marker = "  function firstEvaluationLabel(source, entries, analysisText) {\n"
parser = """  function collectRenderedEntries() {
    const notationPanel = document.getElementById('notationPanel');
    const analysisPanel = document.getElementById('analysisPanel');
    const lineList = notationPanel?.querySelector('.pv-line-list')
      || analysisPanel?.querySelector('.pv-line-list');

    if (!lineList) {
      return { source: 'engine', entries: [] };
    }

    let detectedSource = 'engine';
    const entries = [];

    lineList.querySelectorAll('.pv-line').forEach((lineElement) => {
      const indexLabel = normalizedText(lineElement.querySelector('.pv-line-index'));
      const engineMatch = indexLabel.match(/^PV\\s*(\\d+)$/i);
      const tablebaseMatch = indexLabel.match(/^TB\\s*(\\d+)$/i);
      if (!engineMatch && !tablebaseMatch) {
        return;
      }

      const kind = tablebaseMatch ? 'tablebase' : 'engine';
      detectedSource = kind;
      const depthLabel = normalizedText(lineElement.querySelector('.pv-line-depth'));
      const scoreLabel = normalizedText(lineElement.querySelector('.pv-line-score'));
      const lineText = normalizedText(lineElement.querySelector('.pv-line-text'));
      const depth = kind === 'engine'
        ? depthLabel.replace(/^Depth\\s*/i, '').trim()
        : '';
      const scoreIsPending = !scoreLabel || /^Pending$/i.test(scoreLabel);
      const depthIsPending = kind !== 'engine' || !depth || depth === '—';
      const textIsPlaceholder = !lineText || /^(?:Loading engine line|Stopping analysis|No principal variation yet|Probing tablebase moves|No tablebase move is available)\\.{0,3}$/i.test(lineText);

      if (scoreIsPending && depthIsPending && textIsPlaceholder) {
        return;
      }

      entries.push({
        kind,
        index: Number((tablebaseMatch || engineMatch)[1]),
        depth: depth === '—' ? '' : depth,
        meta: scoreIsPending ? '' : scoreLabel,
        text: textIsPlaceholder ? '' : lineText,
      });
    });

    return { source: detectedSource, entries };
  }

"""
if marker not in source:
    raise SystemExit("evaluation marker not found")
source = source.replace(marker, parser + marker, 1)

old_collect = """  function collectSnapshot() {
    const notationLines = normalizedLines(document.getElementById('notationPanel'));
    const analysisLines = normalizedLines(document.getElementById('analysisPanel'));
    const titleIndex = notationLines.findIndex((line) => line === 'Tablebase moves' || line === 'Engine lines');
    const title = titleIndex >= 0 ? notationLines[titleIndex] : '';
    const source = title === 'Tablebase moves' ? 'tablebase' : 'engine';
    const entries = [];
    let currentEntry = null;

    if (titleIndex >= 0) {
"""
new_collect = """  function collectSnapshot() {
    const notationLines = normalizedLines(document.getElementById('notationPanel'));
    const analysisLines = normalizedLines(document.getElementById('analysisPanel'));
    const titleIndex = notationLines.findIndex((line) => line === 'Tablebase moves' || line === 'Engine lines');
    const title = titleIndex >= 0 ? notationLines[titleIndex] : '';
    const rendered = collectRenderedEntries();
    const source = rendered.entries.length
      ? rendered.source
      : (title === 'Tablebase moves' ? 'tablebase' : 'engine');
    const entries = [...rendered.entries];
    let currentEntry = null;

    if (!entries.length && titleIndex >= 0) {
"""
if old_collect not in source:
    raise SystemExit("snapshot block not found")
source = source.replace(old_collect, new_collect, 1)
popup_path.write_text(source, encoding="utf-8")

index_path = Path("index.html")
html = index_path.read_text(encoding="utf-8")
old_version = "./focus-analysis-popup.mjs?v=20260719-focus-analysis2"
new_version = "./focus-analysis-popup.mjs?v=20260719-focus-analysis3"
if old_version not in html:
    raise SystemExit("cache version not found")
index_path.write_text(html.replace(old_version, new_version, 1), encoding="utf-8")
