import test from 'node:test';
import assert from 'node:assert/strict';

import {
  liveBoardStudentLink,
  liveBoardTeacherLink,
} from '../management/js/student-workspace-core.mjs';

const locationObject = { href: 'https://cddigital.top/management/teacher.html' };

test('student Live Board link keeps access data in the URL fragment', () => {
  const url = new URL(liveBoardStudentLink('abc234', 'student-secret', locationObject));
  const hash = new URLSearchParams(url.hash.slice(1));

  assert.equal(url.pathname, '/live-board.html');
  assert.equal(url.search, '');
  assert.equal(hash.get('room'), 'ABC234');
  assert.equal(hash.get('role'), 'student');
  assert.equal(hash.get('access'), 'student-secret');
});

test('teacher Live Board link contains teacher and student credentials', () => {
  const url = new URL(liveBoardTeacherLink(
    'xyz789',
    'teacher-secret',
    'student-secret',
    locationObject,
  ));
  const hash = new URLSearchParams(url.hash.slice(1));

  assert.equal(url.pathname, '/live-board.html');
  assert.equal(hash.get('room'), 'XYZ789');
  assert.equal(hash.get('role'), 'teacher');
  assert.equal(hash.get('access'), 'teacher-secret');
  assert.equal(hash.get('student'), 'student-secret');
});
