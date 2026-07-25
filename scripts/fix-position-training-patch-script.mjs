import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const path = 'scripts/apply-position-training-learning-upgrade.mjs';
let source = fs.readFileSync(path, 'utf8');
const before = `trainer = replaceOnce(
  trainer,
  "       <p>Train from database positions against dynamic defence. Any move that preserves the objective can be accepted; the existing Endgame vs Stockfish trainer remains unchanged.</p>",
  "       <p>Train against dynamic defence with adaptive difficulty, progressive hints, mistake review, explanations, and theme performance tracking. The existing Endgame vs Stockfish trainer remains unchanged.</p>",
  'launcher learning description',
);`;
const after = `trainer = trainer.replace(
  /(<p>)Train from database positions against dynamic defence\\. Any move that preserves the objective can be accepted; the existing Endgame vs Stockfish trainer remains unchanged\\.(<\\/p>)/,
  '$1Train against dynamic defence with adaptive difficulty, progressive hints, mistake review, explanations, and theme performance tracking. The existing Endgame vs Stockfish trainer remains unchanged.$2',
);`;
if (!source.includes(before)) throw new Error('Launcher patch block was not found in the upgrade script.');
source = source.replace(before, after);
fs.writeFileSync(path, source);
fs.unlinkSync(fileURLToPath(import.meta.url));
console.log('Relaxed launcher description patch.');
