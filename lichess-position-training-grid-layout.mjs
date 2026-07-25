const STYLE_ID = 'position-training-grid-layout-fix';

if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .position-training-board {
      grid-template-columns: repeat(8, minmax(0, 1fr));
      grid-template-rows: repeat(8, minmax(0, 1fr));
      grid-auto-flow: row;
      grid-auto-rows: minmax(0, 1fr);
      align-items: stretch;
      justify-items: stretch;
    }

    .position-training-square {
      width: 100%;
      height: 100%;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
    }
  `;
  document.head.appendChild(style);
}
