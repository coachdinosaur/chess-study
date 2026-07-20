(() => {
  'use strict';
  const course = window.ADVANCED_PAWN_MODULE_1;
  const lessonNumber = Number(document.body.dataset.lessonNumber || 0);
  const lesson = course && course.lessons.find(item => item.number === lessonNumber);
  if (!lesson) {
    document.getElementById('app').innerHTML = '<main class="page"><section class="lesson-section"><h1>Lesson not found</h1><p>The requested Advanced Pawn lesson could not be loaded.</p></section></main>';
    return;
  }

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const pieceMap = {P:'wP',N:'wN',B:'wB',R:'wR',Q:'wQ',K:'wK',p:'bP',n:'bN',b:'bB',r:'bR',q:'bQ',k:'bK'};
  const pieceName = {P:'white pawn',N:'white knight',B:'white bishop',R:'white rook',Q:'white queen',K:'white king',p:'black pawn',n:'black knight',b:'black bishop',r:'black rook',q:'black queen',k:'black king'};

  function parseFen(fen) {
    const boardPart = fen.split(/\s+/)[0];
    const out = [];
    boardPart.split('/').forEach(rank => {
      for (const ch of rank) {
        if (/\d/.test(ch)) for (let i=0;i<Number(ch);i++) out.push(null);
        else out.push(ch);
      }
    });
    return out;
  }

  function renderBoard(node, fen, orientation='white') {
    const pieces=parseFen(fen);
    const ranks=orientation==='white'?[8,7,6,5,4,3,2,1]:[1,2,3,4,5,6,7,8];
    const files=orientation==='white'?['a','b','c','d','e','f','g','h']:['h','g','f','e','d','c','b','a'];
    node.innerHTML='';
    ranks.forEach((rank, visualRank) => {
      files.forEach((file, visualFile) => {
        const fileIndex=file.charCodeAt(0)-97;
        const rankIndex=8-rank;
        const piece=pieces[rankIndex*8+fileIndex];
        const square=document.createElement('div');
        square.className='square '+(((fileIndex+rankIndex)%2===0)?'light':'dark');
        square.setAttribute('aria-label', file+rank+(piece?' '+pieceName[piece]:' empty'));
        if (piece) {
          const img=document.createElement('img');
          img.src='../assets/pieces/mpchess/'+pieceMap[piece]+'.svg';
          img.alt=pieceName[piece];
          img.draggable=false;
          square.appendChild(img);
        }
        if (visualRank===7) {
          const c=document.createElement('span'); c.className='coord-file'; c.textContent=file; square.appendChild(c);
        }
        if (visualFile===0) {
          const c=document.createElement('span'); c.className='coord-rank'; c.textContent=rank; square.appendChild(c);
        }
        node.appendChild(square);
      });
    });
    node.dataset.orientation=orientation;
  }

  function positionHtml(p, index) {
    const solution=p.solution ? `<details class="solution"><summary>Show solution</summary><p>${esc(p.solution)}</p></details>` : '<div class="no-position">This is a practice position. Work it out on the board before checking with a coach or analysis board.</div>';
    return `<article class="position-card" id="position-${index+1}">
      <div class="position-head"><div><h3>${esc(p.label)}</h3><div class="position-meta">Position ${index+1} · ${esc(p.side_to_move[0].toUpperCase()+p.side_to_move.slice(1))} to move</div></div><div class="position-meta">Source PDF page ${esc(p.source_pdf_page)}</div></div>
      <div class="board-and-notes">
        <div class="board-shell"><div class="chessboard" data-fen="${esc(p.fen)}" role="img" aria-label="Chess position: ${esc(p.label)}"></div></div>
        <div>
          <p class="position-prompt">${esc(p.prompt)}</p>
          <div class="fen-box">${esc(p.fen)}</div>
          <div class="board-actions"><button class="mini-btn flip-board" type="button">Flip board</button><button class="mini-btn copy-fen" type="button">Copy FEN</button></div>
          <div class="copy-status" aria-live="polite"></div>
          ${solution}
        </div>
      </div>
    </article>`;
  }

  const positionLinks=lesson.positions.map((p,i)=>`<a href="#position-${i+1}">${i+1}. ${esc(p.label)}</a>`).join('');
  const positions=lesson.positions.length ? lesson.positions.map(positionHtml).join('') : '<div class="no-position">This lesson is conceptual. Study the material list carefully, then continue to the next practical position.</div>';
  const prev=lesson.previous?`<a href="${esc(lesson.previous)}">&larr; Previous lesson</a>`:'<a href="advanced-pawn-index.html">&larr; Module index</a>';
  const next=lesson.next?`<a href="${esc(lesson.next)}">Next lesson &rarr;</a>`:'<a href="advanced-pawn-index.html">Module complete &rarr;</a>';

  document.getElementById('app').innerHTML=`
    <div class="index-header no-print"><div class="index-header-inner">
      <div class="index-brand"><div class="index-brand-icon" aria-hidden="true">♟</div><div><div class="index-brand-label">Advanced Pawn Level</div><div class="index-brand-title">${esc(lesson.title)}</div></div></div>
      <div class="index-top-actions"><a class="toolbar-link" href="advanced-pawn-index.html">&larr; Advanced Pawn Index</a><button class="toolbar-link" type="button" id="themeToggle">Toggle theme</button><button class="toolbar-link" type="button" onclick="window.print()">Print / Save PDF</button></div>
    </div></div>
    <div class="progress" aria-hidden="true"><div class="progress-bar" id="progressBar"></div></div>
    <div class="page">
      <section class="hero" id="top"><div><p class="kicker">Advanced Pawn · Module 1 · Lesson ${lesson.number}</p><h1>${esc(lesson.title)}</h1><p class="lead">${esc(lesson.description)}</p>
      <div class="objective-grid"><div class="objective"><strong>Recognize</strong><span>Identify the pieces and king restrictions that define the pattern.</span></div><div class="objective"><strong>Calculate</strong><span>Find forcing checks, captures, sacrifices, and mating moves.</span></div><div class="objective"><strong>Apply</strong><span>Use the pattern in practical games and avoid the defender’s common mistakes.</span></div></div></div>
      <div class="hero-card"><div class="hero-pieces"><img src="../assets/pieces/mpchess/wR.svg" alt="White rook"><img src="../assets/pieces/mpchess/wQ.svg" alt="White queen"><img src="../assets/pieces/mpchess/bK.svg" alt="Black king"><div class="hero-badge">Checkmate Patterns · ${lesson.positions.length} FEN position${lesson.positions.length===1?'':'s'}</div></div></div></section>
      <div class="layout" id="lesson"><nav class="toc" aria-label="Lesson contents"><div class="toc-title">Contents</div><a href="#idea">1. Main idea</a>${positionLinks}<a href="#review">Review</a></nav>
      <main><section class="lesson-section" id="idea"><div class="section-head"><div class="number">1</div><div><h2>Main Idea</h2></div></div><div class="prose">${lesson.intro_html}</div></section>
      <section class="lesson-section" id="positions"><div class="section-head"><div class="number">2</div><div><h2>${lesson.positions.length?'Study the Position'+(lesson.positions.length===1?'':'s'):'Material Knowledge'}</h2></div></div><div class="position-grid">${positions}</div></section>
      <section class="lesson-section review" id="review"><div class="section-head"><div class="number">✓</div><div><h2>Review</h2><p class="prose">Check that you understand the pattern before moving on.</p></div></div>
      <details><summary>What pieces deliver or support this mating pattern?</summary><p>Use the lesson explanation and board position to name the attacking pieces and the squares they control.</p></details>
      <details><summary>Why can the defending king not escape?</summary><p>Identify every flight square and explain whether it is occupied, attacked, or outside the board.</p></details>
      <details><summary>What is the forcing move or key idea?</summary><p>Look first for checks, then captures, threats, sacrifices, and quiet moves that remove an escape square.</p></details>
      <div class="lesson-nav-row">${prev}${next}</div></section></main></div>
    </div><footer class="footer"><strong>Advanced Pawn Level · Module 1 · Lesson ${lesson.number}:</strong> ${esc(lesson.title)}.</footer>`;

  document.querySelectorAll('.chessboard').forEach(board=>renderBoard(board,board.dataset.fen,'white'));
  document.querySelectorAll('.flip-board').forEach(button=>button.addEventListener('click',()=>{
    const card=button.closest('.position-card'); const board=card.querySelector('.chessboard');
    renderBoard(board,board.dataset.fen,board.dataset.orientation==='white'?'black':'white');
  }));
  document.querySelectorAll('.copy-fen').forEach(button=>button.addEventListener('click',async()=>{
    const card=button.closest('.position-card'); const fen=card.querySelector('.chessboard').dataset.fen; const status=card.querySelector('.copy-status');
    try { await navigator.clipboard.writeText(fen); status.textContent='FEN copied.'; }
    catch(e) { status.textContent='Copy failed. Select the FEN text manually.'; }
    setTimeout(()=>status.textContent='',2200);
  }));

  const root=document.documentElement;
  const stored=localStorage.getItem('chess-lesson-theme');
  if (stored==='light'||stored==='dark') root.dataset.theme=stored;
  document.getElementById('themeToggle').addEventListener('click',()=>{
    root.dataset.theme=root.dataset.theme==='dark'?'light':'dark';
    localStorage.setItem('chess-lesson-theme',root.dataset.theme);
  });
  const bar=document.getElementById('progressBar');
  const update=()=>{ const max=document.documentElement.scrollHeight-window.innerHeight; bar.style.width=(max>0?Math.min(100,Math.max(0,window.scrollY/max*100)):0)+'%'; };
  update(); window.addEventListener('scroll',update,{passive:true});
})();
