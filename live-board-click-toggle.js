(function () {
  'use strict';

  var ignoreSelectedClickUntil = 0;

  /*
   * The drag helper supplies a synthetic click after a touch or pen tap because
   * some mobile browsers omit the native click after pointer capture. A delayed
   * native click can still arrive afterwards. The old desktop deselect helper
   * treated that second click as a request to clear the selected piece, so a
   * student's first tap appeared to do nothing. Keep the desktop deselect
   * convenience, but never run it for touch/pen tap sequences.
   */
  document.addEventListener('pointerdown', function (event) {
    if (event.pointerType === 'touch' || event.pointerType === 'pen') {
      ignoreSelectedClickUntil = Date.now() + 800;
    }
  }, true);

  document.addEventListener('click', function (event) {
    if (Date.now() < ignoreSelectedClickUntil) return;

    var square = event.target && event.target.closest ? event.target.closest('#liveBoard .square') : null;
    if (!square || !square.classList.contains('selected')) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    var board = document.getElementById('liveBoard');
    if (!board) return;

    var fallbackSquare = Array.from(board.querySelectorAll('.square')).find(function (candidate) {
      return candidate !== square && !candidate.querySelector('.piece') && !candidate.classList.contains('legal');
    });

    if (fallbackSquare) {
      fallbackSquare.click();
      return;
    }

    var anyOtherSquare = Array.from(board.querySelectorAll('.square')).find(function (candidate) {
      return candidate !== square;
    });
    if (anyOtherSquare) anyOtherSquare.click();
  }, true);
})();