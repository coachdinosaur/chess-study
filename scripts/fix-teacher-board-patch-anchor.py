from pathlib import Path

path = Path(__file__).with_name('patch-teacher-board-setup.py')
text = path.read_text(encoding='utf-8')
replacements = {
    "'''       setupColorToggle(),\n       setupPieceRow(),\n       '    <button": "'''      setupColorToggle(),\n      setupPieceRow(),\n      '    <button",
    "'''       setupColorToggle(),\n       setupPieceRow(),\n       '<button": "'''      setupColorToggle(),\n      setupPieceRow(),\n      '<button",
}
for old, new in replacements.items():
    if old not in text:
        raise RuntimeError('Expected patch anchor text was not found.')
    text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
print('Teacher Board patch anchors corrected.')
