// Public API for @kevinpeckham/woof-editor.
//
// Release phases:
//   0.1.0-alpha.0  — E1 scaffold
//   0.1.0-alpha.1  — republish under OIDC + provenance (no code change)
//   0.1.0-alpha.2  — E2: actions/dom.ts (pure DOM primitives)     ← CURRENT
//   0.1.0-alpha.3  — E3: MarkdownEditor.svelte + menus (WYSIWYG)
//   0.1.0          — E4: Storybook stories + README polish; stable release

// Re-export the codec so consumers don't need to install barkdown separately
// for basic usage. (They still can if they want the raw API surface.)
export { toDom, toMarkdown } from "@kevinpeckham/barkdown";
// DOM-edit primitives — used by the menu components (E3), re-exported for
// advanced consumers who want to build custom toolbar buttons or automations
// without writing their own DOM plumbing.
export {
	applyLinkToSelection,
	CONVERTIBLE_TAGS_LIST,
	changeBlockType,
	findFootnoteDefinition,
	findFootnoteRef,
	findNearestBlock,
	firstH1,
	getFootnoteText,
	insertFootnote,
	insertParagraph,
	insertPlainTextAtSelection,
	isFirstH1,
	isHeadingBlock,
	parseFootnoteNum,
	placeCaretAtStart,
	pruneOrphanFootnotes,
	removeBlock,
	removeFootnote,
	removeLinkFromSelection,
	setFootnoteText,
	toggleBlockWrap,
	toggleInlineEmphasisOnSelection,
} from "./actions/dom";
export { default as MarkdownEditor } from "./MarkdownEditor.svelte";
export { MarkdownEditorState } from "./state/editor.svelte";
export type { EditorConfig, EditorSnapshot, SanitizeSchema } from "./types";
