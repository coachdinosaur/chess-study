function asNodeMap(nodes) {
  return nodes && typeof nodes === 'object' && !Array.isArray(nodes) ? nodes : {};
}

function getNode(nodes, nodeId) {
  return asNodeMap(nodes)[String(nodeId || '')] || null;
}

function validChildIds(nodes, parentNode) {
  if (!parentNode || !Array.isArray(parentNode.children)) {
    return [];
  }
  const map = asNodeMap(nodes);
  return parentNode.children.filter((childId) => Boolean(map[childId]));
}

export function preferredChildId(nodes, parentId) {
  const parentNode = getNode(nodes, parentId);
  const children = validChildIds(nodes, parentNode);
  if (!children.length) {
    return '';
  }
  if (parentNode.selectedChildId && children.includes(parentNode.selectedChildId)) {
    return parentNode.selectedChildId;
  }
  return children[0];
}

export function ensureExistingChildMainLine(nodes, parentId, childId) {
  const parentNode = getNode(nodes, parentId);
  const childNode = getNode(nodes, childId);
  if (!parentNode || !childNode || childNode.parentId !== parentNode.id) {
    throw new Error('Cannot follow a child that does not belong to the parent node.');
  }
  if (!Array.isArray(parentNode.children) || !parentNode.children.includes(childNode.id)) {
    throw new Error('Parent node does not contain the requested child.');
  }
  const currentMainLineId = preferredChildId(nodes, parentNode.id);
  if (!currentMainLineId) {
    parentNode.selectedChildId = childNode.id;
    return { changed: true, mainLineChildId: childNode.id };
  }
  return { changed: false, mainLineChildId: currentMainLineId };
}

export function appendChildPreservingMainLine(nodes, parentId, childNode) {
  const map = asNodeMap(nodes);
  const parentNode = getNode(map, parentId);
  if (!parentNode) {
    throw new Error(`Missing parent node: ${parentId}`);
  }
  if (!childNode || typeof childNode !== 'object' || !childNode.id) {
    throw new Error('A child node with an ID is required.');
  }
  if (map[childNode.id]) {
    throw new Error(`Node ID already exists: ${childNode.id}`);
  }

  const mainLineBeforeInsert = preferredChildId(map, parentNode.id);
  const normalizedChild = {
    ...childNode,
    parentId: parentNode.id,
    children: Array.isArray(childNode.children) ? [...childNode.children] : [],
    selectedChildId: childNode.selectedChildId || null,
    comment: typeof childNode.comment === 'string' ? childNode.comment : '',
  };

  map[normalizedChild.id] = normalizedChild;
  if (!Array.isArray(parentNode.children)) {
    parentNode.children = [];
  }
  parentNode.children.push(normalizedChild.id);

  if (!mainLineBeforeInsert) {
    parentNode.selectedChildId = normalizedChild.id;
  }

  return {
    node: normalizedChild,
    addedAsVariation: Boolean(mainLineBeforeInsert),
    mainLineChildId: mainLineBeforeInsert || normalizedChild.id,
  };
}

export function isNodeMainLine(nodes, nodeId) {
  const node = getNode(nodes, nodeId);
  if (!node || !node.parentId) {
    return false;
  }
  return preferredChildId(nodes, node.parentId) === node.id;
}

export function promoteNodeToMainLine(nodes, nodeId) {
  const node = getNode(nodes, nodeId);
  if (!node || !node.parentId) {
    return { ok: false, changed: false, reason: 'The root position cannot be promoted.' };
  }
  const parentNode = getNode(nodes, node.parentId);
  if (!parentNode || !Array.isArray(parentNode.children) || !parentNode.children.includes(node.id)) {
    return { ok: false, changed: false, reason: 'The selected move is detached from its parent.' };
  }

  const previousMainLineId = preferredChildId(nodes, parentNode.id);
  parentNode.selectedChildId = node.id;
  return {
    ok: true,
    changed: previousMainLineId !== node.id,
    nodeId: node.id,
    parentId: parentNode.id,
    previousMainLineId,
    mainLineChildId: node.id,
  };
}

export function variationDepth(nodes, nodeId) {
  let cursor = getNode(nodes, nodeId);
  let depth = 0;
  const seen = new Set();
  while (cursor?.parentId && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    if (!isNodeMainLine(nodes, cursor.id)) {
      depth += 1;
    }
    cursor = getNode(nodes, cursor.parentId);
  }
  return depth;
}
