// Public API for @kevinpeckham/barkdown-editor.
//
// v0.1.0-alpha.0 ships stubs. Real implementations arrive incrementally:
//   0.1.0-alpha.1  — actions/dom.ts (pure DOM primitives, no components)
//   0.1.0-alpha.2  — MarkdownEditor.svelte + menus (WYSIWYG surface)
//   0.1.0-alpha.3+ — Storybook stories, README polish
//   0.1.0          — stable release

// Re-export the codec so consumers don't need to install barkdown separately
// for basic usage. (They still can if they want the raw API surface.)
export { toDom, toMarkdown } from "@kevinpeckham/barkdown";
export { default as MarkdownEditor } from "./MarkdownEditor.svelte";
export { MarkdownEditorState } from "./state/editor.svelte";
export type { EditorConfig, EditorSnapshot, SanitizeSchema } from "./types";
