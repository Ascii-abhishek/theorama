export const escapeNoteHTML = (text) => String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Deliberately small Markdown dialect. Raw HTML, images and links are plain
// text, so notes can never load remote resources or execute pasted markup.
export function noteInline(text) {
  return text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g).map((part) => {
    if (/^`[^`]+`$/.test(part)) return `<code>${escapeNoteHTML(part.slice(1, -1))}</code>`;
    if (/^\*\*[^*]+\*\*$/.test(part)) return `<strong>${escapeNoteHTML(part.slice(2, -2))}</strong>`;
    if (/^\*[^*]+\*$/.test(part)) return `<em>${escapeNoteHTML(part.slice(1, -1))}</em>`;
    return escapeNoteHTML(part);
  }).join("");
}

export function renderNote(markdown) {
  let html = "", list = "";
  for (const line of markdown.split("\n")) {
    const bullet = line.match(/^([-*]|\d+\.) (.*)$/);
    const kind = bullet ? (/\d/.test(bullet[1]) ? "ol" : "ul") : "";
    if (list !== kind) {
      if (list) html += `</${list}>`;
      if (kind) html += `<${kind}>`;
      list = kind;
    }
    if (bullet) html += `<li>${noteInline(bullet[2]) || "<br>"}</li>`;
    else {
      const heading = line.match(/^(#{1,3}) (.*)$/);
      const quote = line.match(/^> (.*)$/);
      const tag = heading ? `h${heading[1].length}` : quote ? "blockquote" : "div";
      html += `<${tag}>${noteInline(heading ? heading[2] : quote ? quote[1] : line) || "<br>"}</${tag}>`;
    }
  }
  return html + (list ? `</${list}>` : "");
}

export function serializeNote(root) {
  function inline(node) {
    if (node.nodeType === 3) return node.textContent.replace(/\u200b/g, "").replace(/\u00a0/g, " ");
    const text = [...node.childNodes].map(inline).join("");
    if (/^(STRONG|B)$/.test(node.nodeName)) return text ? `**${text}**` : "";
    if (/^(EM|I)$/.test(node.nodeName)) return text ? `*${text}*` : "";
    if (node.nodeName === "CODE") return text ? `\`${text}\`` : "";
    if (node.nodeName === "BR") return "\n";
    return text;
  }
  function blocks(parent) {
    let result = "";
    for (const node of parent.childNodes) {
      if (/^(UL|OL)$/.test(node.nodeName)) {
        if (result && !result.endsWith("\n")) result += "\n";
        result += [...node.children].map((li, index) => `${node.nodeName === "UL" ? "-" : `${index + 1}.`} ${inline(li).replace(/\n$/, "")}`).join("\n") + "\n";
      } else if (/^(DIV|P|H[1-6]|BLOCKQUOTE)$/.test(node.nodeName)) {
        if (result && !result.endsWith("\n")) result += "\n";
        const prefix = /^H[1-6]$/.test(node.nodeName) ? `${"#".repeat(Math.min(3, Number(node.nodeName[1])))} ` : node.nodeName === "BLOCKQUOTE" ? "> " : "";
        const nested = [...node.children].some((el) => /^(DIV|P|UL|OL)$/.test(el.nodeName));
        result += prefix + (nested ? blocks(node) : inline(node).replace(/\n$/, "")) + "\n";
      } else result += inline(node);
    }
    return result.replace(/\n$/, "");
  }
  return blocks(root);
}

export function formatNoteInput(editor) {
  const selection = window.getSelection();
  if (!selection?.isCollapsed || !selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  const node = range.startContainer;
  if (node.nodeType !== 3 || !editor.contains(node)) return;
  const before = node.textContent.slice(0, range.startOffset);
  const block = node.parentElement.closest("div,p,h1,h2,h3,li,blockquote");
  const marker = before.match(/^(#{1,3}|>|-|\*|1\.)[ \u00a0]$/);
  const blockPrefix = range.cloneRange();
  blockPrefix.selectNodeContents(block || editor);
  blockPrefix.setEnd(node, range.startOffset);
  if (marker && (block === editor || block?.parentElement === editor) && blockPrefix.toString() === marker[0]) {
    const command = ["-", "*", "1."].includes(marker[1]);
    range.setStart(node, 0);
    selection.removeAllRanges(); selection.addRange(range);
    document.execCommand("delete");
    if (command) document.execCommand(marker[1] === "1." ? "insertOrderedList" : "insertUnorderedList");
    else document.execCommand("formatBlock", false, marker[1] === ">" ? "blockquote" : `h${marker[1].length}`);
    return;
  }
  if (node.parentElement.closest("strong,b,em,i,code")) return;
  const match = before.match(/(?:\*\*[^*\n]+\*\*|(?<!\*)\*[^*\n]+\*|`[^`\n]+`)$/);
  if (!match) return;
  // The zero-width text node lets the next keystroke leave the formatting.
  range.setStart(node, before.length - match[0].length);
  selection.removeAllRanges(); selection.addRange(range);
  document.execCommand("insertHTML", false, noteInline(match[0]) + "&#8203;");
}
