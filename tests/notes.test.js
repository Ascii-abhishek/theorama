import { NOTE_LIMIT, normalizeNote, createNotesStore } from "../src/js/notes-store.js";
import { renderNote, serializeNote, formatNoteInput } from "../src/js/notes-markdown.js";
const results = document.querySelector("#results");
const fixture = document.querySelector("#fixture");
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const tests = [
  ["Markdown round trips paragraphs, blank lines, lists, quotes and inline formatting", () => {
    const source = "# A thought\n\nPlain **bold** and *italic* with `code`.\n- First\n- Second\n\n1. One\n2. Two\n> A quote\nLast paragraph";
    fixture.innerHTML = renderNote(source);
    assert(serializeNote(fixture) === source, `Round trip changed content: ${serializeNote(fixture)}`);
    assert(fixture.querySelectorAll("li").length === 4, "Lists missing");
  }],
  ["Pasted HTML, URLs and script markup cannot execute or load resources", () => {
    const source = '<img src="https://example.com/tracker" onerror="alert(1)">\n<script>alert(1)</script>\n**<svg/onload=alert(1)>**\n[link](javascript:alert(1))';
    fixture.innerHTML = renderNote(source);
    assert(!fixture.querySelector("img,script,svg,a"), "Untrusted markup rendered");
    assert(serializeNote(fixture) === source, "Unsafe-looking plain text lost");
  }],
  ["Invalid preferences and oversized records are bounded", () => {
    assert(normalizeNote(null).markdown === "" && normalizeNote("bad").color === "white", "Malformed record failed to recover");
    const result = normalizeNote({ markdown: "x".repeat(NOTE_LIMIT + 1), color: "unknown", font: "unknown", size: 100, revision: -1 });
    assert(result.markdown.length === NOTE_LIMIT && result.color === "white" && result.font === "sans" && result.size === 17 && result.revision === 0, "Bad saved values accepted");
  }],
  ["Typing bold does not prematurely turn the first closing star into italics", () => {
    fixture.hidden = false; fixture.contentEditable = "true";
    fixture.style.whiteSpace = "pre-wrap";
    fixture.textContent = "**useful*";
    const caret = () => {
      const range = document.createRange(); range.selectNodeContents(fixture); range.collapse(false);
      getSelection().removeAllRanges(); getSelection().addRange(range); fixture.focus();
    };
    // Set a text-node caret, as a browser keystroke does.
    const textCaret = () => {
      const range = document.createRange(); range.setStart(fixture.firstChild, fixture.firstChild.length); range.collapse(true);
      getSelection().removeAllRanges(); getSelection().addRange(range); fixture.focus();
    };
    textCaret(); formatNoteInput(fixture);
    assert(!fixture.querySelector("em,strong"), "Incomplete bold was formatted too early");
    fixture.textContent = "**useful**"; textCaret(); formatNoteInput(fixture);
    assert(fixture.querySelector("strong")?.textContent === "useful", "Complete bold did not format");
    assert(serializeNote(fixture) === "**useful**", "Bold did not serialize");
    caret(); fixture.hidden = true;
  }],
  ["Quote shortcuts work after browser-generated spans and nonbreaking spaces", () => {
    fixture.hidden = false; fixture.contentEditable = "true";
    fixture.innerHTML = '<div><span>&gt;&nbsp;</span></div>';
    const text = fixture.querySelector("span").firstChild;
    const range = document.createRange(); range.setStart(text, text.length); range.collapse(true);
    getSelection().removeAllRanges(); getSelection().addRange(range); fixture.focus();
    formatNoteInput(fixture);
    assert(fixture.querySelector("blockquote"), "Quote shortcut failed inside a browser span");
    fixture.hidden = true;
  }],
  ["Committed notes survive a fresh connection; stale tabs cannot overwrite them", async () => {
    // Keep browser tests separate from the reader’s personal note.
    const first = createNotesStore("theorama-notes-test"), second = createNotesStore("theorama-notes-test");
    const before = await first.read();
    const sample = { ...before, markdown: "A saved thought with **bold**.\n\nAnother paragraph." };
    const revision = await first.write(sample, before.revision);
    const restored = await second.read();
    assert(restored.markdown === sample.markdown && restored.revision === revision, "Stored content changed");
    try { await second.write({ ...before, markdown: "stale content" }, before.revision); throw new Error("A stale write succeeded"); }
    catch (error) { assert(error.conflict === true, "Expected a conflict error"); }
    assert((await first.read()).markdown === sample.markdown, "Conflict overwrote saved content");
  }],
];
results.textContent = "";
let failed = 0;
for (const [name, run] of tests) {
  try { await run(); results.textContent += `PASS ${name}\n`; }
  catch (error) { failed++; results.textContent += `FAIL ${name}: ${error.message}\n`; }
}
document.body.dataset.failed = String(failed);
