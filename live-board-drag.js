const board = document.getElementById('liveBoard');

if (board) {
  const style = document.createElement('style');
  style.textContent = `
    .chess-board { touch-action: none; }
    .square:has(.piece):not(:disabled) { cursor: grab; }
    .chess-board.is-dragging .square { cursor: grabbing; }
    .square.drag-source .piece { opacity: 0.24; }
    .square.drag-target { box-shadow: inset 0 0 0 4px color-mix(in srgb, var(--accent) 76%, white); z-index: 1; }
    .live-board-drag-ghost {
      position: fixed;
      z-index: 9999;
      pointer-events: none;
      user-select: none;
      transform: translate(-50%, -50%) scale(1.06);
      filter: drop-shadow(0 8px 6px rgba(0, 0, 0, 0.32));
      will-change: left, top;
    }
  `;
  document.head.appendChild(style);

  const drag = {
    pointerId: null,
    sourceSquare: '',
    startX: 0,
    startY: 0,
    active: false,
    wasSelected: false,
    ghost: null,
    target: null,
  };

  let suppressTrustedClickUntil = 0;

  function squareAtPoint(x, y) {
    return document.elementFromPoint(x, y)?.closest?.('.square') || null;
  }

  function clearTarget() {
    drag.target?.classList.remove('drag-target');
    drag.target = null;
  }

  function updateTarget(x, y) {
    clearTarget();
    const target = squareAtPoint(x, y);
    if (!target || target.dataset.square === drag.sourceSquare) return;
    if (!target.classList.contains('legal')) return;
    target.classList.add('drag-target');
    drag.target = target;
  }

  function positionGhost(x, y) {
    if (!drag.ghost) return;
    drag.ghost.style.left = `${x}px`;
    drag.ghost.style.top = `${y}px`;
  }

  function beginDrag(x, y) {
    const currentSource = board.querySelector(`.square[data-square="${drag.sourceSquare}"]`);
    if (!currentSource) return false;

    // Select through the board's existing click path so legal moves, turn rules,
    // synchronization and promotion behavior remain shared with tap-to-move.
    currentSource.click();

    const selectedSource = board.querySelector(`.square[data-square="${drag.sourceSquare}"].selected`);
    const piece = selectedSource?.querySelector('.piece');
    if (!selectedSource || !piece) return false;

    const rect = selectedSource.getBoundingClientRect();
    drag.ghost = piece.cloneNode(true);
    drag.ghost.className = 'live-board-drag-ghost';
    drag.ghost.removeAttribute('alt');
    drag.ghost.style.width = `${rect.width * 0.86}px`;
    drag.ghost.style.height = `${rect.height * 0.86}px`;
    document.body.appendChild(drag.ghost);

    selectedSource.classList.add('drag-source');
    board.classList.add('is-dragging');
    drag.active = true;
    positionGhost(x, y);
    updateTarget(x, y);
    return true;
  }

  function deselectTappedSquare(tappedSquare) {
    const squares = Array.from(board.querySelectorAll('.square'));
    const fallback = squares.find((candidate) => (
      candidate !== tappedSquare
      && !candidate.querySelector('.piece')
      && !candidate.classList.contains('legal')
    )) || squares.find((candidate) => candidate !== tappedSquare);

    fallback?.click();
  }

  function cleanup() {
    clearTarget();
    drag.ghost?.remove();
    board.classList.remove('is-dragging');
    board.querySelectorAll('.drag-source').forEach((square) => square.classList.remove('drag-source'));
    drag.pointerId = null;
    drag.sourceSquare = '';
    drag.active = false;
    drag.wasSelected = false;
    drag.ghost = null;
  }

  board.addEventListener('click', (event) => {
    if (event.isTrusted && Date.now() < suppressTrustedClickUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  board.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || drag.pointerId !== null) return;
    const source = event.target.closest('.square');
    if (!source || source.disabled) return;

    drag.pointerId = event.pointerId;
    drag.sourceSquare = source.dataset.square || '';
    drag.wasSelected = source.classList.contains('selected');
    drag.startX = event.clientX;
    drag.startY = event.clientY;
    board.setPointerCapture?.(event.pointerId);
  });

  board.addEventListener('pointermove', (event) => {
    if (event.pointerId !== drag.pointerId) return;

    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    const source = board.querySelector(`.square[data-square="${drag.sourceSquare}"]`);
    if (!drag.active && distance >= 7 && source?.querySelector('.piece') && !beginDrag(event.clientX, event.clientY)) {
      cleanup();
      return;
    }

    if (!drag.active) return;
    event.preventDefault();
    positionGhost(event.clientX, event.clientY);
    updateTarget(event.clientX, event.clientY);
  });

  board.addEventListener('pointerup', (event) => {
    if (event.pointerId !== drag.pointerId) return;

    if (drag.active) {
      event.preventDefault();
      const destination = squareAtPoint(event.clientX, event.clientY);
      if (destination?.classList.contains('legal')) destination.click();
    } else {
      // Some mobile browsers fail to dispatch the native click after pointer
      // capture. Trigger it explicitly, while treating a second tap on the
      // already-selected square as a direct deselection request.
      const tappedSquare = squareAtPoint(event.clientX, event.clientY)
        || board.querySelector(`.square[data-square="${drag.sourceSquare}"]`);

      if (drag.wasSelected && tappedSquare?.dataset.square === drag.sourceSquare) {
        deselectTappedSquare(tappedSquare);
      } else {
        tappedSquare?.click();
      }
    }

    suppressTrustedClickUntil = Date.now() + 400;
    cleanup();
  });

  board.addEventListener('pointercancel', (event) => {
    if (event.pointerId === drag.pointerId) cleanup();
  });
}
