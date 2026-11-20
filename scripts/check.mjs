import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const text = (value) => typeof value === "string" && value.trim().length > 0;
const textList = (value) =>
  Array.isArray(value) && value.length > 0 && value.every(text);

// Syntax checks do not execute browser-only modules in Node.
for (const path of [
  "src/js/app.js",
  "src/js/book.js",
  "src/js/illustrations.js",
]) {
  const result = spawnSync(
    process.execPath,
    ["--check", fileURLToPath(new URL(path, root))],
    { stdio: "inherit" },
  );
  assert.equal(result.status, 0, `Invalid JavaScript: ${path}`);
  for (const [, relative] of read(path).matchAll(
    /from\s+['"](\.[^'"]+)['"]/g,
  )) {
    assert.ok(
      existsSync(new URL(relative, new URL(path, root))),
      `Missing import in ${path}: ${relative}`,
    );
  }
}

// Catch broken file moves without relying on a running server.
for (const [, path] of read("index.html").matchAll(
  /(?:href|src)="([^"#]+)"/g,
)) {
  if (path === "./" || /^(?:data:|https?:)/.test(path)) continue;
  assert.ok(existsSync(new URL(path, root)), `Missing page asset: ${path}`);
}
for (const path of ["src/styles/styles.css", "src/styles/book.css"]) {
  for (const [, relative] of read(path).matchAll(
    /url\(['"]?(\.[^)'"\s]+)['"]?\)/g,
  )) {
    assert.ok(
      existsSync(new URL(relative, new URL(path, root))),
      `Missing stylesheet asset in ${path}: ${relative}`,
    );
  }
}

const ideas = JSON.parse(read("data/ideas.json"));
const chapters = JSON.parse(read("data/chapters.json"));
assert.ok(
  Array.isArray(ideas) && ideas.length > 0,
  "The collection must contain ideas.",
);
const ids = new Set();
for (const idea of ideas) {
  assert.ok(
    text(idea.id) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(idea.id),
    "Each idea needs a stable slug ID.",
  );
  assert.ok(!ids.has(idea.id), `Duplicate idea: ${idea.id}`);
  ids.add(idea.id);
  for (const field of [
    "title",
    "category",
    "kind",
    "description",
    "readTime",
    "year",
    "attribution",
    "color",
  ]) {
    assert.ok(text(idea[field]), `${idea.id}: missing ${field}`);
  }
  assert.ok(
    textList(idea.tags),
    `${idea.id}: tags must be a nonempty list of strings.`,
  );
  assert.ok(
    ["peach", "sage", "lavender", "yellow", "blue", "pink"].includes(
      idea.color,
    ),
    `${idea.id}: unknown card color.`,
  );
  assert.ok(
    text(idea.overview?.takeaway),
    `${idea.id}: missing cover takeaway.`,
  );
  assert.ok(
    Array.isArray(idea.details?.sources) && idea.details.sources.length > 0,
    `${idea.id}: include a source.`,
  );
  for (const source of idea.details.sources) {
    assert.ok(
      text(source.label) && new URL(source.url).protocol === "https:",
      `${idea.id}: sources need labels and HTTPS URLs.`,
    );
  }
  const chapter = chapters[idea.id];
  assert.ok(
    chapter?.details?.length === 3 && chapter?.mental?.length === 2,
    `${idea.id}: expected three detail and two mental-model pages.`,
  );
  for (const page of [...chapter.details, ...chapter.mental]) {
    assert.ok(
      text(page.title) && textList(page.paragraphs),
      `${idea.id}: each page needs a title and prose.`,
    );
    if (page.bullets !== undefined)
      assert.ok(textList(page.bullets), `${idea.id}: invalid bullets.`);
    if (page.diagram !== undefined)
      assert.ok(
        ["divergence", "concept"].includes(page.diagram),
        `${idea.id}: unknown diagram.`,
      );
  }
}
assert.deepEqual(
  Object.keys(chapters).sort(),
  [...ids].sort(),
  "Ideas and chapters must have matching IDs.",
);
console.log(
  `Checked JavaScript, local asset paths, and ${ideas.length} six-page chapters.`,
);
