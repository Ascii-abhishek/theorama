import { NOTE_LIMIT, NOTE_COLORS, NOTE_DEFAULTS, createNotesStore } from "./notes-store.js";
import { escapeNoteHTML, renderNote, serializeNote, formatNoteInput } from "./notes-markdown.js";

export const notesIcon = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 3h14v13l-5 5H5Z"/><path d="M14 21v-5h5M8 8h8m-8 4h6"/></svg>';

export function createNotes() {
  const store = createNotesStore();
  const root = document.createElement("section");
  root.className = "notes-content";
  const colorNames = { white: "White", yellow: "Yellow", red: "Rose", green: "Sage", blue: "Blue", gray: "Charcoal" };
  const fonts = ["sans", "serif", "mono"];
  const fontNames = { sans: "Sans", serif: "Serif", mono: "Mono" };
  root.innerHTML = `<div class="notes-controls">
    <div class="notes-colors" role="group" aria-label="Note color">${NOTE_COLORS.map((color) => `<button type="button" class="notes-swatch" data-note-color="${color}" aria-label="${colorNames[color]} paper" aria-pressed="false"><span aria-hidden="true">✓</span></button>`).join("")}</div>
    <select class="notes-color-select" aria-label="Note color">${NOTE_COLORS.map((color) => `<option value="${color}">${colorNames[color]}</option>`).join("")}</select>
    <div class="notes-type"><button class="notes-font" type="button" aria-label="Cycle note font">Sans</button><select class="notes-size" aria-label="Note text size">${[15,17,20,24].map((size) => `<option value="${size}">${size}</option>`).join("")}</select></div>
    </div>
    <div class="notes-paper"><div class="notes-editor" role="textbox" aria-label="Your personal note" aria-multiline="true" contenteditable="false" spellcheck="true" data-placeholder="Leave a little thought here…"></div></div>
    <footer class="notes-footer"><span class="notes-count" aria-label="Note character count"></span>
      <div class="notes-info"><button type="button" class="notes-info-button" aria-label="Note formatting and storage information" aria-expanded="false" aria-controls="notes-info-panel"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/></svg></button>
        <div id="notes-info-panel" class="notes-info-panel" role="region" aria-label="About your notes" hidden>
          <p class="notes-status">Loading your note…</p>
          <p>Only in this browser, on this device. No upload or device sync. Clearing site data, private browsing, or browser storage cleanup can remove notes.</p>
          <p>Type # then Space for headings, - or 1. then Space for lists, or &gt; then Space for quotes. Use **bold**, *italics*, or &#96;code&#96;. Undo with Ctrl/Cmd + Z. Pasted text stays plain.</p>
          <button class="notes-download" type="button">Download a Markdown backup</button>
        </div>
      </div>
    </footer>
    <div class="notes-recovery" hidden><p class="notes-alert" role="status"></p><button type="button" class="notes-retry">Retry</button><button type="button" class="notes-reload" hidden>Replace draft with saved note</button></div>`;
  const $ = (selector) => root.querySelector(selector);
  const editor = $(".notes-editor");
  const status = $(".notes-status");
  let note = { ...NOTE_DEFAULTS }, loaded = false, loading;
  let dirty = false, conflict = false, writing = null, generation = 0;
  let timer, maxTimer, formatting = false, composing = false, acceptedHTML = "";

  function message(text, kind = "status") {
    if (status.textContent !== text) status.textContent = text;
    const problem = kind !== "status";
    $(".notes-alert").textContent = problem ? text : "";
    $(".notes-alert").hidden = !problem;
    if (problem) $(".notes-recovery").hidden = false;
    else if (!conflict) $(".notes-recovery").hidden = true;
    if (kind === "notice") {
      $(".notes-retry").hidden = true;
      $(".notes-reload").hidden = !conflict;
    }
  }
  function styles() {
    root.dataset.noteColor = note.color;
    const drawer = root.closest(".drawer");
    if (drawer) drawer.dataset.noteColor = note.color;
    $(".notes-color-select").value = note.color;
    editor.style.fontFamily = `var(--${note.font === "sans" ? "sans" : note.font === "serif" ? "serif" : "mono"})`;
    editor.style.fontSize = `${note.size}px`;
    $(".notes-font").textContent = fontNames[note.font];
    $(".notes-font").setAttribute("aria-label", `Note font: ${fontNames[note.font]}. Switch to ${fontNames[fonts[(fonts.indexOf(note.font) + 1) % fonts.length]]}`);
    $(".notes-size").value = note.size;
    root.querySelectorAll(".notes-swatch").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.noteColor === note.color)));
    $(".notes-count").textContent = `${note.markdown.length.toLocaleString()} / 20,000`;
  }
  function cancelTimers() { clearTimeout(timer); clearTimeout(maxTimer); maxTimer = null; }
  function changed() {
    dirty = true; generation++;
    styles();
    if (conflict) return;
    message("Unsaved changes…");
    clearTimeout(timer);
    timer = setTimeout(flush, 400);
    if (!maxTimer) maxTimer = setTimeout(flush, 2000);
  }
  async function load() {
    if (loading) return loading;
    message("Loading your note…");
    editor.contentEditable = "false";
    loading = (async () => {
      try {
        note = await store.read();
        editor.innerHTML = renderNote(note.markdown);
        acceptedHTML = editor.innerHTML;
        loaded = true; dirty = false; conflict = false;
        $(".notes-recovery").hidden = true;
        styles();
        message("Saved in this browser");
      } catch {
        message("Couldn’t load browser storage. Retry to open your saved note.", "storage");
        $(".notes-recovery").hidden = false;
        $(".notes-retry").hidden = false;
      } finally {
        editor.contentEditable = String(loaded);
        loading = null;
      }
    })();
    return loading;
  }
  async function flush() {
    cancelTimers();
    if (writing) return writing;
    if (!loaded || !dirty || conflict) return;
    writing = (async () => {
      while (dirty && !conflict) {
        const snapshot = { ...note }, version = generation;
        message("Saving…");
        try {
          const revision = await store.write(snapshot, snapshot.revision);
          note.revision = revision;
          if (generation === version) dirty = false;
          $(".notes-recovery").hidden = true;
          message(dirty ? "Saving…" : "Saved in this browser");
        } catch (error) {
          conflict = !!error.conflict;
          message(conflict ? "Another tab saved changes. Download this draft before replacing it." : "Couldn’t save. Keep this tab open, retry, or download your draft.", "storage");
          $(".notes-recovery").hidden = false;
          $(".notes-retry").hidden = conflict;
          $(".notes-reload").hidden = !conflict;
          break;
        }
      }
    })();
    try { await writing; } finally { writing = null; }
  }
  function endCaret() {
    const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false);
    const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
  }
  function input() {
    if (formatting || composing) return;
    formatting = true;
    formatNoteInput(editor);
    formatting = false;
    const markdown = serializeNote(editor);
    if (markdown.length > NOTE_LIMIT) {
      editor.innerHTML = acceptedHTML; endCaret();
      message("Your note is full (20,000 characters). Download a copy to keep more.", "notice");
      return;
    }
    acceptedHTML = editor.innerHTML;
    note.markdown = markdown;
    changed();
  }
  editor.addEventListener("input", input);
  editor.addEventListener("compositionstart", () => { composing = true; });
  editor.addEventListener("compositionend", () => { composing = false; input(); });
  editor.addEventListener("blur", () => { if (composing) { composing = false; input(); } void flush(); });
  editor.addEventListener("paste", (event) => {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain").replace(/\r\n?/g, "\n");
    if (note.markdown.length + text.length - (window.getSelection()?.toString().length || 0) > NOTE_LIMIT) {
      message("That text won’t fit. Notes have room for 20,000 characters.", "notice"); return;
    }
    document.execCommand("insertHTML", false, escapeNoteHTML(text).replace(/\n/g, "<br>"));
    input();
  });
  editor.addEventListener("drop", (event) => { event.preventDefault(); message("Paste plain text to add it to your note.", "notice"); });
  root.addEventListener("click", (event) => {
    const color = event.target.closest("[data-note-color].notes-swatch");
    if (color && loaded && !loading) { note.color = color.dataset.noteColor; changed(); }
  });
  $(".notes-font").addEventListener("click", () => {
    if (loaded && !loading) { note.font = fonts[(fonts.indexOf(note.font) + 1) % fonts.length]; changed(); }
  });
  $(".notes-color-select").addEventListener("change", (event) => {
    if (loaded && !loading) { note.color = event.target.value; changed(); }
  });
  const info = $(".notes-info"), infoButton = $(".notes-info-button"), infoPanel = $(".notes-info-panel");
  function showInfo(open) { infoPanel.hidden = !open; infoButton.setAttribute("aria-expanded", String(open)); }
  infoButton.addEventListener("click", () => showInfo(infoPanel.hidden));
  info.addEventListener("pointerenter", (event) => { if (event.pointerType === "mouse") showInfo(true); });
  info.addEventListener("pointerleave", (event) => { if (event.pointerType === "mouse" && !info.contains(document.activeElement)) showInfo(false); });
  infoButton.addEventListener("focus", () => { if (infoButton.matches(":focus-visible")) showInfo(true); });
  info.addEventListener("focusout", (event) => { if (!info.contains(event.relatedTarget)) showInfo(false); });
  root.addEventListener("pointerdown", (event) => { if (!info.contains(event.target)) showInfo(false); });
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !infoPanel.hidden) {
      event.preventDefault(); event.stopPropagation(); showInfo(false); infoButton.focus();
    }
  });
  $(".notes-size").addEventListener("change", (event) => { if (loaded && !loading) { note.size = Number(event.target.value); changed(); } });
  $(".notes-retry").addEventListener("click", () => loaded && !conflict ? flush() : load());
  $(".notes-reload").addEventListener("click", async () => { cancelTimers(); if (writing) await writing; await load(); });
  $(".notes-download").addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([note.markdown], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "theorama-note.md"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden) void flush(); });
  window.addEventListener("pagehide", () => { void flush(); });
  return {
    async mount(container, excerpt) {
      container.replaceChildren(root);
      showInfo(false);
      styles();
      if (!loaded || !dirty) await load();
      if (excerpt && loaded) {
        const addition = `${note.markdown ? "\n\n" : ""}${excerpt.text.split("\n").map((line) => `> ${line}`).join("\n")}\n— ${excerpt.title}\n`;
        if (note.markdown.length + addition.length > NOTE_LIMIT) { message("This quote won’t fit. Download your note and make room first.", "notice"); return; }
        note.markdown += addition;
        editor.innerHTML = renderNote(note.markdown); acceptedHTML = editor.innerHTML;
        changed(); void flush();
        if (!root.closest("[hidden]")) { editor.focus({ preventScroll: true }); endCaret(); }
      }
    },
    flush,
  };
}
