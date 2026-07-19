from pathlib import Path

popup_path = Path("focus-analysis-popup.mjs")
popup = popup_path.read_text(encoding="utf-8")

old = """  function normalizedLines(element) {
    return String(element?.innerText || '')
      .split(/\\r?\\n/)
      .map((line) => line.replace(/\\s+/g, ' ').trim())
      .filter(Boolean);
  }
"""

new = """  function normalizedLines(element) {
    // Focus mode hides the control pane with display:none. textContent still
    // exposes the rendered PV/tablebase text, while innerText becomes empty.
    return String(element?.textContent || '')
      .split(/\\r?\\n/)
      .map((line) => line.replace(/\\s+/g, ' ').trim())
      .filter(Boolean);
  }
"""

if popup.count(old) != 1:
    raise SystemExit(f"Expected one normalizedLines block, found {popup.count(old)}")
popup = popup.replace(old, new, 1)
popup_path.write_text(popup, encoding="utf-8")

index_path = Path("index.html")
html = index_path.read_text(encoding="utf-8")
old_version = './focus-analysis-popup.mjs?v=20260719-focus-analysis1'
new_version = './focus-analysis-popup.mjs?v=20260719-focus-analysis2'
if html.count(old_version) != 1:
    raise SystemExit(f"Expected one popup script version, found {html.count(old_version)}")
html = html.replace(old_version, new_version, 1)
index_path.write_text(html, encoding="utf-8")

if "element?.innerText" in popup:
    raise SystemExit("innerText reader still present")
if "element?.textContent" not in popup:
    raise SystemExit("textContent reader missing")
if new_version not in html:
    raise SystemExit("cache-busted popup script URL missing")
