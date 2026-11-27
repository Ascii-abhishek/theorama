import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { build, root, siteSettings } from "../scripts/build.mjs";
import { readContent } from "../scripts/content.mjs";
import { dailySlots, featureOrder } from "../src/js/daily-catalog.js";
import { PAGE_SIZE } from "../src/js/content-model.js";

const env = { SITE_URL: "https://example.com/guide/" };
const read = (root, path) => readFile(join(root, path), "utf8");
async function scratch(t) {
  const path = await mkdtemp(join(tmpdir(), "theorama-build-test-"));
  t.after(() => rm(path, { force: true, recursive: true }));
  return path;
}

test("the public build renders complete articles, links and metadata under a subpath", async (t) => {
  const out = join(await scratch(t), "public");
  const first = await build({ out, env, production: true });
  const home = await read(out, "index.html");
  const article = await read(out, "ideas/butterfly-effect/index.html");
  const sitemap = await read(out, "sitemap.xml");
  assert.match(home, /href="\/guide\/ideas\/butterfly-effect\//);
  assert.match(home, /href="\/guide\/subjects\/physics\//);
  assert.match(article, /<h1>The Butterfly Effect<\/h1>/);
  assert.match(article, /<section id="section-details-1"/);
  assert.match(article, /<h2 id="sources">References<\/h2>/);
  assert.match(article, /rel="canonical" href="https:\/\/example\.com\/guide\/ideas\/butterfly-effect\//);
  assert.match(sitemap, /https:\/\/example\.com\/guide\/ideas\/butterfly-effect\//);
  assert.doesNotMatch(sitemap, /404\.html|_static/);
  assert.match(await read(out, "_headers"), /Content-Security-Policy:[^\n]+script-src 'self'/);
  assert.equal(JSON.parse(await read(out, "release.json")).version, first.version);
  assert.equal((await build({ out, env })).version, first.version);
  assert.match(article, /data-animation-src="[^"]+ideas\/butterfly-effect\/media\/nearby-paths\.webp"/);
  const animation = await readFile(join(out, "_static", first.version, "ideas/butterfly-effect/media/nearby-paths.webp"));
  assert.ok(animation.includes(Buffer.from("ANMF")));
  await assert.rejects(read(out, "content/ideas/butterfly-effect/idea.json"), { code: "ENOENT" });
  await assert.rejects(read(out, "tests/notes.html"), { code: "ENOENT" });
});

test("a bad content file gives field-specific errors and preserves the previous output", async (t) => {
  const directory = await scratch(t);
  const out = join(directory, "public");
  await build({ out, env });
  const before = await read(out, "release.json");
  const contentDirectory = join(directory, "content/ideas");
  await mkdir(contentDirectory, { recursive: true });
  const example = (await readContent(root)).find((idea) => idea.id === "relativity");
  await mkdir(join(contentDirectory, example.id));
  await writeFile(join(contentDirectory, example.id, "idea.json"), JSON.stringify({ ...example, sections: {} }));
  await assert.rejects(build({ out, env, contentRoot: directory }), /content\/ideas\/.+\/idea\.json: sections\.details/);
  assert.equal(await read(out, "release.json"), before);
  assert.throws(() => siteSettings({}, true), /SITE_URL/);
});

test("one thousand ideas produce bounded pages with crawlable next links and a full index", async (t) => {
  const directory = await scratch(t);
  const out = join(directory, "public");
  const contentDirectory = join(directory, "content/ideas");
  await mkdir(contentDirectory, { recursive: true });
  const example = (await readContent(root)).find((idea) => idea.id === "relativity");
  for (let i = 0; i < 1000; i++) {
    const id = `sample-${i}`;
    await mkdir(join(contentDirectory, id));
    await writeFile(join(contentDirectory, id, "idea.json"), JSON.stringify({ ...example, id, title: `Sample idea ${i}` }));
  }
  const { version } = await build({ out, env, contentRoot: directory });
  const home = await read(out, "index.html");
  const page2 = await read(out, "page/2/index.html");
  assert.equal((home.match(/class="idea-card /g) ?? []).length, PAGE_SIZE);
  assert.equal((page2.match(/class="idea-card /g) ?? []).length, PAGE_SIZE);
  assert.match(home, /href="\/guide\/page\/2\/" rel="next"/);
  assert.match(await read(out, "page/42/index.html"), /Page 42 of 42/);
  assert.equal(JSON.parse(await read(out, `_static/${version}/catalog.json`)).ideas.length, 1000);
});


test("the daily feature exhausts the catalog without repeats and each home page is bounded", async () => {
  const order = featureOrder(await readContent(root));
  assert.equal(new Set(order.map((_, day) => dailySlots(day, order.length).at(0))).size, order.length);
  assert.equal(dailySlots(0, order.length)[0], dailySlots(order.length, order.length)[0]);
  assert.equal(new Set(dailySlots(90, 1000)).size, PAGE_SIZE);
  assert.deepEqual(dailySlots(3, 1), [0]);
});
