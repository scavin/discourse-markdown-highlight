import { setupTest } from "ember-qunit";
import { module, test } from "qunit";
import { cook } from "discourse/lib/text";
import {
  decorateHighlights,
  findHighlights,
  formatSelection,
  openHighlightMenu,
} from "../../discourse/lib/highlight.js";

module("Appinn highlight | webpage rendering", function (hooks) {
  setupTest(hooks);

  test("delimiter shortcut finds a separate composer footer toolbar", function (assert) {
    const fixture = document.createElement("div");
    fixture.innerHTML =
      '<div class="reply-area"><div class="d-editor-container"><textarea class="d-editor-input"></textarea></div><footer><button class="appinn-highlight"></button></footer></div><div class="reply-area"><button class="appinn-highlight"></button></div>';
    const input = fixture.querySelector("textarea");
    input.value = "==🟢word==";
    input.setSelectionRange(1, 1);
    let opened = 0;
    fixture.querySelector("button").addEventListener("click", () => opened++);
    fixture
      .querySelectorAll("button")[1]
      .addEventListener("click", () => assert.step("wrong composer"));
    openHighlightMenu({ target: input, button: 0, detail: 1 });
    assert.strictEqual(opened, 1);
    assert.strictEqual(
      input.value.slice(input.selectionStart, input.selectionEnd),
      "word"
    );
    assert.strictEqual(input.value, "==🟢word==");
    assert.verifySteps([]);
  });

  test("colors, inline formatting, repeated decoration, and code boundaries", async function (assert) {
    const raw =
      "==普通== ==🔴红== ==🟠橙== ==🟡黄== ==🟢绿== ==🔵蓝==\n\n==**加粗** 和 [链接](https://example.com)==\n\n`==代码==`\n\n```\n==代码块==\n```\n\na == b\n\n==未闭合\n\n==跨段\n\n不可==";
    const root = document.createElement("div");
    root.innerHTML = (await cook(raw)).toString();
    decorateHighlights(root);
    assert.strictEqual(root.querySelectorAll("mark").length, 9);
    for (const color of [
      "default",
      "red",
      "orange",
      "yellow",
      "green",
      "blue",
    ]) {
      assert.true(
        Boolean(root.querySelector(`.appinn-highlight--${color}`)),
        color
      );
    }
    assert.strictEqual(root.querySelector("strong mark").textContent, "加粗");
    assert.strictEqual(root.querySelector("a").href, "https://example.com/");
    assert.strictEqual(root.querySelector("a mark").textContent, "链接");
    assert.strictEqual(root.querySelector("code").textContent, "==代码==");
    const once = root.innerHTML;
    decorateHighlights(root);
    assert.strictEqual(root.innerHTML, once, "decoration is idempotent");
    assert.true(root.textContent.includes("a == b"));
    assert.true(root.textContent.includes("==未闭合"));
    assert.true(root.textContent.includes("==跨段"));
  });

  test("emoji image color markers and safe content", function (assert) {
    const root = document.createElement("div");
    root.innerHTML =
      '<p>==<img class="emoji" alt=":green_circle:">绿色== &lt;script&gt; ==安全==</p>';
    decorateHighlights(root);
    assert.strictEqual(
      root.querySelector(".appinn-highlight--green").textContent,
      "绿色"
    );
    assert.strictEqual(root.querySelector("img"), null);
    assert.strictEqual(root.querySelector("script"), null);
    assert.true(root.textContent.includes("<script>"));
  });

  test("plain text selection changes color without nesting", function (assert) {
    let text = "前 ==🟢选中== 后";
    let start = 6;
    let end = 8;
    const makeEvent = () => {
      const selected = {
        start,
        end,
        value: text.slice(start, end),
        pre: text.slice(0, start),
        post: text.slice(end),
      };
      return {
        selected,
        selectText(from, length) {
          start = from;
          end = from + length;
        },
        addText(value) {
          text =
            text.slice(0, selected.start) + value + text.slice(selected.end);
        },
      };
    };
    formatSelection(makeEvent(), "red");
    assert.strictEqual(text, "前 ==🔴选中== 后");
    formatSelection(makeEvent(), "remove");
    assert.strictEqual(text, "前 选中 后");
    assert.strictEqual(findHighlights("==== == == ==未闭合 a == b").length, 0);
  });
  test("recoloring preserves ordinary emojis and whitespace", function (assert) {
    const cases = [
      {
        source: "==:warning:文字==",
        start: 11,
        end: 13,
        color: "green",
        expected: "==🟢:warning:文字==",
      },
      {
        source: "==😀文字==",
        start: 4,
        end: 6,
        color: "blue",
        expected: "==🔵😀文字==",
      },
      {
        source: " 两端空格 ",
        start: 0,
        end: 6,
        color: "green",
        expected: " ==🟢两端空格== ",
      },
      { source: "  ", start: 0, end: 2, color: "green", expected: "  " },
      {
        source: "==🟢:warning:文字==",
        start: 13,
        end: 15,
        color: "remove",
        expected: ":warning:文字",
      },
    ];
    for (const entry of cases) {
      let text = entry.source;
      const selected = {
        start: entry.start,
        end: entry.end,
        value: text.slice(entry.start, entry.end),
        pre: text.slice(0, entry.start),
        post: text.slice(entry.end),
      };
      const result = formatSelection(
        {
          selected,
          addText(value) {
            text =
              text.slice(0, selected.start) + value + text.slice(selected.end);
          },
          selectText() {},
        },
        entry.color
      );
      assert.true(result);
      assert.strictEqual(text, entry.expected, entry.source);
    }
  });

  test("cross-line selections leave the source and selection untouched", function (assert) {
    for (const value of [
      "第一行\n第二行",
      "第一行\r第二行",
      "第一行\r\n第二行",
    ]) {
      const selected = {
        start: 0,
        end: value.length,
        value,
        pre: "",
        post: "",
      };
      const before = { ...selected };
      let modified = false;
      const result = formatSelection(
        {
          selected,
          addText() {
            modified = true;
          },
          selectText() {
            modified = true;
          },
        },
        "green"
      );
      assert.false(result);
      assert.false(modified);
      assert.deepEqual(selected, before);
    }
  });

  test("malformed repeated delimiters and line boundaries", function (assert) {
    for (const value of [
      "== ".repeat(16000),
      "==x ".repeat(16000),
      "====",
      "\\==escaped==",
      "==first\nsecond==",
    ]) {
      assert.deepEqual(findHighlights(value), []);
    }
    const prefix = "== ".repeat(16000);
    const result = findHighlights(prefix + "==🟢有效==");
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].start, prefix.length);
    assert.strictEqual(result[0].color, "green");
  });
});
