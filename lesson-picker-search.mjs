const SEARCH_UI_SELECTOR = '[data-lesson-picker-search]';
const SEARCH_INPUT_SELECTOR = '[data-lesson-picker-search-input]';
const SEARCH_STATUS_SELECTOR = '[data-lesson-picker-search-status]';
const LESSON_ITEM_SELECTOR = '.lesson-picker-item:not(.lesson-picker-add-item)';
const STYLE_ID = 'lesson-picker-search-styles';

export function normalizeLessonSearchText(value) {
  return String(value ?? '').trim().toLocaleLowerCase();
}

export function lessonTitleMatchesSearch(title, query) {
  const normalizedQuery = normalizeLessonSearchText(query);
  if (!normalizedQuery) {
    return true;
  }
  return normalizeLessonSearchText(title).includes(normalizedQuery);
}

function installStyles(doc) {
  if (doc.getElementById(STYLE_ID)) {
    return;
  }

  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .lesson-picker-search {
      position: sticky;
      top: 0;
      z-index: 2;
      display: grid;
      gap: 0.35rem;
      padding: 0.55rem;
      border-bottom: 1px solid var(--overflow-divider);
      background: var(--overflow-menu-bg);
    }

    .lesson-picker-search-input {
      width: 100%;
      min-width: 12rem;
      box-sizing: border-box;
      border: 1px solid var(--input-border);
      border-radius: 0.55rem;
      background: var(--input-bg);
      color: var(--text);
      padding: 0.55rem 0.65rem;
      font: inherit;
      line-height: 1.2;
      outline: none;
    }

    .lesson-picker-search-input::placeholder {
      color: var(--text-soft);
    }

    .lesson-picker-search-input:focus {
      border-color: var(--focus-border);
      box-shadow: 0 0 0 3px var(--focus-ring);
    }

    .lesson-picker-search-status {
      min-height: 1rem;
      margin: 0;
      color: var(--text-soft);
      font-size: 0.72rem;
      line-height: 1.3;
    }
  `;
  doc.head.appendChild(style);
}

function createSearchUi(doc, query) {
  const wrapper = doc.createElement('div');
  wrapper.className = 'lesson-picker-search';
  wrapper.setAttribute('data-lesson-picker-search', '');

  const input = doc.createElement('input');
  input.type = 'search';
  input.className = 'lesson-picker-search-input';
  input.placeholder = 'Search lessons…';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('aria-label', 'Search lessons');
  input.setAttribute('data-lesson-picker-search-input', '');
  input.value = query;

  const status = doc.createElement('p');
  status.className = 'lesson-picker-search-status';
  status.setAttribute('data-lesson-picker-search-status', '');
  status.setAttribute('aria-live', 'polite');

  wrapper.append(input, status);
  return wrapper;
}

function installLessonPickerSearch(doc = document) {
  const menu = doc.getElementById('lessonPickerMenu');
  if (!menu) {
    return false;
  }

  installStyles(doc);

  let query = '';
  let repairing = false;

  const getSearchUi = () => menu.querySelector(SEARCH_UI_SELECTOR);

  const applyFilter = () => {
    const normalizedQuery = normalizeLessonSearchText(query);
    const lessonItems = Array.from(menu.querySelectorAll(LESSON_ITEM_SELECTOR));
    let visibleCount = 0;

    lessonItems.forEach((item) => {
      const title = item.querySelector('.lesson-picker-item-title')?.textContent || '';
      const matches = lessonTitleMatchesSearch(title, normalizedQuery);
      item.hidden = !matches;
      if (matches) {
        visibleCount += 1;
      }
    });

    const status = menu.querySelector(SEARCH_STATUS_SELECTOR);
    if (!status) {
      return;
    }

    if (!normalizedQuery) {
      status.textContent = `${lessonItems.length} lesson${lessonItems.length === 1 ? '' : 's'}`;
    } else if (visibleCount === 0) {
      status.textContent = 'No lessons found.';
    } else {
      status.textContent = `${visibleCount} matching lesson${visibleCount === 1 ? '' : 's'}`;
    }
  };

  const bindSearchUi = (wrapper) => {
    const input = wrapper.querySelector(SEARCH_INPUT_SELECTOR);
    if (!input || input.dataset.lessonPickerSearchBound === 'true') {
      return;
    }

    input.dataset.lessonPickerSearchBound = 'true';
    input.addEventListener('input', () => {
      query = input.value;
      applyFilter();
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && input.value) {
        event.preventDefault();
        event.stopPropagation();
        query = '';
        input.value = '';
        applyFilter();
        return;
      }

      if (event.key === 'ArrowDown') {
        const firstVisibleLesson = Array.from(menu.querySelectorAll(LESSON_ITEM_SELECTOR))
          .find((item) => !item.hidden);
        if (firstVisibleLesson) {
          event.preventDefault();
          firstVisibleLesson.focus();
        }
      }
    });
  };

  const ensureSearchUi = () => {
    let wrapper = getSearchUi();
    if (!wrapper) {
      repairing = true;
      wrapper = createSearchUi(doc, query);
      menu.prepend(wrapper);
      repairing = false;
    }

    bindSearchUi(wrapper);
    const input = wrapper.querySelector(SEARCH_INPUT_SELECTOR);
    if (input && input.value !== query) {
      input.value = query;
    }
    applyFilter();
    return input;
  };

  ensureSearchUi();

  const observer = new MutationObserver((mutations) => {
    if (repairing) {
      return;
    }

    const menuClosed = mutations.some((mutation) => (
      mutation.type === 'attributes'
      && mutation.attributeName === 'hidden'
      && menu.hidden
    ));

    if (menuClosed) {
      query = '';
    }

    const input = ensureSearchUi();
    if (!menu.hidden && mutations.some((mutation) => (
      mutation.type === 'attributes' && mutation.attributeName === 'hidden'
    ))) {
      requestAnimationFrame(() => input?.focus({ preventScroll: true }));
    }
  });

  observer.observe(menu, {
    childList: true,
    attributes: true,
    attributeFilter: ['hidden'],
  });

  return true;
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => installLessonPickerSearch(), { once: true });
  } else {
    installLessonPickerSearch();
  }
}
