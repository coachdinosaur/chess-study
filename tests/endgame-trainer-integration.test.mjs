import assert from 'node:assert/strict';
import { access, readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

function file(path) {
  return new URL(path, root);
}

async function assertLocalReferencesExist(documentPath, html) {
  const references = [...html.matchAll(/(?:href|src)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((reference) => !reference.startsWith('#'));

  for (const reference of references) {
    const resolved = new URL(reference, file(documentPath));
    if (resolved.protocol !== 'file:') continue;

    const target = await stat(resolved);
    if (target.isDirectory()) {
      await access(new URL('index.html', resolved));
    }
  }
}

test('the Endgame Trainer landing page uses its production route', async () => {
  const landing = await readFile(file('endgame-trainer/index.html'), 'utf8');

  assert.match(
    landing,
    /rel="canonical" href="https:\/\/cddigital\.top\/endgame-trainer\/"/,
  );
  assert.match(landing, /href="privacy-policy\/"/);
  assert.doesNotMatch(landing, /privacy\.html/);

  await assertLocalReferencesExist('endgame-trainer/index.html', landing);
});

test('the privacy policy is a clean directory route with valid relative assets', async () => {
  const privacy = await readFile(
    file('endgame-trainer/privacy-policy/index.html'),
    'utf8',
  );

  assert.match(
    privacy,
    /rel="canonical" href="https:\/\/cddigital\.top\/endgame-trainer\/privacy-policy\/"/,
  );
  assert.match(privacy, /href="\.\.\/styles\.css"/);
  assert.match(privacy, /href="\.\.\/privacy\.css"/);
  assert.match(privacy, /src="\.\.\/assets\/favicon\.png"/);
  assert.match(privacy, /href="\.\.\/#training"/);
  assert.doesNotMatch(privacy, /privacy\.html|href="index\.html/);

  await assertLocalReferencesExist(
    'endgame-trainer/privacy-policy/index.html',
    privacy,
  );
});

test('the complete standalone asset set is present in the Pages artifact tree', async () => {
  await Promise.all([
    access(file('endgame-trainer/styles.css')),
    access(file('endgame-trainer/privacy.css')),
    access(file('endgame-trainer/assets/favicon.png')),
    access(file('endgame-trainer/assets/light-portrait.png')),
    access(file('endgame-trainer/assets/puzzle-landscape.png')),
    access(file('.nojekyll')),
  ]);

  const workflow = await readFile(file('.github/workflows/pages.yml'), 'utf8');
  assert.match(workflow, /uses:\s*actions\/upload-pages-artifact@v4/);
  assert.match(workflow, /path:\s*\./);
  assert.match(workflow, /cancel-in-progress:\s*false/);
  assert.match(workflow, /build:\s*\n\s*runs-on:/);
  assert.match(workflow, /deploy:\s*\n\s*needs:\s*build/);
});
