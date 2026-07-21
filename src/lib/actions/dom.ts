// DOM-edit primitives for the WYSIWYG menus.
//
// v0.1.0-alpha.0: EMPTY — populated in E2 by porting Replicator's
// blogWysiwygActions.ts (~779 lines of pure functions: changeBlockType,
// findFootnoteRef, pruneOrphanFootnotes, etc.). All functions here
// operate on a `container` (contenteditable root) and a `block`
// (direct-child block element); they never touch state, so they test
// cleanly in node + jsdom.

export const __VERSION_SENTINEL = "0.1.0-alpha.0";
