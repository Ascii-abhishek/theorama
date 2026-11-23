import { paginateBook, findAnchorPage } from "../src/js/pagination.js";
const fixture = document.querySelector("#fixture");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
function createPage(kind) {
  const page = document.createElement("section");
  page.className = "book-page";
  page.innerHTML = `<div class="book-page-inner"><div class="book-page-scroll"><div class="book-prose${kind === "mental" ? " book-mental" : ""}" data-page-content></div></div><footer class="book-page-footer">1 / 1</footer></div>`;
  return page;
}
const paragraph = (id, text, kind = "details") => ({
  id,
  text,
  kind,
  create: () => {
    const p = document.createElement("p");
    p.setAttribute("data-flow-text", "");
    return p;
  },
});
function layout(blocks, width = 280, height = 340) {
  return paginateBook({ blocks, createPage, mount: fixture, width, height });
}
function render(pages, width = 280, height = 340) {
  return pages.map((page) => {
    const node = createPage(page.kind);
    Object.assign(node.style, { width: `${width}px`, height: `${height}px` });
    node.querySelector("[data-page-content]").innerHTML = page.html;
    fixture.append(node);
    const frame = node.querySelector(".book-page-scroll");
    assert(
      frame.scrollHeight <= frame.clientHeight,
      "A rendered page overflowed vertically.",
    );
    assert(
      frame.scrollWidth <= frame.clientWidth,
      "A rendered page overflowed horizontally.",
    );
    return node;
  });
}
function conserve(nodes, id, expected) {
  expected = expected.trim().replace(/\s+/gu, " ");
  const coverage = new Uint8Array(expected.length);
  const fragments = nodes.flatMap((node) => [
    ...node.querySelectorAll(`[data-flow-id="${id}"]`),
  ]);
  assert(fragments.length > 0, `Missing content ${id}`);
  for (const fragment of fragments) {
    const start = Number(fragment.dataset.flowStart),
      end = Number(fragment.dataset.flowEnd);
    assert(
      fragment.textContent === expected.slice(start, end),
      "A fragment changed its source text.",
    );
    for (let index = start; index < end; index++) coverage[index]++;
  }
  assert(
    [...expected].length > 0 &&
      [...coverage].every(
        (count, index) => expected[index] === " " || count === 1,
      ),
    "Text was dropped or repeated.",
  );
}
await document.fonts.ready;
const cases = [
  [
    "Long paragraphs split without losing or duplicating text",
    () => {
      const text = "A small change can follow a very different path. ".repeat(
        50,
      );
      const pages = layout([paragraph("long", text)]);
      const nodes = render(pages);
      assert(pages.length > 2, "Expected multiple pages.");
      conserve(nodes, "long", text);
    },
  ],
  [
    "More text size adds pages, and smaller text removes them",
    () => {
      const blocks = [
        paragraph(
          "sizing",
          "Curiosity makes room for another question. ".repeat(35),
        ),
      ];
      fixture.style.setProperty("--reading-size", "15px");
      const small = layout(blocks);
      fixture.style.setProperty("--reading-size", "24px");
      const large = layout(blocks);
      assert(
        large.length > small.length,
        "Text size did not affect pagination.",
      );
      render(large);
    },
  ],
  [
    "A single final word is retained on its own page",
    () => {
      // Find a full one-page paragraph, then append a word beyond its capacity.
      let text = "wonder";
      while (
        layout([paragraph("one", `${text} wonder`)], 280, 260).length === 1
      )
        text += " wonder";
      const pages = layout([paragraph("one", `${text} wonder`)], 280, 260);
      const nodes = render(pages, 280, 260);
      conserve(nodes, "one", `${text} wonder`);
      assert(
        nodes.at(-1).querySelector("[data-flow-text]").textContent === "wonder",
        `Expected one final word, got: ${JSON.stringify(nodes.at(-1).querySelector("[data-flow-text]").textContent)}`,
      );
    },
  ],
  [
    "Very long Unicode words preserve every grapheme",
    () => {
      const text = "🦋wonder".repeat(130);
      const pages = layout([paragraph("unicode", text)]);
      const nodes = render(pages);
      conserve(nodes, "unicode", text);
      assert(
        !nodes.some((node) =>
          /[\uD800-\uDBFF]$/.test(
            node.querySelector("[data-flow-text]").textContent,
          ),
        ),
        "Split a surrogate pair.",
      );
    },
  ],
  [
    "An oversize illustration stays whole and fits a page",
    () => {
      const art = {
        id: "art",
        kind: "details",
        create: () => {
          const figure = document.createElement("figure");
          figure.className = "book-inline-art";
          figure.innerHTML =
            '<div class="book-media-frame" data-book-media style="height:var(--media-fit-height, 1400px);max-height:none"><svg viewBox="0 0 100 100" aria-label="Animated fixture"><circle cx="50" cy="50" r="30"><animate attributeName="r" values="20;30;20" dur="2s" repeatCount="indefinite"/></circle></svg></div>';
          return figure;
        },
      };
      const pages = layout([
        paragraph("before", "Before the illustration. ".repeat(9)),
        art,
        paragraph("after", "After the illustration. ".repeat(9)),
      ]);
      const nodes = render(pages);
      assert(
        nodes.flatMap((node) => [
          ...node.querySelectorAll('[data-flow-id="art"]'),
        ]).length === 1,
        "Art was split or duplicated.",
      );
      conserve(nodes, "before", "Before the illustration. ".repeat(9));
      conserve(nodes, "after", "After the illustration. ".repeat(9));
    },
  ],
  [
    "Reading anchors survive text-size changes",
    () => {
      const text = "Follow the passage through the book. ".repeat(40);
      const blocks = [paragraph("anchor", text)];
      fixture.style.setProperty("--reading-size", "17px");
      const old = render(layout(blocks));
      const fragment = old[2].querySelector("[data-flow-id]");
      const anchor = {
        id: fragment.dataset.flowId,
        offset: Number(fragment.dataset.flowStart),
      };
      fixture.style.setProperty("--reading-size", "24px");
      const next = render(layout(blocks));
      const index = findAnchorPage(next, anchor);
      assert(
        [...next[index].querySelectorAll("[data-flow-id]")].some(
          (el) =>
            Number(el.dataset.flowStart) <= anchor.offset &&
            Number(el.dataset.flowEnd) > anchor.offset,
        ),
        "Anchor was lost.",
      );
    },
  ],
  [
    "Mental models start after details, with no empty physical pages",
    () => {
      const pages = layout([
        paragraph("detail", "A complete explanation."),
        paragraph("model", "A useful mental model.", "mental"),
      ]);
      assert(
        pages.length === 2 && pages[1].kind === "mental",
        "Section order changed.",
      );
      render(pages);
    },
  ],
];
let failures = 0;
for (const [label, run] of cases) {
  const item = document.createElement("li");
  try {
    run();
    item.className = "pass";
    item.textContent = `PASS: ${label}`;
  } catch (error) {
    failures++;
    item.className = "fail";
    item.textContent = `FAIL: ${label} — ${error.message}`;
    console.error(error);
  }
  document.querySelector("#results").append(item);
  fixture
    .querySelectorAll(":scope > .book-page")
    .forEach((node) => node.remove());
}
document.body.dataset.testStatus = failures ? "failed" : "passed";
