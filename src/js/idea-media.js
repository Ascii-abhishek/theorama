import { escapeHTML as escape } from "./html.js";

const playIcon = '<path d="m9 5 11 7-11 7Z" fill="currentColor" stroke="none"/>';
const pauseIcon = '<path d="M8 5v14M16 5v14" stroke-width="3"/>';
const icon = (playing) => `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">${playing ? pauseIcon : playIcon}</svg>`;
const controls = new Set();
const intent = new Map();
let observer, mounted = false;

export function visualHTML(block, base) {
  const animated = block.type === "animation";
  const poster = escape(base + (animated ? block.poster : block.src));
  const motion = animated ? ` data-animation-src="${escape(base + block.src)}" data-animation-poster="${poster}"` : "";
  return `<div class="idea-visual"><img src="${poster}"${motion} width="${block.width}" height="${block.height}" alt="${escape(block.alt)}" decoding="async" loading="lazy" />${animated ? `<button class="animation-toggle" type="button" data-animation-toggle aria-pressed="false" aria-label="Play animation" title="Play animation" hidden>${icon(false)}</button>` : ""}</div>`;
}

function reducedMotion() {
  return document.documentElement.classList.contains("motion-off") || matchMedia("(prefers-reduced-motion: reduce)").matches || navigator.connection?.saveData === true;
}

function visible(figure) {
  if (!figure.isConnected || document.hidden || figure.closest("[inert], [hidden]") || getComputedStyle(figure).visibility === "hidden") return false;
  const rect = figure.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && rect.top < innerHeight && rect.bottom > 0 && rect.left < innerWidth && rect.right > 0;
}

function setAnimation(button, playing, freeze = false) {
  const figure = button.closest(".idea-visual");
  const image = figure.querySelector("[data-animation-src]");
  if (button.getAttribute("aria-pressed") === String(playing)) return;
  figure.querySelector(".animation-freeze")?.remove();
  image.hidden = false;
  if (!playing && freeze && image.complete && image.naturalWidth) {
    // Raster motion has no pause API. Keep its current frame, then unload
    // the animation. Play starts the illustration again.
    try {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.className = "animation-freeze";
      const rect = image.getBoundingClientRect();
      canvas.style.width = `${rect.width}px`;
      canvas.style.aspectRatio = `${rect.width} / ${rect.height}`;
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", image.alt);
      canvas.getContext("2d").drawImage(image, 0, 0);
      figure.prepend(canvas);
      image.hidden = true;
    } catch { /* The poster remains a readable fallback. */ }
  }
  image.src = playing ? image.dataset.animationSrc : image.dataset.animationPoster;
  button.setAttribute("aria-pressed", String(playing));
  button.setAttribute("aria-label", playing ? "Pause animation" : "Play animation");
  button.title = playing ? "Pause animation" : "Play animation";
  button.innerHTML = icon(playing);
}

function reconcile(button) {
  const figure = button.closest(".idea-visual");
  const image = figure.querySelector("[data-animation-src]");
  const choice = intent.get(image.dataset.animationSrc) || "auto";
  setAnimation(button, !image.dataset.animationFailed && visible(figure) && (choice === "playing" || choice === "auto" && !reducedMotion()));
}

export function activateAnimations(root) {
  for (const button of controls) {
    if (button.isConnected) continue;
    observer?.unobserve(button.closest(".idea-visual"));
    controls.delete(button);
  }
  observer ??= window.IntersectionObserver ? new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const button = entry.target.querySelector("[data-animation-toggle]");
      if (button) reconcile(button);
    }
  }) : null;
  root.querySelectorAll("[data-animation-toggle]").forEach((button) => {
    button.hidden = false;
    if (!controls.has(button)) {
      controls.add(button);
      observer?.observe(button.closest(".idea-visual"));
    }
    reconcile(button);
  });
}

export function stopAnimations(root) {
  root.querySelectorAll('[data-animation-toggle][aria-pressed="true"]').forEach((button) => setAnimation(button, false));
}

export function mountAnimationControls(notice) {
  if (mounted) return;
  mounted = true;
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-animation-toggle]");
    if (!button) return;
    const image = button.closest(".idea-visual").querySelector("[data-animation-src]");
    const playing = button.getAttribute("aria-pressed") !== "true";
    delete image.dataset.animationFailed;
    intent.set(image.dataset.animationSrc, playing ? "playing" : "paused");
    if (!playing) setAnimation(button, false, true);
    for (const control of controls) reconcile(control);
  });
  document.addEventListener("error", (event) => {
    const image = event.target;
    const button = image.closest?.(".idea-visual")?.querySelector('[data-animation-toggle][aria-pressed="true"]');
    if (!button) return;
    event.stopImmediatePropagation();
    image.dataset.animationFailed = "true";
    intent.set(image.dataset.animationSrc, "paused");
    setAnimation(button, false);
    notice("The animation couldn’t load. Its illustration is still available.", { type: "error" });
  }, true);
  const refresh = () => { for (const button of controls) reconcile(button); };
  document.addEventListener("visibilitychange", refresh);
  window.addEventListener("pageshow", refresh);
  if (!window.IntersectionObserver) window.addEventListener("scroll", refresh, { passive: true });
  matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", () => {
    for (const [src, choice] of intent) if (choice === "playing") intent.delete(src);
    refresh();
  });
}
