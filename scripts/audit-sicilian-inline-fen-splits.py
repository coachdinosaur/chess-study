from pathlib import Path
import re

app_path = Path('apps/opening-book-sicilian/app/content/chapters/chapter-1-sicilian.md')
source_path = Path('apps/Chapter_1_Rare_Options.md')
lines = app_path.read_text(encoding='utf-8').splitlines()
source = source_path.read_text(encoding='utf-8')
page = None
fen_re = re.compile(r'^<!--\s*FEN:')
page_re = re.compile(r'^## Page (\d+)\s*$')
move_re = re.compile(
    r'(?:(?:\d+)\.(?:\.\.)?)?'
    r'(?:0-0-0|0-0|O-O-O|O-O|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?)'
    r'(?:[!?]+|N)?'
)

def moves(text):
    out=[]
    for match in move_re.finditer(text):
        token=match.group(0)
        token=re.sub(r'^\d+\.(?:\.\.)?', '', token)
        token=re.sub(r'(?:[!?]+|N)$', '', token)
        out.append(token)
    return out

def contains_sequence(haystack, needle):
    if not needle or len(haystack) < len(needle): return False
    return any(haystack[i:i+len(needle)] == needle for i in range(len(haystack)-len(needle)+1))

# Bold move spans in the PDF-derived source are the best proxy for a continuous
# move run. This avoids treating separate alternatives in one prose paragraph as
# one visual line.
source_spans=[]
for match in re.finditer(r'\*\*(.+?)\*\*', source, flags=re.S):
    text=match.group(1).replace('\n',' ')
    seq=moves(text)
    if seq:
        source_spans.append((text,seq))

def nonblank_before(i):
    j=i-1
    while j>=0 and not lines[j].strip(): j-=1
    return j

def nonblank_after(i):
    j=i+1
    while j<len(lines) and not lines[j].strip(): j+=1
    return j

confirmed=[]
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
    pm=moves(prev); nm=moves(nxt)
    if not pm or not nm:
        continue
    needle=pm[-min(2,len(pm)):] + nm[:min(2,len(nm))]
    matches=[text for text,seq in source_spans if contains_sequence(seq,needle)]
    if matches:
        confirmed.append((page,a+1,b+1,prev,nxt,line.strip(),needle,matches[0]))

print(f'CONTINUOUS_MOVE_SPLITS={len(confirmed)}')
for page,a,b,prev,nxt,fen,needle,source_span in confirmed:
    print(f'PAGE {page} | md lines {a}->{b} | sequence={needle}')
    print('  PREV:', prev)
    print('  NEXT:', nxt)
    print('  FEN :', fen)
    print('  SOURCE_SPAN:', source_span)
