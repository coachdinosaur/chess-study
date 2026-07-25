import { readFile, writeFile } from 'node:fs/promises';

const indexPath = 'index.html';
const before = './focus-analysis-popup.mjs?v=20260725-position-training3';
const after = './focus-analysis-popup.mjs?v=20260725-grid-rows1';

let source = await readFile(indexPath, 'utf8');
if (source.includes(after)) {
  process.exit(0);
}
if (!source.includes(before)) {
  throw new Error(`Expected cache version not found in ${indexPath}`);
}
source = source.replace(before, after);
await writeFile(indexPath, source);
