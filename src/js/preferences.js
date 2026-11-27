import { READ_VIEW_KEY } from "./reader-route.js";

const prefix = "theorama:";
const themes = ["paper", "dusk", "rose"];
const fonts = ["sans", "serif", "handwritten"];
const colors = { paper: "#f7f5ed", dusk: "#252b26", rose: "#f8eeec" };

export function readPreference(key, fallback) {
  try { return JSON.parse(localStorage.getItem(prefix + key)) ?? fallback; }
  catch { return fallback; }
}

export function writePreference(key, value) {
  try {
    localStorage.setItem(prefix + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function createAppearance() {
  const stored = readPreference("appearance", {});
  let value = {
    theme: themes.includes(stored.theme) ? stored.theme : "paper",
    font: fonts.includes(stored.font) ? stored.font : "sans",
    size: Math.round(Math.max(15, Math.min(24, Number(stored.size) || 17))),
    view: readPreference(READ_VIEW_KEY, "book") === "text" ? "text" : "book",
    reducedMotion: stored.reducedMotion === true,
  };

  function apply() {
    const root = document.documentElement;
    root.dataset.theme = value.theme;
    root.dataset.font = value.font;
    root.style.setProperty("--reading-size", `calc(${value.size}px * var(--cursive-factor, 1))`);
    root.classList.toggle("motion-off", value.reducedMotion);
    document.querySelector('meta[name="theme-color"]').content = colors[value.theme];
  }
  apply();

  const listeners = new Set();
  return {
    get: () => value,
    subscribe(listener) { listeners.add(listener); },
    set(key, selection) {
      const options = { theme: themes, font: fonts, view: ["book", "text"] }[key];
      if (key === "size") {
        if (!Number.isInteger(selection) || selection < 15 || selection > 24) return false;
      } else if (!options?.includes(selection)) return false;
      value = { ...value, [key]: selection };
      apply();
      for (const listener of listeners) listener(value, key);
      if (key === "view") return writePreference(READ_VIEW_KEY, value.view);
      const { view, ...storedAppearance } = value;
      return writePreference("appearance", storedAppearance);
    },
  };
}
