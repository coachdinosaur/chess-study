(function () {
  'use strict';

  var TOUCH_MOVE_THRESHOLD = 9;
  var ignoreSelectedClickUntil = 0;
  var touchGesture = null;

  function selectedFallback(board, selectedSquare) {
    return Array.from(board.querySelectorAll('.square')).find(function (candidate) {
      return candidate !== selectedSquare && !candidate.querySelector('.piece') && !candidate.classList.contains('legal');
    }) || Array.from(board.querySelectorAll('.square')).find(function (candidate) {
      return candidate !== selectedSquare;
    });
  }

  function clearSelection(board, selectedSquare) {
    if (!board || !selectedSquare || !selectedSquare.classList.contains('selected')) return;
    var fallbackSquare = selectedFallback(board, selectedSquare);
    if (fallbackSquare) fallbackSquare.click();
  }

  /*
   * The drag helper supplies a synthetic click after touch/pen pointerup because
   * some mobile browsers omit the native click after pointer capture. A delayed
   * native click may still arrive afterwards, so ordinary click-based deselection
   * must ignore the duplicate. At the same time, an intentional second tap on
   * the already-selected piece must still clear that selection.
   */
  document.addEventListener('pointerdown', function (event) {
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;

    var square = event.target && event.target.closest
      ? event.target.closest('#liveBoard .square')
      : null;

    touchGesture = {
      pointerId: event.pointerId,
      square: square,
      squareName: square ? square.dataset.square || '' : '',
      wasSelected: Boolean(square && square.classList.contains('selected')),
      startX: event.clientX,
      startY: event.clientY,
      moved: false
    };

    ignoreSelectedClickUntil = Date.now() + 800;
  }, true);

  document.addEventListener('pointermove', function (event) {
    if (!touchGesture || event.pointerId !== touchGesture.pointerId) return;
    if (Math.hypot(event.clientX - touchGesture.startX, event.clientY - touchGesture.startY) >= TOUCH_MOVE_THRESHOLD) {
      touchGesture.moved = true;
    }
  }, true);

  document.addEventListener('pointerup', function (event) {
    if (!touchGesture || event.pointerId !== touchGesture.pointerId) return;

    var gesture = touchGesture;
    touchGesture = null;

    if (!gesture.wasSelected || gesture.moved || !gesture.squareName) return;

    var releasedSquare = document.elementFromPoint(event.clientX, event.clientY);
    releasedSquare = releasedSquare && releasedSquare.closest
      ? releasedSquare.closest('#liveBoard .square')
      : null;

    if (!releasedSquare || releasedSquare.dataset.square !== gesture.squareName) return;

    /*
     * Let the board's pointerup helper finish its synthetic click first, then
     * clear the still-selected piece through the board's normal click logic.
     */
    window.setTimeout(function () {
      var board = document.getElementById('liveBoard');
      if (!board) return;
      var currentSquare = board.querySelector('.square[data-square="' + gesture.squareName + '"]');
      clearSelection(board, currentSquare);
    }, 0);
  }, true);

  document.addEventListener('pointercancel', function (event) {
    if (touchGesture && event.pointerId === touchGesture.pointerId) touchGesture = null;
  }, true);

  /* Desktop mouse convenience: click the selected piece again to deselect it. */
  document.addEventListener('click', function (event) {
    if (Date.now() < ignoreSelectedClickUntil) return;

    var square = event.target && event.target.closest
      ? event.target.closest('#liveBoard .square')
      : null;
    if (!square || !square.classList.contains('selected')) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    clearSelection(document.getElementById('liveBoard'), square);
  }, true);
})();