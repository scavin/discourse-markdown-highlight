import { registerDestructor } from "@ember/destroyable";
import { apiInitializer } from "discourse/lib/api";
import { i18n } from "discourse-i18n";
import {
  COLORS,
  decorateHighlights,
  formatSelection,
  openHighlightMenu,
} from "../lib/highlight.js";
import richEditorExtension from "../lib/rich-editor-extension.js";

export default apiInitializer((api) => {
  document.addEventListener("click", openHighlightMenu);
  registerDestructor(api.container, () =>
    document.removeEventListener("click", openHighlightMenu)
  );
  api.registerRichEditorExtension(richEditorExtension);
  api.decorateCookedElement((element) => decorateHighlights(element), {
    id: "appinn-markdown-highlight",
  });
  api.onToolbarCreate((toolbar) => {
    toolbar.addButton({
      id: "appinn-highlight",
      group: "fontStyles",
      icon: "highlighter",
      title: themePrefix("highlight.title"),
      popupMenu: {
        options: () =>
          [
            ...COLORS.filter((color) => color.name !== "default"),
            { name: "remove" },
          ].map((color) => ({
            name: `appinn-highlight-${color.name}`,
            icon: color.name === "remove" ? "eraser" : "circle",
            translatedLabel: i18n(themePrefix(`highlight.${color.name}`)),
            action: (event) => {
              if (event.commands?.setAppinnHighlight) {
                event.commands.setAppinnHighlight(color.name);
              } else {
                event.sampleText = i18n(themePrefix("highlight.sample"));
                if (!formatSelection(event, color.name)) {
                  api.container
                    .lookup("service:dialog")
                    .alert(i18n(themePrefix("highlight.single_line")));
                }
              }
            },
          })),
      },
    });
  });
});
