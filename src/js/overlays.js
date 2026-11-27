const focusable = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex], [contenteditable="true"]';

export function createOverlays() {
  const background = [...document.querySelectorAll(".skip-link, .site-header, .site-main")];
  const original = new Map();
  const layers = [];
  const root = document.documentElement;
  const canReserve = CSS.supports("scrollbar-gutter", "stable");

  function top() { return layers.at(-1); }

  function update() {
    root.classList.toggle("overlay-open", layers.length > 0);
    background.forEach((node) => {
      node.inert = layers.length > 0 || original.get(node) === true;
    });
    if (!layers.length) {
      original.clear();
      root.style.removeProperty("--scrollbar-offset");
    }
    for (const { element } of layers) {
      const active = top().element === element;
      element.inert = !active;
      element.setAttribute("aria-modal", String(active));
    }
  }

  function show(element, { close, initialFocus, returnFocus = document.activeElement }) {
    if (layers.some((layer) => layer.element === element)) return;
    if (!layers.length) {
      background.forEach((node) => original.set(node, node.inert));
      if (!canReserve) root.style.setProperty("--scrollbar-offset", `${innerWidth - root.clientWidth}px`);
    }
    layers.push({ element, close, returnFocus });
    element.hidden = false;
    update();
    (initialFocus ?? element).focus({ preventScroll: true });
  }

  function hide(element) {
    const index = layers.findIndex((layer) => layer.element === element);
    if (index === -1) return;
    const isTop = index === layers.length - 1;
    const [{ returnFocus }] = layers.splice(index, 1);
    element.hidden = true;
    element.inert = false;
    update();
    if (!isTop) return;
    const fallback = top()?.element ?? document.getElementById("main");
    const canReturn = returnFocus?.isConnected && !returnFocus.closest("[inert], [hidden]");
    (canReturn ? returnFocus : fallback)?.focus({ preventScroll: true });
  }

  document.addEventListener("keydown", (event) => {
    const layer = top();
    if (!layer || event.defaultPrevented) return;
    if (event.key === "Escape") {
      event.preventDefault();
      layer.close();
    }
    if (event.key !== "Tab") return;
    const entries = [...layer.element.querySelectorAll(focusable)].filter((node) =>
      node.getAttribute("tabindex") !== "-1" && !node.closest("[inert]") && node.getClientRects().length);
    const first = entries[0], last = entries.at(-1);
    const active = document.activeElement;
    if (!layer.element.contains(active) || !entries.length || (event.shiftKey ? active === first : active === last)) {
      event.preventDefault();
      ((event.shiftKey ? last : first) ?? layer.element).focus({ preventScroll: true });
    }
  });

  return { show, hide };
}
