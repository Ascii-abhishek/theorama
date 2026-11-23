# Contributing to Theorama

Theorama is a static field guide. Content and illustrations live in the repository; no database or account is needed to work on it.

## Work locally

Use Node.js 20 or newer and Python 3. No dependency installation is required.

```sh
git clone https://github.com/Ascii-abhishek/theorama.git
cd theorama
npm run dev
```

Open [the local preview](http://127.0.0.1:5173/). Run `npm run check` before submitting a pull request.

## Add or improve an idea

1. Add or edit an entry in `data/ideas.json`. Give new entries a unique lowercase, hyphenated `id`. Preserve existing IDs because saved read status and article links use them.
2. Add the matching entry in `data/chapters.json`, keyed by that ID. Include nonempty `details` and `mental` section arrays. The reader supplies the illustrated opening and calculates physical pages from the screen dimensions and text size.
3. Each section needs a `title` and a nonempty `paragraphs` array, or ordered `blocks` as described below. Optional `bullets` contain short strings. Supported `diagram` values are `divergence` and `concept`.
4. Add an original SVG drawing in `src/js/illustrations.js` if appropriate. Existing IDs can guide the illustration format.
5. Run `npm run check`, then check the article in both a wide and narrow browser window. Test the book at the default and largest reading sizes.

Write complete, concise explanations; do not manually pad or split text into fixed pages. Overflow continues onto new pages, with paragraphs split at word boundaries. Readable paragraphs, bullet numbers, source links, and content order are preserved. The reader keeps each diagram/illustration together and scales oversized art to fit a fresh page.

## Editorial guidelines

- Distinguish formal theorems, scientific theories, observed effects, and informal heuristics.
- Write plain English first, explain technical terms, and state meaningful limits of an analogy.
- Cite primary or authoritative sources with a clear label and HTTPS URL in `details.sources`. Sources follow the detail sections and are paginated with the rest of the text.
- Write original summaries. Do not copy substantial passages, figures, or images without permission.
- Treat diagrams as conceptual illustrations unless they are backed by a defined mathematical or scientific model.

## Code changes

`src/js/app.js` handles discovery, preferences, read status, and utility panes. `src/js/book.js` owns the book reader; `src/js/pagination.js` owns measured text flow and reading anchors. The locally vendored page-fold engine, its license, and provenance are in `src/vendor/page-flip/`. Preserve the documented lifecycle fixes when updating it. Styling lives in `src/styles/`; bundled fonts and their licenses live in `assets/fonts/`.

Keep the site static and accessible. Preserve keyboard navigation, reduced-motion settings, and usable text at every reading size. Test search, filters, page turns, and read toggles when changing their behavior. Never commit local feedback drafts, credentials, or browser artifacts.

## Interleave text and animated art

Use an ordered `blocks` array when media should appear between paragraphs. When present, `blocks` replaces that section's legacy `paragraphs`, `bullets`, and `diagram` fields.

```json
{
  "title": "Small changes, different paths",
  "blocks": [
    { "type": "paragraph", "text": "An explanation before the illustration." },
    {
      "type": "illustration",
      "id": "butterfly-effect",
      "aspectRatio": 1.2,
      "caption": "A conceptual illustration."
    },
    { "type": "paragraph", "text": "The explanation continues here." },
    { "type": "diagram", "name": "divergence" },
    { "type": "bullets", "items": ["A useful point.", "Another useful point."] }
  ]
}
```

Supported block types are `paragraph`, `heading`, `bullets`, `diagram`, `illustration`, and `image`. Illustration IDs refer to drawings in `src/js/illustrations.js`; an optional positive `aspectRatio` reserves the frame (default 1.2). Diagram names are `divergence` and `concept`.

An `image` block needs a repository-local `src` beginning with `assets/`, positive numeric `width` and `height`, and descriptive `alt` text. It may have a `caption`. SVG, GIF, or WebP animations can use this block. Keep dimensions stable: the reserved aspect ratio is measured before the asset loads. Animate inside that box rather than changing its size every frame, so the book does not continually repaginate. Large artwork scales to the page while preserving its proportions; captions can continue on the next page.

Run `npm run check` to validate content, then visit [the browser pagination tests](http://127.0.0.1:5173/tests/pagination.html) through the local server. Test new art at small and large reading sizes in portrait and landscape. Check that all text remains present and that page turns still feel smooth.
