# Contributing to Theorama

Run `npm run dev` to preview your changes. Run `npm run check` and `npm test` before opening a pull request.

## Add or edit an idea

- Add `content/ideas/<slug>/idea.json`. Start from an existing idea such as `content/ideas/butterfly-effect/idea.json`. The directory name matches the unique lowercase `id`. Keep published IDs stable for links and saved reading state.
- Fill in the title, description, primary subject, tags, kind, attribution, year, color, and takeaway. Artwork is optional. The build calculates reading time, catalog data, related ideas, and search text.
- Write the explanation in `sections.details` and the mental models in `sections.mental`. Each section has a stable ID, a title, and ordered blocks. Keep existing section IDs stable when editing so shared links and reading passages still resolve.
- Use `paragraph` and `heading` blocks with `text`, `bullets` with `items`, and `diagram` with a built-in `name` of `divergence` or `concept`. An `illustration` block takes a built-in illustration ID and optional aspect ratio and caption.
- An `image` block takes a raster path such as `media/example.png`, its integer pixel dimensions, descriptive alt text, and an optional caption. Store the file in the same idea directory. Keep each asset under 2 MB.
- Use an `animation` block with the same fields, plus a separate still image in `poster`. Its `src` is an animated WebP or GIF. Give the poster and animation the same dimensions. Place the block where it belongs in the explanation and describe what changes in the caption. `scripts/generate-concept-media.py` can regenerate the example artwork with Pillow and DejaVu Sans.
- Cite primary or authoritative HTTPS sources in `sources`, with a readable label for each one. Check that the explanation, mental model, attribution, citations, and images are accurate and original or properly licensed. Use typed blocks for all public prose and media.

## Review agent-proposed content

- Have the agent open a pull request from its own branch. Limit its write permissions to proposing changes and keep credentials, deployment access, and branch protection out of its account. Scope its proposals to idea files and any referenced raster assets.
- Require the content, build, and browser checks before merging. Review the proposal for near duplicates, factual errors, source relevance, and rights to any assets. Each merged idea should be ready for readers.
- Preview drafts from their branch on a private or unindexed preview. Production builds should use reviewed main commits. A validation failure leaves the existing release available.
- Deploy a completed `dist/` together so the article pages, search index, and sitemap describe one edition. The previous host deployment or the previous successful build artifact provides a rollback point.

## Change the interface

- Keep the public article and animated book based on the same idea schema. Put page-turn behavior behind the adapter and keep the reading position in terms of content passages.
- Change shared theme palettes in the base stylesheet and feature layout in its own stylesheet. Verify keyboard focus, dark and light themes, mobile layouts, text resizing, and reduced motion.
- Use the shared status banner for actionable failures and important confirmations. A failed enhancement should leave readable HTML and working links.
- Keep notes revision-safe across tabs. Test save failures and backup recovery before changing storage or editor behavior.
