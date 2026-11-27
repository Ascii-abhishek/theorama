import { loadStyles } from "./resources.js";

const label = { appearance: "Appearance", about: "About Theorama", notes: "Notes" };
const themeTiles = [["paper", "Paper"], ["dusk", "After hours"], ["rose", "Rosewater"]];
const fontChoices = [["sans", "Clean"], ["serif", "Bookish"], ["handwritten", "Cursive"]];

function readingSample(view) {
  const page = '<strong>A little curiosity</strong><span>One small thought. A door left ajar. Somewhere beyond it, a whole new way to see.</span><i></i><i></i><i></i>';
  return view === "book"
    ? `<span class="sample-book"><span class="sample-page">${page}</span><span class="sample-page">${page}</span><span class="sample-turn">${page}</span></span>`
    : `<span class="sample-article"><span class="sample-scroll">${page}${page}</span></span>`;
}

export function createDrawer({ overlays, appearance, assets, notice }) {
  const drawer = document.getElementById("drawer");
  const backdrop = document.getElementById("drawer-backdrop");
  const content = document.getElementById("drawer-content");
  const closeButton = document.getElementById("close-drawer");
  let active = "", request = 0, notes;
  const closeListeners = new Set();

  function close() {
    if (!active) return;
    if (active === "notes") void notes?.flush();
    active = "";
    request++;
    backdrop.hidden = true;
    drawer.classList.remove("is-notes");
    drawer.classList.remove("is-appearance");
    backdrop.classList.remove("is-notes");
    backdrop.classList.remove("is-appearance");
    overlays.hide(drawer);
    delete drawer.dataset.noteTheme;
    delete drawer.dataset.noteColor;
    for (const listener of closeListeners) listener();
  }

  function fitNotesViewport() {
    if (active !== "notes" || !window.visualViewport) return;
    drawer.style.setProperty("--notes-viewport-height", `${visualViewport.height}px`);
    drawer.style.setProperty("--notes-viewport-top", `${visualViewport.offsetTop}px`);
  }
  window.visualViewport?.addEventListener("resize", fitNotesViewport);
  window.visualViewport?.addEventListener("scroll", fitNotesViewport);

  function open(pane, excerpt, { theme } = {}) {
    if (!Object.hasOwn(label, pane)) return;
    if (active) close();
    active = pane;
    const token = ++request;
    document.getElementById("drawer-label").textContent = label[pane];
    const isNotes = pane === "notes";
    drawer.classList.toggle("is-notes", isNotes);
    drawer.classList.toggle("is-appearance", pane === "appearance");
    backdrop.classList.toggle("is-notes", isNotes);
    backdrop.classList.toggle("is-appearance", pane === "appearance");
    if (isNotes) {
      drawer.dataset.noteTheme = theme ?? appearance.get().theme;
      drawer.dataset.noteColor = "theme";
      fitNotesViewport();
      content.innerHTML = '<div class="utility-content"><div class="loading-skeleton notes-skeleton" aria-hidden="true"><span></span><span></span><span></span></div><p role="status">Opening notes…</p></div>';
    } else if (pane === "appearance") {
      renderAppearance();
    } else {
      content.innerHTML = '<div class="utility-content"><h2>Behind the pages</h2><div class="developer-art" aria-hidden="true"><span>{</span><span class="dev-star">✳</span><span>}</span></div><h3 class="developer-name">I’m Abhishek.</h3><div class="about-copy"><p>Theorama is a field guide to the ideas that help us understand the world. Each entry shares an explanation, a mental model, and sources for further reading.</p></div></div>';
    }
    backdrop.hidden = false;
    overlays.show(drawer, { close, initialFocus: closeButton });
    content.scrollTop = 0;
    if (isNotes) void openNotes(token, excerpt, theme);
  }

  async function openNotes(token, excerpt, theme) {
    let moduleUnavailable = false;
    try {
      const moduleLoad = import("./notes.js").catch((error) => {
        moduleUnavailable = true;
        throw error;
      });
      const [module] = await Promise.all([moduleLoad, loadStyles(assets + "src/styles/notes.css")]);
      if (token !== request) return;
      notes ??= module.createNotes({ onNotice: notice });
      await notes.mount(content, excerpt);
    } catch {
      if (token !== request) return;
      content.innerHTML = '<div class="utility-content"><p role="status">Notes could not open.</p><button type="button" class="primary-button"></button></div>';
      const button = content.querySelector("button");
      button.textContent = moduleUnavailable ? "Reload to retry" : "Try again";
      button.addEventListener("click", () => {
        if (moduleUnavailable) location.reload();
        else open("notes", excerpt, { theme });
      });
      notice("Notes could not open. You can retry from the panel.", { type: "error" });
    }
  }

  function renderAppearance() {
    const { theme, font, view, size } = appearance.get();
    content.innerHTML = `<div class="utility-content appearance-content">
      <div class="appearance-settings">
      <h2>Set the scene</h2>
      <section class="setting-group" aria-labelledby="mood-title">
        <div class="setting-heading"><h3 id="mood-title">The mood</h3></div>
        <div class="theme-options">${themeTiles.map(([id, name]) => `<button type="button" class="theme-option" data-theme-option="${id}" aria-pressed="${theme === id}"><div class="theme-swatch swatch-${id}" aria-hidden="true"><span></span><span></span><span></span></div><span class="theme-name">${name}</span></button>`).join("")}</div>
      </section>
      <section class="setting-group" aria-labelledby="font-title">
        <div class="setting-heading"><h3 id="font-title">The lettering</h3></div>
        <div class="segmented-control">${fontChoices.map(([id, name]) => `<button type="button" data-font-option="${id}" aria-pressed="${font === id}">${name}</button>`).join("")}</div>
      </section>
      <section class="setting-group" aria-labelledby="text-size-title">
        <div class="setting-heading"><label id="text-size-title" for="reading-text-size">Text size</label></div>
        <div class="reading-size-control"><input id="reading-text-size" class="reading-size-slider" type="range" min="15" max="24" step="1" value="${size}" aria-describedby="reading-text-size-value" /><output id="reading-text-size-value" for="reading-text-size">${size} px</output></div>
      </section>
      <section class="setting-group" aria-labelledby="reading-view-title">
        <div class="setting-heading"><h3 id="reading-view-title">The style</h3></div>
        <div class="reading-style-options" data-reader-font="${font}" style="--reading-size: calc(${size}px * var(--cursive-factor, 1))">${[["book", "Book", "A page at a time"], ["text", "Article", "One easy scroll"]].map(([id, name, detail]) => `<button type="button" class="reading-style-option" data-view-option="${id}" aria-pressed="${view === id}"><span class="reading-style-art" aria-hidden="true">${readingSample(id)}</span><span class="reading-style-name">${name}<span class="reading-style-check" aria-hidden="true">✓</span></span><span class="reading-style-detail">${detail}</span></button>`).join("")}</div>
      </section>
      </div>
    </div>`;
  }

  function syncPreview() {
    if (active !== "appearance") return;
    const { font, size } = appearance.get();
    const preview = content.querySelector(".reading-style-options");
    preview.dataset.readerFont = font;
    preview.style.setProperty("--reading-size", `calc(${size}px * var(--cursive-factor, 1))`);
    content.querySelector("#reading-text-size-value").value = `${size} px`;
  }

  content.addEventListener("input", (event) => {
    if (event.target.id !== "reading-text-size") return;
    const saved = appearance.set("size", Number(event.target.value));
    syncPreview();
    if (!saved) notice("Text size changed for this visit. Browser storage is unavailable.", { type: "error" });
  });

  content.addEventListener("click", (event) => {
    const option = event.target.closest("[data-theme-option], [data-font-option], [data-view-option]");
    if (!option) return;
    const setting = option.dataset.themeOption ? "theme" : option.dataset.fontOption ? "font" : "view";
    const value = option.dataset.themeOption ?? option.dataset.fontOption ?? option.dataset.viewOption;
    const saved = appearance.set(setting, value);
    syncPreview();
    content.querySelectorAll(`[data-${setting}-option]`).forEach((button) =>
      button.setAttribute("aria-pressed", String(button === option)));
    if (!saved) notice("Appearance changed for this visit. Browser storage is unavailable.", { type: "error" });
  });
  closeButton.addEventListener("click", close);
  backdrop.addEventListener("click", close);
  return { open, close, subscribeClose: (listener) => closeListeners.add(listener), isOpen: () => Boolean(active), canRefresh: () => notes?.canRefresh() ?? true };
}
