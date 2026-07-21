# Changelog

Notable changes to `@kevinpeckham/woof-editor`. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Pre-1.0, breaking changes may land in minor versions.

## [Unreleased]

## [0.1.0-alpha.3] — 2026-07-21 — E3: WYSIWYG surface + menus

The real WYSIWYG lands. Ports `BlogWysiwyg.svelte` (881 lines) and the four menus + footnote editor (983 lines combined) from `lightning-jar/replicator`, plus a small viewport-fit utility. Blog-editor state coupling swapped for the generic `MarkdownEditorState`.

### Added

- **`src/lib/MarkdownEditor.svelte`** — contenteditable WYSIWYG surface (~880 lines). Barkdown ⇄ marked round-trip, 250ms debounced serialization on every DOM mutation, seed-effect gated on `editor.isSyncingFromWysiwyg`, gutter "⋮" element menu, keyboard-shortcut wiring, DOMPurify paste sanitization, footnote refs + definitions in marked-footnote's canonical shape.
- **`src/lib/menus/ElementMenu.svelte`** — block-level menu (change type, toggle bold/italic/del wraps, add paragraph before/after, delete). Gated when the block is the first-h1 (the "article title" convention consumers may use).
- **`src/lib/menus/SelectionMenu.svelte`** — inline formatting toolbar (bold, italic, strikethrough, link, unlink, footnote).
- **`src/lib/menus/ContextMenu.svelte`** — right-click menu combining block + selection actions.
- **`src/lib/menus/LinkPopover.svelte`** — link-editing popover (edit URL, remove link, open in new tab preview).
- **`src/lib/menus/FootnoteEditor.svelte`** — inline footnote-definition editor.
- **`src/lib/utils/fitPopoverToViewport.ts`** — viewport-clamping helper used by every menu to keep popovers on-screen.
- **`MarkdownEditorState` extended** with undo/redo history (`history`, `historyIndex`, `isReplayingHistory`, `canUndo`, `canRedo`, `pushHistory()`, `resetHistory()`, `undo()`, `redo()`). Bounded at 100 snapshots, dedupes head, truncates redo tail on fresh edit.

### Changed

- Component/type renames applied verbatim across the port:
  - `BlogWysiwyg` → `MarkdownEditor`
  - `BlogWysiwygElementMenu` → `ElementMenu` (and the other four menu components)
  - `BlogEditor` (type) → `MarkdownEditorState`
  - `blogEditor` (prop / variable) → `editor`
  - `firstBlogTitleH1` → `firstH1`, `isBlogTitleH1` → `isFirstH1`
- `hydrateMarkdown()` now also primes the history stack (index 0 = loaded value), so the author's first edit is the first undoable step.

### Deferred

- **Vitest browser project still not enabled** — E1 hit a tester-iframe hang, E3 tried again after the sveltekit()→svelte() swap and hit the same hang. The state class + dom-action tests all run cleanly in the node project (36/36 pass). Real browser tests for the WYSIWYG surface land in a follow-up alpha once the iframe hang is chased down (candidates: `@web/test-runner`, or attaching chrome-devtools-protocol directly to avoid vitest's iframe layer).
- Storybook stories per menu — currently just the placeholder story from E1. Real per-menu stories land alongside the browser tests.
- README API examples — the stub in README.md still shows the alpha.0 shape. Full API docs land in E4 with the stable 0.1.0.

## [0.1.0-alpha.2] — 2026-07-21 — E2: DOM primitives

Real code lands. Ports the ~779-line `blogWysiwygActions.ts` module from `lightning-jar/replicator` into this package as `src/lib/actions/dom.ts`, with the full test suite ported to vitest + happy-dom. Zero framework dependencies; consumers who want to build custom toolbar buttons or automations can import the primitives directly.

### Added

- **`src/lib/actions/dom.ts`** — 22 exported functions + 1 constant, all pure DOM operations on a contenteditable-root + block pair:
  - **Block navigation:** `findNearestBlock`
  - **Block editing:** `changeBlockType`, `toggleBlockWrap`, `removeBlock`, `insertParagraph`, `CONVERTIBLE_TAGS_LIST`
  - **Heading detection:** `isHeadingBlock`
  - **Title conventions:** `firstH1`, `isFirstH1` (renamed from Replicator's `firstBlogTitleH1` / `isBlogTitleH1` — generic naming for the first-h1-as-article-title pattern)
  - **Caret:** `placeCaretAtStart`
  - **Footnotes:** `findFootnoteRef`, `findFootnoteDefinition`, `parseFootnoteNum`, `removeFootnote`, `pruneOrphanFootnotes`, `getFootnoteText`, `setFootnoteText`, `insertFootnote` — round-trips through marked-footnote's canonical GFM shape (`<sup><a id="footnote-ref-N">…</a></sup>` + `<li id="footnote-N">…</li>`) and the legacy attribute-on-sup shape
  - **Inline formatting:** `toggleInlineEmphasisOnSelection` (strong/em/del), `insertPlainTextAtSelection`, `applyLinkToSelection`, `removeLinkFromSelection` — replace deprecated `execCommand("bold"|"italic"|"insertText"|"createLink")` with real semantic tags
- All 22 functions re-exported from `src/lib/index.ts` — advanced consumers can bypass the WYSIWYG surface entirely.
- **`src/lib/actions/dom.test.ts`** — 30 tests, ported from Replicator's `tests/lib/utils/blogWysiwygActions.test.ts`. Uses per-file `@vitest-environment happy-dom` marker so the rest of the node vitest project keeps running in pure node env.
- New devDep: `happy-dom ^20.11.0` (matches template pin).

### Changed

- **Renamed from Replicator's blog-specific names:** `firstBlogTitleH1` → `firstH1`; `isBlogTitleH1` → `isFirstH1`. Semantics unchanged (first direct-child H1 in the container = article title). Docs genericized to drop blog-editor-specific references.

## [0.1.0-alpha.1] — 2026-07-21 — OIDC publish

Same package contents as `0.1.0-alpha.0` — this release exists solely to smoke-test the new publish path.

### Changed

- **`ci`: publish now uses npm's OIDC-based Trusted Publisher flow instead of a long-lived NPM_TOKEN.** The published tarball also gets `--provenance` — a SLSA-style attestation linking the artifact to this exact commit SHA + workflow run. Shows up as a "verified provenance" badge on the npm package page. Kevin registered the trust config on npm.com against `kevinpeckham/woof-editor` + `publish.yml`; the `NPM_TOKEN` GitHub secret is now unused (safe to delete once this publish confirms OIDC works).

## [0.1.0-alpha.0] — 2026-07-21 — E1 scaffold (first publish)

### Changed

- **Renamed from `barkdown-editor` to `woof-editor`** — pre-publish rename before v0.1.0-alpha.0 hits npm. Two `barkdown-editor` GitHub projects already existed (Vue + Avalonia UI variants); `woof-editor` sidesteps the collision and coheres with the barkdown codec on a whimsical dog-theme. Package name: `@kevinpeckham/woof-editor`. Repo: `github.com/kevinpeckham/woof-editor`. Nothing was published under the old name.

## [0.1.0-alpha.0] — 2026-07-21 — E1 scaffold

Initial scaffold. Package is publishable to prove the pipeline; API surface is stubs. Real implementations land in subsequent `0.1.0-alpha.*` releases.

### Added

- Repository, package.json, tsconfig, svelte.config, vite.config, biome, fallow config, storybook config, CI (typecheck + biome + vitest + package build), publish workflow (tag-driven).
- `src/lib/index.ts` public API surface with stub exports (`MarkdownEditor`, `MarkdownEditorState`, type re-exports).
- `MarkdownEditorState` shape — 6 unit tests all passing.
- Storybook story proves the SB pipeline scaffolds.
- MIT license, README, CHANGELOG.

### Known deferred (arrives in E3)

- **Vitest browser project** — enabled in initial scaffold but the tester-iframe hangs when `sveltekit()` intercepts vite's routing OR when the `@storybook/addon-vitest/vitest-plugin` fails to resolve `@storybook/builder-vite`. E1 ships node-only vitest (`src/**/*.{test,spec}.{js,ts}` — 6/6 pass); `src/**/*.svelte.{test,spec}.{js,ts}` files are excluded until E3, when the WYSIWYG surface actually needs browser tests. At that point we either fix the routing intercept (probably by keeping `svelte()` alone and dropping `sveltekit()`) or switch to `@web/test-runner` / `@testing-library/svelte` + jsdom for the render assertions we can express there.
- **Storybook-as-vitest-tests** — same reason. Stories build + run standalone via `bun run storybook`; running them AS vitest tests is a nice-to-have that requires resolving `@storybook/builder-vite` correctly on 10.5.x.
- **Varlock** — no env vars in this package today. If we add any (analytics, secret injection for the storybook demo site, etc.) we'll use `varlock` + `@varlock/vite-integration` to match the LJ house standard rather than raw `process.env`.

### Coming next

- **0.1.0-alpha.1 (E2):** port `blogWysiwygActions.ts` from `lightning-jar/replicator` as `src/lib/actions/dom.ts` (pure DOM primitives — `changeBlockType`, `findFootnoteRef`, `pruneOrphanFootnotes`, etc.) with vitest coverage.
- **0.1.0-alpha.2 (E3):** port the WYSIWYG surface + 4 menus (element, selection, context, link) + optional footnote editor. Swap `blogEditor: BlogEditor` prop coupling for the generic `editor: MarkdownEditorState`.
- **0.1.0 (E4):** Storybook stories per menu, README with full API, publish to npm.
