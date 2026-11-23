# Theorama

A local, interactive **design prototype** for a quiet, retro field guide to big ideas. No server database, build step, framework, or package installation is needed.

Run `npm run dev`, then open [the local preview](http://127.0.0.1:5173). Run `npm run check` to check JavaScript syntax, article JSON, and chapter structure.

## Try the design

- The full-width header contains the wordmark, slogan, and appearance, notes, and a three-dot menu for feedback and author information.
- Click the search icon to expand a field within the subject row. Search titles, descriptions, authors, subjects, and tags. Press `/` to open search and Escape to collapse it.
- Select a subject or use **Surprise me**. Surprise respects the current search, subject, and read filter.
- Open a card to read a centered book with an illustrated opening, detailed explanations, and mental models at the end. Page count is calculated from the text size and available page space. Desktop shows two pages; narrow screens show one at a time.
- Changing text size or rotating/resizing the screen repaginates the content and updates the counters while keeping the current passage in view. Diagrams and media reserve their space and move intact to the following page when needed.
- The compact book controls cycle **Paper / After hours / Rosewater**, adjust reading text from **15–24px**, and cycle the background through **blur / dark focus / clear**. These choices affect only the reader, are retained across books for the current page session, and do not modify site preferences.
- Turn pages with the corner arrows, Left/Right keys, or a horizontal mouse drag from a page edge. A short drag eases back; drag past the center to complete the turn. Touch swiping is supported. Pages do not scroll internally; overflow continues onto following pages.
- Reach the final content page to mark an idea read automatically. The icon at the top right of every card lets you mark or unmark an idea manually; hover it to see the current status.
- **Hide read** excludes completed ideas, including the featured card. Read state and this preference persist in this browser, and read changes sync between tabs on the same origin.
- Appearance opens in a right-side pane. The three-dot menu opens feedback by default, with tabs for feedback and author information; switching tabs preserves the feedback draft. Every drawer has the same header and separator; the feedback/author tabs sit directly in that header. Appearance contains mood tiles, Clean / Bookish / Handwritten fonts, and a live reading preview. Mood and font preferences persist locally. Book text size stays in the reader controls; system reduced-motion settings are respected.
- Press Escape or click the backdrop to close a book or utility pane. Articles have shareable `#idea/…` URLs.

Feedback drafts are browser-local. There is no live message delivery or payment integration in this design preview. The developer bio is sample copy to review before launch.

## Personal notes

The notes icon beside Appearance opens a single shared note in the right drawer. The same icon sits at the top left of the book; opening notes keeps the article, page, theme, and reading size intact. Select book text to reveal an **Add selected text to notes** button after 200 ms. Quotes append with the idea’s title. Touch users can long-press to select text; quick swipes still turn pages.

The drawer is one continuous sticky-note surface with a simple “Notes” header. Choose white, soft yellow, soft red, sage, blue, or dark gray paper. The font button cycles through Sans, Serif, and Mono; a dropdown offers 15/17/20/24px text. Colors switch from swatches to a dropdown when the panel is narrow. Simple Markdown formats as typed: `# ` through `### ` for headings, `- ` or `1. ` for lists, `> ` for quotes, and paired markers for **bold**, *italics*, and inline code. Paste inserts plain text; HTML, images, and remote resources are never rendered. Notes are limited to 20,000 characters including Markdown markers.

Content and note appearance are saved only in IndexedDB for this site, browser profile, and device. Nothing is uploaded or synced to other devices. Saving waits 400 ms after typing, with a maximum two-second interval during continuous typing, and flushes when the panel closes, the editor loses focus, or the document becomes hidden. The save status inside the info popover updates only after a transaction commits; abrupt browser termination can still interrupt pending saves. Storage failures keep the draft in memory and offer Retry and **Download .md**. Transactions compare revisions to prevent stale tabs from silently overwriting each other. A conflicting draft remains available to download before explicitly replacing it with the saved note.

A fixed footer shows the character count on the left and an info button on the right. Hover, keyboard focus, or tap reveals Markdown help, save status, retention details, and the Markdown backup download. Storage failures still show a visible recovery message. Clearing site data, ending a private browsing session, or browser storage eviction can remove notes. **Download .md** provides a portable backup; storage persistence is not promised. The same rules apply on mobile browsers.

With the local server running, open [the notes tests](http://127.0.0.1:5173/tests/notes.html) for Markdown round trips, safe rendering, value bounds, IndexedDB persistence, and stale-tab protection. Tests use a separate IndexedDB database. Notes code lives in `src/js/notes.js`, `src/js/notes-markdown.js`, and `src/js/notes-store.js`, with styles in `src/styles/notes.css`.

## Project structure

```text
theorama/
├── index.html                 # Static entry page
├── src/
│   ├── js/                    # App, book reader, and SVG illustrations
│   ├── styles/                # Page and book styling
│   └── vendor/page-flip/       # Bundled page-fold engine and MIT license
├── data/                      # Article summaries and book chapters
├── assets/fonts/              # Bundled fonts and open font licenses
├── scripts/check.mjs          # Source, content, and asset checks
├── tests/                     # Dependency-free browser notes and pagination tests
├── CONTRIBUTING.md            # Local setup and contribution guidance
└── package.json               # Commands; no package dependencies
```

Node.js 20+ is required for checks; Python 3 serves the local preview. A static host can serve the repository root directly, including under a subpath. No build or `npm install` step is needed. See [CONTRIBUTING.md](CONTRIBUTING.md) to add articles or change the UI.

## Where the content lives

`data/ideas.json` contains 12 sample article summaries, subject tags, types, author/year metadata, colors, and verified source links. `data/chapters.json` contains the longer book content, keyed by article ID. Chapters contain `details` and `mental` section arrays. Sections are semantic content, not fixed pages: the reader measures and splits them into as many justified pages as needed, including single-word continuations. Each section has a title and either paragraphs/optional bullets and a diagram, or an ordered `blocks` array for interleaved text and media. See [CONTRIBUTING.md](CONTRIBUTING.md) for the media format.

`src/js/book.js` and `src/styles/book.css` own the book reader, accessible navigation, and pointer input. `src/js/pagination.js` measures live typography, splits text without dropping words, keeps art together, and preserves the source passage during reflow. The soft-page geometry is provided by a locally bundled [StPageFlip 2.0.7](https://nodlik.github.io/StPageFlip/) engine in `src/vendor/page-flip/`, with its MIT license and documented lifecycle fixes. `src/js/illustrations.js` contains original, editable SVG artwork. Fonts and their open licenses are bundled in `assets/fonts`. The handwritten option uses [Kalam by Indian Type Foundry](https://github.com/google/fonts/tree/main/ofl/kalam), bundled locally with its SIL Open Font License.

The source distinguishes mathematical theorems, scientific theories, observations, and heuristics. Read times are sample estimates. The butterfly diagram is conceptual, not a scientific simulation.

For the eventual site, one Markdown file per idea with frontmatter would make contributions and review easier as the collection grows. The prototype uses JSON to keep design iteration simple; a static build can later generate the same interface from Markdown without a database.

To add a sample article, copy an entry in `data/ideas.json`, give it a unique ID, add the corresponding chapter in `data/chapters.json`, and optionally add its SVG to `src/js/illustrations.js`. Unrecognized illustration IDs use a fallback drawing. Read state is stored separately in local storage, so article files stay static and contribution-friendly.

This is a visual/interaction sample to refine before production development, not a finished encyclopedia.

## Pagination tests

With `npm run dev` running, open [the browser test page](http://127.0.0.1:5173/tests/pagination.html). It checks text conservation, large-text reflow, single-word last pages, long Unicode words, oversized animated art, reading anchors, and mental-model ordering using real browser layout. No test package installation is required.
