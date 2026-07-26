# @kevinpeckham/woof-editor

Contenteditable markdown editor for Svelte 5, backed by [`@kevinpeckham/barkdown`](https://www.npmjs.com/package/@kevinpeckham/barkdown)'s round-trip codec. Real markdown editing in a WYSIWYG surface — every keystroke serializes back to the canonical markdown form the codec would produce from the DOM, so save-and-reload never drifts.

## Why

Traditional markdown WYSIWYGs (Toast UI, SimpleMDE, tiptap-markdown) round-trip lossily — they render markdown to DOM, edit in DOM, then serialize back through a separate path that can produce different markdown. Content drifts on save. This package sits on top of [`marked`](https://marked.js.org) + [`@kevinpeckham/barkdown`](https://www.npmjs.com/package/@kevinpeckham/barkdown), where the DOM → markdown serializer is property-tested to invert marked's parse: `toMarkdown(toDom(md)) === md` for every canonical input.

That guarantee lets you build:

- CMS editors that store canonical markdown in DB
- Portable content workflows (git repo, blob storage) that survive edit → serialize → parse → render round-trips
- Editors that don't accumulate cruft (extra whitespace, quote style drift, list marker changes) on every save

## Install

```sh
bun add @kevinpeckham/woof-editor
# or
npm i @kevinpeckham/woof-editor
```

Peer dependencies (install them if not already in your project):

- `svelte ^5.29`
- `marked ^18`
- `marked-footnote ^1.4`
- `@kevinpeckham/barkdown ^0`
- `isomorphic-dompurify ^2`

## Usage

```svelte
<script lang="ts">
  import { MarkdownEditor, MarkdownEditorState } from "@kevinpeckham/woof-editor";

  // Seed with initial markdown. The state class also primes the undo/redo
  // history with this value at index 0.
  const editor = new MarkdownEditorState({
    markdown: "# Hello\n\nEditable markdown, round-tripped through barkdown.",
  });

  async function save() {
    await fetch("/api/articles/123", {
      method: "PUT",
      body: JSON.stringify({ markdown: editor.markdownCurrent }),
    });
    editor.markAsSaved(); // flips `hasEdits` to false without re-seeding the DOM
  }
</script>

<MarkdownEditor {editor} />

<div style="margin-top: 1rem;">
  <button disabled={!editor.canUndo} onclick={() => editor.undo()}>Undo</button>
  <button disabled={!editor.canRedo} onclick={() => editor.redo()}>Redo</button>
  <button disabled={!editor.hasEdits} onclick={save}>Save</button>
</div>
```

The component owns a contenteditable surface. Every DOM mutation triggers a debounced (250ms default) serialization back to markdown via barkdown — `editor.markdownCurrent` is always the canonical form of what's on-screen.

## Component props

```ts
{
  editor: MarkdownEditorState; // required — see "State class API" below

  /** Applied to the contenteditable body, alongside the fallback `woof-editor-body` styles. Pass your site's article/typography class. */
  class?: string;

  /** DOMPurify schema overrides applied to seeded markdown-HTML and pasted HTML. See "Sanitization". */
  sanitize?: SanitizeSchema;

  /** Loads an OpenGraph-style preview for the link popover. No callback → no preview section. See "Link previews". */
  loadLinkPreview?: (url: string) => Promise<LinkPreview | null>;

  /** Editor-wide configuration. */
  config?: {
    /** Debounce (ms) for DOM-mutation → markdown-serialization. Default 250. */
    serializeDebounceMs?: number;
  };
}
```

`SanitizeSchema` and `LinkPreview` are exported from the package root alongside `MarkdownEditor` and `MarkdownEditorState`.

## What's in the box

- **`<MarkdownEditor>`** — the WYSIWYG surface itself. Handles content editing, click-to-open element menu on a per-block ⋮ gutter, selection menu on text highlight, right-click context menu, footnote refs + definitions, keyboard shortcuts.
- **`MarkdownEditorState`** — the state class the component binds to. Owns `markdownCurrent`, `markdownOriginal`, dirty-tracking (`hasEdits`), the sync flag (`isSyncingFromWysiwyg`), and undo/redo history.
- **DOM primitives** re-exported from `actions/dom` (`changeBlockType`, `findFootnoteRef`, `toggleInlineEmphasisOnSelection`, `insertSanitizedHtmlAtSelection`, ~20 more) — build custom toolbar buttons without touching the WYSIWYG's internals.

## State class API

```ts
class MarkdownEditorState {
  // Body content
  markdownCurrent: string;      // the live source of truth
  markdownOriginal: string;     // last-saved baseline
  readonly hasEdits: boolean;   // markdownCurrent !== markdownOriginal

  // Sync gate — the WYSIWYG sets this while it's serializing its own
  // mutation. Consumer state effects that would re-seed the editor from
  // an external source (LLM chat, article reload) should skip while true.
  isSyncingFromWysiwyg: boolean;

  // Undo/redo. Bounded at 100 snapshots. Dedupes head, truncates redo
  // tail on fresh edit.
  history: string[];
  historyIndex: number;
  isReplayingHistory: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;

  constructor(init?: { markdown?: string });

  hydrateMarkdown(md: string): void;   // full seed — resets history too
  markAsSaved(): void;                 // markdownOriginal = markdownCurrent
  reset(md: string): void;             // full reset (article navigation)

  pushHistory(md: string): void;       // called by WYSIWYG on every flush
  undo(): void;
  redo(): void;

  // Point-in-time snapshot, for save-side hashing / dirty comparisons.
  snapshot(): EditorSnapshot;          // { markdown: string; timestamp: number }
}
```

## Wrapping the state class for domain fields

The state class deliberately only owns the body markdown. Consumers that need title, slug, tags, publish state, etc. wrap `MarkdownEditorState` in their own state class:

```ts
import { MarkdownEditorState } from "@kevinpeckham/woof-editor";

export class ArticleEditor {
  editor: MarkdownEditorState;

  titleCurrent = $state("");
  titleOriginal = $state("");
  readonly titleHasEdits = $derived(this.titleCurrent !== this.titleOriginal);

  slugCurrent = $state("");
  // ... more domain fields

  readonly hasEdits = $derived(
    this.editor.hasEdits || this.titleHasEdits /* || this.slugHasEdits ... */,
  );

  constructor(init: { markdown: string; title: string; slug: string /* ... */ }) {
    this.editor = new MarkdownEditorState({ markdown: init.markdown });
    this.hydrate(init);
  }

  hydrate(init: { markdown: string; title: string; slug: string /* ... */ }) {
    this.editor.hydrateMarkdown(init.markdown);
    this.titleCurrent = this.titleOriginal = init.title;
    this.slugCurrent = init.slug;
    // ...
  }

  markAsSaved() {
    this.editor.markAsSaved();
    this.titleOriginal = this.titleCurrent;
    // ...
  }
}
```

Then in the component:

```svelte
<MarkdownEditor editor={articleEditor.editor} />
```

## Sanitization

Both content paths run through `isomorphic-dompurify` with one shared config: the markdown you seed the editor with (rendered to HTML via `marked`) AND anything pasted into the surface. Script tags and `on*` handlers are stripped either way, and `javascript:`, `vbscript:` and `data:` URLs are stripped from link `href`s.

> **Scope note on `data:`.** DOMPurify's default URI policy allows `data:` on *media* attributes — a pasted `<img src="data:image/png;base64,…">` is preserved, by design, so inline images survive a paste. Only anchor `href`s reject `data:`. If your threat model requires no data-URI content at all, pass `FORBID_TAGS: ["img"]` (or an `ALLOWED_TAGS` list without `img`).

Sanitization is **always on** and cannot be disabled; the `sanitize` prop only adjusts the allowlist. The default config uses DOMPurify's `USE_PROFILES: { html: true }` plus a small allowlist of footnote attributes (`data-footnote-ref`, `data-footnotes`, `id`) so `marked-footnote`'s markup survives. Pass a `sanitize` prop to widen or tighten it for your content:

```svelte
<MarkdownEditor
  {editor}
  sanitize={{
    ALLOWED_TAGS: ["p", "strong", "em", "a", "ul", "li"],
    FORBID_ATTR: ["style"],
  }}
/>
```

That example is a genuine tightening: because it provides `ALLOWED_TAGS`, the resulting config **replaces** the default `html` profile rather than adding to it — so headings, blockquotes, images, tables and everything else outside that six-tag list are stripped (their text content is kept). It does *not* supply `ALLOWED_ATTR`, so that dimension is pinned to the html profile's own attribute list (see below) — attributes stay exactly as tight as the default, they don't widen. Note this means the editor will no longer round-trip markdown it can't represent; only narrow the allowlist to tags your content actually uses.

`sanitize` accepts `ALLOWED_TAGS` / `ALLOWED_ATTR` / `FORBID_TAGS` / `FORBID_ATTR`, all optional:

- Providing **`ALLOWED_TAGS` and/or `ALLOWED_ATTR`** drops `USE_PROFILES` from the config. This is required, not incidental: DOMPurify resolves `USE_PROFILES` *after* those fields and overwrites them with the profile's own allowlists, so a config carrying both would make your allowlist a silent no-op.
- Providing **only one** of `ALLOWED_TAGS` / `ALLOWED_ATTR` pins the *other* dimension to the html profile's own list (vendored as `HTML_PROFILE_TAGS` / `HTML_PROFILE_ATTRS`) rather than leaving it unset — an unset field would otherwise fall back to DOMPurify's full built-in default (html ∪ svg ∪ svgFilters ∪ mathMl), which is *wider* than the html profile and would silently undo the tightening the other field asked for. So supplying one dimension never widens the one you didn't touch.
- Providing **only `FORBID_TAGS` / `FORBID_ATTR`** keeps the default `html` profile and subtracts from it.
- The footnote attributes stay allowed under any shape — they're applied via `ADD_ATTR`, which is additive rather than replacing.

Applies to both the seed path and the paste path.

To skip sanitization/rich-paste entirely for a given paste, right-click and choose **Paste as plain text** from the context menu — it reads the clipboard's plain-text flavor directly and inserts it as a text node. (The editor's own paste handler intercepts every paste event and prefers the HTML flavor whenever the clipboard offers one, so there's no browser-shortcut alternative this package can guarantee — the context menu entry is the reliable plain-paste path.)

## Styling & theming

The editor's chrome (menus, popovers, the gutter button) is fully self-contained, scoped CSS — no Tailwind or other utility-CSS dependency, and nothing to configure to get a working, legible UI out of the box. Theme it by overriding `--woof-*` custom properties on any ancestor element:

| Variable | Fallback | Used for |
|---|---|---|
| `--woof-menu-bg` | `#1e293b` | dark panel background (menus, footnote editor) |
| `--woof-menu-fg` | `#f8fafc` | dark panel text |
| `--woof-menu-border` | `rgb(255 255 255 / 0.1)` | dark panel borders + separators |
| `--woof-menu-hover` | `#334155` | menu item hover background |
| `--woof-accent` | `#3b82f6` | primary buttons, blockquote border, active states |
| `--woof-accent-soft` | `#93c5fd` | active/current submenu entry text |
| `--woof-danger` | `#fca5a5` | destructive menu items (dark panels) |
| `--woof-input-bg` | `#0f172a` | textarea background in footnote editor |
| `--woof-gutter-bg` | `#081526` | gutter button background |
| `--woof-gutter-fg` | `#ffffff` | gutter button text |
| `--woof-popover-bg` | `#ffffff` | light panel (link popover) background |
| `--woof-popover-fg` | `#0f172a` | light panel text |
| `--woof-popover-border` | `#cbd5e1` | light panel border |

Body typography (headings, paragraphs, lists, blockquote, links) is deliberately shipped at **zero CSS specificity** — wrapped in `:where()` — so it's a readable fallback, not something you have to fight. Pass your site's article/typography class via the `class` prop and it wins automatically:

```svelte
<div style="--woof-accent: #16a34a; --woof-menu-bg: #0b3d0b; padding-left: 48px;">
  <MarkdownEditor {editor} class="article-body" />
</div>
```

That example sets two custom properties on a wrapper (accent color, dark-menu background) and shows the required gutter clearance (next paragraph).

Stable class names you can target from outside:

- `woof-editor-body` — the contenteditable root; this is what the `class` prop gets appended to.
- `woof-gutter-btn` — the per-block ⋮-replacement button in the left gutter.
- `woof-menu-panel` — the dark chrome panel shared by the Element, Selection, and Context menus.
- `woof-link-panel` — the light link popover (a separate panel, not `woof-menu-panel`).
- `woof-fn-panel` — the footnote editor's dark panel (a separate panel from `woof-menu-panel`, though it shares the same `--woof-menu-*` tokens).

**Gutter clearance:** the block-type gutter button is positioned `left: -38px` relative to the editor's shell, so it renders outside the editor's own box. Give the editor's wrapper at least `padding-left: 38px` (48px is comfortable) or the button will be clipped or invisible.

## Link previews

Clicking a plain content link (`<a href>`, not a footnote ref) opens a popover with the URL and Edit/Open actions. To show a rich preview (image, title, description) above that, pass `loadLinkPreview` — a callback the popover calls with the href when it opens:

```svelte
<script lang="ts">
  import type { LinkPreview } from "@kevinpeckham/woof-editor";

  async function loadLinkPreview(url: string): Promise<LinkPreview | null> {
    const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
    if (!res.ok) return null;
    return res.json(); // { url, title, description, image?, siteName?, favicon? }
  }
</script>

<MarkdownEditor {editor} {loadLinkPreview} />
```

Without `loadLinkPreview`, the popover shows just the URL and its actions — no loading state, no fetch. (Earlier versions of this package fetched a hardcoded `/api/link-preview` endpoint; that's gone — see CHANGELOG.)

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| Cmd/Ctrl+Alt+0 | Convert current block to paragraph |
| Cmd/Ctrl+Alt+2 | Convert current block to Heading 2 |
| Cmd/Ctrl+Alt+3 | Convert current block to Heading 3 |
| Cmd/Ctrl+Alt+4 | Convert current block to Heading 4 |
| Cmd/Ctrl+Z | Undo |
| Cmd/Ctrl+Shift+Z | Redo |
| Ctrl+Y | Redo |

Undo/redo re-seed the whole surface from the state class's history (the same imperative `innerHTML` write used to load fresh markdown), rather than replaying DOM mutations — so the caret always returns to the start of the surface after an undo/redo, regardless of where it was. See Known limitations.

## Menus

The WYSIWYG surface auto-mounts five internal menus:

- **Element menu** — click the ⋮ button that appears next to the active block. Change block type (paragraph, headings, list, blockquote, code block), toggle bold/italic/strikethrough on the whole block, insert paragraph before/after, delete. The first `<h1>` in the container is protected — the "Delete" and "Change type" actions are disabled on it. That gates the "article title" convention if your consumer relies on it.
- **Selection menu** — appears when text is selected. Bold, italic, strikethrough, link, unlink, footnote.
- **Context menu** — right-click. Combines the element + selection actions, plus "Paste as plain text" (see Sanitization).
- **Link popover** — click any anchor to edit its URL, remove the link, or open it — plus an optional rich preview (see Link previews).
- **Footnote editor** — click the number of a footnote ref to edit its definition inline.

## What's NOT in this package

- **Metadata rail** — title, slug, tags, publish state, etc. Those are the consumer's domain; wrap `MarkdownEditorState` as shown above.
- **Save/load** — bring your own fetch call. The component only owns the body markdown.
- **Version tracking** — undo/redo is in-memory only. For persistent version history, snapshot `markdownCurrent` server-side on every save.
- **Attachment/image upload** — image insertion works via paste (rendered as `<img>` in the DOM, serialized as `![alt](url)`), but there's no built-in upload widget. Add your own paste-handler that intercepts image blobs and swaps them for uploaded URLs.
- **AI-assist** — none. Consumers can wire their own AI tools around the state class.

## Development

```sh
bun install
bun run storybook       # develop against interactive stories on :6006
bun run test            # vitest: node unit project (state class + DOM primitives) + a
                         # storybook project that runs 3 stories in real headless Chromium
bun run check           # svelte-check
bun run biome           # lint + format
bun run build           # svelte-package + publint
bun run build-storybook # static storybook site
bun run build:site      # prerendered static demo page (adapter-static), output in build/
bun run preview:site    # serve that build locally for a final check
```

`bun run test` runs both vitest projects defined in `vite.config.ts`: a node-only `unit` project (68 tests over the state class + DOM primitives) and a `storybook` project that drives the 4 stories in `stories/MarkdownEditor.stories.svelte` through Chromium via `@storybook/addon-vitest`'s `storybookTest` (72 tests total). Both run in CI.

## Known limitations

- **No image upload widget.** Image insertion works via paste (rendered as `<img>`, serialized as `![alt](url)`), but there's no built-in upload flow — pasted/dropped image blobs pass through as data/remote URLs as-is. This is the top candidate for v0.3: a paste-upload hook that intercepts image blobs and swaps them for uploaded URLs before insertion.
- **No per-menu Storybook stories.** The menus are context-dependent (need real block refs + editor state + positioning). Interact with them via the main `MarkdownEditor` story instead.
- **Footnote definitions are edited as plain text.** The footnote-editor popover is a `<textarea>` — inline formatting (bold, italic, links) inside a footnote is flattened to plain text on save.
- **Undo/redo restores content but not caret position.** Both re-seed the whole surface from a markdown snapshot (the same imperative `innerHTML` write used to load fresh markdown) rather than replaying DOM mutations, so the caret always lands at the start of the surface after an undo/redo.

## License

MIT. See [LICENSE](./LICENSE).

## Related

- [`@kevinpeckham/barkdown`](https://www.npmjs.com/package/@kevinpeckham/barkdown) — the underlying markdown ⇄ DOM codec. Property-tested round-trip on marked's canonical output.
- [`marked`](https://marked.js.org) — the markdown parser this codec inverts.
- [`marked-footnote`](https://www.npmjs.com/package/marked-footnote) — footnote support (peer dep).
