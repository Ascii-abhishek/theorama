import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "../scripts/build.mjs";
import { createPreviewServer } from "../scripts/serve.mjs";

const require = createRequire(import.meta.url);
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const name = process.env.TEST_BROWSER ?? "chromium";
const scratch = await mkdtemp(join(tmpdir(), "theorama-browser-test-"));
const out = join(scratch, "public");
const server = createPreviewServer({ out, tests: true });
let browser, origin;
const homeTitle = "The Butterfly Effect";
const path = "ideas/butterfly-effect/";
let failures = 0;

async function openAppearance(page) {
  if (await page.locator("#drawer.is-appearance").isVisible()) return;
  const tools = page.locator(".reading-tools:visible");
  if (await tools.count()) {
    const key = tools.locator("[data-reading-key=theme]");
    if (!await key.isVisible()) await tools.locator(".reading-tools-toggle").click();
    await key.click();
  } else await page.locator("[data-pane=appearance]").click();
}

async function chooseStyle(page, style) {
  await openAppearance(page);
  await page.locator(`[data-view-option=${style}]`).click();
  await page.locator("#close-drawer").click();
  await page.locator(style === "book" ? ".book-overlay[data-layout-pending=false]" : "article.article").waitFor();
}

async function setSize(page, size) {
  await page.locator("#reading-text-size").evaluate((input, size) => {
    input.value = size;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, size);
}

async function check(label, run, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 650 }, reducedMotion: "reduce", ...options });
  const page = await context.newPage();
  page.setDefaultTimeout(6000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && /Content Security Policy|violates the following/.test(message.text())) errors.push(message.text());
  });
  try {
    await run(page, context);
    assert.deepEqual(errors, []);
    console.log(`PASS ${label}`);
  } catch (error) {
    failures++;
    console.error(`FAIL ${label}\n${error.stack}`);
  } finally {
    await context.close();
  }
}

try {
  await build({ out, env: { SITE_URL: "https://example.com/" } });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  origin = `http://127.0.0.1:${server.address().port}/`;
  browser = await playwright[name].launch({
    executablePath: process.env.TEST_BROWSER_PATH || undefined,
    ...(name === "chromium" ? { ignoreDefaultArgs: ["--hide-scrollbars"] } : {}),
  });
  await check("homepage and full articles work without JavaScript", async (page) => {
    await page.goto(origin);
    assert.equal(await page.locator(".idea-card, .featured-card").count(), 12);
    await page.locator(".feature-open").click();
    assert.equal(await page.locator("h1").textContent(), homeTitle);
    assert.ok(await page.locator(".article-prose p").count() > 5);
    assert.equal(await page.locator("link[rel=canonical]").getAttribute("href"), `https://example.com/${path}`);
    const response = await page.goto(origin + "ideas/unknown-example/");
    assert.equal(response.status(), 404);
  }, { javaScriptEnabled: false });

  await check("drawer keeps the page geometry and restores focus", async (page) => {
    await page.goto(origin);
    await page.waitForFunction(() => document.body.dataset.dailyDay);
    await page.evaluate(() => document.fonts.ready);
    const geometry = () => page.locator("#ideas-grid").evaluate((grid) => [grid.clientWidth, grid.children[1].getBoundingClientRect().left, scrollY]);
    await page.evaluate(() => scrollTo(0, 150));
    const before = await geometry();
    await page.locator("[data-pane=appearance]").evaluate((button) => button.focus({ preventScroll: true }));
    await page.keyboard.press("Enter");
    await page.locator("#drawer").waitFor();
    assert.deepEqual(await geometry(), before);
    await page.keyboard.press("Shift+Tab");
    assert.equal(await page.evaluate(() => document.querySelector("#drawer").contains(document.activeElement)), true);
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => document.activeElement.dataset.pane), "appearance");
    assert.deepEqual(await geometry(), before);
  });

  await check("slow and corrupt catalog responses preserve the static cards and skip invalid results", async (page) => {
    let release;
    const wait = new Promise((resolve) => { release = resolve; });
    await page.route("**/catalog.json", async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      json.ideas.push({ id: "broken", title: "Incomplete idea" });
      await wait;
      await route.fulfill({ json });
    });
    await page.goto(origin);
    await page.locator("#search-toggle").click();
    await page.locator("#search").fill("butterfly");
    await page.locator("#catalog-loading").waitFor();
    assert.equal(await page.locator(".idea-card, .featured-card").count(), 12);
    release();
    await page.waitForFunction(() => document.querySelector("#result-count").textContent === "1 idea");
    assert.match(await page.locator("#catalog-status").textContent(), /temporarily unavailable/);
    assert.equal(await page.locator(".idea-card").count(), 1);
  });

  await check("failed catalog request can retry while the static catalog stays usable", async (page) => {
    let fail = true;
    await page.route("**/catalog.json", (route) => fail ? route.fulfill({ status: 503 }) : route.continue());
    await page.goto(origin);
    await page.locator("#search-toggle").click();
    await page.locator("#search").fill("butterfly");
    await page.locator("#site-banner-action").waitFor();
    assert.equal(await page.locator(".idea-card, .featured-card").count(), 12);
    fail = false;
    await page.locator("#site-banner-action").click();
    await page.waitForFunction(() => document.querySelector("#result-count").textContent === "1 idea");
  });

  await check("large search results render at most one page of cards", async (page) => {
    await page.route("**/catalog.json", async (route) => {
      const response = await route.fetch();
      const [seed] = (await response.json()).ideas;
      await route.fulfill({ json: { ideas: Array.from({ length: 5000 }, (_, i) => ({
        ...seed, id: `synthetic-${i}`, title: `Sample idea ${i}`, search: "sample",
      })) } });
    });
    await page.goto(origin);
    await page.locator("#search-toggle").click();
    await page.locator("#search").fill("sample");
    await page.waitForFunction(() => document.querySelector("#result-count").textContent === "5000 ideas");
    assert.equal(await page.locator(".idea-card").count(), 24);
    await page.locator("#catalog-pagination [data-turn='1']").click();
    assert.match(await page.locator("#catalog-pagination").textContent(), /Page 2 of/);
    assert.equal(await page.locator(".idea-card").count(), 24);
  });

  await check("the catalog opens the book by default and closing returns to the catalog", async (page) => {
    await page.goto(origin);
    await page.waitForFunction(() => document.body.dataset.dailyDay);
    const href = await page.locator(".feature-open").getAttribute("href");
    await page.locator(".feature-open").click();
    await page.locator(".book-overlay[data-layout-pending=false]").waitFor();
    assert.equal(new URL(page.url()).pathname, href);
    assert.equal(await page.locator("article.article").isVisible(), false);
    await page.mouse.click(5, 100);
    assert.equal(await page.locator(".book-overlay").isVisible(), true);
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(".book-overlay").isVisible(), true);
    await page.locator(".book-close").click();
    await page.waitForURL(origin);
  });

  await check("slow book startup shows a spinner then stays on the complete article", async (page) => {
    let release;
    const waiting = new Promise((resolve) => { release = resolve; });
    await page.route("**/book.js", async (route) => {
      await waiting;
      await route.continue();
    });
    await page.goto(origin + path, { waitUntil: "commit" });
    await page.locator("#read-text-now").waitFor();
    assert.equal(await page.locator("article.article").isVisible(), false);
    await page.locator("article.article").waitFor();
    assert.match(await page.locator("#book-status").textContent(), /taking a little longer/);
    release();
    await page.waitForFunction(() => location.hash === "#text");
    await chooseStyle(page, "book");
    await page.locator(".book-overlay[data-layout-pending=false]").waitFor();
  });

  await check("the featured idea, order and tile colors follow the local date", async (page) => {
    await page.clock.setFixedTime(new Date(2026, 10, 27, 12));
    async function selection() {
      await page.goto(origin);
      await page.waitForFunction(() => document.body.dataset.dailyDay);
      return page.evaluate(() => ({
        featured: document.querySelector(".featured-card").dataset.ideaId,
        gold: getComputedStyle(document.querySelector(".featured-card")).backgroundImage,
        size: document.querySelector(".featured-card").getBoundingClientRect().height,
        tiles: [...document.querySelectorAll(".idea-card")].map((card) => [
          card.dataset.ideaId, getComputedStyle(card).backgroundColor, getComputedStyle(card).color,
        ]),
      }));
    }
    const today = await selection();
    assert.deepEqual(await selection(), today);
    await page.clock.setFixedTime(new Date(2026, 10, 28, 12));
    const tomorrow = await selection();
    assert.notEqual(tomorrow.featured, today.featured);
    assert.equal(tomorrow.gold, today.gold);
    assert.ok(tomorrow.size < 215);
    assert.notDeepEqual(tomorrow.tiles, today.tiles);
    await page.locator("[data-pane=appearance]").click();
    await page.locator("[data-theme-option=dusk]").click();
    await page.locator("#close-drawer").click();
    assert.notEqual(await page.locator(".featured-card").evaluate((el) => getComputedStyle(el).backgroundImage), tomorrow.gold);
    const same = today.tiles.find(([id]) => tomorrow.tiles.some(([other]) => id === other));
    const updated = tomorrow.tiles.find(([id]) => id === same[0]);
    assert.notEqual(updated[1], same[1]);
    assert.notEqual(updated[2], same[2]);
    await page.setViewportSize({ width: 390, height: 800 });
    assert.equal(await page.locator(".feature-context").count(), 0);
    assert.equal(await page.locator(".feature-open-label").textContent(), "Read this idea ");
    assert.equal(await page.locator(".feature-open-label").isVisible(), true);
  });

  await check("page-turn sheets stay absolute before, during and after animated turns", async (page) => {
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(origin + path);
      await page.locator(".book-overlay[data-layout-pending=false]").waitFor();
      await page.evaluate(() => document.fonts.ready);
      const positioned = () => page.locator(".stf__item").evaluateAll((pages) => pages.every((leaf) => getComputedStyle(leaf).position === "absolute"));
      assert.equal(await positioned(), true);
      await page.locator(".book-next").click();
      await page.locator(".book-overlay[data-state=flipping]").waitFor();
      assert.equal(await positioned(), true);
      if (width < 900) {
        const reverse = page.locator(".book-fold-back .book-page-scroll");
        await reverse.waitFor({ state: "attached" });
        assert.equal(await reverse.evaluate((leaf) => getComputedStyle(leaf).visibility), "hidden");
      }
      await page.locator(`.book-overlay[data-state=read][data-page="${width < 900 ? 2 : 3}"]`).waitFor();
      assert.equal(await positioned(), true);
      await page.locator(".book-previous").click();
      await page.locator('.book-overlay[data-state=read][data-page="1"]').waitFor();
    }
  }, { reducedMotion: "no-preference" });

  await check("the Gödel cover keeps its credit on the first leaf and references stay on the final leaf", async (page) => {
    await page.setViewportSize({ width: 1452, height: 860 });
    await page.goto(origin + "ideas/godel-incompleteness/");
    const book = page.locator(".book-overlay[data-layout-pending=false]");
    await book.waitFor();
    await openAppearance(page);
    await setSize(page, 19);
    await page.locator("#close-drawer").click();
    await book.waitFor();
    assert.equal(await page.locator(".book-page[data-page-kind=cover]").count(), 1);
    assert.match(await page.locator(".book-page[data-page-kind=cover] .book-front-author").textContent(), /Gödel/);
    assert.match(await page.locator(".book-page[data-page-index='1'] h3").first().textContent(), /./);
    const sources = page.locator(".book-page[data-page-kind=sources]");
    assert.equal(await sources.count(), 1);
    assert.equal(Number(await sources.getAttribute("data-page-index")) + 1, Number(await book.getAttribute("data-total")));
    assert.equal(await sources.locator("a").count(), await page.locator(".article [aria-labelledby=sources] a").count());
  });

  await check("the saved default applies to all ideas and switching keeps the current reading settings", async (page) => {
    await page.goto(origin);
    await page.locator("[data-pane=appearance]").click();
    assert.equal(await page.locator("[data-view-option=book]").getAttribute("aria-pressed"), "true");
    await page.locator("[data-view-option=text]").click();
    await page.goto(origin + path);
    const main = page.locator(".article-main");
    await page.locator("article.article").waitFor();
    assert.equal(await page.locator(".book-overlay").count(), 0);
    await main.locator("[data-reading-key=theme]").click();
    await page.locator("[data-theme-option=dusk]").click();
    await page.locator("[data-font-option=handwritten]").click();
    await setSize(page, 18);
    assert.equal(await main.getAttribute("data-reader-font"), "handwritten");
    assert.match(await page.locator(".article-prose").evaluate((element) => getComputedStyle(element).fontFamily), /Caveat/);
    await chooseStyle(page, "book");
    const book = page.locator(".book-overlay[data-layout-pending=false]");
    await book.waitFor();
    assert.equal(await book.getAttribute("data-reader-theme"), "dusk");
    assert.equal(await book.getAttribute("data-reader-font"), "handwritten");
    assert.match(await book.getAttribute("style"), /18px/);
    await chooseStyle(page, "text");
    assert.match(await page.locator(".article-main").getAttribute("style"), /18px/);
    assert.equal(await page.locator("[data-reading-key=switch], [data-reading-key=font], [data-reading-key=larger], [data-reading-key=smaller]").count(), 0);
    await page.goto(origin + "ideas/entropy/");
    await page.locator("article.article").waitFor();
    assert.equal(await page.locator(".book-overlay").count(), 0);
    assert.equal(await page.evaluate(() => localStorage.getItem("theorama:reader-view")), '"text"');
  });

  await check("mobile controls float over full-width content and stay below the title", async (page) => {
    await page.goto(origin + path);
    const book = page.locator(".book-overlay[data-layout-pending=false]");
    await book.waitFor();
    const toggle = book.locator(".reading-tools-toggle");
    await toggle.waitFor();
    const close = book.locator("[data-reading-key=close]");
    assert.equal(await close.isVisible(), false);
    const toggleBox = await toggle.boundingBox();
    const titleBox = await book.locator("#book-dialog-title").boundingBox();
    const stageBox = await book.locator(".book-stage").boundingBox();
    assert.ok(toggleBox.y > titleBox.y + titleBox.height);
    assert.ok(toggleBox.y + toggleBox.height <= stageBox.y);
    assert.equal(await book.locator(".reading-keys").isVisible(), false);
    await toggle.click();
    assert.equal(await toggle.getAttribute("aria-expanded"), "true");
    const keyPositions = await book.locator(".reading-keys button:visible").evaluateAll((nodes) =>
      nodes.map((button) => [button.getBoundingClientRect().x, button.getBoundingClientRect().y]));
    assert.equal(new Set(keyPositions.map(([x]) => x)).size, 3);
    await chooseStyle(page, "text");
    const textTools = page.locator(".article-main .reading-tools");
    assert.equal(await textTools.locator("[data-reading-key=close]").isVisible(), false);
    assert.equal(await textTools.locator(".reading-keys").isVisible(), false);
    const articleToggle = await textTools.locator(".reading-tools-toggle").boundingBox();
    assert.ok(Math.abs(articleToggle.y + articleToggle.height / 2 - 400) < 2);
    assert.equal(await page.locator(".header-slogan").isVisible(), false);
    const prose = await page.locator(".article").boundingBox();
    assert.ok(prose.width >= 330);
    await textTools.locator(".reading-tools-toggle").click();
    await textTools.locator("[data-reading-key=theme]").waitFor();
  }, { viewport: { width: 390, height: 800 }, hasTouch: true });

  await check("the floating mobile controls drag, clamp, and keep their position across views", async (page) => {
    await page.goto(origin + path + "#text");
    const tools = page.locator(".article-main .reading-tools");
    const toggle = tools.locator(".reading-tools-toggle");
    await toggle.waitFor();
    const rect = await toggle.boundingBox();
    await page.mouse.move(rect.x + 22, rect.y + 22);
    await page.mouse.down();
    await page.mouse.move(70, 210, { steps: 8 });
    await page.mouse.up();
    const moved = await toggle.boundingBox();
    assert.ok(moved.x < 100 && moved.y < 250);
    assert.equal(await toggle.getAttribute("aria-expanded"), "false");
    await toggle.click();
    const panel = await tools.locator(".reading-keys").boundingBox();
    assert.ok(panel.x >= 0 && panel.x + panel.width <= 390 && panel.y + panel.height <= 800);
    await chooseStyle(page, "book");
    const book = page.locator(".book-overlay[data-layout-pending=false]");
    await book.waitFor();
    const bookToggle = book.locator(".reading-tools-toggle");
    assert.deepEqual(await bookToggle.boundingBox(), moved);
    await bookToggle.focus();
    await page.keyboard.press("Alt+ArrowDown");
    assert.equal((await bookToggle.boundingBox()).y, moved.y + 24);
    assert.equal(await book.getAttribute("data-page"), "1");
    await page.setViewportSize({ width: 320, height: 400 });
    const resized = await bookToggle.boundingBox();
    assert.ok(resized.x >= 12 && resized.x + resized.width <= 320 && resized.y >= 76 && resized.y + resized.height <= 400);
    await page.mouse.move(resized.x + 22, resized.y + 22);
    await page.mouse.down();
    await page.mouse.move(900, -200, { steps: 8 });
    await page.mouse.up();
    const clamped = await bookToggle.boundingBox();
    assert.ok(clamped.x + clamped.width <= 320 && clamped.y >= 76);
    await book.locator(".reading-tools").evaluate((node) => {
      node.style.setProperty("--tools-safe-right", "34px");
      node.style.setProperty("--tools-safe-left", "24px");
      node.style.setProperty("--tools-safe-bottom", "34px");
      dispatchEvent(new Event("resize"));
    });
    const safe = await bookToggle.boundingBox();
    const viewportWidth = await page.evaluate(() => document.documentElement.getBoundingClientRect().width);
    assert.ok(safe.x >= 24 && safe.x + safe.width <= viewportWidth - 34);
  }, { viewport: { width: 390, height: 800 }, hasTouch: true });

  await check("mobile OS Back returns to the catalog from either reading style", async (page) => {
    for (const style of ["book", "text"]) {
      await page.goto(origin);
      await page.waitForFunction(() => document.body.dataset.dailyDay);
      await page.evaluate((style) => localStorage.setItem("theorama:reader-view", JSON.stringify(style)), style);
      await page.locator(".feature-open").click();
      await page.locator(style === "book" ? ".book-overlay[data-layout-pending=false]" : "article.article").waitFor();
      await page.goBack();
      await page.waitForURL(origin);
    }
  }, { viewport: { width: 390, height: 800 }, hasTouch: true });

  await check("the book opens on the reading surface and keeps a bounded book proportion", async (page) => {
    await page.goto(origin + path);
    const book = page.locator(".book-overlay[data-layout-pending=false]");
    await book.waitFor();
    assert.equal(await page.evaluate(() => document.activeElement.className), "book-overlay");
    assert.equal(await book.locator("[data-reading-key=close]").evaluate((node) => node.matches(":focus-visible")), false);
    const bounds = await page.locator(".book-stage").boundingBox();
    assert.ok(bounds.width <= 1080 && bounds.x > 100);
    assert.ok(Math.abs(bounds.width / bounds.height - 1.5) < .01);
    const close = await book.locator("[data-reading-key=close]").boundingBox();
    const next = await book.locator("[data-reading-key=listen]").boundingBox();
    assert.ok(close.y < next.y && close.x === next.x);
    assert.equal(await book.locator(".reading-keys > button").first().getAttribute("data-reading-key"), "close");
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.querySelector(".book-overlay").contains(document.activeElement)), true);
  }, { viewport: { width: 1600, height: 1000 } });

  for (const width of [390, 1280]) {
    await check(`appearance keeps system lettering and only the reading-style tile previews at ${width}px`, async (page) => {
      await page.goto(origin);
      await page.locator("[data-pane=appearance]").click();
      const title = page.locator("#drawer h2");
      const font = await title.evaluate((node) => getComputedStyle(node).fontFamily);
      assert.match(font, /system-ui/);
      assert.equal(await page.locator(".reading-preview").count(), 0);
      await page.locator("[data-theme-option=dusk]").click();
      await page.locator("[data-font-option=handwritten]").click();
      assert.equal(await title.evaluate((node) => getComputedStyle(node).fontFamily), font);
      assert.match(await page.locator("body").evaluate((node) => getComputedStyle(node).fontFamily), /Caveat/);
      assert.match(await page.locator("[data-font-option=sans]").evaluate((node) => getComputedStyle(node).fontFamily), /DM Sans/);
      assert.match(await page.locator("[data-font-option=serif]").evaluate((node) => getComputedStyle(node).fontFamily), /Georgia/);
      assert.match(await page.locator("[data-font-option=handwritten]").evaluate((node) => getComputedStyle(node).fontFamily), /Caveat/);
      const sample = page.locator(".sample-page > span").first();
      const beforeSize = await sample.evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
      await page.locator("#reading-text-size").focus();
      await page.keyboard.press("End");
      assert.equal(await page.locator("#reading-text-size-value").textContent(), "24 px");
      assert.ok(await sample.evaluate((node) => parseFloat(getComputedStyle(node).fontSize)) > beforeSize * 1.3);
      assert.match(await sample.evaluate((node) => getComputedStyle(node).fontFamily), /Caveat/);
      assert.equal(await page.locator("#reading-view-title").textContent(), "The style");
      await page.locator("[data-view-option=text]").click();
      assert.equal(await page.locator("[data-view-option=text]").getAttribute("aria-pressed"), "true");
      assert.equal(await page.locator("[data-view-option=text] .sample-article").isVisible(), true);
      await page.locator("[data-view-option=book]").click();
      assert.equal(await page.locator("[data-view-option=book] .sample-book").isVisible(), true);
      assert.equal(await page.locator(".sample-turn").evaluate((node) => getComputedStyle(node).animationName), "none");
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.evaluate(() => document.fonts.check('18px "Caveat"')), true);
      await page.reload();
      await page.locator("[data-pane=appearance]").click();
      assert.equal(await page.locator("#reading-text-size").inputValue(), "24");
    }, { viewport: { width, height: 650 } });
  }

  await check("read aloud pauses, resumes and follows the article between reading views", async (page) => {
    await page.addInitScript(() => {
      window.testSpeech = { spoken: [], canceled: 0 };
      const synth = new EventTarget();
      synth.getVoices = () => [
        { name: "Basic", lang: "en", default: true },
        { name: "Natural", lang: "en", default: false },
      ];
      synth.speak = (utterance) => { window.testSpeech.spoken.push(utterance); };
      synth.cancel = () => { window.testSpeech.canceled++; };
      Object.defineProperty(window, "speechSynthesis", { value: synth });
      window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    });
    await page.goto(origin + path + "#text");
    await page.locator(".article-main [data-reading-key=listen]").click();
    assert.equal(await page.evaluate(() => testSpeech.spoken[0].text), homeTitle);
    assert.equal(await page.evaluate(() => testSpeech.spoken[0].voice.name), "Natural");
    await page.evaluate(() => testSpeech.spoken[0].onboundary({ name: "word", charIndex: 4 }));
    await chooseStyle(page, "book");
    const book = page.locator(".book-overlay[data-layout-pending=false]");
    await book.waitFor();
    assert.equal(await book.locator("[data-reading-key=listen]").getAttribute("aria-label"), "Pause reading aloud");
    await book.locator("[data-reading-key=listen]").click();
    assert.equal(await book.locator("[data-reading-key=listen]").getAttribute("aria-label"), "Resume reading aloud");
    assert.equal(await page.evaluate(() => testSpeech.canceled), 1);
    await page.evaluate(() => testSpeech.spoken[0].onend());
    assert.equal(await page.evaluate(() => testSpeech.spoken.length), 1);
    await book.locator("[data-reading-key=listen]").click();
    assert.equal(await page.evaluate(() => testSpeech.spoken.length), 2);
    assert.equal(await page.evaluate(() => testSpeech.spoken[1].text), "Butterfly Effect");
    await page.evaluate(() => testSpeech.spoken.at(-1).onend());
    assert.equal(await page.evaluate(() => testSpeech.spoken.length), 3);
    assert.notEqual(await page.evaluate(() => testSpeech.spoken.at(-1).text), homeTitle);
    await book.locator("[data-reading-key=stop]").click();
    assert.equal(await book.locator("[data-reading-key=stop]").isVisible(), false);
    assert.equal(await book.locator("[data-reading-key=listen]").getAttribute("aria-label"), "Read aloud");
    assert.equal(await page.evaluate(() => document.activeElement.dataset.readingKey), "listen");
    await book.locator("[data-reading-key=listen]").click();
    await page.evaluate(() => testSpeech.spoken.at(-1).onerror({ error: "synthesis-failed" }));
    assert.equal(await book.locator("[data-reading-key=listen]").getAttribute("aria-label"), "Read aloud");
    assert.match(await page.locator("#site-banner-message").textContent(), /voice couldn’t play/);
    await page.locator("#site-banner-action").click();
    await page.evaluate(() => {
      let remaining = 500;
      while (document.querySelector(".book-overlay [data-reading-key=listen]").getAttribute("aria-pressed") === "true" && remaining-- > 0) {
        testSpeech.spoken.at(-1).onend();
      }
    });
    assert.equal(await book.locator("[data-reading-key=listen]").getAttribute("aria-pressed"), "false");
    assert.equal(await page.evaluate(() => testSpeech.spoken.some((item) => item.text === "References" || item.text === "Related ideas")), false);
  });

  await check("illustrations autoplay only when visible and the circular pause control holds a frame", async (page) => {
    await page.goto(origin + path + "#text");
    const button = page.locator(".article [data-animation-toggle]");
    await button.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector(".article [data-animation-toggle]").getAttribute("aria-pressed") === "true");
    const image = page.locator(".article [data-animation-src]");
    await image.evaluate((node) => node.decode());
    const before = await button.locator("..").boundingBox();
    assert.equal(await button.getAttribute("aria-label"), "Pause animation");
    assert.equal(await button.locator("svg").count(), 1);
    await button.click();
    assert.equal(await button.getAttribute("aria-label"), "Play animation");
    assert.equal(await page.locator(".article .animation-freeze").count(), 1);
    const after = await button.locator("..").boundingBox();
    assert.ok(Math.abs(before.height - after.height) < 2);
    await page.evaluate(() => scrollTo(0, 0));
    await button.scrollIntoViewIfNeeded();
    assert.equal(await button.getAttribute("aria-pressed"), "false");
    await button.click();
    assert.equal(await button.getAttribute("aria-pressed"), "true");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForFunction(() => document.querySelector(".article [data-animation-toggle]").getAttribute("aria-pressed") === "false");
  }, { reducedMotion: "no-preference" });

  await check("a failed autoplay leaves the poster readable and can be retried explicitly", async (page) => {
    await page.route("**/nearby-paths.webp", (route) => route.abort());
    await page.goto(origin + path + "#text");
    const button = page.locator(".article [data-animation-toggle]");
    await button.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector(".article [data-animation-src]").dataset.animationFailed === "true");
    assert.equal(await button.getAttribute("aria-pressed"), "false");
    assert.match(await page.locator(".article [data-animation-src]").getAttribute("src"), /nearby-paths\.png$/);
    await page.unroute("**/nearby-paths.webp");
    await button.click();
    assert.equal(await button.getAttribute("aria-pressed"), "true");
  }, { reducedMotion: "no-preference" });

  await check("reading still works when speech synthesis is unavailable", async (page) => {
    await page.addInitScript(() => Object.defineProperty(window, "speechSynthesis", { value: undefined }));
    await page.goto(origin + path);
    await page.locator(".book-overlay[data-layout-pending=false]").waitFor();
    assert.equal(await page.locator("[data-reading-key=listen]").count(), 0);
    await page.locator(".book-next").click();
    await page.locator('.book-overlay[data-page="3"]').waitFor();
  });

  await check("the selection note key follows the focus endpoint in both directions", async (page) => {
    for (const mode of ["text", "book"]) {
      await page.goto(origin + path + (mode === "text" ? "#text" : ""));
      const root = page.locator(mode === "text" ? ".article-main" : ".book-overlay[data-layout-pending=false]");
      await root.waitFor();
      await page.evaluate(() => document.fonts.ready);
      for (const backwards of [false, true]) {
        const selectionTarget = root.locator(mode === "text" ? ".article-summary" : "[data-flow-id=cover-description]");
        await selectionTarget.waitFor();
        const caret = await selectionTarget.evaluate((el, backwards) => {
          const node = el.firstChild;
          const selection = window.getSelection();
          const tail = Math.min(node.textContent.length, 24);
          selection.setBaseAndExtent(node, backwards ? tail : 2, node, backwards ? 2 : tail);
          const range = document.createRange();
          range.setStart(node, selection.focusOffset);
          range.collapse(true);
          const rect = range.getBoundingClientRect();
          return { right: rect.right, top: rect.top };
        }, backwards);
        const note = root.locator(".selection-note");
        await note.waitFor();
        await page.waitForFunction(({ x, y, selector }) => {
          const box = document.querySelector(selector + " .selection-note").getBoundingClientRect();
          return Math.abs(box.x - x - 6) <= 3 && Math.abs(box.y - y) <= 3;
        }, { x: caret.right, y: caret.top, selector: mode === "text" ? ".article-main" : ".book-overlay" });
      }
    }
  });

  await check("both reading views contain the same text and concept animation", async (page) => {
    await page.goto(origin + path);
    const book = page.locator(".book-overlay[data-layout-pending=false]");
    await book.waitFor();
    const compare = await page.evaluate(() => {
      const bookBlocks = (prefix) => [...document.querySelectorAll(`.book-page [data-flow-id^="${prefix}"]`)]
        .filter((node) => node.matches("p,h3,h4,a,li")).map((node) => node.textContent);
      const animation = document.querySelector(".book-page [data-animation-src]");
      return {
        description: bookBlocks("cover-description").join(" ") === document.querySelector(".article-summary").textContent,
        sections: [...document.querySelectorAll(".article [id^=section-] h2")].every((heading) =>
          bookBlocks(heading.parentElement.id + "-title").join(" ") === heading.textContent),
        matchingMedia: animation?.dataset.animationSrc === document.querySelector(".article [data-animation-src]").dataset.animationSrc,
        matchingSources: [...document.querySelectorAll(".article [aria-labelledby=sources] a")].map((a) => a.href).every((href) =>
          [...document.querySelectorAll(".book-source-link")].some((link) => link.href === href)),
      };
    });
    assert.ok(Object.values(compare).every(Boolean), JSON.stringify(compare));
    await chooseStyle(page, "text");
    await page.locator("article.article").waitFor();
    const toggle = page.locator(".article [data-animation-toggle]");
    await toggle.click();
    assert.equal(await toggle.getAttribute("aria-pressed"), "true");
    await toggle.click();
    assert.equal(await toggle.getAttribute("aria-pressed"), "false");
  });

  await check("notes follow the reader theme and preserve a custom color across reloads", async (page) => {
    await page.goto(origin + path);
    await page.locator(".book-overlay[data-layout-pending=false]").waitFor();
    await page.locator(".book-theme").click();
    await page.locator("[data-theme-option=dusk]").click();
    await page.locator("#close-drawer").click();
    await page.locator(".book-notes").click();
    const drawer = page.locator("#drawer");
    await page.locator(".notes-editor[contenteditable=true]").waitFor();
    assert.equal(await drawer.getAttribute("data-note-theme"), "dusk");
    assert.equal(await drawer.getAttribute("data-note-color"), "theme");
    assert.equal(await drawer.evaluate((element) => getComputedStyle(element).backgroundColor), "rgb(37, 43, 38)");
    await page.locator(".notes-custom-color").fill("#286075");
    await page.waitForFunction(() => document.querySelector(".notes-status").textContent === "Saved in this browser");
    await page.reload();
    await page.locator(".book-overlay[data-layout-pending=false]").waitFor();
    await page.locator(".book-notes").click();
    await page.locator(".notes-editor[contenteditable=true]").waitFor();
    assert.equal(await drawer.evaluate((element) => getComputedStyle(element).backgroundColor), "rgb(40, 96, 117)");
    await page.locator(".notes-swatch[data-note-color=theme]").click();
    assert.equal(await drawer.getAttribute("data-note-color"), "theme");
  });

  await check("missing book engine leaves the article readable and offers a retry", async (page) => {
    let fail = true;
    await page.route("**/page-flip.js", (route) => fail ? route.fulfill({ status: 503 }) : route.continue());
    await page.goto(origin + path);
    await page.locator("#site-banner-action").waitFor();
    await page.waitForFunction(() => location.hash === "#text");
    assert.match(await page.locator("#book-status").textContent(), /keep reading here/);
    assert.equal(await page.locator("main").evaluate((element) => element.inert), false);
    assert.equal(await page.locator("#site-banner-action").textContent(), "Reload to retry");
    fail = false;
    await page.locator("#site-banner-action").click();
    await page.locator(".book-overlay[data-layout-pending=false]").waitFor();
  });

  await check("legacy hash opens the book and notes preserve the page, theme and focus", async (page) => {
    await page.goto(origin + "#idea/butterfly-effect");
    await page.locator(".book-overlay[data-layout-pending=false]").waitFor();
    assert.equal(new URL(page.url()).pathname, "/" + path);
    await page.locator(".book-next").click();
    const book = page.locator(".book-overlay");
    await page.locator(".book-theme").click();
    await page.locator("[data-theme-option=dusk]").click();
    await page.locator("#close-drawer").click();
    const view = async () => [await book.getAttribute("data-page"), await book.getAttribute("data-book-theme")];
    const before = await view();
    await page.locator(".book-notes").click();
    await page.locator(".notes-editor[contenteditable=true]").waitFor();
    assert.equal(await book.evaluate((el) => el.inert), true);
    await page.keyboard.press("Escape");
    assert.deepEqual(await view(), before);
    assert.equal(await page.evaluate(() => document.activeElement.classList.contains("book-notes")), true);
    await page.keyboard.press("Escape");
    assert.equal(await book.isVisible(), true);
    await page.locator(".book-close").click();
    await page.waitForURL(origin);
  });

  await check("simultaneous read marks in two tabs preserve both changes", async (page, context) => {
    const other = await context.newPage();
    await Promise.all([page.goto(origin), other.goto(origin)]);
    await Promise.all([
      page.locator("[data-read-toggle=butterfly-effect]").click(),
      other.locator("[data-read-toggle=entropy]").click(),
    ]);
    await page.waitForFunction(() => [...document.querySelectorAll(".read-status[aria-pressed=true]")].length === 2);
    await other.reload();
    await other.waitForFunction(() => [...document.querySelectorAll(".read-status[aria-pressed=true]")].length === 2);
  });

  await check("release updates wait for an unsaved note", async (page) => {
    await page.clock.install();
    await page.route("**/release.json", (route) => route.fulfill({ json: { version: "f".repeat(16) } }));
    await page.goto(origin);
    await page.locator("[data-pane=notes]").click();
    const editor = page.locator(".notes-editor[contenteditable=true]");
    await editor.waitFor();
    await page.evaluate(() => {
      IDBObjectStore.prototype.put = () => { throw new DOMException("Storage is full.", "QuotaExceededError"); };
    });
    await editor.fill("Keep this unsaved note.");
    await page.clock.runFor(800);
    await page.locator(".notes-alert").waitFor();
    await page.locator("#close-drawer").click();
    await page.clock.fastForward(5 * 60_000);
    await page.waitForFunction(() => document.getElementById("site-banner-action").textContent === "Load update");
    await page.locator("#site-banner-action").click();
    await page.waitForFunction(() => document.getElementById("site-banner-action").textContent === "Try update again");
    await page.locator("[data-pane=notes]").click();
    assert.equal(await editor.innerText(), "Keep this unsaved note.");
  });

  if (name !== "firefox") {
    await check("tapping the middle of a mobile book leaves the page in place", async (page) => {
      await page.goto(origin + path);
      await page.locator(".book-overlay[data-layout-pending=false]").waitFor();
      const spread = await page.locator(".book-spread").boundingBox();
      await page.touchscreen.tap(spread.x + spread.width * 0.55, spread.y + spread.height * 0.55);
      assert.equal(await page.locator(".book-overlay").getAttribute("data-page"), "1");
    }, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  }

  for (const test of ["notes", "pagination"]) {
    await check(`existing ${test} browser suite`, async (page) => {
      await page.goto(origin + `tests/${test}.html`);
      await page.waitForFunction(() => document.body.dataset.failed !== undefined || document.body.dataset.testStatus !== undefined);
      const failed = await page.locator("body").getAttribute("data-failed");
      const status = await page.locator("body").getAttribute("data-test-status");
      assert.ok(failed === "0" || status === "passed", await page.locator("#results").innerText());
    });
  }
} finally {
  await browser?.close();
  server.close();
  await rm(scratch, { force: true, recursive: true });
}
if (failures) process.exitCode = 1;
