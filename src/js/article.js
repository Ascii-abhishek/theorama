import { SECTION_KINDS, isSlug, sectionAnchor, validateIdea } from "./content-model.js";
import { loadStyles, requestJSON } from "./resources.js";
import { savedPassage, savePassage } from "./reading-state.js";
import { createReadingTools, styleReadingView } from "./reading-tools.js";
import { mountSelectionNote } from "./selection-note.js";
import { BOOK_STARTUP_MS, wantsBook } from "./reader-route.js";
import { createReadAloud } from "./read-aloud.js";
import { activateAnimations, stopAnimations } from "./idea-media.js";

export function mountArticle({ base, assets, appearance, reading, drawer, overlays, notice }) {
  const id = document.body.dataset.article;
  if (!isSlug(id)) return;
  const root = document.documentElement;
  const main = document.getElementById("main");
  const article = document.getElementById("text");
  const status = document.getElementById("book-status");
  const skipBook = document.getElementById("read-text-now");
  const initial = appearance.get();
  let settings = { theme: initial.theme, font: initial.font, size: initial.size, focus: "blur" };
  let reader, idea, controller, moduleUnavailable = false, textAnchor = "", pendingStyle = false;
  const speech = createReadAloud({
    passages: () => [...article.querySelectorAll("h1, .article-summary, .article-prose h2, .article-prose h3, .article-prose p, .article-prose li, .article-prose figcaption")]
      .filter((node) => !node.closest(".article-related, [aria-labelledby=sources]"))
      .map((node) => node.textContent.trim()).filter(Boolean),
    onError: () => notice("This voice couldn’t play. Try again or check your device’s speech settings.", {
      type: "error", label: "Try again", run: () => speech.toggle(),
    }),
  });
  const textTools = createReadingTools({
    mode: "text", onChange: updateSettings, onAppearance: () => drawer.open("appearance"), onClose: leaveBook,
    onNotes: () => openNotes(), onRead: toggleRead, speech,
  });
  main.insertBefore(textTools.element, article);
  const selection = mountSelectionNote({
    scope: article, mount: main,
    isActive: () => !reader?.isOpen() && !drawer.isOpen() && !root.hasAttribute("data-book-startup"),
    title: () => article.querySelector("h1").textContent,
    onNote: (excerpt) => {
      textTools.focusNotes();
      openNotes(excerpt);
    },
  });

  function openNotes(excerpt) {
    selection.clear();
    drawer.open("notes", excerpt, { theme: settings.theme });
  }
  function updateSettings(changes) {
    settings = { ...settings, ...changes };
    styleReadingView(main, settings);
    textTools.sync(settings);
    reader?.setSettings(settings);
  }
  updateSettings({});
  appearance.subscribe((value, key) => {
    if (key === "theme" || key === "font" || key === "size") updateSettings({ [key]: value[key] });
    if (key === "view") pendingStyle = true;
  });
  drawer.subscribeClose(() => {
    if (!pendingStyle) return;
    queueMicrotask(() => {
      if (drawer.isOpen() || !pendingStyle) return;
      pendingStyle = false;
      if (appearance.get().view === "book") void openBook();
      else if (reader?.isOpen()) reader.readText();
    });
  });

  function syncRead() {
    textTools.syncRead(reading.has(id));
    reader?.setRead(reading.has(id));
  }
  function setRead(read) {
    if (!reading.set(id, read)) notice("Read status changed for this visit. Browser storage is unavailable.", { type: "error" });
  }
  function toggleRead() { setRead(!reading.has(id)); }
  syncRead();
  reading.subscribe((changed) => { if (!changed || changed === id) syncRead(); });

  function bookStatus(text) {
    status.textContent = text;
    status.hidden = !text;
  }

  function finishLoading() {
    delete root.dataset.bookStartup;
  }

  function showText({ focus = false, preserveHash = false } = {}) {
    selection.clear();
    controller?.abort();
    controller = null;
    finishLoading();
    root.classList.remove("book-present");
    if (reader?.isOpen()) {
      drawer.close();
      reader.close({ notify: false });
    }
    if (!preserveHash) history.replaceState(history.state, "", textAnchor || "#text");
    activateAnimations(article);
    if (focus) main.focus({ preventScroll: true });
  }

  function readText(anchor) {
    const section = SECTION_KINDS.flatMap((kind) => idea.sections[kind])
      .map((item) => sectionAnchor(item.id)).find((name) =>
        anchor?.id === `${name}-title` || anchor?.id?.startsWith(`${name}-block-`));
    textAnchor = section ? `#${section}` : "";
    showText({ focus: !section });
    if (section) {
      const target = document.getElementById(section);
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }

  function leaveBook() {
    speech.stop();
    root.classList.remove("book-present");
    const fallback = new URL(base, location.origin);
    if (document.referrer) {
      const from = new URL(document.referrer);
      const route = from.pathname.slice(base.length);
      if (from.origin === location.origin && from.pathname.startsWith(base) &&
          /^(?:|page\/\d+\/|subjects\/[a-z0-9-]+\/(?:page\/\d+\/)?)$/.test(route)) {
        if (!location.hash && history.length > 1) {
          history.back();
          return;
        }
        location.assign(from.href);
        return;
      }
    }
    location.assign(fallback);
  }

  function unavailable({ delayed = false } = {}) {
    const focus = document.activeElement === skipBook;
    showText({ focus });
    const text = delayed
      ? "The book is taking a little longer. You can read the same article here."
      : "The animated book couldn’t open. You can keep reading here.";
    bookStatus(text);
    if (!delayed) notice(text, {
      type: "error",
      label: moduleUnavailable ? "Reload to retry" : "Retry",
      run: moduleUnavailable ? reloadReader : openBook,
    });
  }

  async function reloadReader() {
    if (await drawer.canRefresh()) {
      history.replaceState(history.state, "", "#book");
      location.reload();
    } else {
      notice("Save your note before reloading the reader. You can download a backup from Notes.", {
        type: "error", label: "Open notes", run: () => drawer.open("notes"),
      });
    }
  }

  async function openBook() {
    if (controller || reader?.isOpen()) return;
    selection.clear();
    const load = new AbortController();
    controller = load;
    moduleUnavailable = false;
    if (!wantsBook(location.hash)) textAnchor = location.hash;
    const deadline = Number(root.dataset.bookStartup) || Date.now() + BOOK_STARTUP_MS;
    root.dataset.bookStartup = deadline;
    bookStatus("");
    const timeout = setTimeout(() => unavailable({ delayed: true }), Math.max(0, deadline - Date.now()));
    try {
      const content = idea ?? requestJSON(`${assets}ideas/${id}/idea.json`, { signal: load.signal });
      const moduleLoad = import("./book.js").catch((error) => {
        if (!load.signal.aborted) moduleUnavailable = true;
        throw error;
      });
      const [loadedIdea, module] = await Promise.all([
        content, moduleLoad, loadStyles(assets + "src/styles/page-flip.css"), loadStyles(assets + "src/styles/book.css"),
      ]);
      if (load.signal.aborted) return;
      if (Date.now() >= deadline) {
        unavailable({ delayed: true });
        return;
      }
      if (loadedIdea?.id !== id || validateIdea(loadedIdea).length) throw new Error("Invalid idea payload.");
      idea = loadedIdea;
      reader ??= module.createBookReader({
        overlays,
        onNotes: openNotes,
        onSettings: updateSettings,
        onRead: toggleRead,
        onAppearance: () => drawer.open("appearance"),
        speech,
        onComplete: () => setRead(true),
        onPosition: (anchor) => savePassage(id, anchor),
        onClose: leaveBook,
        onReadText: readText,
        onError: unavailable,
      });
      reader.setSettings(settings);
      syncRead();
      const section = textAnchor.slice(1);
      const isSection = SECTION_KINDS.some((kind) => idea.sections[kind].some((item) => sectionAnchor(item.id) === section));
      if (drawer.isOpen()) {
        showText();
        return;
      }
      root.classList.add("book-present");
      reader.open(idea, {
        assetBase: `${assets}ideas/${id}/`,
        anchor: isSection ? { id: `${section}-title`, offset: 0 } : savedPassage(id),
        returnFocus: textTools.appearanceKey,
      });
      stopAnimations(article);
      if (textAnchor) history.replaceState(history.state, "", "#book");
    } catch {
      if (!load.signal.aborted) unavailable();
    } finally {
      clearTimeout(timeout);
      if (controller === load) {
        controller = null;
        finishLoading();
      }
    }
  }

  skipBook.addEventListener("click", (event) => {
    event.preventDefault();
    showText({ focus: true });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !event.defaultPrevented && controller) showText({ focus: true });
  });
  window.addEventListener("hashchange", () => {
    if (wantsBook(location.hash, appearance.get().view)) void openBook();
    else showText({ preserveHash: true });
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted && wantsBook(location.hash, appearance.get().view)) void openBook();
  });
  if (root.hasAttribute("data-book-startup") && wantsBook(location.hash, appearance.get().view)) void openBook();
}
