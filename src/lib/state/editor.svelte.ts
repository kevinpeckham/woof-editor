// MarkdownEditorState — the state class the WYSIWYG surface binds to.
//
// Owns the body markdown string (`markdownCurrent`), a "last saved" baseline
// (`markdownOriginal`), a sync flag used by the WYSIWYG to gate re-seed
// effects, and an undo/redo history stack.
//
// Deliberately domain-neutral. Consumer state classes wrap this one for
// their own fields (title, slug, tags, categories, publish status, etc.).

export type MarkdownEditorInit = {
	markdown?: string;
};

/** Hard cap on the undo/redo history stack. */
const HISTORY_LIMIT = 100;

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

	// --------------------------------------------------------------------------
	// Undo/redo history
	// --------------------------------------------------------------------------
	//
	// Whole-markdown snapshots (not deltas). Bodies are typically small
	// enough that the memory cost stays trivial even at HISTORY_LIMIT
	// entries. `historyIndex` points at the current entry; a fresh edit
	// truncates everything to the right (standard undo-tree flattening).
	//
	// `undo()` / `redo()` set `isReplayingHistory=true` so pushHistory
	// no-ops during the replay — otherwise the WYSIWYG's own
	// serialize-on-mutation effect would immediately re-push and break
	// the ability to redo.

	history: string[] = $state([]);
	historyIndex: number = $state(-1);
	isReplayingHistory: boolean = $state(false);
	readonly canUndo: boolean = $derived(this.historyIndex > 0);
	readonly canRedo: boolean = $derived(
		this.historyIndex >= 0 && this.historyIndex < this.history.length - 1,
	);

	/**
	 * True when the current markdown differs from the last saved snapshot.
	 * Rolls up automatically as `markdownCurrent` / `markdownOriginal`
	 * change.
	 */
	readonly hasEdits: boolean = $derived(this.markdownCurrent !== this.markdownOriginal);

	constructor(init: MarkdownEditorInit = {}) {
		this.hydrateMarkdown(init.markdown ?? "");
	}

	/**
	 * Load fresh markdown into both current + original (no dirty state) AND
	 * prime the history stack — the loaded value becomes index 0, so the
	 * author's first edit becomes the first undoable step.
	 */
	hydrateMarkdown(md: string): void {
		this.markdownCurrent = md;
		this.markdownOriginal = md;
		this.resetHistory(md);
	}

	/**
	 * Push a fresh markdown snapshot. No-op when replaying history or when
	 * the new value equals the current head (typing 'a' then deleting then
	 * retyping the same 'a' → single entry). A fresh edit after undo
	 * truncates the redo tail.
	 */
	pushHistory(md: string): void {
		if (this.isReplayingHistory) return;
		const head = this.history[this.historyIndex];
		if (head === md) return;
		const truncated = this.history.slice(0, this.historyIndex + 1);
		truncated.push(md);
		if (truncated.length > HISTORY_LIMIT) truncated.shift();
		this.history = truncated;
		this.historyIndex = truncated.length - 1;
	}

	/** Prime the history with a single entry (called by hydrateMarkdown). */
	resetHistory(md: string): void {
		this.history = [md];
		this.historyIndex = 0;
	}

	undo(): void {
		if (!this.canUndo) return;
		this.isReplayingHistory = true;
		this.historyIndex--;
		this.markdownCurrent = this.history[this.historyIndex];
		queueMicrotask(() => {
			this.isReplayingHistory = false;
		});
	}

	redo(): void {
		if (!this.canRedo) return;
		this.isReplayingHistory = true;
		this.historyIndex++;
		this.markdownCurrent = this.history[this.historyIndex];
		queueMicrotask(() => {
			this.isReplayingHistory = false;
		});
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
	 * into the same editor instance). Loses any unsaved edits, resets
	 * the history stack.
	 */
	reset(md: string): void {
		this.hydrateMarkdown(md);
	}
}
