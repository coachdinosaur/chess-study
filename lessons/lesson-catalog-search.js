(function () {
  'use strict';

  var COURSE_INDEXES = [
    { name: 'Pawn Level', path: 'pawn-index.html' },
    { name: 'Advanced Pawn', path: 'advanced-pawn-index.html' },
    { name: 'Bishop Level', path: 'bishop-index.html' }
  ];
  var MAX_RENDERED_RESULTS = 60;
  var catalogPromise = null;

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function matchesQuery(item, query) {
    var tokens = normalizeText(query).split(' ').filter(Boolean);
    if (!tokens.length) return true;
    var haystack = normalizeText([
      item.title,
      item.description,
      item.course,
      item.module
    ].join(' '));
    return tokens.every(function (token) { return haystack.indexOf(token) !== -1; });
  }

  function injectStyles() {
    if (document.getElementById('lessonCatalogSearchStyles')) return;
    var style = document.createElement('style');
    style.id = 'lessonCatalogSearchStyles';
    style.textContent = [
      '.lesson-catalog-search{margin-top:28px;padding:18px;border:1px solid var(--panel-border);border-radius:20px;background:var(--panel-bg);box-shadow:0 12px 30px color-mix(in srgb,var(--page-bg) 30%,transparent)}',
      '.lesson-catalog-search-head{display:flex;align-items:end;justify-content:space-between;gap:16px;margin-bottom:12px}',
      '.lesson-catalog-search-title{margin:0;font-family:var(--font-display);font-size:1.08rem;color:var(--ink)}',
      '.lesson-catalog-search-copy{margin:4px 0 0;color:var(--ink-soft);font-size:.86rem}',
      '.lesson-catalog-search-row{display:flex;gap:10px;align-items:center}',
      '.lesson-catalog-search-input{width:100%;min-height:44px;padding:10px 13px;border:1px solid var(--panel-border);border-radius:12px;background:color-mix(in srgb,var(--panel-bg) 92%,var(--accent-soft));color:var(--ink);font:inherit;outline:none}',
      '.lesson-catalog-search-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 18%,transparent)}',
      '.lesson-catalog-search-clear{min-height:44px;padding:0 14px;border:1px solid var(--panel-border);border-radius:12px;background:var(--panel-bg);color:var(--ink);font:inherit;font-weight:750;cursor:pointer}',
      '.lesson-catalog-search-clear[hidden]{display:none}',
      '.lesson-catalog-search-status{margin:9px 0 0;color:var(--ink-soft);font-size:.8rem}',
      '.lesson-catalog-search-results{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px}',
      '.lesson-catalog-result{display:block;padding:13px 14px;border:1px solid var(--hairline);border-radius:13px;background:color-mix(in srgb,var(--panel-bg) 94%,var(--accent-soft));color:inherit;text-decoration:none}',
      '.lesson-catalog-result:hover,.lesson-catalog-result:focus-visible{outline:none;border-color:var(--accent);background:var(--accent-soft)}',
      '.lesson-catalog-result-meta{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:5px;color:var(--accent-strong);font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em}',
      '.lesson-catalog-result-title{display:block;color:var(--ink);font-weight:800;font-size:.93rem;line-height:1.35}',
      '.lesson-catalog-result-desc{display:block;margin-top:5px;color:var(--ink-soft);font-size:.79rem;line-height:1.45}',
      '.lesson-catalog-search-empty{grid-column:1/-1;margin:0;padding:16px;border:1px dashed var(--panel-border);border-radius:13px;color:var(--ink-soft);text-align:center}',
      '@media(max-width:700px){.lesson-catalog-search-head{display:block}.lesson-catalog-search-results{grid-template-columns:minmax(0,1fr)}.lesson-catalog-search-row{align-items:stretch}.lesson-catalog-search-clear{flex:0 0 auto}}'
    ].join('');
    document.head.appendChild(style);
  }

  function readLinksFromDocument(doc, courseName) {
    return Array.prototype.map.call(doc.querySelectorAll('.toc-link'), function (link) {
      var module = link.closest('.module');
      var title = link.querySelector('.toc-title');
      var description = link.querySelector('.toc-desc');
      var moduleName = module && module.querySelector('.module-name');
      var moduleTopic = module && module.querySelector('.module-topic');
      return {
        title: title ? title.textContent.trim() : link.textContent.trim(),
        description: description ? description.textContent.trim() : '',
        course: courseName,
        module: [moduleName && moduleName.textContent.trim(), moduleTopic && moduleTopic.textContent.trim()].filter(Boolean).join(' · '),
        href: link.getAttribute('href') || '#'
      };
    });
  }

  function loadCourseIndex(course) {
    return new Promise(function (resolve) {
      var iframe = document.createElement('iframe');
      iframe.hidden = true;
      iframe.setAttribute('aria-hidden', 'true');
      iframe.setAttribute('tabindex', '-1');
      iframe.src = course.path;
      var finished = false;

      function finish(items) {
        if (finished) return;
        finished = true;
        iframe.remove();
        resolve(items || []);
      }

      iframe.addEventListener('load', function () {
        try {
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              try {
                finish(readLinksFromDocument(iframe.contentDocument, course.name));
              } catch (error) {
                finish([]);
              }
            });
          });
        } catch (error) {
          finish([]);
        }
      }, { once: true });

      iframe.addEventListener('error', function () { finish([]); }, { once: true });
      document.body.appendChild(iframe);
      window.setTimeout(function () { finish([]); }, 8000);
    });
  }

  function buildCatalog() {
    if (catalogPromise) return catalogPromise;
    var currentItems = readLinksFromDocument(document, 'Endgame studies');
    catalogPromise = Promise.all(COURSE_INDEXES.map(loadCourseIndex)).then(function (groups) {
      return currentItems.concat.apply(currentItems, groups);
    });
    return catalogPromise;
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function init() {
    var page = document.querySelector('main.lesson-page');
    var hero = page && page.querySelector('.index-hero');
    if (!page || !hero) return;

    injectStyles();

    var section = document.createElement('section');
    section.className = 'lesson-catalog-search no-print';
    section.setAttribute('aria-labelledby', 'lessonCatalogSearchTitle');
    section.innerHTML = '' +
      '<div class="lesson-catalog-search-head">' +
        '<div><h2 id="lessonCatalogSearchTitle" class="lesson-catalog-search-title">Search lessons</h2>' +
        '<p class="lesson-catalog-search-copy">Search Pawn, Advanced Pawn, Bishop, and supplementary endgame lessons by title, topic, or description.</p></div>' +
      '</div>' +
      '<div class="lesson-catalog-search-row">' +
        '<input id="lessonCatalogSearchInput" class="lesson-catalog-search-input" type="search" autocomplete="off" spellcheck="false" placeholder="Search lessons, e.g. castling, rook mate, weakness…" aria-label="Search all lessons">' +
        '<button id="lessonCatalogSearchClear" class="lesson-catalog-search-clear" type="button" hidden>Clear</button>' +
      '</div>' +
      '<p id="lessonCatalogSearchStatus" class="lesson-catalog-search-status" aria-live="polite">Type to search the full lesson catalog.</p>' +
      '<div id="lessonCatalogSearchResults" class="lesson-catalog-search-results" hidden></div>';

    hero.insertAdjacentElement('afterend', section);

    var input = section.querySelector('#lessonCatalogSearchInput');
    var clear = section.querySelector('#lessonCatalogSearchClear');
    var status = section.querySelector('#lessonCatalogSearchStatus');
    var results = section.querySelector('#lessonCatalogSearchResults');
    var searchableSections = Array.prototype.slice.call(page.querySelectorAll('.index-section, .course-note')).filter(function (node) {
      return !section.contains(node);
    });
    var requestId = 0;

    function showDefaultContent() {
      searchableSections.forEach(function (node) { node.hidden = false; });
      results.hidden = true;
      results.innerHTML = '';
      clear.hidden = true;
      status.textContent = 'Type to search the full lesson catalog.';
    }

    function render(query) {
      var currentRequest = ++requestId;
      var trimmed = query.trim();
      if (!trimmed) {
        showDefaultContent();
        return;
      }

      clear.hidden = false;
      searchableSections.forEach(function (node) { node.hidden = true; });
      results.hidden = false;
      status.textContent = 'Loading lesson catalog…';
      results.innerHTML = '';

      buildCatalog().then(function (catalog) {
        if (currentRequest !== requestId) return;
        var matches = catalog.filter(function (item) { return matchesQuery(item, trimmed); });
        var shown = matches.slice(0, MAX_RENDERED_RESULTS);

        if (!matches.length) {
          status.textContent = 'No lessons found for “' + trimmed + '”.';
          results.innerHTML = '<p class="lesson-catalog-search-empty">No matching lessons. Try a broader chess term or part of a lesson title.</p>';
          return;
        }

        status.textContent = matches.length + ' matching lesson' + (matches.length === 1 ? '' : 's') + (matches.length > shown.length ? ' · showing first ' + shown.length : '');
        results.innerHTML = shown.map(function (item) {
          return '<a class="lesson-catalog-result" href="' + escapeHtml(item.href) + '">' +
            '<span class="lesson-catalog-result-meta"><span>' + escapeHtml(item.course) + '</span>' +
            (item.module ? '<span>·</span><span>' + escapeHtml(item.module) + '</span>' : '') + '</span>' +
            '<span class="lesson-catalog-result-title">' + escapeHtml(item.title) + '</span>' +
            (item.description ? '<span class="lesson-catalog-result-desc">' + escapeHtml(item.description) + '</span>' : '') +
          '</a>';
        }).join('');
      }).catch(function () {
        if (currentRequest !== requestId) return;
        status.textContent = 'Lesson search could not load the catalog.';
        results.innerHTML = '<p class="lesson-catalog-search-empty">The lesson catalog could not be loaded. Refresh the page and try again.</p>';
      });
    }

    input.addEventListener('input', function () { render(input.value); });
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && input.value) {
        input.value = '';
        render('');
      }
    });
    clear.addEventListener('click', function () {
      input.value = '';
      render('');
      input.focus();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
