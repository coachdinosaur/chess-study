export const AUDIT_PAGE_SIZE = 25;

function normalizePageSize(pageSize) {
  return Math.min(499, Math.max(1, Math.trunc(Number(pageSize) || AUDIT_PAGE_SIZE)));
}

export function buildAuditPageParams(cursor = null, pageSize = AUDIT_PAGE_SIZE) {
  const normalizedPageSize = normalizePageSize(pageSize);
  const params = { p_limit: normalizedPageSize + 1 };

  if (cursor?.createdAt && cursor.id !== null && cursor.id !== undefined) {
    params.p_before_created_at = cursor.createdAt;
    params.p_before_id = cursor.id;
  }

  return params;
}

export function mergeAuditPage(existingRows, fetchedRows, pageSize = AUDIT_PAGE_SIZE) {
  const currentRows = Array.isArray(existingRows) ? existingRows : [];
  const pageRows = Array.isArray(fetchedRows) ? fetchedRows : [];
  const normalizedPageSize = normalizePageSize(pageSize);
  const consumedRows = pageRows.slice(0, normalizedPageSize);
  const seenIds = new Set(
    currentRows
      .map((row) => row?.audit_id)
      .filter((id) => id !== null && id !== undefined)
      .map(String),
  );
  const appendedRows = consumedRows.filter((row) => {
    if (row?.audit_id === null || row?.audit_id === undefined) return true;
    const key = String(row.audit_id);
    if (seenIds.has(key)) return false;
    seenIds.add(key);
    return true;
  });
  const cursorRow = consumedRows.at(-1);

  return {
    rows: [...currentRows, ...appendedRows],
    hasMore: pageRows.length > normalizedPageSize,
    cursor: cursorRow
      ? { createdAt: cursorRow.created_at, id: cursorRow.audit_id }
      : null,
  };
}
