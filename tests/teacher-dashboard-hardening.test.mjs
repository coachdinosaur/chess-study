import assert from 'node:assert/strict';
import test from 'node:test';
import { csvCell } from '../management/js/teacher-dashboard.mjs';

test('csvCell handles empty, null, and undefined values cleanly', () => {
  assert.equal(csvCell(null), '""');
  assert.equal(csvCell(undefined), '""');
  assert.equal(csvCell(''), '""');
});

test('csvCell escapes double quotes according to RFC 4180', () => {
  assert.equal(csvCell('Hello "World"'), '"Hello ""World"""');
  assert.equal(csvCell('"""'), '""""""""');
});

test('csvCell safely preserves commas and multi-line strings inside quoted cell', () => {
  const multiLine = 'Line 1\nLine 2, with commas\r\nLine 3';
  const escaped = csvCell(multiLine);
  assert.equal(escaped, '"Line 1\nLine 2, with commas\r\nLine 3"');
});

test('csvCell neutralizes CSV formula injection attempts (CWE-1236)', () => {
  // Common formula injection triggers: =, +, -, @, tab, return
  assert.equal(csvCell('=SUM(A1:A10)'), '"\'=SUM(A1:A10)"');
  assert.equal(csvCell('+cmd|"/C calc"!A0'), '"\'+cmd|""/C calc""!A0"');
  assert.equal(csvCell('-5+10'), '"\'-5+10"');
  assert.equal(csvCell('@IMPORTXML("http://evil.com")'), '"\'@IMPORTXML(""http://evil.com"")"');
  assert.equal(csvCell('\t=1+1'), '"\'\t=1+1"');
  assert.equal(csvCell('  =2+2'), '"\'  =2+2"');
});

test('csvCell leaves regular text and numbers untouched except for wrapping quotes', () => {
  assert.equal(csvCell('Normal note without formula'), '"Normal note without formula"');
  assert.equal(csvCell('12345'), '"12345"');
  assert.equal(csvCell('Needs practice on e4/e5'), '"Needs practice on e4/e5"');
});
