function loadTeacherBoardIllegalMoveSupport() {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    const params = new URLSearchParams(window.location.search);
    const embed = params.get('embed');
    const boardOnly = params.get('boardOnly');
    const isTeacherBoard = (embed === '1' || embed === 'true')
      && (boardOnly === '1' || boardOnly === 'true')
      && params.has('_teacher');
    if (isTeacherBoard) {
      void import('./lessons/teacher-board-illegal-moves.mjs?v=20260711-illegal3').catch((error) => {
        console.warn('[Teacher Board] Illegal-move support failed to load.', error);
      });
    }
  } catch {
    // Ignore malformed or unavailable URL state outside browser environments.
  }
}

function loadAiHelpChat() {
  if (typeof window === 'undefined') {
    return;
  }

  void import('./ai-help-chat.mjs?v=20260718-ai-help1').catch((error) => {
    console.warn('[AI Help] Chat failed to load.', error);
  });
}

loadTeacherBoardIllegalMoveSupport();
loadAiHelpChat();

const ENCODING_REPAIR_REPLACEMENTS = Object.freeze([
  ['\u00e2\u20ac\u2122', "'"],
  ['\u00e2\u20ac\u02dc', "'"],
  ['\u00e2\u20ac\u0161', "'"],
  ['\u00e2\u20ac\u0153', '"'],
  ['\u00e2\u20ac\u009d', '"'],
  ['\u00e2\u20ac\ufffd', '"'],
  ['\u00e2\u20ac\u201c', '-'],
  ['\u00e2\u20ac\u201d', '-'],
  ['\u00e2\u20ac\u00a6', '...'],
  ['\u00e2\u20ac\u00a2', '-'],
  ['\u00c2\u00a0', ' '],
  ['\u00c2 ', ' '],
]);

const PUNCTUATION_REPLACEMENTS = Object.freeze([
  ['\u2018', "'"],
  ['\u2019', "'"],
  ['\u201a', "'"],
  ['\u201b', "'"],
  ['\u201c', '"'],
  ['\u201d', '"'],
  ['\u201e', '"'],
  ['\u201f', '"'],
  ['\u2013', '-'],
  ['\u2014', '-'],
  ['\u2212', '-'],
  ['\u2026', '...'],
  ['\u00a0', ' '],
]);

function applyTextReplacements(text, replacements) {
  return replacements.reduce(
    (result, [search, replacement]) => result.split(search).join(replacement),
    text,
  );
}

export function normalizeEditableText(value) {
  const text = String(value ?? '');
  return applyTextReplacements(
    applyTextReplacements(text, ENCODING_REPAIR_REPLACEMENTS),
    PUNCTUATION_REPLACEMENTS,
  );
}
