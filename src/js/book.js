import { paginateBook, findAnchorPage } from "./pagination.js";
import { PageFlip } from "../vendor/page-flip/page-flip.js";
import { illustration } from "./illustrations.js";
import { notesIcon } from "./notes.js";

const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const arrow = (direction) =>
  `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="${direction === "previous" ? "m14 5-7 7 7 7M7 12h13" : "m10 5 7 7-7 7M17 12H4"}"/></svg>`;

function fallbackChapter(idea) {
  return {
    details: [
      {
        title: idea.title,
        paragraphs: [idea.overview.lead, ...idea.overview.paragraphs],
      },
      {
        title: "How the idea works",
        paragraphs: idea.details.paragraphs,
        bullets: idea.details.bullets,
        diagram: idea.id === "butterfly-effect" ? "divergence" : "concept",
      },
      {
        title: "A useful perspective",
        paragraphs: [
          idea.mental.analogy,
          idea.mental.caution,
          idea.overview.takeaway,
        ],
        bullets: idea.details.bullets,
      },
    ],
    mental: [
      {
        title: idea.mental.analogyTitle,
        paragraphs: [idea.mental.analogy],
        bullets: idea.mental.steps,
      },
      {
        title: "A thought to take with you",
        paragraphs: [idea.overview.takeaway],
        bullets: [idea.mental.caution],
      },
    ],
  };
}

function diagram(kind) {
  if (kind === "divergence") {
    return `<figure class="book-diagram"><svg viewBox="0 0 420 180" role="img" aria-label="Two similar starting points gradually diverge"><path d="M25 140h370M25 140V18" stroke="currentColor" opacity=".25"/><path class="book-trajectory" d="M25 86C74 87 83 44 123 56S161 130 207 107 258 28 297 48 347 125 393 43" stroke="var(--accent)"/><path class="book-trajectory book-trajectory-second" d="M25 89C74 89 84 50 124 62S167 143 210 119 258 92 292 117 349 59 393 129" stroke="currentColor"/><circle cx="25" cy="86" r="3" fill="var(--accent)"/><circle cx="25" cy="89" r="3" fill="currentColor"/><text x="25" y="165">NEARLY IDENTICAL STARTS</text><text x="312" y="165">TIME</text></svg><figcaption>A conceptual illustration of sensitivity, rather than a scientific simulation.</figcaption></figure>`;
  }
  return `<figure class="book-diagram"><svg viewBox="0 0 420 100" role="img" aria-label="Notice, question, understand"><g fill="none" stroke="currentColor"><rect x="5" y="22" width="115" height="56" rx="5"/><path d="M120 50h25m130 0h25"/><rect x="145" y="22" width="130" height="56" rx="5"/><rect x="300" y="22" width="115" height="56" rx="5"/></g><g text-anchor="middle"><text x="62" y="54">NOTICE</text><text x="210" y="54">QUESTION</text><text x="357" y="54">UNDERSTAND</text></g></svg></figure>`;
}

export function createBookReader({
  onComplete = () => {},
  onClose = () => {},
  onNotes = () => {},
} = {}) {
  const mount = document.getElementById("book-root");
  if (!mount) throw new Error("The book reader requires #book-root.");
  mount.innerHTML = `<div class="book-overlay" role="dialog" aria-modal="true" aria-labelledby="book-dialog-title" tabindex="-1" hidden><h2 class="sr-only" id="book-dialog-title"></h2><div class="book-stage"><button class="book-tool book-notes" aria-label="Your notes" title="Your notes" aria-controls="drawer" aria-haspopup="dialog">${notesIcon}</button><div class="book-tools" role="group" aria-label="Book appearance"><button class="book-tool book-theme" aria-label="Cycle book theme" title="Cycle book theme"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" opacity=".65"/></svg></button><div class="book-text-tools" role="group" aria-label="Book text size"><button class="book-tool book-text-smaller" aria-label="Decrease book text size" title="Decrease book text size"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 12h12"/></svg></button><output class="book-text-value" aria-label="Book text size">17</output><button class="book-tool book-text-larger" aria-label="Increase book text size" title="Increase book text size"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 12h12M12 6v12"/></svg></button></div><button class="book-tool book-focus" aria-label="Cycle book background" title="Cycle book background"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4"/><circle cx="12" cy="12" r="3"/></svg></button><button class="book-tool book-close" aria-label="Close book" title="Close book"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button></div><div class="book-spread"><div class="book-leaves"></div><button class="book-turn book-previous" aria-label="Previous page" title="Previous page">${arrow("previous")}</button><button class="book-turn book-next" aria-label="Next page" title="Next page">${arrow("next")}</button></div><p class="sr-only book-announcement" role="status" aria-live="polite"></p><p class="sr-only book-settings-announcement" role="status" aria-live="polite"></p></div></div>`;
  const overlay = mount.querySelector(".book-overlay");
  const selectionButton = document.createElement("button");
  selectionButton.className = "book-selection-note";
  selectionButton.setAttribute("aria-label", "Add selected text to notes");
  selectionButton.title = "Add selected text to notes";
  selectionButton.innerHTML = notesIcon;
  selectionButton.hidden = true;
  overlay.append(selectionButton);
  let selectionTimer, selectedExcerpt = null;
  function hideSelectionNote() {
    clearTimeout(selectionTimer);
    selectionButton.hidden = true;
    selectedExcerpt = null;
  }
  function selectionNote() {
    hideSelectionNote();
    if (overlay.hidden || overlay.inert) return;
    selectionTimer = setTimeout(() => {
      const selection = window.getSelection();
      if (overlay.inert || !selection?.rangeCount || selection.isCollapsed) return;
      const range = selection.getRangeAt(0);
      const start = range.startContainer.parentElement?.closest(".book-page-scroll");
      const end = range.endContainer.parentElement?.closest(".book-page-scroll");
      if (!start || !end || !spread.contains(start) || !spread.contains(end) || start.closest("[inert]") || end.closest("[inert]")) return;
      const text = selection.toString().trim();
      if (!text) return;
      const rect = [...range.getClientRects()].find((r) => r.width && r.height);
      if (!rect) return;
      selectedExcerpt = { text, title: article.title };
      selectionButton.style.left = `${Math.max(8, Math.min(innerWidth - 48, rect.left + rect.width / 2 - 20))}px`;
      selectionButton.style.top = `${Math.max(8, rect.top - 46)}px`;
      selectionButton.hidden = false;
    }, 200);
  }
  document.addEventListener("selectionchange", selectionNote);
  overlay.addEventListener("scroll", hideSelectionNote, true);
  window.addEventListener("resize", hideSelectionNote);
  selectionButton.addEventListener("pointerdown", (event) => event.preventDefault());
  selectionButton.addEventListener("click", () => {
    const excerpt = selectedExcerpt;
    hideSelectionNote();
    window.getSelection()?.removeAllRanges();
    if (excerpt) { mount.querySelector(".book-notes").focus({ preventScroll: true }); onNotes(excerpt); }
  });
  mount.querySelector(".book-notes").addEventListener("click", () => { hideSelectionNote(); onNotes(); });
  const stage = mount.querySelector(".book-stage");
  const spread = mount.querySelector(".book-spread");
  let leaves = mount.querySelector(".book-leaves");
  const closeButton = mount.querySelector(".book-close");
  const themeButton = mount.querySelector(".book-theme");
  const smallerButton = mount.querySelector(".book-text-smaller");
  const largerButton = mount.querySelector(".book-text-larger");
  const sizeOutput = mount.querySelector(".book-text-value");
  const focusButton = mount.querySelector(".book-focus");
  const bookThemes = ["paper", "dusk", "rose"];
  const themeNames = { paper: "Paper", dusk: "After hours", rose: "Rosewater" };
  const backgrounds = ["blur", "dark", "clear"];
  const backgroundNames = {
    blur: "Blurred",
    dark: "Dark focus",
    clear: "Clear",
  };
  // Reader settings are session-local overrides, never site preferences.
  let bookTheme = null;
  let bookTextSize = null;
  let bookBackground = "blur";
  const previousButton = mount.querySelector(".book-previous");
  const nextButton = mount.querySelector(".book-next");
  const media = window.matchMedia("(max-width: 899px)");
  let article = null;
  let chapter = null;
  let pageIndex = 0;
  let previousFocus = null;
  let previousOverflow = "";
  let backgroundState = [];
  let engine = null;
  let pageElements = [];
  let queuedTurn = 0;
  let inputFrame = 0;
  let resizeFrame = 0;
  let engineSize = "";
  let copyObserver = null;
  let pointer = null;
  let completionReported = false;
  let layoutPages = [];
  let layoutFrame = 0;

  function syncBookSettings(message = "") {
    overlay.dataset.bookTheme = bookTheme;
    overlay.dataset.focusMode = bookBackground;
    overlay.style.setProperty("--reading-size", `${bookTextSize}px`);
    sizeOutput.value = `${bookTextSize}`;
    sizeOutput.title = `${bookTextSize}px · book text only`;
    smallerButton.disabled = bookTextSize <= 15;
    largerButton.disabled = bookTextSize >= 24;
    const nextTheme =
      bookThemes[(bookThemes.indexOf(bookTheme) + 1) % bookThemes.length];
    themeButton.title = `Book theme: ${themeNames[bookTheme]}. Switch to ${themeNames[nextTheme]}`;
    themeButton.setAttribute("aria-label", themeButton.title);
    const nextBackground =
      backgrounds[
        (backgrounds.indexOf(bookBackground) + 1) % backgrounds.length
      ];
    focusButton.title = `Book background: ${backgroundNames[bookBackground]}. Switch to ${backgroundNames[nextBackground]}`;
    focusButton.setAttribute("aria-label", focusButton.title);
    focusButton.dataset.mode = bookBackground;
    mount.querySelector(".book-settings-announcement").textContent = message;
  }

  themeButton.addEventListener("click", () => {
    bookTheme =
      bookThemes[(bookThemes.indexOf(bookTheme) + 1) % bookThemes.length];
    syncBookSettings(`Book theme: ${themeNames[bookTheme]}`);
  });
  function resizeText(step) {
    bookTextSize = Math.max(15, Math.min(24, bookTextSize + step));
    syncBookSettings(`Book text: ${bookTextSize} pixels`);
    scheduleLayout();
    // Keep keyboard focus in the size controls when a limit is reached.
    if (document.activeElement.disabled)
      (step > 0 ? smallerButton : largerButton).focus();
  }
  smallerButton.addEventListener("click", () => resizeText(-1));
  largerButton.addEventListener("click", () => resizeText(1));
  focusButton.addEventListener("click", () => {
    bookBackground =
      backgrounds[
        (backgrounds.indexOf(bookBackground) + 1) % backgrounds.length
      ];
    syncBookSettings(`Book background: ${backgroundNames[bookBackground]}`);
  });

  function reducedMotion() {
    return (
      document.documentElement.classList.contains("motion-off") ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function element(html) {
    const template = document.createElement("template");
    template.innerHTML = html;
    return template.content.firstElementChild;
  }

  function contentBlocks() {
    const blocks = [];
    const addText = (
      id,
      kind,
      text,
      tag = "p",
      className = "",
      options = {},
    ) => {
      blocks.push({
        id,
        kind,
        text,
        ...options,
        create: () =>
          element(`<${tag} class="${className}" data-flow-text></${tag}>`),
      });
    };
    const addMedia = (id, kind, html, caption = "") => {
      blocks.push({ id, kind, create: () => element(html) });
      if (caption)
        addText(`${id}-caption`, kind, caption, "p", "book-graphic-caption");
    };
    const addDiagram = (id, kind, name) => {
      const figure = element(diagram(name));
      const caption = figure.querySelector("figcaption");
      const captionText = caption?.textContent || "";
      caption?.remove();
      (figure.querySelector("svg") || figure).setAttribute(
        "data-book-media",
        "",
      );
      addMedia(id, kind, figure.outerHTML, captionText);
    };
    const addBullets = (id, kind, items) =>
      items.forEach((text, index) => {
        blocks.push({
          id: `${id}-${index}`,
          kind,
          text,
          create: () =>
            element(
              `<ul class="book-flow-list"><li data-flow-text data-number="${index + 1}"></li></ul>`,
            ),
        });
      });
    const addOrderedBlock = (id, kind, block) => {
      switch (block.type) {
        case "paragraph":
          addText(id, kind, block.text);
          break;
        case "heading":
          addText(id, kind, block.text, "h3", "", { keepNext: true });
          break;
        case "bullets":
          addBullets(id, kind, block.items);
          break;
        case "diagram":
          addDiagram(id, kind, block.name);
          break;
        case "illustration":
          addMedia(
            id,
            kind,
            `<figure class="book-inline-art"><div class="book-media-frame" data-book-media style="aspect-ratio:${Number(block.aspectRatio) || 1.2}">${illustration(block.id, "book-inline-illustration")}</div></figure>`,
            block.caption,
          );
          break;
        case "image": {
          // Repository-local assets only. Explicit dimensions reserve the layout
          // before loading; GIF/WebP/SVG animation never changes pagination.
          if (
            !/^assets\//.test(block.src) ||
            block.src.split("/").includes("..")
          )
            throw new Error("Book images must be inside assets/.");
          const url = new URL(`../../${block.src}`, import.meta.url);
          const width = Number(block.width),
            height = Number(block.height);
          if (!(width > 0 && height > 0))
            throw new Error("Book images need dimensions.");
          addMedia(
            id,
            kind,
            `<figure class="book-inline-art"><div class="book-media-frame" data-book-media style="aspect-ratio:${width / height}"><img src="${escapeHTML(url.href)}" width="${width}" height="${height}" alt="${escapeHTML(block.alt || "")}" decoding="async"></div></figure>`,
            block.caption,
          );
          break;
        }
      }
    };

    addText(
      "cover-category",
      "cover",
      article.category,
      "p",
      "book-front-category",
    );
    addMedia(
      "cover-art",
      "cover",
      `<div class="book-artwork" data-book-media>${illustration(article.id, "book-illustration")}</div>`,
    );
    addText("cover-title", "cover", article.title, "h3", "", {
      keepNext: true,
    });
    addText(
      "cover-takeaway",
      "cover",
      article.overview.takeaway,
      "p",
      "book-front-description",
    );
    addText(
      "cover-author",
      "cover",
      `${article.attribution} · ${article.year}`,
      "p",
      "book-front-author",
    );
    for (const kind of ["details", "mental"]) {
      chapter[kind].forEach((section, index) => {
        const id = `${kind}-${index}`;
        if (kind === "mental")
          addText(
            `${id}-label`,
            kind,
            "MENTAL MODEL",
            "p",
            "book-section-label",
            { keepNext: true },
          );
        addText(`${id}-title`, kind, section.title, "h3", "", {
          keepNext: true,
        });
        if (section.blocks)
          section.blocks.forEach((block, i) =>
            addOrderedBlock(`${id}-block-${i}`, kind, block),
          );
        else {
          (section.paragraphs || []).forEach((text, i) =>
            addText(`${id}-paragraph-${i}`, kind, text),
          );
          if (section.diagram)
            addDiagram(`${id}-diagram`, kind, section.diagram);
          if (section.bullets)
            addBullets(`${id}-bullet`, kind, section.bullets);
        }
      });
      if (kind === "details" && article.details.sources?.length) {
        addText(
          "sources-title",
          kind,
          "Further reading",
          "h4",
          "book-source-heading",
          { keepNext: true },
        );
        article.details.sources
          .filter((source) => /^https:\/\//.test(source.url))
          .forEach((source, index) => {
            blocks.push({
              id: `source-${index}`,
              kind,
              text: source.label,
              create: () =>
                element(
                  `<a class="book-source-link" data-flow-text href="${escapeHTML(source.url)}" target="_blank" rel="noopener noreferrer"></a>`,
                ),
            });
          });
      }
    }
    return blocks;
  }

  function pageHTML(page, index, total) {
    const wrapper =
      page.kind === "cover"
        ? "book-frontispiece"
        : `book-prose${page.kind === "mental" ? " book-mental" : ""}`;
    return `<section class="book-page${index % 2 ? " book-page-right" : " book-page-left"}${page.kind === "cover" ? " book-page-front" : ""}" data-page-index="${index}" data-page-kind="${page.kind}" aria-label="Page ${index + 1} of ${total}"><div class="book-page-inner"><div class="book-page-scroll" tabindex="0"><div class="${wrapper}" data-page-content>${page.html || ""}</div></div><footer class="book-page-footer"><span>${index + 1} / ${total}</span></footer></div></section>`;
  }

  function currentAnchor() {
    const first = pageElements[pageIndex]?.querySelector("[data-flow-id]");
    return first
      ? { id: first.dataset.flowId, offset: Number(first.dataset.flowStart) }
      : null;
  }

  function scheduleLayout() {
    if (overlay.hidden) return;
    overlay.dataset.layoutPending = "true";
    cancelAnimationFrame(layoutFrame);
    layoutFrame = requestAnimationFrame(() => {
      if (!overlay.hidden) buildEngine();
    });
  }

  function checkCompletion() {
    if (
      !article ||
      overlay.hidden ||
      completionReported ||
      overlay.dataset.layoutPending === "true" ||
      !engine ||
      engine.getState() !== "read"
    )
      return;
    const lastIndex = layoutPages.length - 1;
    if (lastIndex >= pageIndex + (media.matches ? 1 : 2)) return;
    if (!pageElements[lastIndex]?.clientHeight) return;
    completionReported = true;
    onComplete(article.id);
  }

  // Only accessibility/navigation state changes on a flip. Pages stay mounted
  // until a deliberate font/viewport reflow, so turns never reset the content.
  function syncPages() {
    const count = media.matches ? 1 : 2;
    pageElements.forEach((page, index) => {
      const visible =
        index < layoutPages.length &&
        index >= pageIndex &&
        index < pageIndex + count;
      page.inert = !visible;
      page.setAttribute("aria-hidden", String(!visible));
    });
    previousButton.disabled = pageIndex === 0;
    nextButton.disabled = pageIndex + count >= layoutPages.length;
    previousButton.setAttribute(
      "aria-label",
      media.matches ? "Previous page" : "Previous spread",
    );
    nextButton.setAttribute(
      "aria-label",
      media.matches ? "Next page" : "Next spread",
    );
    overlay.dataset.page = String(pageIndex + 1);
    overlay.dataset.total = String(layoutPages.length);
    stage.classList.toggle("book-single-page", media.matches);
    mount.querySelector(".book-announcement").textContent =
      `${article.title}. ${count === 1 || pageIndex + 1 === layoutPages.length ? `Page ${pageIndex + 1}` : `Pages ${pageIndex + 1} and ${Math.min(pageIndex + 2, layoutPages.length)}`} of ${layoutPages.length}.`;
    // Never leave keyboard focus on a page which just became inert.
    if (document.activeElement.closest?.(".book-page[inert]"))
      closeButton.focus({ preventScroll: true });
    checkCompletion();
  }

  function destroyEngine() {
    cancelAnimationFrame(inputFrame);
    queuedTurn = 0;
    pointer = null;
    spread.classList.remove("book-is-dragging");
    copyObserver?.disconnect();
    copyObserver = null;
    if (engine) {
      engine.destroy();
      engine = null;
    }
    pageElements = [];
    overlay.dataset.state = "read";
  }

  function buildEngine() {
    const anchor = currentAnchor();
    const fallbackIndex = pageIndex;
    cancelAnimationFrame(layoutFrame);
    overlay.dataset.layoutPending = "true";
    destroyEngine();
    const width = spread.clientWidth;
    const height = spread.clientHeight;
    const pageWidth = media.matches ? width : width / 2;
    engineSize = `${width}:${height}:${media.matches}`;
    // The offscreen page uses precisely the same width, padding, typography,
    // footer, and reserved art boxes as the live leaves.
    overlay.style.setProperty(
      "--book-media-max-height",
      `${Math.max(24, (height - 120) * 0.48)}px`,
    );
    layoutPages = paginateBook({
      blocks: contentBlocks(),
      mount: stage,
      width: pageWidth,
      height,
      createPage: (kind) => element(pageHTML({ kind, html: "" }, 0, 0)),
    });
    leaves = document.createElement("div");
    leaves.className = "book-leaves";
    spread.querySelector(".book-leaves")?.remove();
    spread.prepend(leaves);
    leaves.innerHTML = layoutPages
      .map((page, index) => pageHTML(page, index, layoutPages.length))
      .join("");
    pageElements = [...leaves.children];
    pageIndex = findAnchorPage(pageElements, anchor, fallbackIndex);
    if (!media.matches) pageIndex = Math.floor(pageIndex / 2) * 2;
    // A physical spread always has two soft leaves. Keep an odd final page
    // paired with a blank back without inventing another numbered content page.
    if (pageElements.length % 2) {
      const blank = element(
        pageHTML(
          { kind: "blank", html: "" },
          pageElements.length,
          layoutPages.length,
        ),
      );
      blank.setAttribute("aria-label", "Blank back page");
      blank.querySelector(".book-page-footer").replaceChildren();
      leaves.append(blank);
      pageElements.push(blank);
    }
    const reader = new PageFlip(leaves, {
      width: media.matches ? width : width / 2,
      height,
      size: "fixed",
      autoSize: false,
      usePortrait: media.matches,
      showCover: false,
      startPage: pageIndex,
      flippingTime: 580,
      drawShadow: true,
      maxShadowOpacity: 0.22,
      useMouseEvents: false,
      showPageCorners: false,
      mobileScrollSupport: false,
    });
    engine = reader;
    reader.on("flip", (event) => {
      if (engine !== reader) return;
      pageIndex = event.data;
      syncPages();
    });
    reader.on("changeState", (event) => {
      if (engine !== reader) return;
      overlay.dataset.state = event.data;
      if (event.data === "read") {
        requestAnimationFrame(() => {
          if (engine !== reader || overlay.hidden) return;
          syncPages();
          if (queuedTurn) {
            const direction = queuedTurn;
            queuedTurn = 0;
            turn(direction);
          }
        });
      }
    });
    reader.loadFromHTML(pageElements);
    overlay.dataset.layoutPending = "false";
    // Portrait folds use a decorative copy of the outgoing page. Keep it out
    // of the accessibility tree.
    copyObserver = new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes) {
          if (
            !(node instanceof HTMLElement) ||
            !node.matches(".book-page") ||
            pageElements.includes(node)
          )
            continue;
          node.inert = true;
          node.setAttribute("aria-hidden", "true");
          const original = pageElements[Number(node.dataset.pageIndex)];
          if (original)
            node.querySelector(".book-page-scroll").scrollTop =
              original.querySelector(".book-page-scroll").scrollTop;
        }
    });
    copyObserver.observe(leaves, { childList: true, subtree: true });
    syncPages();
  }

  function turn(direction) {
    hideSelectionNote();
    if (overlay.hidden || !engine) return;
    if (engine.getState() !== "read") {
      queuedTurn = direction; // One pending intention, rather than dropped clicks.
      return;
    }
    const target = pageIndex + direction * (media.matches ? 1 : 2);
    if (target < 0 || target >= layoutPages.length) return;
    if (reducedMotion()) engine.turnToPage(target);
    else if (direction > 0) engine.flipNext("bottom");
    else engine.flipPrev("bottom");
  }

  function close(options = {}) {
    if (overlay.hidden) return;
    hideSelectionNote();
    const notify =
      typeof options === "boolean" ? options : options.notify !== false;
    // Preserve completion even when the reader closes immediately after landing.
    checkCompletion();
    cancelAnimationFrame(resizeFrame);
    cancelAnimationFrame(layoutFrame);
    destroyEngine();
    overlay.hidden = true;
    document.body.style.overflow = previousOverflow;
    backgroundState.forEach(([element, value]) => {
      element.inert = value;
    });
    backgroundState = [];
    if (previousFocus?.isConnected && !previousFocus.closest("[inert]"))
      previousFocus.focus({ preventScroll: true });
    else
      document.getElementById("search-toggle")?.focus({ preventScroll: true });
    if (notify) onClose();
  }

  function open(idea, suppliedChapter) {
    if (overlay.hidden) {
      previousFocus = document.activeElement;
      previousOverflow = document.body.style.overflow;
      backgroundState = [
        ...document.querySelectorAll(".site-header,.site-main,.skip-link"),
      ].map((element) => [element, element.inert]);
      backgroundState.forEach(([element]) => {
        element.inert = true;
      });
    }
    destroyEngine();
    article = idea;
    const fallback = fallbackChapter(idea);
    chapter = {
      details:
        suppliedChapter?.details?.length > 0
          ? suppliedChapter.details
          : fallback.details,
      mental:
        suppliedChapter?.mental?.length > 0
          ? suppliedChapter.mental
          : fallback.mental,
    };
    pageIndex = 0;
    completionReported = false;
    mount.querySelector("#book-dialog-title").textContent = idea.title;
    if (bookTheme === null) {
      const siteTheme = document.documentElement.dataset.theme;
      bookTheme = bookThemes.includes(siteTheme) ? siteTheme : "paper";
    }
    if (bookTextSize === null)
      bookTextSize = Math.max(
        15,
        Math.min(
          24,
          parseFloat(
            getComputedStyle(overlay).getPropertyValue("--reading-size"),
          ) || 17,
        ),
      );
    syncBookSettings();
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    buildEngine();
    closeButton.focus({ preventScroll: true });
  }

  closeButton.addEventListener("click", close);
  previousButton.addEventListener("click", () => turn(-1));
  nextButton.addEventListener("click", () => turn(1));
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  document.addEventListener(
    "keydown",
    (event) => {
      if (overlay.hidden || overlay.inert) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        close();
        return;
      }
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        event.stopImmediatePropagation();
        turn(event.key === "ArrowRight" ? 1 : -1);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [
        ...overlay.querySelectorAll(
          'button:not([disabled]),a[href],[tabindex="0"]',
        ),
      ].filter(
        (element) =>
          element.getClientRects().length && !element.closest("[inert]"),
      );
      const first = focusable[0],
        last = focusable[focusable.length - 1];
      if (!overlay.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    true,
  );
  function localPoint(event, bounds) {
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  }

  spread.addEventListener("pointerdown", (event) => {
    if (
      !engine ||
      pointer ||
      engine.getState() !== "read" ||
      event.button !== 0 ||
      event.target.closest("button,a")
    )
      return;
    const bounds = leaves.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const edge = Math.min(72, bounds.width * 0.16);
    if (event.pointerType === "mouse" && x > edge && x < bounds.width - edge)
      return;
    const direction = x < (media.matches ? edge : bounds.width / 2) ? -1 : 1;
    const target = pageIndex + direction * (media.matches ? 1 : 2);
    if (target < 0 || target >= layoutPages.length) return;
    hideSelectionNote();
    pointer = {
      started: performance.now(),
      id: event.pointerId,
      bounds,
      start: localPoint(event, bounds),
      latest: localPoint(event, bounds),
      direction,
      dragging: false,
    };
  });

  function foldPoint(point, gesture) {
    // In a single-page view the other half of the spread is offscreen. Map
    // a half-width swipe onto the full sheet so release near the middle turns
    // the page rather than requiring a finger to leave the viewport.
    return media.matches
      ? { x: gesture.start.x + (point.x - gesture.start.x) * 2, y: point.y }
      : point;
  }

  function drawDrag() {
    inputFrame = 0;
    if (pointer?.dragging && engine)
      engine.userMove(foldPoint(pointer.latest, pointer), true);
  }

  spread.addEventListener("pointermove", (event) => {
    if (!pointer || event.pointerId !== pointer.id) return;
    const point = localPoint(event, pointer.bounds);
    const dx = point.x - pointer.start.x,
      dy = point.y - pointer.start.y;
    if (!pointer.dragging) {
      // Leave a long press and text selection to the browser on touch screens.
      if (performance.now() - pointer.started > 250 || !window.getSelection()?.isCollapsed) {
        pointer = null;
        return;
      }
      // Vertical gestures must never trigger a page turn.
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {
        pointer = null;
        return;
      }
      if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      if (dx * pointer.direction > 0) {
        pointer = null;
        return;
      }
      pointer.dragging = true;
      spread.setPointerCapture(event.pointerId);
      window.getSelection()?.removeAllRanges();
      spread.classList.add("book-is-dragging");
      if (!reducedMotion()) engine.startUserTouch(pointer.start);
    }
    pointer.latest = point;
    if (event.cancelable) event.preventDefault();
    if (!reducedMotion() && !inputFrame)
      inputFrame = requestAnimationFrame(drawDrag);
  });

  function endPointer(event, cancelled = false) {
    if (!pointer || event.pointerId !== pointer.id) return;
    cancelAnimationFrame(inputFrame);
    inputFrame = 0;
    const gesture = pointer;
    pointer = null;
    spread.classList.remove("book-is-dragging");
    if (spread.hasPointerCapture(event.pointerId))
      spread.releasePointerCapture(event.pointerId);
    if (!engine) return;
    if (!gesture.dragging) {
      if (!cancelled && performance.now() - gesture.started < 250 && window.getSelection()?.isCollapsed) turn(gesture.direction);
      return;
    }
    if (reducedMotion()) {
      if (!cancelled && Math.abs(gesture.latest.x - gesture.start.x) > 45)
        turn(gesture.direction);
      return;
    }
    // Finish from the actual fold position, or ease back to the starting edge.
    const point = cancelled ? gesture.start : localPoint(event, gesture.bounds);
    const fold = foldPoint(point, gesture);
    engine.userMove(fold, true);
    engine.userStop(fold);
  }
  spread.addEventListener("pointerup", (event) => endPointer(event));
  spread.addEventListener("pointercancel", (event) => endPointer(event, true));
  spread.addEventListener("lostpointercapture", (event) =>
    endPointer(event, true),
  );

  const resizeObserver = new ResizeObserver(() => {
    if (overlay.hidden) return;
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      if (
        !overlay.hidden &&
        engineSize !==
          `${spread.clientWidth}:${spread.clientHeight}:${media.matches}`
      )
        buildEngine();
    });
  });
  resizeObserver.observe(stage);
  document.fonts?.addEventListener("loadingdone", scheduleLayout);
  return { open, close, isOpen: () => !overlay.hidden };
}
