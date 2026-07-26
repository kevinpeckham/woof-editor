# Changelog

Notable changes to `@kevinpeckham/woof-editor`. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Pre-1.0, breaking changes may land in minor versions.

## [Unreleased]

Hardening pass aimed at making the package genuinely consumable outside `lightning-jar/replicator`: real paste sanitization, a configurable sanitize schema, pluggable link previews (no more hardcoded endpoint), keyboard undo/redo, API-honesty fixes, fully self-contained styling, and the template-proven browser-test/tooling setup.

### Added

- **Paste sanitization.** Pasting into the editor now runs rich HTML through the same DOMPurify config used to seed the surface from markdown — script tags and `on*` handlers are stripped either way, and `javascript:`/`vbscript:`/`data:` URLs are stripped from link `href`s. (Per DOMPurify's default URI policy, `data:` remains permitted on media attributes such as `img src`; see README → Sanitization.) Plain-text paste falls back to a text-node insert. `insertSanitizedHtmlAtSelection(html, container): boolean` is exported from `actions/dom` / the package root for consumers building custom paste handling.
- **`sanitize` prop** on `<MarkdownEditor>` — accepts a `SanitizeSchema` (`ALLOWED_TAGS` / `ALLOWED_ATTR` / `FORBID_TAGS` / `FORBID_ATTR`, all optional) to widen or tighten the DOMPurify config for both the seed path and the paste path.
- **`loadLinkPreview` prop** on `<MarkdownEditor>` — `(url: string) => Promise<LinkPreview | null>`, threaded through to `LinkPopover`. Without it, the popover shows just the URL + actions (no loading state, no fetch). New exported type `LinkPreview` (`url`, `title?`, `description?`, `image?`, `siteName?`, `favicon?`).
- **Keyboard undo/redo.** Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z, and Ctrl+Y now route to `MarkdownEditorState`'s history (`editor.undo()` / `editor.redo()`) instead of the browser's native contenteditable undo, which was broken by the component's imperative `innerHTML` re-seeds.
- **`MarkdownEditorState.snapshot(): EditorSnapshot`** — point-in-time `{ markdown, timestamp }` snapshot for save-side hashing / dirty comparisons. (`EditorSnapshot`'s docblock referenced this method before it existed.)
- **"Code block" block type.** `changeBlockType(block, "pre")` now wraps content in `<pre><code>` (matching the shape `marked` emits for fenced code blocks, so it round-trips through the codec), and converting *away* from a `pre` correctly unwraps the inner `<code>` instead of leaking it into the new block. `CONVERTIBLE_TAGS_LIST` gains `{ label: "Code block", tag: "pre" }`, surfaced in the Element/Context menu type submenus.
- **Self-contained styling.** All chrome (menus, popovers, the gutter button) now ships as scoped `<style>` CSS themable via `--woof-*` custom properties, with no utility-CSS dependency anywhere in `src/lib/**`. New stable class names: `woof-editor-body`, `woof-shell`, `woof-gutter-btn`, `woof-menu-backdrop`, `woof-menu-panel`, `woof-menu-item`, `woof-menu-hr`, `woof-menu-note`, `woof-submenu`, `woof-toolbar`, `woof-toolbar-btn`, `woof-toolbar-divider`, `woof-fn-panel`, `woof-fn-textarea`, `woof-btn`, `woof-btn-primary`, `woof-btn-danger`, `woof-link-panel`. New `class` prop on `<MarkdownEditor>` for passing your site's article/typography class onto the contenteditable body.
- **`bun run test` now includes real-browser coverage.** A `storybook` vitest project (via `@storybook/addon-vitest`'s `storybookTest`) runs 4 stories from `stories/MarkdownEditor.stories.svelte` through headless Chromium, alongside the node `unit` project (68 tests as of this writing — 72 tests total via `bun run test`). Both run in CI.
- Tooling parity with `sk-app-template`: Biome bumped to 2.5.5, CI job timeouts added, `SECURITY.md`, Renovate config.

### Changed

- **BREAKING: `loadLinkPreview` replaces the hardcoded `/api/link-preview` fetch.** `LinkPopover` no longer fetches any endpoint on its own — real consumers outside replicator (where that route doesn't exist) previously got a 404 on every link click. Preview loading is now entirely consumer-provided.
- **BREAKING: hardcoded `blog-wysiwyg` / `article-body` classes are gone.** The contenteditable root's stable class is now `woof-editor-body`; pass your own typography class via the new `class` prop instead of relying on the old fixed class names. Body typography (headings, paragraphs, lists, blockquote, links) moved to zero-specificity `:where()` fallbacks so any consumer rule wins without `!important`.
- **BREAKING: minimum supported Svelte raised to `^5.29.0`.** The peer dependency floor moves from `^5` to `^5.29.0` to permit `{@attach}` attachments in upcoming releases; no attachments are used yet in this release.
- The 250ms debounce between a DOM mutation and its markdown serialization is now configurable via `config.serializeDebounceMs` (default remains 250) instead of a hardcoded literal.
- Browser-test architecture: dropped `vitest-browser-svelte` direct-render in favor of the `@storybook/addon-vitest` `storybookTest` architecture (see Removed).
- **`$effect` ladder cleanups.** `MarkdownEditor` drops two of its three effects: the `document` `selectionchange` + container `scroll` listeners become `<svelte:document onselectionchange>` and an `onscroll` attribute (which also deletes a latent teardown bug — the old cleanup re-read the reactive `containerRef` instead of the element the listener was bound to), and the unmount-flush effect becomes `onDestroy`. Both are behaviour-preserving. The remaining `$effect` census is now documented per site with the *specific* residual smell and its planned 0.3 replacement, rather than a blanket "audited" note.

### Fixed

- **Keyboard undo/redo silently did nothing inside the serialize debounce window.** Pressing Cmd/Ctrl+Z within 250ms of a keystroke forced a synchronous flush whose `isSyncingFromWysiwyg = true` was still set when Svelte flushed effects, so the seed effect skipped the undo's re-seed: the history pointer and markdown moved but the DOM never reverted — undo looked dead in exactly the "typo → instant Cmd+Z" case. The flag is now cleared synchronously before the replay, gated on `canUndo`/`canRedo` so a no-op undo can't re-seed (and clobber the caret) from text just serialized out of the DOM. Covered by a new Chromium play-function regression test.
- **Menus flipped upward by viewport clamping stayed flipped after their type submenu collapsed.** `ElementMenu` / `ContextMenu` / `SelectionMenu` re-clamped only when the submenu *opened*; they now re-clamp on both transitions.
- **`sanitize`'s `ALLOWED_TAGS` / `ALLOWED_ATTR` were silent no-ops.** The merged config always kept `USE_PROFILES: { html: true }`, and DOMPurify resolves the profile *after* those two fields and overwrites them — so a consumer passing `ALLOWED_TAGS: ["p", "strong"]` still got the full html allowlist. Config building moved to a pure, unit-tested `buildSanitizeConfig()` (`src/lib/utils/sanitize.ts`) that omits `USE_PROFILES` whenever an allowlist field is supplied, keeps it when only `FORBID_*` is supplied, and always applies the additive footnote `ADD_ATTR`. `FORBID_TAGS` / `FORBID_ATTR` were unaffected and behaved correctly throughout.
- **Residual: a single-dimension `sanitize` schema widened the OTHER dimension instead of tightening it.** Fixing the no-op above by dropping `USE_PROFILES` whenever either `ALLOWED_TAGS` or `ALLOWED_ATTR` was supplied had a side effect for consumers who supplied only one of the two: the unsupplied dimension fell back to DOMPurify's full built-in default (`html ∪ svg ∪ svgFilters ∪ mathMl`), which is *wider* than the html profile — e.g. `{ ALLOWED_ATTR: ["href"] }` alone let `<svg>`/`<math>` tags through, and `{ ALLOWED_TAGS: ["p", "strong"] }` alone let svg/mathml attributes like `fill` through. `buildSanitizeConfig()` now pins the unsupplied dimension to a vendored copy of DOMPurify's html-profile tag/attribute lists (`HTML_PROFILE_TAGS` / `HTML_PROFILE_ATTRS`, exported from `src/lib/utils/sanitize.ts`) whenever exactly one of `ALLOWED_TAGS`/`ALLOWED_ATTR` is supplied, so a partial schema can only tighten, never widen.
- `changeBlockType` round-trips code blocks correctly in both directions (see Added) — previously converting a paragraph to `pre` produced a bare `<pre>` with no inner `<code>`, which didn't serialize back to a fenced code block, and converting away from `pre` left an inline `<code>` wrapping the whole result.

### Removed

- **BREAKING: `frontmatterMode` removed from `EditorConfig`.** It was unimplemented (scaffolded type, no runtime) — re-added if/when a real implementation lands.
- `vitest-browser-svelte` devDependency, replaced by `@storybook/addon-vitest` + `@vitest/browser-playwright` (see Added/Changed).

## [0.1.0] — 2026-07-21 — First stable release

Marks the API stable at 0.1.x — no breaking changes will land in patch versions. Adds Storybook stories, a full README with consumer walkthrough, and promotes the package from the `alpha` dist-tag to `latest` on npm.

Contents unchanged from `0.1.0-alpha.3` — no code changes. The alpha ran through: E1 (scaffold), E2 (DOM primitives), E3 (WYSIWYG surface + menus). Consumer-visible API:

- `<MarkdownEditor {editor} />`
- `new MarkdownEditorState({ markdown })` with `hasEdits`, `canUndo`, `canRedo`, `pushHistory()`, `undo()`, `redo()`, `hydrateMarkdown()`, `markAsSaved()`, `reset()`
- All 22 DOM-primitive functions exported for consumers building custom toolbar buttons
- `toDom` / `toMarkdown` re-exported from `@kevinpeckham/barkdown`

### Added

- **Interactive Storybook story** for `MarkdownEditor` with realistic sample content (headings, lists, blockquote, formatting, footnote). `bun run storybook` and `bun run build-storybook` both work. Story file uses relative imports (`../src/lib/…`) because Storybook's Vite doesn't resolve `$lib`.
- **README** — full consumer walkthrough replacing the alpha stub: install, usage, state class API, wrapping-for-domain-fields pattern, menus, sanitization notes, what's not in the package, known limitations.

### Known limitations shipping with 0.1.0

- **Vitest browser project not enabled** (tester-iframe hang, two attempts). Pure-logic layer is covered — 36 node tests across state class + DOM primitives.
- **No per-menu Storybook stories** — menus are context-dependent (need real block refs, editor state, positioning). Interact with them via the main editor story.
- **Sanitization schema is not configurable** yet — future minor bump.

### Follow-ups queued for 0.2 / 0.3

- Solve the vitest browser-tester issue (candidates: `@web/test-runner`, direct chrome-devtools-protocol)
- Configurable sanitize schema via prop
- Standalone menu stories once we have real browser-test fixtures to drive them
- Optional frontmatter mode (`extract` / `preserve`) — `EditorConfig` type is scaffolded, no runtime yet

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
