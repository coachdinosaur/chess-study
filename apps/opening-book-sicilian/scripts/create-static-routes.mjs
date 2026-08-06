import { mkdir, writeFile, readdir } from "node:fs/promises";
import path from "node:path";

const outputRoot = path.resolve("dist");
const chaptersDir = path.resolve("app/content/chapters");

let chapterIds = [];
try {
  const files = await readdir(chaptersDir);
  chapterIds = files
    .map((name) => {
      const match = /^chapter-(\d+)-sicilian\.md$/.exec(name);
      return match ? match[1] : null;
    })
    .filter(Boolean);
} catch {
  // Fallback if directory not present during test setups
}
if (chapterIds.length === 0) {
  chapterIds.push("1");
}

for (const id of chapterIds) {
  const routeDirectory = path.join(outputRoot, "chapters", id);
  const target = `../../#/chapters/${id}`;
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="refresh" content="0; url=${target}" />
    <title>Opening Chapter ${id}</title>
  </head>
  <body>
    <p>Opening <a href="${target}">Chapter ${id}</a>…</p>
    <script>window.location.replace(${JSON.stringify(target)});</script>
  </body>
</html>
`;
  await mkdir(routeDirectory, { recursive: true });
  await writeFile(path.join(routeDirectory, "index.html"), html, "utf8");
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
      const match = window.location.pathname.match(/^(.*)\\/chapters\\/(\\d+)\\/?$/);
      const base = match ? match[1].replace(/\\/$/, "") : window.location.pathname.replace(/\\/[^/]*$/, "");
      const route = match ? "#/chapters/" + match[2] : "";
      window.location.replace(window.location.origin + base + "/" + route);
    </script>
  </body>
</html>
`;

await writeFile(path.join(outputRoot, "404.html"), notFound, "utf8");
