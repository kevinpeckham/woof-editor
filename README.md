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

- `svelte ^5`
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

The component owns a contenteditable surface. Every DOM mutation triggers a debounced (250ms) serialization back to markdown via barkdown — `editor.markdownCurrent` is always the canonical form of what's on-screen.

## What's in the box

- **`<MarkdownEditor>`** — the WYSIWYG surface itself. Handles content editing, click-to-open element menu on a per-block ⋮ gutter, selection menu on text highlight, right-click context menu, footnote refs + definitions, keyboard shortcuts.
- **`MarkdownEditorState`** — the state class the component binds to. Owns `markdownCurrent`, `markdownOriginal`, dirty-tracking (`hasEdits`), the sync flag (`isSyncingFromWysiwyg`), and undo/redo history.
- **DOM primitives** re-exported from `actions/dom` (`changeBlockType`, `findFootnoteRef`, `toggleInlineEmphasisOnSelection`, ~20 more) — build custom toolbar buttons without touching the WYSIWYG's internals.

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

Pasted HTML is scrubbed via `isomorphic-dompurify` before insertion — script tags, `on*` handlers, and dangerous URL schemes (`javascript:`, `vbscript:`, `data:`) are stripped. The default sanitize allowlist is deliberately narrow; if you need to widen it for your content, open an issue.

## Menus

The WYSIWYG surface auto-mounts five internal menus:

- **Element menu** — click the ⋮ button that appears next to the active block. Change block type (paragraph, headings, list, blockquote), toggle bold/italic/strikethrough on the whole block, insert paragraph before/after, delete. The first `<h1>` in the container is protected — the "Delete" and "Change type" actions are disabled on it. That gates the "article title" convention if your consumer relies on it.
- **Selection menu** — appears when text is selected. Bold, italic, strikethrough, link, unlink, footnote.
- **Context menu** — right-click. Combines the element + selection actions.
- **Link popover** — click any anchor to edit its URL or remove the link.
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
bun run test            # vitest node project — state class + DOM primitives
bun run check           # svelte-check
bun run biome           # lint + format
bun run build           # svelte-package + publint
bun run build-storybook # static storybook site
```

## Known limitations (v0.1.0)

- **Vitest browser project is not enabled.** Two attempts hit a tester-iframe hang; needs dedicated investigation (candidates: `@web/test-runner`, direct chrome-devtools-protocol). Component-level pure-logic tests are covered via the state class + DOM primitive test suites (36 tests, all node-runnable).
- **No per-menu Storybook stories.** The menus are context-dependent (need real block refs + editor state + positioning). Interact with them via the main `MarkdownEditor` story instead.
- **Sanitization schema is not configurable yet.** Ships with a sensible default; a future minor will accept a `sanitize` prop for consumers with unusual requirements.

## License

MIT. See [LICENSE](./LICENSE).

## Related

- [`@kevinpeckham/barkdown`](https://www.npmjs.com/package/@kevinpeckham/barkdown) — the underlying markdown ⇄ DOM codec. Property-tested round-trip on marked's canonical output.
- [`marked`](https://marked.js.org) — the markdown parser this codec inverts.
- [`marked-footnote`](https://www.npmjs.com/package/marked-footnote) — footnote support (peer dep).
