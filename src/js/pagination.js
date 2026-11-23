// DOM-measured pagination. Semantic source blocks stay independent of physical
// pages; the same CSS and page box are used for measuring and reading.
const normalizeText = (text) => String(text).trim().replace(/\s+/gu, " ");

export function paginateBook({ blocks, createPage, mount, width, height }) {
  const measure = document.createElement("div");
  measure.className = "book-measure";
  measure.inert = true;
  measure.setAttribute("aria-hidden", "true");
  Object.assign(measure.style, { width: `${width}px`, height: `${height}px` });
  mount.append(measure);
  const result = [];
  let page,
    content,
    scroller,
    kind,
    count = 0;

  function start(nextKind) {
    kind = nextKind;
    page = createPage(kind);
    Object.assign(page.style, { width: `${width}px`, height: `${height}px` });
    measure.replaceChildren(page);
    content = page.querySelector("[data-page-content]");
    scroller = page.querySelector(".book-page-scroll");
    count = 0;
  }
  function fits() {
    // Leave a little rounding room for transformed/clipped page rendering.
    return scroller.scrollHeight <= scroller.clientHeight;
  }
  function save() {
    if (!count) return;
    result.push({ kind, html: content.innerHTML });
  }
  function next(nextKind = kind) {
    save();
    start(nextKind);
  }
  function make(
    block,
    text,
    start = 0,
    end = text?.length || 0,
    continues = false,
  ) {
    const root = block.create();
    const target = root.matches("[data-flow-text]")
      ? root
      : root.querySelector("[data-flow-text]");
    const anchor = target || root;
    anchor.dataset.flowId = block.id;
    anchor.dataset.flowStart = String(start);
    anchor.dataset.flowEnd = String(end);
    if (target) {
      target.textContent = text;
      target.dataset.continuation = String(start > 0);
      target.dataset.continues = String(continues);
    }
    return root;
  }

  try {
    start(blocks[0]?.kind || "details");
    for (let index = 0; index < blocks.length; index++) {
      const block = blocks[index];
      if (block.kind !== kind) next(block.kind);
      if (block.text === undefined) {
        let element = make(block);
        content.append(element);
        if (!fits() && count) {
          element.remove();
          next();
          content.append(element);
        }
        // Figures reserve their layout box. Oversize art scales down on a fresh
        // page instead of overlapping text, splitting, or changing size per frame.
        const frame = element.matches("[data-book-media]")
          ? element
          : element.querySelector("[data-book-media]");
        if (!fits() && frame) {
          const overflow = scroller.scrollHeight - scroller.clientHeight;
          frame.style.setProperty(
            "--media-fit-height",
            `${Math.max(1, frame.getBoundingClientRect().height - overflow - 2)}px`,
          );
        }
        if (!fits()) throw new Error(`Book block cannot fit: ${block.id}`);
        count++;
        continue;
      }

      const text = normalizeText(block.text);
      if (!text) continue;
      let offset = 0;
      while (offset < text.length) {
        const full = make(block, text.slice(offset), offset, text.length);
        content.append(full);
        if (fits()) {
          // Keep a heading with at least the start of the following paragraph
          // when the page already has earlier content and there is room next page.
          const following = blocks[index + 1];
          if (
            block.keepNext &&
            count &&
            following?.kind === kind &&
            following.text
          ) {
            const firstWord = normalizeText(following.text).split(" ")[0];
            const probe = make(following, firstWord);
            content.append(probe);
            const orphan = !fits();
            probe.remove();
            if (orphan) {
              full.remove();
              next();
              continue;
            }
          }
          count++;
          break;
        }
        full.remove();
        if (block.keepNext && count) {
          next();
          continue;
        }
        // Find the longest word-boundary prefix fitting the remaining page.
        const remainder = text.slice(offset);
        let ends = [...remainder.matchAll(/\S+(?:\s+|$)/gu)].map(
          (match) => match.index + match[0].trimEnd().length,
        );
        let low = 0,
          high = ends.length - 1,
          best = 0;
        const candidate = make(block, "", offset, offset, true);
        const target = candidate.matches("[data-flow-text]")
          ? candidate
          : candidate.querySelector("[data-flow-text]");
        content.append(candidate);
        while (low <= high) {
          const mid = (low + high) >> 1;
          target.textContent = remainder.slice(0, ends[mid]);
          if (fits()) {
            best = ends[mid];
            low = mid + 1;
          } else high = mid - 1;
        }
        candidate.remove();
        if (!best && count) {
          next();
          continue;
        }
        if (!best) {
          // A single unbroken word/URL may itself exceed a tiny page. Only in
          // that case split by grapheme, never dropping a Unicode character.
          ends =
            typeof Intl.Segmenter === "function"
              ? [
                  ...new Intl.Segmenter(undefined, {
                    granularity: "grapheme",
                  }).segment(remainder),
                ].map((part) => part.index + part.segment.length)
              : [...remainder].reduce(
                  (all, char) => [...all, (all.at(-1) || 0) + char.length],
                  [],
                );
          low = 0;
          high = ends.length - 1;
          content.append(candidate);
          while (low <= high) {
            const mid = (low + high) >> 1;
            target.textContent = remainder.slice(0, ends[mid]);
            if (fits()) {
              best = ends[mid];
              low = mid + 1;
            } else high = mid - 1;
          }
          candidate.remove();
        }
        if (!best) throw new Error(`Book text cannot fit: ${block.id}`);
        content.append(
          make(block, remainder.slice(0, best), offset, offset + best, true),
        );
        count++;
        offset += best;
        while (text[offset] === " ") offset++;
        next();
      }
    }
    save();
    return result;
  } finally {
    measure.remove();
  }
}

export function findAnchorPage(pages, anchor, fallback = 0) {
  if (!anchor) return Math.min(fallback, pages.length - 1);
  for (let index = 0; index < pages.length; index++) {
    const elements = pages[index].querySelectorAll("[data-flow-id]");
    if (
      [...elements].some(
        (element) =>
          element.dataset.flowId === anchor.id &&
          Number(element.dataset.flowStart) <= anchor.offset &&
          (Number(element.dataset.flowEnd) > anchor.offset ||
            element.dataset.flowStart === element.dataset.flowEnd),
      )
    )
      return index;
  }
  return Math.min(fallback, pages.length - 1);
}
