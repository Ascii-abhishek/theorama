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
2. Add the matching entry in `data/chapters.json`, keyed by that ID. Include three `details` pages followed by two `mental` pages. The reader supplies the illustrated first page.
3. Each page needs a `title` and a nonempty `paragraphs` array. Optional `bullets` contain short strings. Supported `diagram` values are `divergence` and `concept`.
4. Add an original SVG drawing in `src/js/illustrations.js` if appropriate. Existing IDs can guide the illustration format.
5. Run `npm run check`, then check the article in both a wide and narrow browser window. Test the book at the default and largest reading sizes.

Keep prose concise enough to fit a book page comfortably. Short screens and large text can scroll within a page. Avoid adding repeated text merely to fill pages.

## Editorial guidelines

- Distinguish formal theorems, scientific theories, observed effects, and informal heuristics.
- Write plain English first, explain technical terms, and state meaningful limits of an analogy.
- Cite primary or authoritative sources with a clear label and HTTPS URL in `details.sources`. Sources appear on the final detail page.
- Write original summaries. Do not copy substantial passages, figures, or images without permission.
- Treat diagrams as conceptual illustrations unless they are backed by a defined mathematical or scientific model.

## Code changes

`src/js/app.js` handles discovery, preferences, read status, and utility panes. `src/js/book.js` owns the book reader. Styling lives in `src/styles/`; bundled fonts and their licenses live in `assets/fonts/`.

Keep the site static and accessible. Preserve keyboard navigation, reduced-motion settings, and usable text at every reading size. Test search, filters, page turns, and read toggles when changing their behavior. Never commit local feedback drafts, credentials, or browser artifacts.
