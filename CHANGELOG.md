# Changelog

Notable changes to `@kevinpeckham/barkdown-editor`. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Pre-1.0, breaking changes may land in minor versions.

## [Unreleased]

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
