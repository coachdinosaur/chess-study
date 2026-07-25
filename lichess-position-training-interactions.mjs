const DRAG_THRESHOLD_PX = 7;
const CLICK_SUPPRESSION_MS = 500;

let gesture = null;
let dragPreview = null;
let dispatchingSyntheticClick = false;
let suppressNativeClicksUntil = 0;

function boardFromTarget(target) {
  return target instanceof Element ? target.closest('[data-pt-board]') : null;
}

function squareElementFromTarget(target) {
  return target instanceof Element ? target.closest('[data-pt-board] [data-square]') : null;
}

function squareElementFromPoint(board, clientX, clientY) {
  const target = document.elementFromPoint(clientX, clientY);
  const square = squareElementFromTarget(target);
  return square && board.contains(square) ? square : null;
}

function dispatchSquareClick(board, square) {
  if (!square) return false;
  const squareElement = board.querySelector(`[data-square="${square}"]`);
  if (!squareElement) return false;
  dispatchingSyntheticClick = true;
  try {
    squareElement.click();
  } finally {
    dispatchingSyntheticClick = false;
  }
  return true;
}

function clearDragPreview() {
  dragPreview?.remove();
  dragPreview = null;
}

function showDragPreview(pieceImage, clientX, clientY) {
  if (!pieceImage || dragPreview) return;
  const preview = document.createElement('div');
  preview.className = 'position-training-drag-preview';
  const image = pieceImage.cloneNode(true);
  image.className = 'position-training-drag-preview-piece';
  image.removeAttribute('draggable');
  preview.appendChild(image);
  document.body.appendChild(preview);
  dragPreview = preview;
  moveDragPreview(clientX, clientY);
}

function moveDragPreview(clientX, clientY) {
  if (!dragPreview) return;
  dragPreview.style.left = `${clientX}px`;
  dragPreview.style.top = `${clientY}px`;
}

function clearDragHover(board) {
  board?.querySelector('.position-training-square.drag-hover')?.classList.remove('drag-hover');
}

function setDragHover(board, squareElement) {
  clearDragHover(board);
  if (squareElement?.classList.contains('legal-target')) {
    squareElement.classList.add('drag-hover');
  }
}

function resetGesture({ releaseCapture = true } = {}) {
  if (!gesture) {
    clearDragPreview();
    return;
  }
  const { board, pointerId } = gesture;
  clearDragHover(board);
  board.querySelector('.position-training-square.is-drag-source')?.classList.remove('is-drag-source');
  if (releaseCapture) {
    try {
      if (board.hasPointerCapture?.(pointerId)) board.releasePointerCapture(pointerId);
    } catch {}
  }
  clearDragPreview();
  gesture = null;
}

function beginGesture(event) {
  if (!event.isPrimary || event.button !== 0) return;
  const squareElement = squareElementFromTarget(event.target);
  const board = squareElement ? boardFromTarget(squareElement) : null;
  if (!board || board.classList.contains('is-busy')) return;

  event.preventDefault();
  gesture = {
    board,
    pointerId: event.pointerId,
    sourceSquare: squareElement.dataset.square || '',
    startX: event.clientX,
    startY: event.clientY,
    moved: false,
    pieceImage: squareElement.querySelector('.position-training-piece'),
  };
  try {
    board.setPointerCapture?.(event.pointerId);
  } catch {}
}

function moveGesture(event) {
  if (!gesture || gesture.pointerId !== event.pointerId) return;
  const distance = Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY);
  if (!gesture.moved && distance < DRAG_THRESHOLD_PX) return;
  if (!gesture.pieceImage) return;

  event.preventDefault();
  if (!gesture.moved) {
    gesture.moved = true;
    dispatchSquareClick(gesture.board, gesture.sourceSquare);
    gesture.board.querySelector(`[data-square="${gesture.sourceSquare}"]`)?.classList.add('is-drag-source');
    showDragPreview(gesture.pieceImage, event.clientX, event.clientY);
  } else {
    moveDragPreview(event.clientX, event.clientY);
  }

  const targetSquareElement = squareElementFromPoint(gesture.board, event.clientX, event.clientY);
  setDragHover(gesture.board, targetSquareElement);
}

function endGesture(event) {
  if (!gesture || gesture.pointerId !== event.pointerId) return;
  event.preventDefault();
  const { board, sourceSquare, moved } = gesture;
  const targetSquareElement = squareElementFromPoint(board, event.clientX, event.clientY);
  const targetSquare = targetSquareElement?.dataset.square || '';
  resetGesture();
  suppressNativeClicksUntil = Date.now() + CLICK_SUPPRESSION_MS;

  if (!moved) {
    dispatchSquareClick(board, sourceSquare);
    return;
  }

  if (targetSquare && targetSquare !== sourceSquare && targetSquareElement?.classList.contains('legal-target')) {
    dispatchSquareClick(board, targetSquare);
  }
}

function cancelGesture(event) {
  if (!gesture || gesture.pointerId !== event.pointerId) return;
  resetGesture();
  suppressNativeClicksUntil = Date.now() + CLICK_SUPPRESSION_MS;
}

document.addEventListener('pointerdown', beginGesture, true);
document.addEventListener('pointermove', moveGesture, true);
document.addEventListener('pointerup', endGesture, true);
document.addEventListener('pointercancel', cancelGesture, true);
document.addEventListener('click', (event) => {
  if (dispatchingSyntheticClick) return;
  if (Date.now() >= suppressNativeClicksUntil) return;
  if (!squareElementFromTarget(event.target)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);

window.addEventListener('blur', () => resetGesture());
