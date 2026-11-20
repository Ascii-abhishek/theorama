import { illustration } from "./illustrations.js";
import { createBookReader } from "./book.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHTML = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const storage = {
  get(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(`theorama:${key}`)) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`theorama:${key}`, JSON.stringify(value));
    } catch {
      /* Works without persistent storage too. */
    }
  },
};
const defaults = {
  theme: "paper",
  font: "sans",
  size: 17,
  reducedMotion: false,
};
const savedPreferences = storage.get("appearance", {});
const preferences = {
  ...defaults,
  ...(savedPreferences && typeof savedPreferences === "object"
    ? savedPreferences
    : {}),
};
let ideas = [];
let chapters = {};
let selectedCategory = "All ideas";
let hideRead = storage.get("hide-read", false) === true;
let readIdeas = new Set(
  (Array.isArray(storage.get("read-ideas", []))
    ? storage.get("read-ideas", [])
    : []
  ).filter((id) => typeof id === "string"),
);
let previousFocus = null;
let toastTimeout;
let feedbackArticle = "";
let suppressBookClose = false;
const categories = [
  "All ideas",
  "Physics",
  "Psychology",
  "Biology",
  "Space",
  "Computer science",
  "Mathematics",
  "Everyday life",
];
const book = createBookReader({
  onComplete(id) {
    setRead(id, true);
  },
  onClose() {
    if (!suppressBookClose)
      history.replaceState(null, "", location.pathname + location.search);
  },
});

function applyAppearance() {
  document.documentElement.dataset.theme = ["paper", "dusk", "rose"].includes(
    preferences.theme,
  )
    ? preferences.theme
    : "paper";
  document.documentElement.dataset.font =
    preferences.font === "serif" ? "serif" : "sans";
  document.documentElement.style.setProperty(
    "--reading-size",
    `${Math.max(15, Math.min(22, Number(preferences.size) || 17))}px`,
  );
  document.documentElement.classList.toggle(
    "motion-off",
    !!preferences.reducedMotion,
  );
  $('meta[name="theme-color"]').content =
    { paper: "#f7f5ed", dusk: "#252b26", rose: "#f8eeec" }[preferences.theme] ||
    "#f7f5ed";
}
applyAppearance();

function renderFilters() {
  $("#filters").innerHTML = categories
    .map(
      (category) =>
        `<button class="filter-button" data-category="${category}" aria-pressed="${selectedCategory === category}">${category}</button>`,
    )
    .join("");
}

function readButton(idea) {
  const read = readIdeas.has(idea.id);
  return `<button class="read-status ${read ? "is-read" : ""}" data-read-toggle="${idea.id}" aria-pressed="${read}" aria-label="Mark ${escapeHTML(idea.title)} as ${read ? "unread" : "read"}" title="${read ? "Read — click to mark unread" : "Unread — click to mark read"}"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8"/>${read ? '<path d="m8.5 12 2.5 2.5 4.5-5"/>' : '<path d="M9 8v8l3-1.8 3 1.8V8Z"/>'}</svg></button>`;
}

function card(idea) {
  return `<article class="idea-card ${idea.color}"><button class="idea-card-open" data-idea="${idea.id}" aria-label="Read ${escapeHTML(idea.title)}"><div class="idea-art">${illustration(idea.id)}</div><div class="idea-card-info"><p class="card-category">${escapeHTML(idea.category)}</p><h3>${escapeHTML(idea.title)}</h3><p class="card-description">${escapeHTML(idea.description)}</p></div></button>${readButton(idea)}</article>`;
}

function matchingIdeas() {
  const query = $("#search").value.trim().toLocaleLowerCase();
  return ideas.filter(
    (idea) =>
      (!hideRead || !readIdeas.has(idea.id)) &&
      (selectedCategory === "All ideas" ||
        idea.tags.includes(selectedCategory)) &&
      `${idea.title} ${idea.description} ${idea.tags.join(" ")} ${idea.attribution} ${idea.kind}`
        .toLocaleLowerCase()
        .includes(query),
  );
}

function renderCollection() {
  const query = $("#search").value.trim();
  const matches = matchingIdeas();
  const showFeatured =
    !query &&
    selectedCategory === "All ideas" &&
    matches.some((idea) => idea.id === "butterfly-effect");
  $("#featured").hidden = !showFeatured;
  if (showFeatured) renderFeature();
  $("#ideas-grid").innerHTML = (
    showFeatured
      ? matches.filter((idea) => idea.id !== "butterfly-effect")
      : matches
  )
    .map(card)
    .join("");
  $("#empty-state").hidden = matches.length > 0;
  $("#collection-title").textContent =
    selectedCategory === "All ideas"
      ? query
        ? "Search results"
        : "The collection"
      : selectedCategory;
  $("#result-count").textContent =
    `${matches.length} ${matches.length === 1 ? "idea" : "ideas"}${hideRead ? " · unread" : ""}`;
  $("#hide-read").setAttribute("aria-pressed", String(hideRead));
  $("#hide-read").title = hideRead
    ? "Showing unread ideas — click to show all"
    : "Hide ideas you've already read";
  $("#surprise").disabled = matches.length === 0;
}

function setRead(id, read) {
  if (readIdeas.has(id) === read) return;
  if (read) readIdeas.add(id);
  else readIdeas.delete(id);
  storage.set("read-ideas", [...readIdeas]);
  renderCollection();
}

function renderFeature() {
  const idea = ideas.find((idea) => idea.id === "butterfly-effect");
  if (!idea) return;
  $("#featured").innerHTML =
    `<article class="featured-card sage"><button class="feature-open" data-idea="${idea.id}" aria-label="Read the featured idea: ${escapeHTML(idea.title)}"><div class="feature-art">${illustration(idea.id)}</div><div class="featured-content"><p class="featured-eyebrow">FEATURED IDEA · PHYSICS</p><h2>${escapeHTML(idea.title)}</h2><p class="featured-copy">Small beginnings. Surprisingly big consequences.</p><span class="feature-readtime">${idea.attribution}, ${idea.year} · ${idea.readTime} read</span></div><div class="feature-open-label" aria-hidden="true">Open the book <svg viewBox="0 0 24 24" fill="none"><path d="M12 6C8.5 4 5 4 2 5v14c3-1 6.5-1 10 1 3.5-2 7-2 10-1V5c-3-1-6.5-1-10 1Zm0 0v14"/></svg></div></button>${readButton(idea)}</article>`;
}

function setSearchOpen(open) {
  $("#search-box").classList.toggle("is-expanded", open);
  $("#search-toggle").setAttribute("aria-expanded", String(open));
  $("#search").hidden = !open;
  if (open) {
    $(".toolbar-browse").scrollLeft = 0;
    $("#search").focus({ preventScroll: true });
  } else {
    $("#search").value = "";
    renderCollection();
    $("#search-toggle").focus({ preventScroll: true });
  }
}

function openDrawer(label) {
  if ($("#drawer").hidden) previousFocus = document.activeElement;
  $("#drawer-label").textContent = label;
  $("#drawer").hidden = false;
  $("#drawer-backdrop").hidden = false;
  document.body.style.overflow = "hidden";
  $(".site-header").inert = true;
  $(".site-main").inert = true;
  $("#drawer-content").scrollTop = 0;
  $("#close-drawer").focus({ preventScroll: true });
}

function closeDrawer({ updateURL = true } = {}) {
  if ($("#drawer").hidden) return;
  $("#drawer").hidden = true;
  $("#drawer-backdrop").hidden = true;
  document.body.style.overflow = "";
  $(".site-header").inert = false;
  $(".site-main").inert = false;
  if (updateURL)
    history.replaceState(null, "", location.pathname + location.search);
  if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  else $("#search-toggle").focus({ preventScroll: true });
}

function dismissBook() {
  suppressBookClose = true;
  book.close();
  suppressBookClose = false;
}

function setURL(value) {
  history.pushState(null, "", `#${value}`);
}

function openArticle(id, updateURL = true) {
  const idea = ideas.find((idea) => idea.id === id);
  if (!idea) return;
  closeDrawer({ updateURL: false });
  if (updateURL) setURL(`idea/${id}`);
  book.open(idea, chapters[id]);
}

function openAppearance() {
  $("#drawer-content").innerHTML =
    `<div class="utility-content"><p class="eyebrow">MAKE YOURSELF AT HOME</p><h2 id="drawer-title">Your kind of quiet.</h2><p class="utility-intro">A little less glare. A little more room to read.<br>Make this corner of the internet feel like yours.</p><section class="setting-group"><div class="setting-heading"><h3>The mood</h3><span class="setting-value">A CHANGE OF SCENERY</span></div><div class="theme-options">${[
      ["paper", "Paper"],
      ["dusk", "After hours"],
      ["rose", "Rosewater"],
    ]
      .map(
        ([id, label]) =>
          `<button class="theme-option" data-theme-option="${id}" aria-pressed="${preferences.theme === id}"><div class="theme-swatch swatch-${id}" aria-hidden="true"><span></span><span></span><span></span></div><span class="theme-name">${label}</span></button>`,
      )
      .join(
        "",
      )}</div></section><section class="setting-group"><div class="setting-heading"><h3>Your site font</h3></div><div class="segmented-control">${[
      ["sans", "A clean slate"],
      ["serif", "A bookish feel"],
    ]
      .map(
        ([id, label]) =>
          `<button class="${id === "serif" ? "serif-sample" : ""}" data-font-option="${id}" aria-pressed="${preferences.font === id}">${label}</button>`,
      )
      .join(
        "",
      )}</div></section><section class="setting-group"><div class="setting-heading"><h3><label for="reading-size">A little breathing room</label></h3><output for="reading-size" class="setting-value" id="size-value">${preferences.size}px</output></div><div class="size-control"><span aria-hidden="true">A</span><input id="reading-size" type="range" min="15" max="22" value="${preferences.size}" aria-label="Reading font size"><span aria-hidden="true">A</span></div></section><section class="setting-group toggle-row"><div><h3>A stiller world</h3><p>Keep the illustrations and diagrams still.</p></div><button class="toggle" id="motion-toggle" role="switch" aria-label="Reduce motion" aria-checked="${preferences.reducedMotion}"><span></span></button></section><div class="reading-preview"><p class="eyebrow">A LITTLE PREVIEW</p><p>A tiny difference now can become a very different world later. Curiosity is a good place to begin.</p></div><p class="appearance-note">Your preferences stay with this browser.</p></div>`;
}

function openFeedback() {
  const draft = storage.get("feedback-draft", {});
  $("#drawer-content").innerHTML =
    `<div class="utility-content"><p class="eyebrow">A NOTE TO THE MAKER</p><h2 id="drawer-title">Found a loose thread?</h2><p class="utility-intro">A missing idea, a small correction, or a bug.<br>Every little note helps make this a better place.</p><form class="feedback-form" id="feedback-form"><label for="feedback-type">What's on your mind?</label><select id="feedback-type" name="type"><option>A small suggestion</option><option>A content correction</option><option>Something isn't working</option><option>An idea to add</option><option>Just saying hello</option></select><label for="feedback-message">Your note</label><textarea id="feedback-message" name="message" maxlength="3000" required placeholder="I was thinking…">${escapeHTML(feedbackArticle ? `About ${feedbackArticle}:\n\n` : draft.message || "")}</textarea><button class="primary-button" type="submit">Save feedback draft</button><p class="form-note">This is a design preview. Your note is saved only in this browser; sending will be connected before launch.</p></form></div>`;
  if (feedbackArticle) $("#feedback-type").value = "A content correction";
  else if (draft.type) $("#feedback-type").value = draft.type;
  feedbackArticle = "";
}

function openAbout() {
  $("#drawer-content").innerHTML =
    `<div class="utility-content"><p class="eyebrow">THE PERSON BEHIND THE PAGES</p><h2 id="drawer-title">Hello, fellow<br>curious person.</h2><div class="developer-art" aria-hidden="true"><span>{</span><span class="dev-star">✳</span><span>}</span></div><h3 class="developer-name">I'm Abhishek.</h3><div class="about-copy"><p>Theorama started with a simple thought: there are so many wonderful ideas out there. What if there were one quiet place to wander through them?</p><p>From the mathematics of a triangle to the strange ways our minds work, this is a growing field guide for anyone who likes asking “why?”</p><p>Made slowly, with curiosity. Built to be open to ideas, corrections, and a little help from other wandering minds.</p></div><button class="primary-button" data-pane="feedback">Leave me a note</button><div class="donation-box"><h3>A coffee for the curiosity?</h3><p>If this little corner of the internet makes your day a bit more interesting, you can help keep it growing.</p><button class="primary-button" id="support-button">☕ Buy me a coffee</button><p class="small-note">Support links are coming with the full site.</p></div><p class="small-note" style="margin-top:25px">A little field guide. A work in progress. Always curious.</p></div>`;
}

function openUtility(pane, updateURL = true) {
  if (!["appearance", "feedback", "about"].includes(pane)) return;
  dismissBook();
  if (pane === "appearance") openAppearance();
  else if (pane === "feedback") openFeedback();
  else openAbout();
  if (updateURL) setURL(pane);
  openDrawer(
    {
      appearance: "A SPACE THAT FEELS LIKE YOU",
      feedback: "THE SUGGESTION BOX",
      about: "BEHIND THEORAMA",
    }[pane],
  );
}

function toast(message) {
  clearTimeout(toastTimeout);
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  toastTimeout = setTimeout(() => {
    $("#toast").hidden = true;
  }, 4500);
}

function restoreFromHash() {
  let hash;
  try {
    hash = decodeURIComponent(location.hash.slice(1));
  } catch {
    hash = "";
  }
  if (
    hash.startsWith("idea/") &&
    ideas.some((idea) => idea.id === hash.slice(5))
  )
    openArticle(hash.slice(5), false);
  else if (["appearance", "feedback", "about"].includes(hash))
    openUtility(hash, false);
  else {
    closeDrawer({ updateURL: false });
    dismissBook();
  }
}

document.addEventListener("click", async (event) => {
  const status = event.target.closest("[data-read-toggle]");
  if (status) {
    const id = status.dataset.readToggle;
    setRead(id, !readIdeas.has(id));
    const replacement = $$(`[data-read-toggle="${id}"]`).find(
      (button) => button.getClientRects().length,
    );
    (replacement && replacement.getClientRects().length
      ? replacement
      : $("#hide-read")
    ).focus({ preventScroll: true });
    return;
  }
  const idea = event.target.closest("[data-idea]");
  if (idea) return openArticle(idea.dataset.idea);
  const utility = event.target.closest("[data-pane]");
  if (utility) return openUtility(utility.dataset.pane);
  const filter = event.target.closest("[data-category]");
  if (filter) {
    selectedCategory = filter.dataset.category;
    $$(".filter-button").forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.category === selectedCategory),
      ),
    );
    renderCollection();
  }
  const theme = event.target.closest("[data-theme-option]");
  if (theme) {
    preferences.theme = theme.dataset.themeOption;
    applyAppearance();
    storage.set("appearance", preferences);
    $$("[data-theme-option]").forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.themeOption === preferences.theme),
      ),
    );
  }
  const font = event.target.closest("[data-font-option]");
  if (font) {
    preferences.font = font.dataset.fontOption;
    applyAppearance();
    storage.set("appearance", preferences);
    $$("[data-font-option]").forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.fontOption === preferences.font),
      ),
    );
  }
  if (event.target.closest("#motion-toggle")) {
    preferences.reducedMotion = !preferences.reducedMotion;
    $("#motion-toggle").setAttribute("aria-checked", preferences.reducedMotion);
    applyAppearance();
    storage.set("appearance", preferences);
  }
  if (event.target.closest("#support-button"))
    toast(
      "The coffee link is coming with the full site. Thank you for the thought!",
    );
  if (event.target.closest("#new-feedback")) {
    openFeedback();
    $("#feedback-message").focus();
  }
  if (event.target.closest("#copy-feedback")) {
    const draft = storage.get("feedback-draft", {});
    try {
      await navigator.clipboard.writeText(`${draft.type}\n\n${draft.message}`);
      toast("Your note is copied.");
    } catch {
      toast(
        "Copy is unavailable in this browser. Your draft is still saved here.",
      );
    }
  }
});

$("#search-toggle").addEventListener("click", () =>
  setSearchOpen($("#search").hidden),
);
$("#search").addEventListener("input", renderCollection);
$("#hide-read").addEventListener("click", () => {
  hideRead = !hideRead;
  storage.set("hide-read", hideRead);
  renderCollection();
});
$("#close-drawer").addEventListener("click", closeDrawer);
$("#drawer-backdrop").addEventListener("click", closeDrawer);
$("#surprise").addEventListener("click", () => {
  const candidates = matchingIdeas();
  if (candidates.length)
    openArticle(candidates[Math.floor(Math.random() * candidates.length)].id);
});
$("#reset-search").addEventListener("click", () => {
  selectedCategory = "All ideas";
  hideRead = false;
  storage.set("hide-read", false);
  $("#search").value = "";
  renderFilters();
  renderCollection();
  $("#search-toggle").focus();
});
document.addEventListener("input", (event) => {
  if (event.target.id === "reading-size") {
    preferences.size = Number(event.target.value);
    $("#size-value").textContent = `${preferences.size}px`;
    applyAppearance();
    storage.set("appearance", preferences);
  }
});
document.addEventListener("submit", (event) => {
  if (event.target.id !== "feedback-form") return;
  event.preventDefault();
  const message = $("#feedback-message").value.trim();
  if (!message) {
    $("#feedback-message").setCustomValidity("Write a little note first.");
    $("#feedback-message").reportValidity();
    $("#feedback-message").setCustomValidity("");
    return;
  }
  storage.set("feedback-draft", { type: $("#feedback-type").value, message });
  $(".feedback-form").outerHTML =
    '<div class="feedback-confirm"><h3>Your note has a home.</h3><p>The draft is saved in this browser. You can copy it now, or come back to it later.</p><button class="primary-button" id="copy-feedback">Copy my note</button> <button class="surprise-button" id="new-feedback">Edit the draft</button></div>';
  $("#copy-feedback").focus();
});
document.addEventListener("keydown", (event) => {
  const isTyping =
    /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) ||
    document.activeElement.isContentEditable;
  if (event.key === "/" && !isTyping && $("#drawer").hidden && !book.isOpen()) {
    event.preventDefault();
    setSearchOpen(true);
  }
  if (event.key === "Escape" && !$("#drawer").hidden) {
    event.preventDefault();
    closeDrawer();
  } else if (event.key === "Escape" && !book.isOpen() && !$("#search").hidden) {
    event.preventDefault();
    setSearchOpen(false);
  }
  if (event.key === "Tab" && !$("#drawer").hidden) {
    const focusable = $$(
      'button:not([disabled]),a[href],input,textarea,select,[tabindex="0"]',
      $("#drawer"),
    ).filter((el) => el.getClientRects().length);
    const first = focusable[0],
      last = focusable[focusable.length - 1];
    if (!$("#drawer").contains(document.activeElement)) {
      event.preventDefault();
      first.focus();
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});
window.addEventListener("hashchange", restoreFromHash);
window.addEventListener("storage", (event) => {
  if (event.key === "theorama:read-ideas") {
    const saved = storage.get("read-ideas", []);
    readIdeas = new Set(
      Array.isArray(saved) ? saved.filter((id) => typeof id === "string") : [],
    );
    renderCollection();
  }
});

try {
  const [ideaResponse, chapterResponse] = await Promise.all([
    fetch(new URL("../../data/ideas.json", import.meta.url)),
    fetch(new URL("../../data/chapters.json", import.meta.url)),
  ]);
  if (!ideaResponse.ok || !chapterResponse.ok)
    throw new Error("Could not load the field guide.");
  [ideas, chapters] = await Promise.all([
    ideaResponse.json(),
    chapterResponse.json(),
  ]);
  renderFilters();
  renderCollection();
  restoreFromHash();
} catch (error) {
  $("#result-count").textContent =
    "Our field notes could not be loaded. Please refresh to try again.";
  $("#ideas-grid").innerHTML =
    "<p>Open this preview through the local server so its articles can load.</p>";
  console.error(error);
}
