import { paginateBook, findAnchorPage } from "./pagination.js";
import { mountPageTurner } from "./page-turner.js";
import { illustration } from "./illustrations.js";
import { escapeHTML } from "./html.js";
import { diagram } from "./article-art.js";
import { SECTION_KINDS, readingMinutes, sectionAnchor, sourceURL } from "./content-model.js";

import { createReadingTools, styleReadingView } from "./reading-tools.js";
import { mountSelectionNote } from "./selection-note.js";
import { activateAnimations, stopAnimations, visualHTML } from "./idea-media.js";

const arrow = (direction) =>
  `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="${direction === "previous" ? "m14 5-7 7 7 7M7 12h13" : "m10 5 7 7-7 7M17 12H4"}"/></svg>`;

export function createBookReader({
  overlays,
  onPosition = () => {},
  onError = () => {},
  onComplete = () => {},
  onClose = () => {},
  onReadText = () => {},
  onNotes = () => {},
  onSettings = () => {},
  onRead = () => {},
  onAppearance = () => {},
  speech,
} = {}) {
  const mount = document.getElementById("book-root");
  if (!mount || !overlays || !window.ResizeObserver) throw new Error("The animated reader is unavailable.");
  mount.innerHTML = `<div class="book-overlay" role="dialog" aria-modal="true" aria-labelledby="book-dialog-title" tabindex="-1" hidden><h2 class="sr-only book-dialog-title" id="book-dialog-title"></h2><div class="book-stage"><div class="book-spread"><div class="book-leaves"></div><button class="book-turn book-previous" aria-label="Previous page" title="Previous page">${arrow("previous")}</button><button class="book-turn book-next" aria-label="Next page" title="Next page">${arrow("next")}</button></div><p class="sr-only book-announcement" role="status" aria-live="polite"></p></div></div>`;
  const overlay = mount.querySelector(".book-overlay");
  const stage = mount.querySelector(".book-stage");
  const spread = mount.querySelector(".book-spread");
  let leaves = mount.querySelector(".book-leaves");
  let settings;
  const tools = createReadingTools({
    mode: "book", onChange: onSettings, onClose: close, onNotes: openNotes, onRead, speech, onAppearance,
  });
  overlay.append(tools.element);
  const selection = mountSelectionNote({
    scope: spread, mount: overlay,
    isActive: () => Boolean(article && !overlay.hidden && !overlay.inert && engine?.idle()),
    title: () => article.title,
    onNote: (excerpt) => openNotes(excerpt),
  });

  function openNotes(excerpt) {
    selection.clear();
    if (excerpt) tools.focusNotes();
    onNotes(excerpt, { theme: settings.theme });
  }
  const previousButton = mount.querySelector(".book-previous");
  const nextButton = mount.querySelector(".book-next");
  const media = window.matchMedia("(max-width: 899px)");
  let article = null;
  let minutes = 0;
  let assetBase = "";
  let pageIndex = 0;
  let initialAnchor = null;
  let lastPosition = "";
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

  function setSettings(next) {
    const reflow = settings && (settings.size !== next.size || settings.font !== next.font);
    settings = next;
    styleReadingView(overlay, settings);
    overlay.dataset.bookTheme = settings.theme;
    tools.sync(settings);
    if (reflow) scheduleLayout();
  }

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
        case "image":
        case "animation":
          addMedia(
            id,
            kind,
            `<figure class="book-inline-art"><div class="book-media-frame" data-book-media style="aspect-ratio:${block.width / block.height}">${visualHTML(block, assetBase)}</div></figure>`,
            block.caption,
          );
          break;
      }
    };

    const coverLine = (tag, id, className, value) =>
      `<${tag} class="${className}" data-flow-id="${id}" data-flow-start="0" data-flow-end="${value.length}" data-flow-text>${escapeHTML(value)}</${tag}>`;
    blocks.push({
      id: "cover",
      kind: "cover",
      allowScroll: true,
      create: () => element(`<div class="book-cover">
        ${coverLine("p", "cover-category", "book-front-category", `${article.category} · ${article.kind}`)}
        <div class="book-artwork">${illustration(article.illustration, "book-illustration")}</div>
        ${coverLine("h3", "cover-title", "", article.title)}
        ${coverLine("p", "cover-description", "book-front-description", article.description)}
        ${coverLine("p", "cover-takeaway", "book-front-description", article.takeaway)}
        ${coverLine("p", "cover-author", "book-front-author", `${article.attribution} · ${article.year} · ${minutes} min read`)}
      </div>`),
    });
    for (const kind of SECTION_KINDS) {
      article.sections[kind].forEach((section) => {
        const id = sectionAnchor(section.id);
        addText(`${id}-title`, kind, section.title, "h3", "", { keepNext: true });
        section.blocks.forEach((block, index) => addOrderedBlock(`${id}-block-${index}`, kind, block));
      });
    }
    if (article.sources.length) {
      const links = article.sources.flatMap((source) => {
        const href = sourceURL(source.url);
        return href ? [`<li><a class="book-source-link" href="${escapeHTML(href)}" target="_blank" rel="noopener noreferrer">${escapeHTML(source.label)}</a></li>`] : [];
      });
      blocks.push({
        id: "sources-title", kind: "sources", allowScroll: true,
        create: () => element(`<section class="book-references"><h3>References</h3><ol>${links.join("")}</ol></section>`),
      });
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

  function recoverLayout() {
    try { buildEngine(); }
    catch {
      close({ notify: false });
      onError();
    }
  }

  function scheduleLayout() {
    if (overlay.hidden) return;
    overlay.dataset.layoutPending = "true";
    cancelAnimationFrame(layoutFrame);
    layoutFrame = requestAnimationFrame(() => {
      if (!overlay.hidden) recoverLayout();
    });
  }

  function checkCompletion() {
    if (
      !article ||
      overlay.hidden ||
      completionReported ||
      overlay.dataset.layoutPending === "true" ||
      !engine?.idle()
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
      if (visible) activateAnimations(page);
      else stopAnimations(page);
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
      tools.focusTarget().focus({ preventScroll: true });
    if (engine?.idle()) {
      const anchor = currentAnchor();
      const position = anchor ? `${anchor.id}:${anchor.offset}` : "";
      if (anchor && position !== lastPosition) {
        lastPosition = position;
        onPosition(anchor);
      }
    }
    checkCompletion();
  }

  function destroyEngine() {
    cancelAnimationFrame(inputFrame);
    inputFrame = 0;
    queuedTurn = 0;
    const pointerId = pointer?.id;
    pointer = null;
    if (pointerId !== undefined && spread.hasPointerCapture(pointerId)) spread.releasePointerCapture(pointerId);
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
    const anchor = currentAnchor() ?? initialAnchor;
    initialAnchor = null;
    const fallbackIndex = pageIndex;
    cancelAnimationFrame(layoutFrame);
    overlay.dataset.layoutPending = "true";
    destroyEngine();
    const width = spread.clientWidth;
    const height = spread.clientHeight;
    if (width < 220 || height < 180) throw new Error("The animated reader needs a larger viewport.");
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
    activateAnimations(leaves);
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
    const reader = mountPageTurner({
      host: leaves, pages: pageElements, width: pageWidth, height, single: media.matches, startPage: pageIndex,
      onPage(index) {
        pageIndex = index;
        if (engine) syncPages();
      },
      onState(state) {
        overlay.dataset.state = state;
        if (state === "read") requestAnimationFrame(() => {
          if (engine !== reader || overlay.hidden) return;
          syncPages();
          if (queuedTurn) {
            const direction = queuedTurn;
            queuedTurn = 0;
            turn(direction);
          }
        });
      },
    });
    engine = reader;
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
          node.classList.add("book-fold-back");
        }
    });
    copyObserver.observe(leaves, { childList: true, subtree: true });
    syncPages();
  }

  function canTurn(direction) {
    const target = pageIndex + direction * (media.matches ? 1 : 2);
    return target >= 0 && target < layoutPages.length;
  }

  function turn(direction) {
    selection.clear();
    if (overlay.hidden || !engine) return;
    if (!engine.idle()) {
      queuedTurn = direction; // One pending intention, rather than dropped clicks.
      return;
    }
    const target = pageIndex + direction * (media.matches ? 1 : 2);
    if (!canTurn(direction)) return;
    if (reducedMotion()) engine.show(target);
    else engine.flip(direction);
  }

  function close({ notify = true } = {}) {
    if (overlay.hidden) return;
    selection.clear();
    checkCompletion();
    cancelAnimationFrame(resizeFrame);
    cancelAnimationFrame(layoutFrame);
    destroyEngine();
    overlays.hide(overlay);
    layoutPages = [];
    article = null;
    if (notify) onClose();
  }

  function open(idea, { assetBase: mediaBase, anchor, returnFocus } = {}) {
    destroyEngine();
    article = idea;
    minutes = readingMinutes(idea);
    assetBase = mediaBase;
    initialAnchor = anchor;
    lastPosition = "";
    pageIndex = 0;
    completionReported = false;
    mount.querySelector("#book-dialog-title").textContent = idea.title;
    tools.reset();
    overlays.show(overlay, { close: () => {}, initialFocus: overlay, returnFocus });
    try { buildEngine(); }
    catch (error) {
      close({ notify: false });
      throw error;
    }
  }

  previousButton.addEventListener("click", () => turn(-1));
  nextButton.addEventListener("click", () => turn(1));
  overlay.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || overlay.inert) return;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      turn(event.key === "ArrowRight" ? 1 : -1);
    }
  });
  function localPoint(event, bounds) {
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  }

  spread.addEventListener("pointerdown", (event) => {
    if (
      !engine ||
      pointer ||
      !engine.idle() ||
      event.button !== 0 ||
      event.target.closest("button,a")
    )
      return;
    const bounds = leaves.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const edge = Math.min(72, bounds.width * 0.16);
    const atEdge = x <= edge || x >= bounds.width - edge;
    const mouse = event.pointerType === "mouse";
    if (mouse && !atEdge) return;
    const direction = x < bounds.width / 2 ? -1 : 1;
    if (mouse && !canTurn(direction)) return;
    selection.clear();
    pointer = {
      started: performance.now(),
      id: event.pointerId,
      bounds,
      start: localPoint(event, bounds),
      latest: localPoint(event, bounds),
      direction,
      mouse,
      atEdge,
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
      engine.moveDrag(foldPoint(pointer.latest, pointer));
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
      const direction = dx < 0 ? 1 : -1;
      if ((pointer.mouse && pointer.direction !== direction) || !canTurn(direction)) {
        pointer = null;
        return;
      }
      pointer.direction = direction;
      pointer.dragging = true;
      spread.setPointerCapture(event.pointerId);
      window.getSelection()?.removeAllRanges();
      spread.classList.add("book-is-dragging");
      if (!reducedMotion()) engine.startDrag(pointer.start);
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
      if (gesture.atEdge && !cancelled && performance.now() - gesture.started < 250 && window.getSelection()?.isCollapsed) turn(gesture.direction);
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
    engine.moveDrag(fold);
    engine.endDrag(fold);
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
        recoverLayout();
    });
  });
  resizeObserver.observe(stage);
  document.fonts?.addEventListener("loadingdone", scheduleLayout);
  return { open, close, setSettings, setRead: tools.syncRead, readText: () => onReadText(currentAnchor()), isOpen: () => !overlay.hidden };
}
