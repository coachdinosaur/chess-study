const INDEXES = [
  { level: 'Pawn Level', path: '../lessons/pawn-index.html', available: true },
  { level: 'Advanced Pawn', path: '../lessons/advanced-pawn-index.html', available: false },
  { level: 'Bishop Level', path: '../lessons/bishop-index.html', available: true },
];

function decodeJavascriptString(value) {
  try {
    return JSON.parse(`"${value.replaceAll('"', '\\"')}"`);
  } catch {
    return value.replaceAll('\\"', '"').replaceAll("\\'", "'");
  }
}

function extractLessons(html, source) {
  const lessons = [];
  const tuplePattern = /\[\s*"([^"]+)"\s*,\s*"((?:\\.|[^"])*)"\s*,\s*"([^"]+\.html)"\s*,\s*"((?:\\.|[^"])*)"\s*\]/g;
  let match;
  while ((match = tuplePattern.exec(html))) {
    const number = match[1];
    const title = decodeJavascriptString(match[2]);
    const filename = match[3];
    const before = html.slice(Math.max(0, match.index - 1200), match.index);
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

function extractEndgames(html) {
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

async function fetchText(path) {
  const response = await fetch(path, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Unable to load curriculum index: ${path}`);
  return response.text();
}

export async function loadLessonCatalog() {
  const results = await Promise.all(INDEXES.map(async (source) => {
    const html = await fetchText(source.path);
    return extractLessons(html, source);
  }));
  const mainIndex = await fetchText('../lessons/index.html');
  return [...results.flat(), ...extractEndgames(mainIndex)];
}
