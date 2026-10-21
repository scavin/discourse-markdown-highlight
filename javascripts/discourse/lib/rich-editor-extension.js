import { COLORS, findHighlights, readColor } from "./highlight.js";

function tokenText(token) {
  if (token.type === "text") {
    return token.content;
  }
  if (token.type === "emoji") {
    return token.attrGet("alt");
  }
  return token.nesting ? "" : "\0";
}

function parseInline(state, token) {
  const children = token.children || [];
  const text = children.map(tokenText).join("");
  const matches = findHighlights(text);
  if (!matches.length) {
    state.parseTokens(children);
    return true;
  }
  let offset = 0;
  for (const child of children) {
    const value = tokenText(child);
    const start = offset;
    offset += value.length;
    if (child.type !== "text" && child.type !== "emoji") {
      state.parseTokens([child]);
      continue;
    }
    let cursor = start;
    for (const match of matches) {
      if (match.end <= start || match.start >= offset) {
        continue;
      }
      if (cursor < match.start) {
        state.addText(value.slice(cursor - start, match.start - start));
      }
      const from = Math.max(start, match.from);
      const to = Math.min(offset, match.to);
      if (from < to) {
        state.openMark(
          state.schema.marks.appinn_highlight.create({ color: match.color })
        );
        if (child.type === "emoji") {
          state.parseTokens([child]);
        } else {
          state.addText(value.slice(from - start, to - start));
        }
        state.closeMark(state.schema.marks.appinn_highlight);
      }
      cursor = Math.min(offset, match.end);
    }
    if (cursor < offset) {
      if (child.type === "emoji") {
        state.parseTokens([child]);
      } else {
        state.addText(value.slice(cursor - start));
      }
    }
  }
  return true;
}

export default {
  markSpec: {
    appinn_highlight: {
      before: "link",
      attrs: { color: { default: "default" } },
      toDOM: (mark) => [
        "mark",
        { class: `appinn-highlight appinn-highlight--${mark.attrs.color}` },
        0,
      ],
      parseDOM: [
        {
          tag: "mark.appinn-highlight",
          getAttrs: (node) => ({
            color:
              COLORS.find((color) =>
                node.classList.contains(`appinn-highlight--${color.name}`)
              )?.name || "default",
          }),
        },
      ],
    },
  },
  parse: { inline: parseInline },
  serializeMark: {
    appinn_highlight: {
      open: (_state, mark) =>
        `==${COLORS.find((color) => color.name === mark.attrs.color)?.marker || ""}`,
      close: "==",
      mixable: true,
      expelEnclosingWhitespace: true,
    },
  },
  commands: ({ schema }) => ({
    setAppinnHighlight: (color) => (state, dispatch) => {
      const { from, to, empty, $from } = state.selection;
      if (
        $from.parent.type.spec.code ||
        state.storedMarks?.some((mark) => mark.type.name === "code")
      ) {
        return false;
      }
      const type = schema.marks.appinn_highlight;
      const tr = state.tr;
      if (empty) {
        if (color === "remove") {
          tr.removeStoredMark(type);
        } else {
          tr.addStoredMark(type.create({ color }));
        }
      } else {
        tr.removeMark(from, to, type);
        if (color !== "remove") {
          tr.addMark(from, to, type.create({ color }));
        }
      }
      dispatch?.(tr.scrollIntoView());
      return true;
    },
  }),
  inputRules: ({ schema, utils }) => {
    const rule = utils.markInputRule(
      /(?<![=\\])==([^=\n]+)==$/u,
      schema.marks.appinn_highlight,
      (match) => {
        const { color, length } = readColor(match[1]);
        return { color, match: [match[0], match[1].slice(length)] };
      }
    );
    const handler = rule.handler;
    rule.handler = (state, match, start, end) => {
      const [highlight] = findHighlights(match[0]);
      return highlight?.start === 0 && highlight.end === match[0].length
        ? handler(state, match, start, end)
        : null;
    };
    return rule;
  },
};
