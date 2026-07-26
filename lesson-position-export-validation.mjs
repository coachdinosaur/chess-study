import { normalizeLessonPosition, validateLessonPosition } from './lesson-model.mjs';

export function validatePositionSetExport(inputs = [], options = {}) {
  const errors = [];
  if (!Array.isArray(inputs) || inputs.length === 0) {
    return {
      ok: false,
      errors: ['No positions to export.'],
      positions: [],
    };
  }

  const ids = new Set();
  let defaultCount = 0;
  const positions = inputs.map((input, index) => {
    const position = normalizeLessonPosition(input, { fallbackId: `position-${index + 1}` });
    const validation = validateLessonPosition(position, {
      validateFen: options.validateFen,
    });
    if (!validation.ok) {
      errors.push(`${position.title || `Position ${index + 1}`}: ${validation.errors.join(' ')}`);
    }
    if (ids.has(position.id)) {
      errors.push(`Duplicate position ID: ${position.id}.`);
    }
    ids.add(position.id);
    if (position.isDefault) defaultCount += 1;
    return position;
  });

  if (defaultCount === 0) {
    errors.push('Set one default position before export.');
  } else if (defaultCount > 1) {
    errors.push('Only one default position may be exported.');
  }

  return {
    ok: errors.length === 0,
    errors,
    positions,
  };
}
