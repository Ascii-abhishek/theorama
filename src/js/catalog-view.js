import { escapeHTML as escape } from "./html.js";
import { illustration } from "./illustrations.js";
import { IDEA_COLORS, ideaPath, isSlug, PAGE_SIZE } from "./content-model.js";

const bookmark = '<path d="M9 8v8l3-1.8 3 1.8V8Z"/>';
const arrowIcon = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>';

export function readButton(idea) {
  return `<button type="button" class="read-status" data-read-toggle="${escape(idea.id)}" data-idea-title="${escape(idea.title)}" aria-pressed="false" aria-label="Mark ${escape(idea.title)} as read" hidden><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8"/>${bookmark}</svg></button>`;
}

export function syncReadButton(button, read) {
  button.hidden = false;
  button.classList.toggle("is-read", read);
  button.setAttribute("aria-pressed", String(read));
  button.setAttribute("aria-label", `Mark ${button.dataset.ideaTitle} as ${read ? "unread" : "read"}`);
  button.title = read ? "Read — click to mark unread" : "Unread — click to mark read";
  button.querySelector("path").setAttribute("d", read ? "m8.5 12 2.5 2.5 4.5-5" : "M9 8v8l3-1.8 3 1.8V8Z");
}

export function cardHTML(idea, base, featured = false, assets = "") {
  if (!isSlug(idea.id)) return "";
  const href = escape(ideaPath(base, idea.id));
  const color = IDEA_COLORS.includes(idea.color) ? idea.color : "sage";
  const art = illustration(idea.illustration);
  const title = escape(idea.title);
  const category = escape(idea.category);
  const description = escape(idea.description);
  if (featured) {
    return `<article class="featured-card" data-idea-id="${escape(idea.id)}"><a class="feature-open" href="${href}"><div class="feature-art">${art}</div><div class="featured-content"><p class="featured-eyebrow">A little discovery · ${category}</p><h2>${title}</h2><p class="featured-copy">${escape(idea.takeaway || idea.description)}</p><div class="feature-meta"><span class="feature-readtime">${escape(idea.minutes)} min read · ${escape(idea.attribution)}</span><span class="feature-open-label">Read this idea ${arrowIcon}</span></div></div></a>${readButton(idea)}</article>`;
  }
  return `<article class="idea-card ${color}" data-idea-id="${escape(idea.id)}"><a class="idea-card-open" href="${href}"><div class="idea-art">${art}</div><div class="idea-card-info"><p class="card-category">${category}</p><h3>${title}</h3><p class="card-description">${description}</p></div></a>${readButton(idea)}</article>`;
}

export function paginationPaths(rootPath, count, page) {
  const total = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const path = (n) => n <= 1 ? rootPath : `${rootPath}page/${n}/`;
  return { total, path, previous: page > 1 ? path(page - 1) : "", next: page < total ? path(page + 1) : "" };
}
