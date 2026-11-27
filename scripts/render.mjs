import { escapeHTML as escape } from "../src/js/html.js";
import { FEATURED_ID, PAGE_SIZE, SECTION_KINDS, SUBJECTS, ideaPath, sectionAnchor, sourceURL } from "../src/js/content-model.js";
import { cardHTML, paginationPaths } from "../src/js/catalog-view.js";
import { illustration } from "../src/js/illustrations.js";
import { visualHTML } from "../src/js/idea-media.js";
import { diagram } from "../src/js/article-art.js";

export const description = "A little field guide to big ideas. Explore the theories, laws, and mental models that help us make sense of the world.";

export function fill(template, fields) {
  return template.replace(/%%([A-Z_]+)%%/g, (_, key) => {
    if (!Object.hasOwn(fields, key)) throw new Error(`Missing template field ${key}`);
    return fields[key];
  });
}

export function renderPage(template, { title, summary = description, canonical, base, assets, pageData = "", earlyScript = "", main, noindex = false }) {
  return fill(template, {
    TITLE: escape(title),
    DESCRIPTION: escape(summary),
    METADATA: [
      canonical ? `<link rel="canonical" href="${escape(canonical)}" />` : "",
      noindex ? '<meta name="robots" content="noindex" />' : "",
    ].join("\n    "),
    EARLY_SCRIPT: earlyScript ? `<script>${earlyScript}</script>` : "",
    BASE: escape(base),
    ASSETS: escape(assets),
    PAGE_DATA: pageData,
    MAIN: main,
  });
}

const countLabel = (num) => `${num} ${num === 1 ? "idea" : "ideas"}`;

export function renderCatalog(template, { base, assets, list, page, slug, path }) {
  const home = !slug && page === 1;
  const featured = home ? list.find((idea) => idea.id === FEATURED_ID) : null;
  const grid = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).filter((idea) => idea !== featured);
  const title = slug ? SUBJECTS[slug] : "The collection";
  const links = paginationPaths(path, list.length, page);
  const filters = [["", "All ideas"], ...Object.entries(SUBJECTS)].map(([id, name]) =>
    `<a class="filter-button"${id === slug ? ' aria-current="true"' : ""} href="${escape(id ? `${base}subjects/${id}/` : base)}">${escape(name)}</a>`,
  ).join("");
  const pagination = [
    links.previous ? `<a href="${escape(links.previous)}" rel="prev">Previous</a>` : "",
    `<span>Page ${page} of ${links.total}</span>`,
    links.next ? `<a href="${escape(links.next)}" rel="next">Next</a>` : "",
  ].join("");
  return fill(template, {
    HEADING: escape(slug ? `Explore ${title}` : "Explore Theorama’s collection of ideas"),
    FILTERS: filters,
    FEATURE: featured ? cardHTML(featured, base, true, assets) : "",
    FEATURE_STATE: featured ? "" : "hidden",
    COLLECTION_TITLE: escape(title),
    COUNT: countLabel(list.length),
    CARDS: grid.length ? grid.map((idea) => cardHTML(idea, base)).join("") : "<p>No ideas in this subject yet.</p>",
    PAGINATION: links.total > 1 ? pagination : "",
    PAGINATION_STATE: links.total > 1 ? "" : "hidden",
  });
}

function figure(markup, caption) {
  return `<figure class="article-figure">${markup}${caption ? `<figcaption>${escape(caption)}</figcaption>` : ""}</figure>`;
}

function renderBlock(block, assets) {
  switch (block.type) {
    case "paragraph": return `<p>${escape(block.text)}</p>`;
    case "heading": return `<h3>${escape(block.text)}</h3>`;
    case "bullets": return `<ul>${block.items.map((item) => `<li>${escape(item)}</li>`).join("")}</ul>`;
    case "diagram": return diagram(block.name);
    case "illustration": return figure(illustration(block.id), block.caption);
    case "image":
    case "animation":
      return figure(visualHTML(block, assets), block.caption);
  }
}

export function renderArticle(idea, { base, assets, minutes, related }) {
  const sections = SECTION_KINDS.map((kind) => {
    const group = idea.sections[kind].map((section) =>
      `<section id="${escape(sectionAnchor(section.id))}" tabindex="-1"><h2>${escape(section.title)}</h2>${section.blocks.map((block) => renderBlock(block, `${assets}ideas/${idea.id}/`)).join("")}</section>`,
    ).join("");
    return `<div class="article-${kind}">${group}</div>`;
  }).join("");
  const sources = idea.sources.map((source) =>
    `<li><a href="${escape(sourceURL(source.url))}" rel="noopener noreferrer">${escape(source.label)}</a></li>`,
  ).join("");
  const subject = Object.keys(SUBJECTS).find((key) => SUBJECTS[key] === idea.category);
  const relatedList = related.length ? `<nav class="article-related" aria-label="Related ideas"><h2>Related ideas</h2><ul>${related.map((item) => `<li><a href="${escape(ideaPath(base, item.id))}">${escape(item.title)}</a></li>`).join("")}</ul></nav>` : "";
  return `<main id="main" tabindex="-1" class="site-main article-main">
    <div class="reader-loading" id="book-startup">
      <span class="reader-spinner" aria-hidden="true"></span>
      <p role="status">Opening the book…</p>
      <a href="#text" class="filter-button" id="read-text-now">Read as text</a>
    </div>
    <article id="text" class="article">
      <header class="article-hero">
        <div class="article-intro">
          <p class="card-category"><a href="${escape(base)}subjects/${escape(subject)}/">${escape(idea.category)}</a> · ${escape(idea.kind)}</p>
          <h1>${escape(idea.title)}</h1>
          <p class="article-summary">${escape(idea.description)}</p>
          <p class="article-credit">${escape(idea.attribution)} · ${escape(idea.year)} · ${minutes} min read</p>
          <p class="feature-status" id="book-status" role="status" hidden></p>
        </div>
        <div class="article-art ${escape(idea.color)}">${illustration(idea.illustration)}</div>
      </header>
      <div class="article-prose">
        <p class="article-takeaway">${escape(idea.takeaway)}</p>
        ${sections}
        <section aria-labelledby="sources"><h2 id="sources">References</h2><ul>${sources}</ul></section>
        ${relatedList}
      </div>
    </article>
  </main>`;
}
