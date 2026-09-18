import { mkdir, writeFile, readdir, readFile } from "node:fs/promises";
import path from "node:path";

const outputRoot = path.resolve("dist");
const chaptersDir = path.resolve("app/content/chapters");

const redirectHtml = (target, title, label) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="refresh" content="0; url=${target}" />
    <title>${title}</title>
  </head>
  <body>
    <p>Opening <a href="${target}">${label}</a>…</p>
    <script>window.location.replace(${JSON.stringify(target)});</script>
  </body>
</html>
`;

let chapters = [];
try {
  const files = await readdir(chaptersDir);
  chapters = (await Promise.all(files
    .map((name) => /^chapter-(\d+)-sicilian\.md$/.exec(name))
    .filter(Boolean)
    .map(async (match) => {
      const content = await readFile(path.join(chaptersDir, match[0]), "utf8");
      const pages = [...content.matchAll(/^## Page (\d+)\s*$/gm)].map((m) => Number(m[1]));
      return { id: match[1], pages: pages.length ? pages : [1] };
    }))).sort((a, b) => Number(a.id) - Number(b.id));
} catch {
  // Fallback if directory not present during test setups
}
if (chapters.length === 0) {
  chapters.push({ id: "1", pages: [1] });
}

for (const { id, pages } of chapters) {
  const routeDirectory = path.join(outputRoot, "chapters", id);
  await mkdir(routeDirectory, { recursive: true });
  await writeFile(
    path.join(routeDirectory, "index.html"),
    redirectHtml(`../../#/chapters/${id}`, `Opening Chapter ${id}`, `Chapter ${id}`),
    "utf8",
  );
  for (const page of pages) {
    const pageDirectory = path.join(routeDirectory, "pages", String(page));
    await mkdir(pageDirectory, { recursive: true });
    await writeFile(
      path.join(pageDirectory, "index.html"),
      redirectHtml(`../../../#/chapters/${id}/pages/${page}`, `Opening Chapter ${id} Page ${page}`, `Chapter ${id}, Page ${page}`),
      "utf8",
    );
  }
}

const notFound = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sicilian Defense</title>
  </head>
  <body>
    <p>Opening the Sicilian Defense Book…</p>
    <script>
      const match = window.location.pathname.match(/^(.*)\\/chapters\\/(\\d+)(?:\\/pages\\/(\\d+))?\\/?$/);
      const base = match ? match[1].replace(/\\/$/, "") : window.location.pathname.replace(/\\/[^/]*$/, "");
      const route = match ? "#/chapters/" + match[2] + (match[3] ? "/pages/" + match[3] : "") : "";
      window.location.replace(window.location.origin + base + "/" + route);
    </script>
  </body>
</html>
`;

await writeFile(path.join(outputRoot, "404.html"), notFound, "utf8");
