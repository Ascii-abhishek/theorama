import { illustration } from "./illustrations.js";

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

function diagram(kind, idea) {
  if (kind === "divergence" || idea.id === "butterfly-effect") {
    return `<figure class="book-diagram"><svg viewBox="0 0 420 180" role="img" aria-label="Two similar starting points gradually diverge"><path d="M25 140h370M25 140V18" stroke="currentColor" opacity=".25"/><path class="book-trajectory" d="M25 86C74 87 83 44 123 56S161 130 207 107 258 28 297 48 347 125 393 43" stroke="var(--accent)"/><path class="book-trajectory book-trajectory-second" d="M25 89C74 89 84 50 124 62S167 143 210 119 258 92 292 117 349 59 393 129" stroke="currentColor"/><circle cx="25" cy="86" r="3" fill="var(--accent)"/><circle cx="25" cy="89" r="3" fill="currentColor"/><text x="25" y="165">NEARLY IDENTICAL STARTS</text><text x="312" y="165">TIME</text></svg><figcaption>A conceptual illustration of sensitivity, rather than a scientific simulation.</figcaption></figure>`;
  }
  return `<figure class="book-diagram book-concept-diagram" aria-label="A way to use this idea"><span>Notice</span><i aria-hidden="true"></i><span>Question</span><i aria-hidden="true"></i><span>Understand</span></figure>`;
}

export function createBookReader({
  onComplete = () => {},
  onClose = () => {},
} = {}) {
  const mount = document.getElementById("book-root");
  if (!mount) throw new Error("The book reader requires #book-root.");
  mount.innerHTML = `<div class="book-overlay" role="dialog" aria-modal="true" aria-labelledby="book-dialog-title" tabindex="-1" hidden><h2 class="sr-only" id="book-dialog-title"></h2><div class="book-stage"><button class="book-close" aria-label="Close book" title="Close book"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button><div class="book-spread"><div class="book-leaves"></div><button class="book-turn book-previous" aria-label="Previous page" title="Previous page">${arrow("previous")}</button><button class="book-turn book-next" aria-label="Next page" title="Next page">${arrow("next")}</button></div><p class="sr-only book-announcement" role="status" aria-live="polite"></p></div></div>`;
  const overlay = mount.querySelector(".book-overlay");
  const stage = mount.querySelector(".book-stage");
  const spread = mount.querySelector(".book-spread");
  const leaves = mount.querySelector(".book-leaves");
  const closeButton = mount.querySelector(".book-close");
  const previousButton = mount.querySelector(".book-previous");
  const nextButton = mount.querySelector(".book-next");
  const media = window.matchMedia("(max-width: 899px)");
  let article = null;
  let chapter = null;
  let pageIndex = 0;
  let previousFocus = null;
  let previousOverflow = "";
  let backgroundState = [];
  let turning = false;
  let turnTimer;
  let pointer = null;
  let completionReported = false;

  function reducedMotion() {
    return (
      document.documentElement.classList.contains("motion-off") ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function pages() {
    return [
      { frontispiece: true },
      ...chapter.details
        .slice(0, 3)
        .map((page) => ({ ...page, mental: false })),
      ...chapter.mental.slice(0, 2).map((page) => ({ ...page, mental: true })),
    ];
  }

  function paragraphsHTML(paragraphs = []) {
    return paragraphs
      .filter(Boolean)
      .map((paragraph) => `<p>${escapeHTML(paragraph)}</p>`)
      .join("");
  }

  function pageHTML(page, index, total) {
    let content;
    if (page.frontispiece) {
      content = `<div class="book-frontispiece ${escapeHTML(article.color)}"><p class="book-front-category">${escapeHTML(article.category)}</p><div class="book-artwork">${illustration(article.id, "book-illustration")}</div><h3>${escapeHTML(article.title)}</h3><p class="book-front-description">${escapeHTML(article.overview.takeaway)}</p><p class="book-front-author">${escapeHTML(article.attribution)} · ${escapeHTML(article.year)}</p></div>`;
    } else {
      const sources =
        index === 3
          ? `<div class="book-sources"><h4>Further reading</h4>${(
              article.details.sources || []
            )
              .filter((source) => /^https:\/\//.test(source.url))
              .map(
                (source) =>
                  `<a href="${escapeHTML(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(source.label)}</a>`,
              )
              .join("")}</div>`
          : "";
      content = `<div class="book-prose${page.mental ? " book-mental" : ""}">${page.mental ? '<p class="book-section-label">MENTAL MODEL</p>' : ""}<h3>${escapeHTML(page.title)}</h3>${paragraphsHTML(page.paragraphs)}${page.diagram ? diagram(page.diagram, article) : ""}${page.bullets?.length ? `<ul>${page.bullets.map((bullet) => `<li>${escapeHTML(bullet)}</li>`).join("")}</ul>` : ""}${sources}</div>`;
    }
    return `<section class="book-page${index % 2 ? " book-page-right" : " book-page-left"}${page.frontispiece ? " book-page-front" : ""}" aria-label="Page ${index + 1} of ${total}"><div class="book-page-scroll" tabindex="0">${content}</div><footer class="book-page-footer"><span>${index + 1} / ${total}</span></footer></section>`;
  }

  function checkCompletion() {
    if (!article || overlay.hidden || completionReported) return;
    const lastPageIndex = pages().length - 1;
    if (
      pageIndex > lastPageIndex ||
      lastPageIndex >= pageIndex + (media.matches ? 1 : 2)
    )
      return;
    const lastScroller = leaves.querySelector(
      ".book-page:last-child .book-page-scroll",
    );
    if (
      !lastScroller ||
      lastScroller.scrollTop + lastScroller.clientHeight <
        lastScroller.scrollHeight - 8
    )
      return;
    completionReported = true;
    onComplete(article.id);
  }

  function render() {
    const allPages = pages();
    const count = media.matches ? 1 : 2;
    const visiblePages = allPages.slice(pageIndex, pageIndex + count);
    leaves.innerHTML = visiblePages
      .map((page, offset) =>
        pageHTML(page, pageIndex + offset, allPages.length),
      )
      .join("");
    previousButton.disabled = pageIndex === 0;
    nextButton.disabled = pageIndex + count >= allPages.length;
    previousButton.setAttribute(
      "aria-label",
      media.matches ? "Previous page" : "Previous spread",
    );
    nextButton.setAttribute(
      "aria-label",
      media.matches ? "Next page" : "Next spread",
    );
    overlay.dataset.page = String(pageIndex + 1);
    overlay.dataset.total = String(allPages.length);
    stage.classList.toggle("book-single-page", media.matches);
    mount.querySelector(".book-announcement").textContent =
      `${article.title}. ${count === 1 ? `Page ${pageIndex + 1}` : `Pages ${pageIndex + 1} and ${Math.min(pageIndex + 2, allPages.length)}`} of ${allPages.length}.`;
    leaves
      .querySelectorAll(".book-page-scroll")
      .forEach((scroller) =>
        scroller.addEventListener("scroll", checkCompletion, { passive: true }),
      );
    requestAnimationFrame(checkCompletion);
  }

  function turn(direction) {
    if (overlay.hidden || turning) return;
    const count = media.matches ? 1 : 2;
    const target = pageIndex + direction * count;
    if (target < 0 || target >= pages().length) return;
    const outgoing = leaves.querySelector(
      direction > 0 ? ".book-page:last-child" : ".book-page:first-child",
    );
    const fold = outgoing?.cloneNode(true);
    const scrollTop =
      outgoing?.querySelector(".book-page-scroll").scrollTop || 0;
    pageIndex = target;
    render();
    if (!reducedMotion() && fold) {
      turning = true;
      fold.classList.add(
        "book-flipping-page",
        direction > 0 ? "book-turn-forward" : "book-turn-backward",
      );
      fold.setAttribute("aria-hidden", "true");
      fold.inert = true;
      spread.append(fold);
      fold.querySelector(".book-page-scroll").scrollTop = scrollTop;
      turnTimer = setTimeout(() => {
        fold.remove();
        turning = false;
      }, 570);
    }
  }

  function close(options = {}) {
    if (overlay.hidden) return;
    const notify =
      typeof options === "boolean" ? options : options.notify !== false;
    clearTimeout(turnTimer);
    turning = false;
    pointer = null;
    spread.classList.remove("book-is-dragging");
    spread.style.removeProperty("--book-drag");
    spread
      .querySelectorAll(".book-flipping-page")
      .forEach((page) => page.remove());
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
    clearTimeout(turnTimer);
    spread
      .querySelectorAll(".book-flipping-page")
      .forEach((page) => page.remove());
    turning = false;
    article = idea;
    const fallback = fallbackChapter(idea);
    chapter = {
      details:
        suppliedChapter?.details?.length >= 3
          ? suppliedChapter.details
          : fallback.details,
      mental:
        suppliedChapter?.mental?.length >= 2
          ? suppliedChapter.mental
          : fallback.mental,
    };
    pageIndex = 0;
    completionReported = false;
    mount.querySelector("#book-dialog-title").textContent = idea.title;
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    render();
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
      if (overlay.hidden) return;
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
      ].filter((element) => element.getClientRects().length);
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
  spread.addEventListener("pointerdown", (event) => {
    if (turning || event.button !== 0 || event.target.closest("button,a"))
      return;
    const bounds = spread.getBoundingClientRect();
    const nearEdge =
      event.clientX - bounds.left < 100 || bounds.right - event.clientX < 100;
    if (event.pointerType === "mouse" && !nearEdge) return;
    pointer = {
      x: event.clientX,
      y: event.clientY,
      id: event.pointerId,
      dragging: false,
    };
  });
  spread.addEventListener("pointermove", (event) => {
    if (!pointer || event.pointerId !== pointer.id) return;
    const dx = event.clientX - pointer.x,
      dy = event.clientY - pointer.y;
    if (!pointer.dragging && Math.abs(dy) > 20 && Math.abs(dy) > Math.abs(dx)) {
      pointer = null;
      return;
    }
    if (Math.abs(dx) > 18 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      if (!pointer.dragging) {
        pointer.dragging = true;
        spread.setPointerCapture(event.pointerId);
        window.getSelection()?.removeAllRanges();
      }
      spread.classList.add("book-is-dragging");
      spread.style.setProperty(
        "--book-drag",
        `${Math.max(-6, Math.min(6, dx / 30))}deg`,
      );
    }
  });
  function endPointer(event) {
    if (!pointer || event.pointerId !== pointer.id) return;
    const dx = event.clientX - pointer.x;
    const shouldTurn = pointer.dragging && Math.abs(dx) > 55;
    pointer = null;
    spread.classList.remove("book-is-dragging");
    spread.style.removeProperty("--book-drag");
    if (spread.hasPointerCapture(event.pointerId))
      spread.releasePointerCapture(event.pointerId);
    if (shouldTurn) turn(dx < 0 ? 1 : -1);
  }
  spread.addEventListener("pointerup", endPointer);
  spread.addEventListener("pointercancel", (event) => {
    pointer = null;
    spread.classList.remove("book-is-dragging");
    spread.style.removeProperty("--book-drag");
  });
  media.addEventListener("change", () => {
    if (overlay.hidden) return;
    if (!media.matches) pageIndex = Math.floor(pageIndex / 2) * 2;
    render();
  });
  return { open, close, isOpen: () => !overlay.hidden };
}
