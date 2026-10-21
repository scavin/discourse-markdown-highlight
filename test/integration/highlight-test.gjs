import { click, settled, triggerEvent } from "@ember/test-helpers";
import { module, test } from "qunit";
import { forceMobile } from "discourse/lib/mobile";
import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import { setupRichEditor } from "discourse/tests/helpers/rich-editor-helper";

module("Appinn highlight | rich editor", function (hooks) {
  setupRenderingTest(hooks);
  hooks.beforeEach(function () {
    this.siteSettings.rich_editor = true;
  });

  test("parses, recolors, removes, and preserves code while switching modes", async function (assert) {
    const [editor] = await setupRichEditor(
      assert,
      "==🟢绿色== 和 ==**加粗**== `==代码==`",
      { withMenus: true }
    );
    assert.dom(".ProseMirror mark.appinn-highlight--green").hasText("绿色");
    assert.dom(".ProseMirror strong").hasText("加粗");
    assert.dom(".ProseMirror code").hasText("==代码==");
    const view = editor.view;
    const selection = view.state.selection.constructor.create(
      view.state.doc,
      1,
      3
    );
    view.dispatch(view.state.tr.setSelection(selection));
    await click(".appinn-highlight");
    await click('[data-name="appinn-highlight-red"]');
    assert.dom(".ProseMirror mark.appinn-highlight--red").hasText("绿色");
    await settled();
    assert.true(editor.value.includes("==🔴绿色=="));
    await click(".composer-toggle-switch");
    await click(".composer-toggle-switch");
    assert.dom(".ProseMirror mark.appinn-highlight--red").hasText("绿色");
    editor.view.dispatch(
      editor.view.state.tr.setSelection(
        editor.view.state.selection.constructor.create(
          editor.view.state.doc,
          1,
          3
        )
      )
    );
    await click(".appinn-highlight");
    await click('[data-name="appinn-highlight-remove"]');
    assert.dom(".ProseMirror mark.appinn-highlight--red").doesNotExist();
  });
  for (const mobile of [false, true]) {
    test(`opening delimiter opens the color menu on ${mobile ? "mobile" : "desktop"}`, async function (assert) {
      if (mobile) {
        forceMobile();
      }
      const source = "before ==🟢word== after";
      const [editor] = await setupRichEditor(assert, source, {
        withMenus: true,
      });
      await click(".composer-toggle-switch");
      const input = document.querySelector("textarea.d-editor-input");
      input.focus();
      for (const position of [2, 12, 15]) {
        input.setSelectionRange(position, position);
        await triggerEvent(input, "click", { button: 0, detail: 1 });
        assert.dom('[data-name="appinn-highlight-blue"]').doesNotExist();
      }
      input.setSelectionRange(8, 8);
      await triggerEvent(input, "click", { button: 0, detail: 1 });
      assert.dom('[data-name="appinn-highlight-blue"]').exists();
      assert.strictEqual(editor.value, source, "opening does not edit text");
      await click('[data-name="appinn-highlight-blue"]');
      assert.strictEqual(editor.value, "before ==🔵word== after");
    });

    test(`menu and Markdown selection on ${mobile ? "mobile" : "desktop"}`, async function (assert) {
      if (mobile) {
        forceMobile();
      }
      const [editor] = await setupRichEditor(assert, "==🟢选中==", {
        withMenus: true,
      });
      await click(".composer-toggle-switch");
      const input = document.querySelector("textarea.d-editor-input");
      input.focus();
      input.setSelectionRange(4, 6);
      await click(".appinn-highlight");
      assert.dom('[data-name="appinn-highlight-blue"]').exists();
      assert.dom('[data-name="appinn-highlight-default"]').doesNotExist();
      assert.dom('[data-name="appinn-highlight-yellow"]').exists();
      if (
        new URLSearchParams(location.search).get("visual") ===
        (mobile ? "mobile" : "desktop")
      ) {
        window.__highlightReviewReady = true;
        await new Promise((resolve) => {
          window.__finishHighlightReview = resolve;
        });
      }
      await click('[data-name="appinn-highlight-blue"]');
      assert.strictEqual(editor.value, "==🔵选中==");
      await click(".appinn-highlight");
      await click('[data-name="appinn-highlight-remove"]');
      assert.strictEqual(editor.value, "选中");
    });
  }
  for (const [name, markdown, selector] of [
    ["bold", "==**word**=", "strong"],
    ["link", "==[word](https://example.com)=", 'a[href="https://example.com"]'],
  ]) {
    test(`typing the closing delimiter preserves ${name}`, async function (assert) {
      const [editor] = await setupRichEditor(assert, markdown);
      const view = editor.view;
      const position = view.state.doc.firstChild.nodeSize - 1;
      view.dispatch(
        view.state.tr.setSelection(
          view.state.selection.constructor.create(view.state.doc, position)
        )
      );
      const handled = view.someProp("handleTextInput", (handler) =>
        handler(view, position, position, "=")
      );
      await settled();
      assert.true(handled);
      assert.dom(`.ProseMirror ${selector}`).hasText("word");
      assert.dom(".ProseMirror mark.appinn-highlight--default").hasText("word");
    });
  }

  test("Markdown menu reports cross-line selections without editing", async function (assert) {
    const [editor] = await setupRichEditor(assert, "first\nsecond", {
      withMenus: true,
    });
    await click(".composer-toggle-switch");
    const input = document.querySelector("textarea.d-editor-input");
    const original = input.value;
    input.focus();
    input.setSelectionRange(0, input.value.length);
    await click(".appinn-highlight");
    await click('[data-name="appinn-highlight-green"]');
    assert.strictEqual(editor.value, original);
    const dialog = this.owner.lookup("service:dialog");
    assert.strictEqual(
      dialog.message,
      "Select text within a single line to highlight."
    );
    assert.true(dialog.show);
    dialog.cancel();
  });
});
