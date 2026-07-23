(function () {
  'use strict';

  document.addEventListener('click', function (event) {
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
