import { createDrawer } from "./drawer.js";
import { createOverlays } from "./overlays.js";
import { createAppearance } from "./preferences.js";
import { createReadingState } from "./reading-state.js";
import { notice } from "./notifications.js";
import { activateAnimations, mountAnimationControls } from "./idea-media.js";
import { monitorRelease } from "./release.js";
import { ideaPath, isSlug } from "./content-model.js";

const { base, assets, article, catalog } = document.body.dataset;
const overlays = createOverlays();
const appearance = createAppearance();
const reading = createReadingState();
const drawer = createDrawer({ overlays, assets, appearance, notice });
mountAnimationControls(notice);
activateAnimations(document);
const context = { base, assets, appearance, drawer, overlays, reading, notice };

document.querySelectorAll(".header-actions [data-pane]").forEach((button) => {
  button.hidden = false;
  button.addEventListener("click", () => drawer.open(button.dataset.pane));
});

function legacyRoute() {
  const hash = location.hash.slice(1);
  if (!hash.startsWith("idea/") || location.pathname !== base) return false;
  const id = hash.slice(5);
  if (isSlug(id)) location.replace(ideaPath(base, id) + "#book");
  else notice("This shared idea link is incomplete. You can browse the catalog below.", { type: "error" });
  return true;
}

if (!legacyRoute()) {
  if (article) import("./article.js").then((module) => module.mountArticle(context))
    .catch(() => notice("Interactive reading tools couldn’t load. The article is still available.", { type: "error" }));
  if (catalog !== undefined) import("./catalog.js").then((module) => module.mountCatalog(context))
    .catch(() => notice("Search couldn’t load. You can still browse ideas by subject.", { type: "error" }));
  if (["appearance", "notes", "about", "feedback"].includes(location.hash.slice(1))) {
    const panel = location.hash.slice(1);
    drawer.open(panel === "feedback" ? "about" : panel);
  }
}
window.addEventListener("hashchange", legacyRoute);

document.addEventListener("error", (event) => {
  const media = event.target;
  if (!media.matches?.(".article-figure img") || media.dataset.failed ||
      media.dataset.animationSrc && media.getAttribute("src") === media.dataset.animationSrc) return;
  media.dataset.failed = "true";
  const fallback = document.createElement("p");
  fallback.className = "feature-status";
  fallback.textContent = `Image unavailable. ${media.alt}`;
  media.replaceWith(fallback);
}, true);

monitorRelease({ base, assets, notice, canRefresh: drawer.canRefresh });
