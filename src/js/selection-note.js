import { notesIcon } from "./notes-icon.js";

export function selectionEndpoint(selection) {
  const range = selection.getRangeAt(0);
  const focus = selection.focusNode;
  if (!focus) return null;
  const caret = range.cloneRange();
  caret.setStart(focus, selection.focusOffset);
  caret.collapse(true);
  const rect = [...caret.getClientRects()].find((item) => item.height);
  if (rect) return rect;
  const rects = [...range.getClientRects()].filter((item) => item.height && item.width);
  const atStart = focus === range.startContainer && selection.focusOffset === range.startOffset;
  const edge = atStart ? rects[0] : rects.at(-1);
  if (!edge) return null;
  return { right: atStart ? edge.left : edge.right, top: edge.top, bottom: edge.bottom };
}

export function mountSelectionNote({ scope, mount, isActive, title, onNote }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "selection-note reading-key";
  button.setAttribute("aria-label", "Add selected text to notes");
  button.title = "Add selected text to notes";
  button.innerHTML = notesIcon;
  button.hidden = true;
  mount.append(button);
  let timer, selected;

  function clear() {
    clearTimeout(timer);
    button.hidden = true;
    selected = null;
  }
  function within(node) {
    const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    return element && scope.contains(element) && !element.closest("[inert], [hidden], button");
  }
  function update() {
    clear();
    if (!isActive()) return;
    timer = setTimeout(() => {
      if (!isActive()) return;
      const selection = window.getSelection();
      if (!selection?.rangeCount || selection.isCollapsed || !within(selection.anchorNode) || !within(selection.focusNode)) return;
      const text = selection.toString().trim();
      const rect = text && selectionEndpoint(selection);
      if (!rect) return;
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft ?? 0;
      const top = viewport?.offsetTop ?? 0;
      const right = left + (viewport?.width ?? document.documentElement.clientWidth);
      const bottom = top + (viewport?.height ?? innerHeight);
      const size = 40, pad = 6;
      const x = rect.right + pad + size <= right - pad ? rect.right + pad : rect.right - size - pad;
      button.style.left = `${Math.max(left + pad, Math.min(right - size - pad, x))}px`;
      button.style.top = `${Math.max(top + pad, Math.min(bottom - size - pad, rect.top))}px`;
      selected = { text, title: title() };
      button.hidden = false;
    }, 120);
  }

  document.addEventListener("selectionchange", update);
  window.addEventListener("scroll", clear, true);
  window.addEventListener("resize", clear);
  window.visualViewport?.addEventListener("scroll", clear);
  button.addEventListener("pointerdown", (event) => event.preventDefault());
  button.addEventListener("click", () => {
    const excerpt = selected;
    clear();
    window.getSelection()?.removeAllRanges();
    if (excerpt) onNote(excerpt);
  });
  return { clear };
}
