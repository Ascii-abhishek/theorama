# Theorama

Theorama is a field guide to big ideas. The catalog, subject pages, and full articles are generated as HTML. The animated book, search, appearance controls, and local notes load in the browser.

## Preview and verify

- Use Node.js 20 or newer. `npm run dev` builds the site and serves it at [127.0.0.1:5173](http://127.0.0.1:5173). Run `npm run build` again after content or code changes.
- Run `npm run check` for source and content validation, and `npm test` for static output, invalid content, and catalog scaling checks.
- Run `npm run test:browser` with Playwright installed. Set `PLAYWRIGHT_MODULE` if it is installed outside this project and `TEST_BROWSER` to select Chromium, Firefox, or WebKit. The GitHub workflow runs all three.
- Open [the pagination checks](http://127.0.0.1:5173/tests/pagination.html) and [the notes checks](http://127.0.0.1:5173/tests/notes.html) directly in the development preview.

## Read and browse

- Use the catalog, subject links, and numbered pages with any connection. Search and **Hide read** use a compact catalog index when requested. **Surprise me** respects the active filters.
- The animated book is the initial default. Choose **Book** or **Article** under **The style** in Appearance. Style changes apply when the panel closes and keep the reading passage. Reading style, lettering, and text size are changed only in Appearance, available from the reader’s theme icon. The Clean, Bookish, and Cursive names use their actual fonts; the animated style tiles preview the selected font and 15–24 px text size. The settings interface keeps the system font. Cursive uses the self-hosted Caveat font.
- Both views share reading controls. On desktop, a red Close button leads the rail. On mobile, use the OS Back gesture or button to leave; drag the floating chevron to move its compact control palette. It starts above the book or midway down the article’s right edge and stays below the title bar. Keyboard users can move it with Alt and the arrow keys. The controls overlay the content without narrowing the article. The desktop book keeps a bounded page proportion with space around it.
- Clicking outside the book or pressing Escape leaves it open. Use Close or browser Back to leave; selecting Article in Appearance deliberately changes the reading style.
- **Read aloud** uses the browser’s speech service and prefers an enhanced or natural voice when available. Pause, resume, and stop work across both reading views. Available voices and their quality depend on your device. The button appears only when the browser supports speech synthesis.
- A slow book startup shows a spinner and switches to the complete text after three seconds. The book keeps the cover and its credit together, remembers the reading passage in this browser tab, and puts references on a dedicated final page.
- The homepage uses the device's calendar date to shuffle tiles and their palettes. Its compact **A little discovery** card gives the idea’s key takeaway, reading time, and a **Read this idea** link that follows your chosen style. It walks through every idea once before repeating. Adding or removing ideas recalculates the cycle. The static catalog stays available when daily data cannot load.
- Illustrated animations play automatically while visible, except with reduced motion or data saving enabled. The circular play/pause button follows the reading theme. Pause holds the current frame; Play restarts raster motion. Hidden pages stop animating, and a failed animation leaves its poster readable.
- Use the Notes drawer on any page. In the book, select a passage to add it to the same note. Notes follow the current reading theme by default. A preset or custom color is remembered across visits. Notes and their appearance are stored in IndexedDB in the current browser profile. The note supports simple Markdown, plain-text paste, a 20,000-character limit, and a Markdown backup from its information menu.
- Notes save as you type. A storage failure or conflict shows recovery controls. Clearing site data can remove notes. Read marks and site appearance also stay in this browser.

## Build for production

```sh
SITE_URL=https://theorama.example/ npm run build:production
```

- Set `SITE_URL` to the real public HTTPS address. Include the public subdirectory in that address when deploying under one. Local builds without `SITE_URL` discourage indexing.
- Publish only `dist/` on a static host. Serve directory index files, forward HTTP to HTTPS, and return `404.html` with status 404 for unknown routes. The output includes `sitemap.xml`, `robots.txt`, and canonical article URLs.
- Apply the generated `_headers` rules or translate them to the host’s configuration. Versioned assets use immutable caching. The release manifest bypasses caches so an open page can offer **Load update**. Enable gzip or Brotli on the host.
- Enable atomic deployments and retain the last good deployment. On GitHub, setting the repository variable `SITE_URL` enables a production artifact on verified main builds. The hosting service can run the same production command from the approved main branch.
- After deployment, check the public homepage, a direct article link, a missing URL, cache headers, and `sitemap.xml`. Verify the domain and submit the sitemap in Search Console.
- Before enabling ads, reserve layout space and confirm publisher and consent requirements. Keep notes isolated from third-party scripts that run with access to same-origin storage.

## Source files

- `content/ideas/<slug>/` contains each idea’s `idea.json` and its optional `media/` directory. See [CONTRIBUTING.md](CONTRIBUTING.md) for the format and the agent review workflow.
- `scripts/build.mjs` generates pages, the searchable catalog, per-idea reader data, and a versioned public release. Development and production use the same content validator.
- `src/js/` contains the catalog, article controls, overlay manager, notifications, reader, and local notes. `page-turner.js` adapts the vendored StPageFlip engine.
- `src/styles/` contains the base site styles and shared themes, with separate book and notes styles. `assets/fonts/` contains WOFF2 fonts and their open licenses.
