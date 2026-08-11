import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  AUDIT_PAGE_SIZE,
  buildAuditPageParams,
  mergeAuditPage,
} from '../management/js/admin-audit-pagination.mjs';

const [html, dashboard, hardening, migration] = await Promise.all([
  readFile(new URL('../management/admin.html', import.meta.url), 'utf8'),
  readFile(new URL('../management/js/admin-dashboard.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../management/hardening.css', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/migrations/20260811074100_paginate_management_audit_events.sql', import.meta.url), 'utf8'),
]);

function auditRow(id, createdAt = `2026-08-11T00:00:${String(60 - id).padStart(2, '0')}Z`) {
  return { audit_id: id, created_at: createdAt, event_type: `event.${id}` };
}

test('initial audit request fetches one sentinel beyond the 25 visible events', () => {
  assert.equal(AUDIT_PAGE_SIZE, 25);
  assert.deepEqual(buildAuditPageParams(), { p_limit: 26 });

  const page = mergeAuditPage([], Array.from({ length: 26 }, (_, index) => auditRow(index + 1)));
  assert.equal(page.rows.length, 25);
  assert.equal(page.hasMore, true);
  assert.deepEqual(page.cursor, {
    createdAt: page.rows[24].created_at,
    id: page.rows[24].audit_id,
  });
});

test('older pages preserve server order and do not append duplicate audit ids', () => {
  const firstRows = [auditRow(1), auditRow(2), auditRow(3)];
  const fetchedRows = [auditRow(3), auditRow(4), auditRow(5)];
  const page = mergeAuditPage(firstRows, fetchedRows, 3);

  assert.deepEqual(page.rows.map((row) => row.audit_id), [1, 2, 3, 4, 5]);
  assert.equal(new Set(page.rows.map((row) => row.audit_id)).size, page.rows.length);
  assert.equal(page.hasMore, false);
  assert.equal(page.cursor.id, 5);
});

test('successive pages expose every audit row exactly once', () => {
  const allRows = Array.from({ length: 50 }, (_, index) => auditRow(index + 1));
  const firstPage = mergeAuditPage([], allRows.slice(0, 26));
  const finalPage = mergeAuditPage(firstPage.rows, allRows.slice(25));

  assert.equal(firstPage.hasMore, true);
  assert.equal(finalPage.hasMore, false);
  assert.deepEqual(finalPage.rows.map((row) => row.audit_id), allRows.map((row) => row.audit_id));
  assert.equal(new Set(finalPage.rows.map((row) => row.audit_id)).size, allRows.length);
});

test('cursor requests use the final consumed created-at and id values', () => {
  assert.deepEqual(
    buildAuditPageParams({ createdAt: '2026-08-10T12:00:00Z', id: 42 }),
    {
      p_limit: 26,
      p_before_created_at: '2026-08-10T12:00:00Z',
      p_before_id: 42,
    },
  );
});

test('empty and final pages stop pagination cleanly', () => {
  const empty = mergeAuditPage([], []);
  assert.deepEqual(empty, { rows: [], hasMore: false, cursor: null });

  const final = mergeAuditPage([], [auditRow(1), auditRow(2)]);
  assert.equal(final.hasMore, false);
  assert.equal(final.rows.length, 2);
  assert.equal(final.cursor.id, 2);
});

test('admin UI exposes older history without rendering all rows initially', () => {
  assert.match(html, /id="loadMoreAuditButton"[^>]*hidden>Load older events/);
  assert.match(html, /id="auditPaginationStatus"[^>]*aria-live="polite"/);
  assert.match(dashboard, /buildAuditPageParams\(\)/);
  assert.match(dashboard, /mergeAuditPage\(\[\], auditResult\.data, AUDIT_PAGE_SIZE\)/);
  assert.match(dashboard, /loadMoreAuditEvents/);
  assert.doesNotMatch(dashboard, /p_limit:\s*100/);
  assert.match(hardening, /\.audit-card \.list-card-head \{[\s\S]+flex-wrap: wrap/);
  assert.match(hardening, /\.audit-card h3,[\s\S]+overflow-wrap: anywhere/);
  assert.match(hardening, /\.audit-pagination \{[\s\S]+flex-direction: column/);
});

test('migration uses stable newest-first keyset pagination and least privilege', () => {
  assert.match(migration, /drop function if exists public\.admin_list_audit_log\(integer\)/);
  assert.match(migration, /p_limit integer default 25/);
  assert.match(migration, /p_before_created_at timestamptz default null/);
  assert.match(migration, /p_before_id bigint default null/);
  assert.match(migration, /\(audit\.created_at, audit\.id\) < \(p_before_created_at, p_before_id\)/);
  assert.match(migration, /order by audit\.created_at desc, audit\.id desc/);
  assert.match(migration, /management_audit_log\(created_at desc, id desc\)/);
  assert.match(migration, /not private\.is_platform_admin\(\)/);
  assert.match(migration, /revoke all on function public\.admin_list_audit_log\(integer, timestamptz, bigint\)[\s\S]+from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.admin_list_audit_log\(integer, timestamptz, bigint\)[\s\S]+to authenticated/);
  assert.doesNotMatch(migration, /delete\s+from\s+public\.management_audit_log/i);
  assert.match(migration, /^begin;[\s\S]+commit;\s*$/);
});
