export const COLORS = [
  { name: "default", marker: "" },
  { name: "red", marker: "🔴" },
  { name: "orange", marker: "🟠" },
  { name: "yellow", marker: "🟡" },
  { name: "green", marker: "🟢" },
  { name: "blue", marker: "🔵" },
];

export function readColor(text, offset = 0) {
  for (const color of COLORS.slice(1)) {
    for (const marker of [
      color.marker,
      `:${color.name}_circle:`,
      `:large_${color.name}_circle:`,
    ]) {
      if (text.startsWith(marker, offset)) {
        return { color: color.name, length: marker.length };
      }
    }
  }
  return { color: "default", length: 0 };
}

export function findHighlights(text) {
  const matches = [];
  let opening = null;
  for (let index = 0; index < text.length; index++) {
    if (text[index] === "\n" || text[index] === "\r" || text[index] === "\0") {
      opening = null;
      continue;
    }
    if (text[index] !== "=" || text[index + 1] !== "=") {
      continue;
    }
    const start = index;
    while (text[index + 1] === "=") {
      index++;
    }
    if (index - start !== 1) {
      continue;
    }
    if (opening && start > opening.from && !/\s/.test(text[start - 1])) {
      matches.push({ ...opening, to: start, end: index + 1 });
      opening = null;
    } else if (!opening && text[start - 1] !== "\\") {
      const { color, length } = readColor(text, index + 1);
      const from = index + 1 + length;
      if (from < text.length && !/[\s=\0]/.test(text[from])) {
        opening = { start, from, color };
      }
    }
  }
  return matches;
}

export function formatSelection(event, color) {
  const selected = event.selected;
  let { start, end, value, pre, post } = selected;
  if (/[\r\n\0]/.test(value)) {
    return false;
  }
  const source = pre + value + post;
  const existing = findHighlights(source).find(
    (match) =>
      (match.start === start && match.end === end) ||
      (match.from <= start && match.to >= end)
  );
  if (existing) {
    value = source.slice(existing.from, existing.to);
    start = existing.start;
    end = existing.end;
  } else if (color === "remove") {
    return true;
  }
  if (!value) {
    value = event.sampleText;
  }
  const content = value.trim();
  if (!content) {
    return true;
  }
  const leading = value.slice(0, value.length - value.trimStart().length);
  const trailing = value.slice(value.trimEnd().length);
  const marker = COLORS.find((entry) => entry.name === color)?.marker || "";
  const head = color === "remove" ? "" : `==${marker}`;
  const tail = color === "remove" ? "" : "==";
  const replacement = `${leading}${head}${content}${tail}${trailing}`;
  Object.assign(selected, {
    start,
    end,
    value: source.slice(start, end),
    pre: source.slice(0, start),
    post: source.slice(end),
  });
  event.addText(replacement);
  event.selectText(start + leading.length + head.length, content.length);
  return true;
}

export function openHighlightMenu(event) {
  const input = event.target;
  if (
    !input.matches?.("textarea.d-editor-input") ||
    input.disabled ||
    input.readOnly ||
    event.button !== 0 ||
    event.detail > 1 ||
    event.shiftKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    input.selectionStart !== input.selectionEnd
  ) {
    return;
  }
  const position = input.selectionStart;
  const match = findHighlights(input.value).find(
    (highlight) =>
      position >= highlight.start && position <= highlight.start + 2
  );
  const button = input
    .closest(".d-editor-container")
    ?.querySelector("button.appinn-highlight");
  if (!match || !button) {
    return;
  }
  input.setSelectionRange(match.from, match.to);
  button.click();
}

const SKIP =
  "pre, code, kbd, script, style, textarea, mark, .onebox, .lightbox-wrapper";
const BLOCK = "p, li, h1, h2, h3, h4, h5, h6, td, th, summary, blockquote, div";

export function decorateHighlights(root) {
  const visit = (container) => {
    let parts = [];
    const flush = () => {
      if (parts.length) {
        decorateRun(parts);
        parts = [];
      }
    };
    const walk = (node) => {
      if (node.nodeType === 3) {
        parts.push({ node, text: node.data });
      } else if (node.nodeType === 1) {
        if (node.matches(SKIP) || node.tagName === "BR") {
          flush();
        } else if (node.matches("img.emoji")) {
          parts.push({ node, text: node.alt });
        } else if (node.matches(BLOCK)) {
          flush();
          visit(node);
        } else {
          [...node.childNodes].forEach(walk);
        }
      }
    };
    [...container.childNodes].forEach(walk);
    flush();
  };
  visit(root);
}

function decorateRun(parts) {
  let offset = 0;
  for (const part of parts) {
    part.start = offset;
    offset += part.text.length;
    part.end = offset;
  }
  const text = parts.map((part) => part.text).join("");
  const matches = findHighlights(text);
  for (const match of matches.reverse()) {
    // Work per text node so a highlight crossing an inline element never
    // splits or clones links, mentions, or their event handlers.
    for (const part of [...parts].reverse()) {
      if (part.end <= match.start || part.start >= match.end) {
        continue;
      }
      if (part.node.nodeType !== 3) {
        if (part.start >= match.start && part.end <= match.from) {
          part.node.remove();
        }
        continue;
      }
      const localStart = Math.max(match.start, part.start) - part.start;
      const localEnd = Math.min(match.end, part.end) - part.start;
      const contentStart = Math.max(match.from, part.start) - part.start;
      const contentEnd = Math.min(match.to, part.end) - part.start;
      const target = part.node.splitText(localStart);
      target.splitText(localEnd - localStart);
      if (contentStart < contentEnd) {
        const mark = document.createElement("mark");
        mark.className = `appinn-highlight appinn-highlight--${match.color}`;
        mark.textContent = part.text.slice(contentStart, contentEnd);
        target.replaceWith(mark);
      } else {
        target.remove();
      }
    }
  }
}
