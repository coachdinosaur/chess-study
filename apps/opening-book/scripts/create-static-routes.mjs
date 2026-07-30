import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const outputRoot = path.resolve("dist");
const chapterIds = Array.from({ length: 16 }, (_, index) => String(index + 1));

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
    <title>Catalan Atelier</title>
  </head>
  <body>
    <p>Opening the Catalan Atelier…</p>
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
