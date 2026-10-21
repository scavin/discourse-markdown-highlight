# Discourse Markdown Highlight

[![Discourse Theme](https://github.com/scavin/discourse-markdown-highlight/actions/workflows/discourse-theme.yml/badge.svg)](https://github.com/scavin/discourse-markdown-highlight/actions/workflows/discourse-theme.yml)

A Discourse **theme component**, tested on Discourse 2026.10. No server plugin, core patch, migration, or post rebake is required.

## Usage

Select text in the composer, click the highlighter button, then choose Default, Red, Orange, Yellow, Green, or Blue. Select highlighted text again to change its color or remove highlighting. In Markdown mode, a selection inside an existing highlight updates that entire highlight and preserves other emojis. Leading/trailing selection whitespace stays outside the markers; cross-line selections show a message and are left unchanged. An empty Markdown selection inserts a translated sample; an empty rich-editor selection changes the formatting for subsequent typing.

| Color | Stored Markdown |
| --- | --- |
| Default | `==text==` |
| Red | `==🔴text==` |
| Orange | `==🟠text==` |
| Yellow | `==🟡text==` |
| Green | `==🟢text==` |
| Blue | `==🔵text==` |

The six choices include Default (yellow). Emoji shortcode aliases, such as `==:large_green_circle:text==`, are accepted when Discourse has converted an emoji. Rich editing serializes colors using the Unicode markers above. Normal editor serialization can normalize whitespace and equivalent Markdown formatting.

Colors use [Obsidian's default palette](https://docs.obsidian.md/Reference/CSS%20variables/Foundations/Colors) with 40% opacity. Default and Yellow share Obsidian's default yellow highlight (`#ffd000`); the other colors use its light/dark extended palette.

Highlighting is inline: it does not span paragraphs, line breaks, code, embedded previews, or existing `<mark>` elements. Bold and links inside a highlight retain their behavior. Use inline code or fenced code to show literal `==text==`; Markdown escapes can be removed by the server before the component receives the HTML, so backslash escaping alone is not a reliable way to suppress this display-only enhancement.

## Rendering contract

- Original post text remains Markdown, including `==` and the color marker.
- Server `cooked` HTML is unchanged. Browser decoration creates fixed `<mark>` classes from already sanitized content, without inserting user HTML.
- Email, RSS, API, crawlers, JavaScript-disabled clients, and themes without this component display the original markers. API clients may implement their own parser.
- The component decorates normal topic posts and composer previews. Search excerpts, chat, and other special render surfaces are outside this initial scope.
- Disabling the component restores the normal unformatted display of the stored Markdown.

## Install

Upload the component ZIP in **Admin → Appearance → Themes & components**, then attach it to the desired themes. The ZIP has `about.json` at its root. There is no `plugin.rb`.

The repository can also be installed through Discourse’s Git repository installer. For a private repository, configure the appropriate repository credentials. Attach the installed component to the desired themes.

## Verify

Visit `/theme-qunit?id=COMPONENT_ID` on a development forum, replacing `COMPONENT_ID` with the installed component’s ID. Tests cover web rendering, code boundaries, color markers as text and emoji images, repeated decoration, Markdown selection replacement, rich-editor parsing and serialization, color changes, removal, and desktop/mobile menus.

For a manual visual check, use `/theme-qunit?id=COMPONENT_ID&filter=menu&visual=desktop` (or `visual=mobile`). The matching test waits with the actual composer menu open. Resume it from the browser console with `window.__finishHighlightReview()`.

Run Discourse's `bin/lint --fix themes/discourse-markdown-highlight` with the component copied into that directory. The 0.1.1 validation run passed 12 tests and 71 assertions, plus ESLint, Prettier, and Stylelint.

## 0.1.1

Reuses the core rich-editor mark input rule to preserve bold and links, replaces the backtracking matcher with a single pass, preserves ordinary emojis on recoloring, and handles selection whitespace and unsupported cross-line selections. No dependencies or server changes were added.

## Continuous integration

GitHub Actions uses [Discourse’s official theme workflow](https://github.com/discourse/.github/blob/v1/.github/workflows/discourse-theme.yml) on pushes to `main`, pull requests, and manual dispatch. It runs the official lint configurations, the component’s QUnit tests against the current Discourse `latest` branch, and English locale validation. No deployment or forum credentials are needed.

For local lint checks, run `pnpm install --frozen-lockfile`, then `pnpm lint:js`, `pnpm lint:css`, and `pnpm lint:prettier`. Runtime/editor tests require a Discourse development environment; the GitHub workflow provisions that environment automatically.
