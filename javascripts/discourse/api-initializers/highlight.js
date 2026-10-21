import { apiInitializer } from "discourse/lib/api";
import { i18n } from "discourse-i18n";
import { COLORS, decorateHighlights, formatSelection } from "../lib/highlight";
import richEditorExtension from "../lib/rich-editor-extension";

export default apiInitializer((api) => {
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
          [...COLORS, { name: "remove" }].map((color) => ({
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
