import { isSlug } from "./content-model.js";
import { readPreference, writePreference } from "./preferences.js";

const keyPrefix = "theorama:read:";

export function createReadingState() {
  const read = new Set();
  const listeners = new Set();

  function change(id, value) {
    if (value) read.add(id);
    else read.delete(id);
  }

  function restore() {
    read.clear();
    const legacy = readPreference("read-ideas", []);
    if (Array.isArray(legacy)) legacy.filter(isSlug).forEach((id) => change(id, true));
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith(keyPrefix)) continue;
        const id = key.slice(keyPrefix.length);
        if (isSlug(id)) change(id, localStorage.getItem(key) === "true");
      }
    } catch { /* In-memory changes still work with storage disabled. */ }
  }
  restore();

  window.addEventListener("storage", (event) => {
    if (event.key?.startsWith(keyPrefix) && isSlug(event.key.slice(keyPrefix.length))) {
      const id = event.key.slice(keyPrefix.length);
      change(id, event.newValue === "true");
      listeners.forEach((listener) => listener(id));
    } else if (event.key === null) {
      restore();
      listeners.forEach((listener) => listener());
    }
  });

  return {
    has: (id) => read.has(id),
    set(id, value) {
      if (!isSlug(id) || read.has(id) === value) return true;
      change(id, value);
      const saved = writePreference(`read:${id}`, value);
      listeners.forEach((listener) => listener(id));
      return saved;
    },
    subscribe(listener) { listeners.add(listener); },
  };
}

export function savedPassage(id) {
  try {
    const value = JSON.parse(sessionStorage.getItem(`theorama:passage:${id}`));
    if (typeof value?.id === "string" && Number.isSafeInteger(value.offset) && value.offset >= 0) return value;
  } catch { /* Opening at the beginning is safe. */ }
  return null;
}

export function savePassage(id, anchor) {
  if (!anchor) return;
  try { sessionStorage.setItem(`theorama:passage:${id}`, JSON.stringify(anchor)); }
  catch { /* This setting is optional. */ }
}
