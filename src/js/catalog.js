import { PAGE_SIZE, ideaPath, inSubject, normalizeSearch, validateSummary } from "./content-model.js";
import { cardHTML, syncReadButton } from "./catalog-view.js";
import { colorForDay, dailyCards, dailySlots, localDay } from "./daily-catalog.js";
import { requestJSON } from "./resources.js";
import { readPreference, writePreference } from "./preferences.js";

export function mountCatalog({ base, assets, reading, notice }) {
  const $ = (id) => document.getElementById(id);
  const search = $("search");
  const grid = $("ideas-grid");
  const featured = $("featured");
  const pagination = $("catalog-pagination");
  const loading = $("catalog-loading");
  const status = $("catalog-status");
  const hideButton = $("hide-read");
  const surprise = $("surprise");
  const subject = document.body.dataset.subject;
  const homeCount = Number(document.body.dataset.homeCount);
  const original = {
    grid: grid.innerHTML, featured: featured.innerHTML, count: $("result-count").textContent,
    title: $("collection-title").textContent, pagination: pagination.innerHTML, paginated: !pagination.hidden,
  };
  let hideRead = readPreference("hide-read", false) === true;
  let daily, refreshingDay, dailyTimer;
  let page = 1, generation = 0, pendingCount = 0, timer, cached, loadingIndex, incomplete = false;

  function markButtons(id) {
    for (const button of document.querySelectorAll(id ? `[data-read-toggle="${id}"]` : "[data-read-toggle]")) {
      syncReadButton(button, reading.has(button.dataset.readToggle));
    }
  }
  markButtons();

  function updateStatus(text) {
    status.hidden = !text;
    status.textContent = text;
  }

  async function loadCatalog() {
    if (cached) return cached;
    if (!loadingIndex) loadingIndex = (async () => {
      const data = await requestJSON(assets + "catalog.json");
      if (!Array.isArray(data?.ideas)) throw new Error("Invalid catalog response.");
      const seen = new Set();
      const items = data.ideas.filter((item) => {
        if (validateSummary(item).length || typeof item?.search !== "string" ||
            !Number.isSafeInteger(item?.minutes) || item.minutes <= 0 || seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
      if (!items.length) throw new Error("The catalog is unavailable.");
      incomplete = items.length !== data.ideas.length;
      cached = items;
      return cached;
    })().finally(() => { loadingIndex = null; });

    pendingCount++;
    loading.hidden = false;
    grid.setAttribute("aria-busy", "true");
    updateStatus("Loading the catalog…");
    try { return await loadingIndex; }
    finally {
      if (--pendingCount === 0) {
        loading.hidden = true;
        grid.removeAttribute("aria-busy");
        updateStatus("");
      }
    }
  }

  function query() { return normalizeSearch(search.value); }

  const matches = (ideas) => {
    const term = query();
    return ideas.filter((item) =>
      inSubject(item, subject) && (!hideRead || !reading.has(item.id)) && (!term || item.search.includes(term)));
  };

  const card = (idea, day) => cardHTML(day === undefined ? idea : { ...idea, color: colorForDay(idea.id, day) }, base);

  function restore() {
    grid.innerHTML = daily ? daily.cards.map((idea) => card(idea, daily.day)).join("") : original.grid;
    featured.innerHTML = daily?.featured ? cardHTML(daily.featured, base, true, assets) : original.featured;
    featured.hidden = !featured.firstElementChild;
    $("result-count").textContent = original.count;
    $("collection-title").textContent = original.title;
    $("empty-state").hidden = true;
    pagination.innerHTML = original.pagination;
    pagination.hidden = !original.paginated;
    surprise.disabled = !grid.querySelector(".idea-card") && featured.hidden;
    markButtons();
  }

  function draw(items) {
    const total = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    page = Math.min(page, total);
    const homeFeature = !query() ? items.find((item) => item.id === daily?.featured?.id) : null;
    const ordered = homeFeature ? [homeFeature, ...items.filter((item) => item !== homeFeature)] : items;
    const feature = page === 1 ? homeFeature : null;
    const visible = ordered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    featured.innerHTML = feature ? cardHTML(feature, base, true, assets) : "";
    featured.hidden = !feature;
    grid.innerHTML = visible.filter((item) => item !== feature).map((item) => card(item, daily?.day)).join("");
    $("result-count").textContent = `${items.length} ${items.length === 1 ? "idea" : "ideas"}${hideRead ? " · unread" : ""}`;
    $("collection-title").textContent = query() ? "Search results" : original.title;
    $("empty-state").hidden = items.length > 0;
    surprise.disabled = items.length === 0;
    pagination.hidden = total < 2;
    pagination.innerHTML = `${page > 1 ? '<button type="button" data-turn="-1">Previous</button>' : ""}<span>Page ${page} of ${total}</span>${page < total ? '<button type="button" data-turn="1">Next</button>' : ""}`;
    markButtons();
  }

  async function refreshDaily() {
    const day = localDay();
    const slots = dailySlots(day, homeCount);
    if (!slots.length || daily?.day === day || refreshingDay === day) return;
    refreshingDay = day;
    try {
      const shards = new Map(await Promise.all([...new Set(slots.map((slot) => Math.floor(slot / PAGE_SIZE)))].map(async (chunk) =>
        [chunk, await requestJSON(`${assets}daily/${chunk}.json`)])));
      const window = slots.map((slot) => shards.get(Math.floor(slot / PAGE_SIZE))?.[slot % PAGE_SIZE]);
      const ideas = window.filter((item) => !validateSummary(item).length);
      if (day !== localDay() || !ideas.length) return;
      daily = { day, ...dailyCards(ideas, day) };
      document.body.dataset.dailyDay = String(day);
      if (!query() && !hideRead) {
        const focused = document.activeElement?.closest("[data-idea-id]");
        const focusTarget = focused && document.activeElement;
        restore();
        if (focusTarget) {
          const replacement = document.querySelector(`[data-idea-id="${focused.dataset.ideaId}"]`);
          (replacement?.querySelector(focusTarget.matches("button") ? "button" : "a") ?? $("search-toggle")).focus({ preventScroll: true });
        }
      } else if (hideRead && !query()) void render();
    } catch { /* The generated links stay available. */ }
    finally { if (refreshingDay === day) refreshingDay = undefined; }
  }

  function refreshAtMidnight() {
    clearTimeout(dailyTimer);
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    dailyTimer = setTimeout(() => {
      void refreshDaily();
      refreshAtMidnight();
    }, next.getTime() - now.getTime() + 250);
  }

  function unavailable(retry) {
    const text = "The full catalog is temporarily unavailable. You can still browse this page.";
    updateStatus(text);
    notice(text, { type: "error", label: "Retry", run: retry });
  }

  async function render() {
    const token = ++generation;
    if (!query() && !hideRead) {
      if (!loadingIndex) updateStatus("");
      restore();
      return;
    }
    const focusedId = document.activeElement?.dataset.readToggle;
    try {
      const ideas = await loadCatalog();
      if (token !== generation) return;
      draw(matches(ideas));
      if (focusedId) {
        const button = document.querySelector(`[data-read-toggle="${focusedId}"]`);
        (button ?? hideButton).focus({ preventScroll: true });
      }
      updateStatus(incomplete ? "Some ideas are temporarily unavailable." : "");
    } catch {
      if (token !== generation) return;
      restore();
      unavailable(render);
    }
  }

  function setHideRead(value) {
    hideRead = value;
    page = 1;
    hideButton.setAttribute("aria-pressed", String(value));
    if (!writePreference("hide-read", value)) notice("This filter is active for this visit. Browser storage is unavailable.", { type: "error" });
    void render();
  }

  function openSearch(open) {
    $("search-box").classList.toggle("is-expanded", open);
    $("search-toggle").setAttribute("aria-expanded", String(open));
    search.hidden = !open;
    if (open) {
      document.querySelector(".toolbar-browse").scrollLeft = 0;
      search.focus({ preventScroll: true });
    } else {
      search.value = "";
      page = 1;
      void render();
      $("search-toggle").focus({ preventScroll: true });
    }
  }

  async function chooseIdea() {
    try {
      const ideas = matches(await loadCatalog());
      const chosen = ideas[Math.floor(Math.random() * ideas.length)];
      if (chosen) location.assign(ideaPath(base, chosen.id));
    } catch { unavailable(chooseIdea); }
  }

  $("search-box").hidden = false;
  document.querySelector(".toolbar-actions").hidden = false;
  hideButton.setAttribute("aria-pressed", String(hideRead));
  $("search-toggle").addEventListener("click", () => openSearch(search.hidden));
  search.addEventListener("input", () => {
    clearTimeout(timer);
    generation++;
    page = 1;
    timer = setTimeout(render, 100);
  });
  hideButton.addEventListener("click", () => setHideRead(!hideRead));
  surprise.addEventListener("click", chooseIdea);
  $("reset-search").addEventListener("click", () => {
    search.value = "";
    setHideRead(false);
    $("search-toggle").focus({ preventScroll: true });
  });
  pagination.addEventListener("click", async (event) => {
    if (!event.target.matches("[data-turn]")) return;
    page += Number(event.target.dataset.turn);
    await render();
    $("collection-title").focus({ preventScroll: true });
    $("collection").scrollIntoView({ block: "start" });
  });
  document.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-read-toggle]");
    if (!toggle) return;
    const id = toggle.dataset.readToggle;
    if (!reading.set(id, !reading.has(id))) {
      notice("Read status changed for this visit. Browser storage is unavailable.", { type: "error" });
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || document.documentElement.classList.contains("overlay-open") ||
        /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) && event.target !== search ||
        event.target.isContentEditable) return;
    if (event.key === "/" && event.target !== search) {
      event.preventDefault();
      openSearch(true);
    } else if (event.key === "Escape" && !search.hidden) openSearch(false);
  });
  reading.subscribe((id) => {
    if (hideRead) void render();
    else markButtons(id);
  });
  if (hideRead || query()) void render();
  if (homeCount > 0) {
    void refreshDaily();
    refreshAtMidnight();
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) void refreshDaily();
    });
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) void refreshDaily();
    });
  }
}
