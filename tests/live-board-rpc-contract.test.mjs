import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = path.join(repoRoot, 'supabase', 'migrations');

// Ship-facing JavaScript that can hold a Supabase client: every root-level
// script plus the management dashboard modules. Vendor bundles, tests, and
// buildable app sources are excluded.
async function collectClientSources() {
  const rootEntries = await readdir(repoRoot, { withFileTypes: true });
  const files = rootEntries
    .filter((entry) => entry.isFile() && /\.(mjs|js)$/.test(entry.name))
    .map((entry) => path.join(repoRoot, entry.name));

  const managementJsDir = path.join(repoRoot, 'management', 'js');
  for (const entry of await readdir(managementJsDir, { withFileTypes: true })) {
    if (entry.isFile() && /\.(mjs|js)$/.test(entry.name)) {
      files.push(path.join(managementJsDir, entry.name));
    }
  }
  return files.sort();
}

// Collects RPC names invoked through a Supabase client. Covers literal calls
// (`.rpc('name', …)`, including the `originalRpc` shim) and identifier calls
// where the identifier is bound to a ternary of two literals
// (`const rpcName = cond ? 'a' : 'b'` — see puzzle-assignment-student.mjs).
function collectCalledRpcs(source) {
  const called = new Map();
  const identifierNames = new Map();

  const ternaryPattern = /\b(?:const|let|var)\s+(\w+)\s*=[^;\n]*\?\s*'([a-z_0-9]+)'\s*:\s*'([a-z_0-9]+)'/g;
  for (const match of source.matchAll(ternaryPattern)) {
    identifierNames.set(match[1], [match[2], match[3]]);
  }

  const callPattern = /(?:\.rpc|originalRpc)\(\s*(?:'([a-z_0-9]+)'|"([a-z_0-9]+)"|(\w+))/g;
  for (const match of source.matchAll(callPattern)) {
    const names = match[1] || match[2]
      ? [match[1] || match[2]]
      : identifierNames.get(match[3]) || [];
    for (const name of names) {
      if (!called.has(name)) called.set(name, []);
      called.get(name).push({ index: match.index });
    }
  }
  return called;
}

// Extracts the `p_*` argument names a call site passes by scanning the
// balanced (...) argument list that starts at the call, then reading keys
// from everything after the first top-level comma (the args object).
// Identifier-form calls (`.rpc(rpcName, args)`) carry no inline keys and
// return an empty set.
function collectCallParams(source, callIndex) {
  const openParen = source.indexOf('(', callIndex);
  if (openParen === -1) return new Set();

  let depth = 0;
  let inString = null;
  let end = -1;
  for (let i = openParen; i < source.length; i += 1) {
    const ch = source[i];
    if (inString) {
      if (ch === inString && source[i - 1] !== '\\') inString = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { inString = ch; continue; }
    if (ch === '(' || ch === '{' || ch === '[') depth += 1;
    if (ch === ')' || ch === '}' || ch === ']') {
      depth -= 1;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end === -1) return new Set();

  const argsText = source.slice(openParen + 1, end);
  const firstComma = argsText.indexOf(',');
  if (firstComma === -1) return new Set();
  const objectText = argsText.slice(firstComma);
  return new Set([...objectText.matchAll(/\b(p_[a-z_0-9]+)\s*:/g)].map((m) => m[1]));
}

// Maps each RPC name defined in the migrations to the text of its
// signature (from `create function name(` through `returns …`), which is
// where declared parameter names live.
function collectDefinedRpcs(sqlByFile) {
  const defined = new Map();
  const signaturePattern = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z_0-9]+)\s*\(([\s\S]*?)\)\s*returns/gi;
  for (const [file, sql] of sqlByFile) {
    for (const match of sql.matchAll(signaturePattern)) {
      if (!defined.has(match[1])) defined.set(match[1], []);
      defined.get(match[1]).push({ file, signature: match[2] });
    }
  }
  return defined;
}

const clientFiles = await collectClientSources();
const calledRpcs = new Map();
for (const file of clientFiles) {
  const source = await readFile(file, 'utf8');
  const relative = path.relative(repoRoot, file);
  for (const [name, sites] of collectCalledRpcs(source)) {
    if (!calledRpcs.has(name)) calledRpcs.set(name, []);
    for (const site of sites) {
      calledRpcs.get(name).push({ file: relative, index: site.index, source });
    }
  }
}

const migrationFiles = (await readdir(migrationsDir))
  .filter((name) => name.endsWith('.sql'))
  .sort();
const sqlByFile = new Map();
for (const name of migrationFiles) {
  sqlByFile.set(name, await readFile(path.join(migrationsDir, name), 'utf8'));
}
const definedRpcs = collectDefinedRpcs(sqlByFile);

test('every RPC invoked by shipped client code is defined in supabase/migrations', () => {
  const missing = [...calledRpcs.keys()].filter((name) => !definedRpcs.has(name)).sort();
  assert.deepEqual(
    missing,
    [],
    `Client code calls RPCs with no migration definition: ${missing.join(', ')}`,
  );
});

test('RPC call-site parameters exist in the migration signatures', () => {
  const failures = [];
  for (const [name, sites] of calledRpcs) {
    const definitions = definedRpcs.get(name) || [];
    if (!definitions.length) continue; // already reported by the coverage test
    for (const site of sites) {
      for (const param of collectCallParams(site.source, site.index)) {
        const declared = definitions.some((definition) =>
          new RegExp(`\\b${param}\\b`).test(definition.signature),
        );
        if (!declared) failures.push(`${name}: ${param} (called in ${site.file})`);
      }
    }
  }
  assert.deepEqual(
    failures,
    [],
    `Client call-site params missing from migration signatures:\n${failures.join('\n')}`,
  );
});

test('columns referenced by migrations are created by migrations', () => {
  // Regression guard for the drift where start_student_workspace_live_board
  // inserted into live_board_rooms.student_short_token_hash before any
  // migration created the column.
  const allSql = [...sqlByFile.values()].join('\n');
  assert.match(
    allSql,
    /student_short_token_hash\s+text\b|add\s+column\s+(?:if\s+not\s+exists\s+)?[\w.]*student_short_token_hash/i,
    'live_board_rooms.student_short_token_hash must be created by a migration',
  );
});
