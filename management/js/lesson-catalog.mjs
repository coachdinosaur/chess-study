const STANDARD_INDEXES = [
  { level: 'Pawn Level', path: '../lessons/pawn-index.html', available: true },
  { level: 'Bishop Level', path: '../lessons/bishop-index.html', available: true },
];

const ADVANCED_PAWN_MODULES = Array.from({ length: 12 }, (_, index) => ({
  level: 'Advanced Pawn Level',
  path: `../lessons/advanced-pawn-module-${index + 1}-data.js`,
  available: true,
}));

function decodeJavascriptString(value) {
  try {
    return JSON.parse(`"${value.replaceAll('"', '\\"')}"`);
  } catch {
    return value.replaceAll('\\"', '"').replaceAll("\\'", "'");
  }
}

function extractHtmlLessons(html, source) {
  const arrayMatch = html.match(/var\s+(?:PAWN|BISHOP)_MODULES\s*=\s*(\[\s*\{[\s\S]*?\}\s*\]);/);
  if (arrayMatch) {
    try {
      const modules = Function(`return (${arrayMatch[1]})`)();
      const lessons = [];
      for (const mod of modules) {
        const moduleTitle = mod.title || `Module ${mod.module}`;
        for (const item of mod.lessons || []) {
          const [number, title, filename] = item;
          lessons.push({
            key: `${source.level}:${filename}`,
            level: source.level,
            module: moduleTitle,
            number: String(number),
            title,
            url: `../lessons/${filename}`,
            available: source.available,
          });
        }
      }
      return lessons;
    } catch {
      // fallback to regex if structure varies
    }
  }

  const lessons = [];
  const tuplePattern = /\[\s*"([^"]+)"\s*,\s*"((?:\\.|[^"])*)"\s*,\s*"([^"]+\.html)"\s*,\s*"((?:\\.|[^"])*)"\s*\]/g;
  let match;
  while ((match = tuplePattern.exec(html))) {
    const number = match[1];
    const title = decodeJavascriptString(match[2]);
    const filename = match[3];
    const before = html.slice(0, match.index);
    const moduleMatches = [...before.matchAll(/title:\s*"((?:\\.|[^"])*)"/g)];
    const moduleTitle = moduleMatches.at(-1)?.[1] || '';
    lessons.push({
      key: `${source.level}:${filename}`,
      level: source.level,
      module: decodeJavascriptString(moduleTitle),
      number,
      title,
      url: `../lessons/${filename}`,
      available: source.available,
    });
  }
  return lessons;
}

function parseModuleData(jsCode) {
  const clean = jsCode
    .replace(/^window\.ADVANCED_PAWN_MODULE_\d+\s*=\s*/, '')
    .replace(/;\s*$/, '');
  return Function(`return (${clean})`)();
}

function extractModuleLessons(jsCode, source) {
  const data = parseModuleData(jsCode);
  const moduleTitle = data.moduleTitle || (data.module ? `Module ${data.module}` : '');
  return (data.lessons || []).map((lesson) => ({
    key: `${source.level}:${lesson.filename}`,
    level: source.level,
    module: moduleTitle,
    number: String(lesson.number),
    title: lesson.title,
    url: `../lessons/${lesson.filename}`,
    available: source.available,
  }));
}

function extractEndgames(html) {
  if (typeof DOMParser !== 'undefined') {
    const documentNode = new DOMParser().parseFromString(html, 'text/html');
    return [...documentNode.querySelectorAll('#endgames .toc-link[href]')].map((link, index) => ({
      key: `Endgames:${link.getAttribute('href')}`,
      level: 'Endgames',
      module: 'Supplementary endgame studies',
      number: String(index + 1),
      title: link.querySelector('.toc-title')?.textContent?.trim() || link.textContent.trim(),
      url: `../lessons/${link.getAttribute('href')}`,
      available: true,
    }));
  }
  const endgamesSection = html.slice(Math.max(0, html.indexOf('id="endgames"')));
  const matches = [...endgamesSection.matchAll(/<a class="toc-link" href="([^"]+)">[\s\S]*?<span class="toc-title">([^<]+)<\/span>/g)];
  return matches.map((m, index) => ({
    key: `Endgames:${m[1]}`,
    level: 'Endgames',
    module: 'Supplementary endgame studies',
    number: String(index + 1),
    title: m[2].trim(),
    url: `../lessons/${m[1]}`,
    available: true,
  }));
}

async function fetchText(path) {
  const response = await fetch(path, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Unable to load curriculum index: ${path}`);
  return response.text();
}

export async function loadLessonCatalog(customFetch = fetchText) {
  const [standardResults, advancedPawnResults, mainIndex] = await Promise.all([
    Promise.all(STANDARD_INDEXES.map(async (source) => {
      const html = await customFetch(source.path);
      return extractHtmlLessons(html, source);
    })),
    Promise.all(ADVANCED_PAWN_MODULES.map(async (source) => {
      const jsCode = await customFetch(source.path);
      return extractModuleLessons(jsCode, source);
    })),
    customFetch('../lessons/index.html'),
  ]);

  return [
    ...standardResults.flat(),
    ...advancedPawnResults.flat(),
    ...extractEndgames(mainIndex),
  ];
}
