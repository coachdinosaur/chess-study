from pathlib import Path
import re

path = Path('apps/opening-book-sicilian/app/content/chapters/chapter-1-sicilian.md')
lines = path.read_text(encoding='utf-8').splitlines()
page = None
move_re = re.compile(r'(?<!\w)(?:\d+\.(?:\.\.)?)?[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?[!?]*(?:N)?|\b\d+\.\.\.[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8]|\b\d+\.[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8]')
fen_re = re.compile(r'^<!--\s*FEN:')
page_re = re.compile(r'^## Page (\d+)\s*$')

def nonblank_before(i):
    j=i-1
    while j>=0 and not lines[j].strip(): j-=1
    return j

def nonblank_after(i):
    j=i+1
    while j<len(lines) and not lines[j].strip(): j+=1
    return j

for i,line in enumerate(lines):
    m=page_re.match(line.strip())
    if m:
        page=int(m.group(1))
    if not fen_re.match(line.strip()):
        continue
    a=nonblank_before(i); b=nonblank_after(i)
    if a<0 or b>=len(lines):
        continue
    prev=lines[a].strip(); nxt=lines[b].strip()
    if prev.startswith('`') or prev.startswith('**FEN:**') or nxt.startswith('`') or nxt.startswith('**FEN:**'):
        continue
    if move_re.search(prev) and move_re.search(nxt):
        print(f'PAGE {page} | md lines {a+1}->{b+1}')
        print('  PREV:', prev)
        print('  NEXT:', nxt)
        print('  FEN :', line.strip())
