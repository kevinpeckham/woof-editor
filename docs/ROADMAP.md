# Roadmap

Follow-up candidates, mostly identified during the 0.2 hardening reviews and the
`$effect` audit. Ordered roughly by value; none are commitments.

## 0.3 candidates

### Editor internals

- **`lastEmitted` identity gate** — replace the internal use of the
  `isSyncingFromWysiwyg` microtask flag with a non-reactive "last serialized
  value" comparison in the seed effect. Removes all timing assumptions from the
  seed/flush choreography (the flag stays as public API for consumers).
- **Mount-scoped menu panels** — restructure the five menu/popover components as
  `{#if open}`-mounted panels with local state instead of always-mounted
  popovers driven by open-effects. Collapses ~8 `$effect` sites to ~3, removes
  the `FootnoteEditor` prop→state copy and `LinkPopover`'s `fetchedFor` memo
  (and its reopen-staleness), and is the natural place to adopt **`{@attach}`**
  (peer floor is already `^5.29.0`).
- **Shared menu stylesheet** — the dark-menu CSS is duplicated across four
  components (Svelte scoped styles can't share blocks). Evaluate shipping one
  `menus.css` the package imports, so panel styling edits land once.
- **Block-paste normalization** — pasting block-level HTML mid-paragraph can
  nest blocks invalidly (e.g. `<p>` in `<p>`); add a normalization pass +
  serialization tests for that shape.

### Features with confirmed consumer demand

- **Image paste-upload hook** — `onPasteImage?: (file: File) => Promise<string>`
  style hook so consumers can intercept pasted image blobs and swap in uploaded
  URLs (support-securelogix has Blob plumbing waiting on this).
- **Rich footnote editing** — footnote definitions are edited as plain text
  today; inline formatting inside a definition is flattened on save.
- **Link-preview polish** — retry after a failed `loadLinkPreview` (currently
  `fetchedFor` blocks re-fetch) and a request token so a stale in-flight
  preview can't land after the popover moved to a different link.

### Quality / tooling

- **Per-menu interaction stories** — grow the storybookTest suite beyond the
  current four stories: open each menu via play functions (element menu,
  selection toolbar, context menu, link popover, footnote editor) and assert
  rendered styling/behavior.
- **A11y pass on menus** — `menuitem` roles, arrow-key navigation, focus
  management; gutter button is mouse-only today.
- **Biome Svelte-warning override** — ~88 `noUnusedVariables`/`noUnusedImports`
  false positives on `.svelte` files bury real warnings; add a scoped override.
- **DOMPurify vendored-list drift check** — `src/lib/utils/sanitize.ts` vendors
  the html-profile tag/attr lists from dompurify@3.4.12; add an automated test
  that diffs them against the installed dompurify so version bumps can't
  silently desync. (Note: DOMPurify is non-functional under happy-dom — keep
  sanitizer behavioral tests in node/jsdom or a real browser.)

## Separate track

- **Demo site** — public playground + docs page for the package (hosting and
  repo location TBD).
