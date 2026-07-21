// MarkdownEditorState — the state class the WYSIWYG surface binds to.
//
// v0.1.0-alpha.0: shape-only. Real behavior (isSyncingFromWysiwyg flag
// handling, snapshot(), version tracking, dirty-flag rollup) lands in
// E3 when the WYSIWYG surface is ported.

export type MarkdownEditorInit = {
	markdown?: string;
};

export class MarkdownEditorState {
	markdownCurrent: string = $state("");
	markdownOriginal: string = $state("");

	/**
	 * Set to true by the WYSIWYG surface while it's writing markdown from
	 * its own DOM mutation. Consumer state effects that would re-seed the
	 * editor from an external source (e.g. LLM chat inserting content)
	 * should skip while this is true, or they'll clobber the caret.
	 */
	isSyncingFromWysiwyg: boolean = $state(false);

	/**
	 * True when the current markdown differs from the last saved snapshot.
	 * Rolls up automatically as `markdownCurrent` / `markdownOriginal`
	 * change.
	 */
	readonly hasEdits: boolean = $derived(this.markdownCurrent !== this.markdownOriginal);

	constructor(init: MarkdownEditorInit = {}) {
		this.hydrateMarkdown(init.markdown ?? "");
	}

	/** Load fresh markdown into both current + original — no dirty state. */
	hydrateMarkdown(md: string): void {
		this.markdownCurrent = md;
		this.markdownOriginal = md;
	}

	/**
	 * Called after a successful save. Advances `markdownOriginal` to
	 * `markdownCurrent` so `hasEdits` flips false — WITHOUT re-hydrating
	 * (which would re-seed the WYSIWYG and lose the caret).
	 */
	markAsSaved(): void {
		this.markdownOriginal = this.markdownCurrent;
	}

	/**
	 * Full reset. Use on article-navigation (loading a different article
	 * into the same editor instance). Loses any unsaved edits.
	 */
	reset(md: string): void {
		this.hydrateMarkdown(md);
	}
}
