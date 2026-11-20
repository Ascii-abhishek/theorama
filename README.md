# Theorama

A local, interactive **design prototype** for a quiet, retro field guide to big ideas. No database, build step, framework, or installed dependencies.

Run `npm run dev`, then open [the local preview](http://127.0.0.1:5173). Run `npm run check` to check JavaScript syntax, article JSON, and the six-page chapter structure.

## Try the design

- The full-width header contains the wordmark, slogan, and the same three utility controls.
- Click the search icon to expand a field within the subject row. Search titles, descriptions, authors, subjects, and tags. Press `/` to open search and Escape to collapse it.
- Select a subject or use **Surprise me**. Surprise respects the current search, subject, and read filter.
- Open a card to read a centered, six-page book: an illustrated frontispiece, three pages of details, and two mental-model pages. Desktop shows two pages; narrow screens show one at a time.
- Turn pages with the corner arrows, Left/Right keys, or a horizontal mouse drag from a page edge. Touch swiping is supported; vertical scrolling remains available for longer text and larger font settings.
- Reach the last mental-model page to mark an idea read automatically. If it overflows, scroll its content to the bottom to finish. The icon at the top right of every card lets you mark or unmark an idea manually; hover it to see the current status.
- **Hide read** excludes completed ideas, including the featured card. Read state and this preference persist in this browser, and read changes sync between tabs on the same origin.
- Appearance, feedback, and developer info still open in right-side panes. Font choice applies to the whole site, including headings, controls, and book text; the size slider controls book/preview text. Theme, font, size, and reduced-motion preferences persist locally.
- Press Escape or click the backdrop to close a book or utility pane. Articles have shareable `#idea/…` URLs.

Feedback drafts are browser-local. There is no live message delivery or payment integration in this design preview. The developer bio is sample copy to review before launch.

## Project structure

```text
theorama/
├── index.html                 # Static entry page
├── src/
│   ├── js/                    # App, book reader, and SVG illustrations
│   └── styles/                # Page and book styling
├── data/                      # Article summaries and book chapters
├── assets/fonts/              # Bundled fonts and open font licenses
├── scripts/check.mjs          # Source, content, and asset checks
├── CONTRIBUTING.md            # Local setup and contribution guidance
└── package.json               # Commands; no package dependencies
```

Node.js 20+ is required for checks; Python 3 serves the local preview. A static host can serve the repository root directly, including under a subpath. No build or `npm install` step is needed. See [CONTRIBUTING.md](CONTRIBUTING.md) to add articles or change the UI.

## Where the content lives

`data/ideas.json` contains 12 sample article summaries, subject tags, types, author/year metadata, colors, and verified source links. `data/chapters.json` contains the longer book content, keyed by article ID. Each chapter has exactly three `details` pages and two `mental` pages; the reader generates the illustrated first page. A page contains a title, paragraphs, optional bullet points, and an optional conceptual diagram.

`src/js/book.js` and `src/styles/book.css` own the book reader and page-turn animation. `src/js/illustrations.js` contains original, editable SVG artwork. Fonts and their open licenses are bundled in `assets/fonts`.

The source distinguishes mathematical theorems, scientific theories, observations, and heuristics. Read times are sample estimates. The butterfly diagram is conceptual, not a scientific simulation.

For the eventual site, one Markdown file per idea with frontmatter would make contributions and review easier as the collection grows. The prototype uses JSON to keep design iteration simple; a static build can later generate the same interface from Markdown without a database.

To add a sample article, copy an entry in `data/ideas.json`, give it a unique ID, add the corresponding chapter in `data/chapters.json`, and optionally add its SVG to `src/js/illustrations.js`. Unrecognized illustration IDs use a fallback drawing. Read state is stored separately in local storage, so article files stay static and contribution-friendly.

This is a visual/interaction sample to refine before production development, not a finished encyclopedia.
