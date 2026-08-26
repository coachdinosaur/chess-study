(() => {
  'use strict';
  const moduleNumber = Number(document.body.dataset.moduleNumber || 1);
  const course = window[`ADVANCED_PAWN_MODULE_${moduleNumber}`];
  const lessonNumber = Number(document.body.dataset.lessonNumber || 0);
  const lesson = course && course.lessons.find(item => item.number === lessonNumber);
  if (!lesson) {
    document.getElementById('app').innerHTML = '<main class="page"><section class="lesson-section"><h1>Lesson not found</h1><p>The requested Advanced Pawn lesson could not be loaded.</p></section></main>';
    return;
  }

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const pieceMap = {P:'wP',N:'wN',B:'wB',R:'wR',Q:'wQ',K:'wK',p:'bP',n:'bN',b:'bB',r:'bR',q:'bQ',k:'bK'};
  const pieceName = {P:'white pawn',N:'white knight',B:'white bishop',R:'white rook',Q:'white queen',K:'white king',p:'black pawn',n:'black knight',b:'black bishop',r:'black rook',q:'black queen',k:'black king'};

  function enableTeacherBoard() {
    const firstPosition = lesson.positions && lesson.positions[0];
    if (firstPosition && firstPosition.fen) {
      document.documentElement.setAttribute('data-teacher-fen', firstPosition.fen);
    }

    if (!document.querySelector('link[data-advanced-pawn-teacher-board]')) {
      const stylesheet = document.createElement('link');
      stylesheet.rel = 'stylesheet';
      stylesheet.href = 'pawn-teacher-board.css?v=20260826-teacher-board-size-fix2';
      stylesheet.setAttribute('data-advanced-pawn-teacher-board', '');
      document.head.appendChild(stylesheet);
    }

    if (!document.querySelector('script[data-advanced-pawn-teacher-board]')) {
      const script = document.createElement('script');
      script.src = 'pawn-teacher-board.js?v=20260826-teacher-board-size-fix2';
      script.setAttribute('data-advanced-pawn-teacher-board', '');
      document.body.appendChild(script);
    }
  }

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
    const solutionText=p.solution ? esc(p.solution).replace(/\n/g,'<br>') : '';
    const solution=p.solution ? `<details class="solution"><summary>Show solution</summary><p>${solutionText}</p></details>` : '<div class="no-position">This is a practice position. Work it out on the board before checking with a coach or analysis board.</div>';
    const notes=(p.notes||[]).map(note=>`<div class="no-position"><strong>Source note:</strong> ${esc(note)}</div>`).join('');
    const sourcePage=p.source_pdf_page ? `<div class="position-meta">Source PDF page ${esc(p.source_pdf_page)}</div>` : '';
    return `<article class="position-card" id="position-${index+1}">
      <div class="position-head"><div><h3>${esc(p.label)}</h3><div class="position-meta">Position ${index+1} · ${esc(p.side_to_move[0].toUpperCase()+p.side_to_move.slice(1))} to move</div></div>${sourcePage}</div>
      <div class="board-and-notes">
        <div class="board-shell"><div class="chessboard" data-fen="${esc(p.fen)}" role="img" aria-label="Chess position: ${esc(p.label)}"></div></div>
        <div>
          <p class="position-prompt">${esc(p.prompt)}</p>
          <div class="fen-box">${esc(p.fen)}</div>
          <div class="board-actions"><button class="mini-btn flip-board" type="button">Flip board</button><button class="mini-btn copy-fen" type="button">Copy FEN</button></div>
          <div class="copy-status" aria-live="polite"></div>
          ${solution}${notes}
        </div>
      </div>
    </article>`;
  }

  const defaultObjectives=[
    {title:'Recognize',text:'Identify the pieces and king restrictions that define the pattern.'},
    {title:'Calculate',text:'Find forcing checks, captures, sacrifices, and mating moves.'},
    {title:'Apply',text:'Use the pattern in practical games and avoid the defender’s common mistakes.'}
  ];
  const defaultReview=[
    {question:'What pieces deliver or support this mating pattern?',answer:'Use the lesson explanation and board position to name the attacking pieces and the squares they control.'},
    {question:'Why can the defending king not escape?',answer:'Identify every flight square and explain whether it is occupied, attacked, or outside the board.'},
    {question:'What is the forcing move or key idea?',answer:'Look first for checks, then captures, threats, sacrifices, and quiet moves that remove an escape square.'}
  ];
  const objectives=(course.objectives||defaultObjectives).map(item=>`<div class="objective"><strong>${esc(item.title)}</strong><span>${esc(item.text)}</span></div>`).join('');
  const review=(course.reviewQuestions||defaultReview).map(item=>`<details><summary>${esc(item.question)}</summary><p>${esc(item.answer)}</p></details>`).join('');
  const heroPieces=(course.heroPieces||['wR','wQ','bK']).map(piece=>`<img src="../assets/pieces/mpchess/${esc(piece)}.svg" alt="Chess piece">`).join('');
  const positionLinks=lesson.positions.map((p,i)=>`<a href="#position-${i+1}">${i+1}. ${esc(p.label)}</a>`).join('');
  const positions=lesson.positions.length ? lesson.positions.map(positionHtml).join('') : `<div class="no-position">${esc(lesson.emptyState||'This lesson is conceptual. Study the main idea carefully, then continue to the next practical position.')}</div>`;
  const prev=lesson.previous?`<a href="${esc(lesson.previous)}">&larr; Previous lesson</a>`:'<a href="advanced-pawn-index.html">&larr; Module index</a>';
  const next=lesson.next?`<a href="${esc(lesson.next)}">Next lesson &rarr;</a>`:'<a href="advanced-pawn-index.html">Module complete &rarr;</a>';

  document.getElementById('app').innerHTML=`
    <div class="index-header no-print"><div class="index-header-inner">
      <div class="index-brand"><div class="index-brand-icon" aria-hidden="true">♟</div><div><div class="index-brand-label">Advanced Pawn Level</div><div class="index-brand-title">${esc(lesson.title)}</div></div></div>
      <div class="index-top-actions"><a class="toolbar-link" href="advanced-pawn-index.html">&larr; Advanced Pawn Index</a><button class="toolbar-link" type="button" id="themeToggle">Toggle theme</button><button class="toolbar-link" type="button" onclick="window.print()">Print / Save PDF</button></div>
    </div></div>
    <div class="progress" aria-hidden="true"><div class="progress-bar" id="progressBar"></div></div>
    <div class="page">
      <section class="hero" id="top"><div><p class="kicker">Advanced Pawn · Module ${course.module} · Lesson ${lesson.number}</p><h1>${esc(lesson.title)}</h1><p class="lead">${esc(lesson.description)}</p>
      <div class="objective-grid">${objectives}</div></div>
      <div class="hero-card"><div class="hero-pieces">${heroPieces}<div class="hero-badge">${esc(course.moduleTitle)} · ${lesson.positions.length} FEN position${lesson.positions.length===1?'':'s'}</div></div></div></section>
      <div class="layout" id="lesson"><nav class="toc" aria-label="Lesson contents"><div class="toc-title">Contents</div><a href="#idea">1. Main idea</a>${positionLinks}<a href="#review">Review</a></nav>
      <main><section class="lesson-section" id="idea"><div class="section-head"><div class="number">1</div><div><h2>Main Idea</h2></div></div><div class="prose">${lesson.intro_html}</div></section>
      <section class="lesson-section" id="positions"><div class="section-head"><div class="number">2</div><div><h2>${lesson.positions.length?'Study the Position'+(lesson.positions.length===1?'':'s'):'Core Knowledge'}</h2></div></div><div class="position-grid">${positions}</div></section>
      <section class="lesson-section review" id="review"><div class="section-head"><div class="number">✓</div><div><h2>Review</h2><p class="prose">Check that you understand the lesson before moving on.</p></div></div>
      ${review}
      <div class="lesson-nav-row">${prev}${next}</div></section></main></div>
    </div><footer class="footer"><strong>Advanced Pawn Level · Module ${course.module} · Lesson ${lesson.number}:</strong> ${esc(lesson.title)}.</footer>`;

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
  const stored=localStorage.getItem('lesson-theme-v1')||localStorage.getItem('chess-lesson-theme');
  if (stored==='light'||stored==='dark') root.dataset.theme=stored;
  document.getElementById('themeToggle').addEventListener('click',()=>{
    root.dataset.theme=root.dataset.theme==='dark'?'light':'dark';
    localStorage.setItem('lesson-theme-v1',root.dataset.theme);
    localStorage.setItem('chess-lesson-theme',root.dataset.theme);
  });
  const bar=document.getElementById('progressBar');
  const update=()=>{ const max=document.documentElement.scrollHeight-window.innerHeight; bar.style.width=(max>0?Math.min(100,Math.max(0,window.scrollY/max*100)):0)+'%'; };
  update(); window.addEventListener('scroll',update,{passive:true});
  enableTeacherBoard();
})();

(function loadLessonPresentation() {
  if (document.querySelector('script[data-lesson-presentation]')) return;
  var script = document.createElement('script');
  script.src = 'lesson-presentation.js?v=20260725-presentation-click-pulse-v5';
  script.defer = true;
  script.setAttribute('data-lesson-presentation', '');
  document.body.appendChild(script);
})();
