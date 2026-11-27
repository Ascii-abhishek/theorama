import { notesIcon } from "./notes-icon.js";

const icons = {
  close: "<path d='m6 6 12 12M6 18 18 6'/>",
  theme: "<circle cx='12' cy='12' r='8'/><path d='M12 4a8 8 0 0 1 0 16Z' fill='currentColor' opacity='.65'/>",
  focus: "<path d='M8 4H4v4m12-4h4v4M4 16v4h4m12 0h4v-4'/><circle cx='12' cy='12' r='3'/>",
  read: "<circle cx='12' cy='12' r='8'/><path d='m8.5 12 2.5 2.5 4.5-5'/>",
  toggle: "<path d='m14 6-6 6 6 6'/>",
  listen: "<path d='m11 5-6 4H2v6h3l6 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14'/>",
  pause: "<path d='M8 5v14M16 5v14'/>",
  stop: "<rect x='6' y='6' width='12' height='12' rx='1'/>",
};

const focusNames = { blur: "Soft", dark: "Dim", clear: "Clear" };
const svg = (name) => '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' + icons[name] + "</svg>";
let mobilePosition;

function cycle(names, value) {
  const keys = Object.keys(names);
  return keys[(keys.indexOf(value) + 1) % keys.length];
}

export function styleReadingView(element, { theme, font, size, focus }) {
  element.dataset.readerTheme = theme;
  element.dataset.readerFont = font;
  element.dataset.focusMode = focus;
  element.style.setProperty("--reading-size", `calc(${size}px * var(--cursive-factor, 1))`);
}

export function createReadingTools({ mode, onChange, onAppearance, onNotes, onClose, onRead, speech }) {
  const isBook = mode === "book";
  const toolbar = document.createElement("nav");
  toolbar.className = "reading-tools";
  toolbar.setAttribute("aria-label", "Reading controls");
  const menuId = `${mode}-reading-keys`;
  const key = (name, icon, label, alias = "", attrs = "") =>
    `<button class="reading-key ${alias}" type="button" data-reading-key="${name}" aria-label="${label}" ${attrs}>${icon}<span class="reading-key-label" aria-hidden="true">${label}</span></button>`;
  toolbar.innerHTML = `
    <button class="reading-tools-toggle reading-key" type="button" aria-expanded="false" aria-controls="${menuId}" aria-describedby="${menuId}-help" aria-label="Show reading controls">${svg("toggle")}</button>
    <div class="reading-keys" id="${menuId}">
      ${key("close", svg("close"), "Return to catalog", isBook ? "book-close" : "")}
      ${speech?.supported ? key("listen", svg("listen"), "Read aloud", "", 'aria-pressed="false"') + key("stop", svg("stop"), "Stop reading aloud", "", "hidden") : ""}
      ${key("notes", notesIcon, "Your notes", isBook ? "book-notes" : "", 'aria-controls="drawer" aria-haspopup="dialog"')}
      ${key("theme", svg("theme"), "Appearance", isBook ? "book-theme" : "", 'aria-controls="drawer" aria-haspopup="dialog"')}
      ${key("focus", svg("focus"), "Reading background", isBook ? "book-focus" : "")}
      ${key("read", svg("read"), "Mark as read", "", 'aria-pressed="false"')}
    </div>
    <p class="sr-only" id="${menuId}-help">Drag to move reading controls. With the button focused, use Alt and the arrow keys to move it.</p>
    <p class="sr-only reading-tools-status" role="status"></p>`;
  const toggle = toolbar.querySelector(".reading-tools-toggle");
  const panel = toolbar.querySelector(".reading-keys");
  const status = toolbar.querySelector(".reading-tools-status");
  const keys = Object.fromEntries([...toolbar.querySelectorAll("[data-reading-key]")].map((node) => [node.dataset.readingKey, node]));
  [...panel.children].forEach((node, index) => node.style.setProperty("--key-order", index));
  const mobile = window.matchMedia("(max-width: 760px), (max-width: 899px) and (pointer: coarse)");
  let settings, gesture, suppressClick = false;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function bounds() {
    const viewport = window.visualViewport;
    const width = Math.min(viewport?.width ?? innerWidth, document.documentElement.getBoundingClientRect().width);
    const height = viewport?.height ?? innerHeight;
    const style = getComputedStyle(toolbar);
    const safe = (edge) => parseFloat(style.getPropertyValue(`--tools-safe-${edge}`)) || 0;
    const title = isBook && document.getElementById("book-dialog-title");
    const titleHeight = title ? parseFloat(getComputedStyle(title).height) || 64 : document.querySelector(".site-header")?.offsetHeight || 64;
    const top = Math.min(height - 60, Math.max(76, titleHeight + 12));
    const left = Math.max(12, safe("left"));
    return { width, height, top, left, right: Math.max(left, width - 44 - Math.max(12, safe("right"))), bottom: Math.max(top, height - 44 - Math.max(16, safe("bottom"))) };
  }

  function position({ x, y }, remember = false) {
    const area = bounds();
    x = clamp(x, area.left, area.right);
    y = clamp(y, area.top, area.bottom);
    toolbar.style.setProperty("--tools-x", `${x}px`);
    toolbar.style.setProperty("--tools-y", `${y}px`);
    const below = area.height - y - 66;
    const above = y - area.top - 10;
    const upwards = below < 210 && above > below;
    toolbar.dataset.panelSide = upwards ? "above" : "below";
    toolbar.dataset.panelAlign = x < 130 ? "left" : "right";
    toolbar.style.setProperty("--keys-space", `${Math.max(50, upwards ? above : below)}px`);
    if (remember) mobilePosition = { x: (x - area.left) / Math.max(1, area.right - area.left), y: (y - area.top) / Math.max(1, area.bottom - area.top) };
  }

  function fitPosition() {
    if (!mobile.matches) return;
    const area = bounds();
    position(mobilePosition
      ? { x: area.left + mobilePosition.x * (area.right - area.left), y: area.top + mobilePosition.y * (area.bottom - area.top) }
      : { x: area.right, y: isBook ? area.top : area.height / 2 - 22 });
  }

  function label(name, text) {
    keys[name].setAttribute("aria-label", text);
    keys[name].querySelector(".reading-key-label").textContent = text;
  }

  function expand(open) {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Hide reading controls" : "Show reading controls");
    panel.hidden = mobile.matches && !open;
    fitPosition();
  }
  expand(false);
  queueMicrotask(fitPosition);
  mobile.addEventListener("change", () => {
    const losingFocus = mobile.matches && panel.contains(document.activeElement);
    expand(false);
    if (losingFocus) toggle.focus({ preventScroll: true });
  });
  toggle.addEventListener("click", () => {
    if (suppressClick) { suppressClick = false; return; }
    expand(panel.hidden);
  });
  toggle.addEventListener("pointerdown", (event) => {
    if (!mobile.matches || event.button !== 0 || gesture) return;
    const rect = toggle.getBoundingClientRect();
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, moved: false };
    suppressClick = false;
    toggle.setPointerCapture(event.pointerId);
  });
  toggle.addEventListener("pointermove", (event) => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    if (!gesture.moved && Math.hypot(dx, dy) < 6) return;
    gesture.moved = true;
    toolbar.dataset.dragging = "true";
    position({ x: gesture.left + dx, y: gesture.top + dy }, true);
  });
  function finishDrag(event) {
    if (!gesture || gesture.id !== event.pointerId) return;
    suppressClick = gesture.moved && event.type === "pointerup";
    gesture = null;
    delete toolbar.dataset.dragging;
    if (toggle.hasPointerCapture(event.pointerId)) toggle.releasePointerCapture(event.pointerId);
  }
  toggle.addEventListener("pointerup", finishDrag);
  toggle.addEventListener("pointercancel", finishDrag);
  toggle.addEventListener("lostpointercapture", finishDrag);
  toggle.addEventListener("keydown", (event) => {
    if (!mobile.matches || !event.altKey || !event.key.startsWith("Arrow")) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = toggle.getBoundingClientRect();
    position({ x: rect.left + (event.key === "ArrowRight" ? 24 : event.key === "ArrowLeft" ? -24 : 0), y: rect.top + (event.key === "ArrowDown" ? 24 : event.key === "ArrowUp" ? -24 : 0) }, true);
  });
  window.addEventListener("resize", fitPosition);
  window.visualViewport?.addEventListener("resize", fitPosition);
  toolbar.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !mobile.matches || panel.hidden) return;
    event.preventDefault();
    expand(false);
    toggle.focus({ preventScroll: true });
  });

  const actions = {
    close: onClose,
    notes: onNotes,
    theme: onAppearance,
    focus: () => {
      const focus = cycle(focusNames, settings.focus);
      onChange({ focus });
      status.textContent = `Reading background: ${focusNames[focus]}`;
    },
    read: onRead,
    listen: () => speech.toggle(),
    stop: () => {
      speech.stop();
      keys.listen.focus({ preventScroll: true });
    },
  };
  for (const [name, button] of Object.entries(keys)) button.addEventListener("click", () => actions[name]?.());
  speech?.subscribe((state) => {
    const playing = state === "playing";
    const active = state !== "idle";
    keys.listen.querySelector("svg").outerHTML = svg(playing ? "pause" : "listen");
    label("listen", playing ? "Pause reading aloud" : active ? "Resume reading aloud" : "Read aloud");
    keys.listen.setAttribute("aria-pressed", String(active));
    keys.stop.hidden = !active;
    status.textContent = playing ? "Reading aloud." : active ? "Reading aloud paused." : "Reading aloud stopped.";
  });

  return {
    element: toolbar,
    appearanceKey: keys.theme,
    focusTarget: () => mobile.matches ? toggle : keys.close,
    focusNotes: () => (panel.hidden ? toggle : keys.notes).focus({ preventScroll: true }),
    reset: () => expand(false),
    sync(options) {
      settings = options;
      label("focus", `Reading background: ${focusNames[settings.focus]}`);
    },
    syncRead(read) {
      keys.read.setAttribute("aria-pressed", String(read));
      label("read", read ? "Mark as unread" : "Mark as read");
    },
  };
}
