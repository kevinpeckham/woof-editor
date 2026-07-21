# @kevinpeckham/barkdown-editor

Contenteditable markdown editor for Svelte 5, backed by [`@kevinpeckham/barkdown`](https://www.npmjs.com/package/@kevinpeckham/barkdown)'s round-trip codec. Real markdown editing in a WYSIWYG surface — every keystroke serializes back to the canonical markdown form the codec would produce from the DOM, so save-and-reload never drifts.

> **Status:** `0.1.0-alpha.0` — scaffold only. The WYSIWYG surface and menus land in the `0.1.0-alpha.1`+ releases. Do not depend on this yet.

## Why

Traditional markdown WYSIWYGs (Toast UI, SimpleMDE, tiptap-markdown) round-trip lossily — they render markdown to DOM, edit in DOM, then serialize back through a separate path that can produce different markdown. Content drifts on save. This package sits on top of `marked` + `@kevinpeckham/barkdown`, where the DOM → markdown serializer is property-tested to invert marked's parse: `toMarkdown(toDom(md)) === md` for every canonical input.

That guarantee lets you build:

- CMS editors that store canonical markdown in DB
- Portable content workflows (git repo, blob storage) that survive edit → serialize → parse → render round-trips
- Editors that don't accumulate cruft (extra whitespace, quote style drift, list marker changes) with each save

## Install

```sh
bun add @kevinpeckham/barkdown-editor
# or
npm i @kevinpeckham/barkdown-editor
```

Peer dependencies:

- `svelte ^5`
- `marked ^18`
- `marked-footnote ^1.4`
- `@kevinpeckham/barkdown ^0`
- `isomorphic-dompurify ^2`

## Usage (sketch — final API lands in `0.1.0-alpha.2`)

```svelte
<script lang="ts">
  import { MarkdownEditor, MarkdownEditorState } from '@kevinpeckham/barkdown-editor';

  const editor = new MarkdownEditorState({ markdown: '# Hello\n\nWorld.' });

  function save() {
    // editor.markdownCurrent is the canonical markdown from the DOM
    fetch('/api/save', {
      method: 'POST',
      body: JSON.stringify({ markdown: editor.markdownCurrent }),
    });
    editor.markAsSaved();
  }
</script>

<MarkdownEditor {editor} />
<button onclick={save} disabled={!editor.hasEdits}>Save</button>
```

## Design principles

1. **Barkdown is the only source of truth for markdown-serialization.** The package never emits markdown by any other path.
2. **Consumer owns metadata.** Title, slug, tags, categories, publish state, etc. are the consumer's problem — the editor owns the body markdown and nothing else. Wrap `MarkdownEditorState` in your own state class for domain fields.
3. **Frontmatter-agnostic (default).** The default posture treats the whole markdown string as body. A future `{ frontmatterMode: 'extract' }` config will opt into parsing YAML frontmatter into a separate signal for consumers that want it.
4. **Menus stay tight.** Selection / element / context / link / footnote. No arbitrary menu customization in v0.1 — that's an escape hatch we'll add if consumers ask.
5. **Sanitized paste.** DOMPurify runs on every paste before insertion. Configurable schema, safe default.

## Development

```sh
bun install
bun run storybook      # develop components against stories
bun run test           # vitest (node + browser + storybook projects)
bun run check          # svelte-check
bun run biome          # lint + format
bun run build          # svelte-package + publint
```

## License

MIT. See [LICENSE](./LICENSE).

## Related

- [`@kevinpeckham/barkdown`](https://www.npmjs.com/package/@kevinpeckham/barkdown) — the underlying markdown ⇄ DOM codec. Property-tested round-trip on marked's canonical output.
- [`marked`](https://marked.js.org) — the markdown parser this codec inverts.
- [`marked-footnote`](https://www.npmjs.com/package/marked-footnote) — footnote support (peer dep).
