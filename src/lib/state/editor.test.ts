// Unit tests for MarkdownEditorState — pure state, no DOM. Runs in the
// vitest `node` project.

import { expect, test } from "vitest";

import { MarkdownEditorState } from "./editor.svelte";

test("initializes clean (no edits) with empty markdown", () => {
	const e = new MarkdownEditorState();
	expect(e.markdownCurrent).toBe("");
	expect(e.markdownOriginal).toBe("");
	expect(e.hasEdits).toBe(false);
});

test("initializes from provided markdown", () => {
	const e = new MarkdownEditorState({ markdown: "# Hello" });
	expect(e.markdownCurrent).toBe("# Hello");
	expect(e.hasEdits).toBe(false);
});

test("hasEdits flips when current diverges from original", () => {
	const e = new MarkdownEditorState({ markdown: "# Hello" });
	e.markdownCurrent = "# Hello world";
	expect(e.hasEdits).toBe(true);
});

test("markAsSaved clears hasEdits without rehydrating", () => {
	const e = new MarkdownEditorState({ markdown: "# Hello" });
	e.markdownCurrent = "# Hello world";
	expect(e.hasEdits).toBe(true);
	e.markAsSaved();
	expect(e.hasEdits).toBe(false);
	expect(e.markdownCurrent).toBe("# Hello world");
	expect(e.markdownOriginal).toBe("# Hello world");
});

test("reset replaces both current + original", () => {
	const e = new MarkdownEditorState({ markdown: "# A" });
	e.markdownCurrent = "# A modified";
	e.reset("# B");
	expect(e.markdownCurrent).toBe("# B");
	expect(e.markdownOriginal).toBe("# B");
	expect(e.hasEdits).toBe(false);
});

test("pushHistory dedupes an identical head", () => {
	const e = new MarkdownEditorState({ markdown: "a" });
	e.pushHistory("ab");
	e.pushHistory("ab");
	expect(e.history).toEqual(["a", "ab"]);
	expect(e.historyIndex).toBe(1);
});

test("undo/redo walk history; pushes during replay are ignored", () => {
	const e = new MarkdownEditorState({ markdown: "a" });
	e.pushHistory("ab");
	e.pushHistory("abc");
	e.undo();
	expect(e.markdownCurrent).toBe("ab");
	// The WYSIWYG's own serialize-flush fires during replay — must no-op.
	e.pushHistory("should-be-ignored");
	expect(e.history).toEqual(["a", "ab", "abc"]);
	e.redo();
	expect(e.markdownCurrent).toBe("abc");
	expect(e.canRedo).toBe(false);
});

test("a fresh edit after undo truncates the redo tail", async () => {
	const e = new MarkdownEditorState({ markdown: "a" });
	e.pushHistory("ab");
	e.pushHistory("abc");
	e.undo();
	// isReplayingHistory clears on a microtask — wait it out like the
	// real WYSIWYG flush (debounced 250ms) always does.
	await new Promise((r) => setTimeout(r, 0));
	e.pushHistory("aX");
	expect(e.history).toEqual(["a", "ab", "aX"]);
	expect(e.canRedo).toBe(false);
});

test("history is capped at 100 entries", () => {
	const e = new MarkdownEditorState({ markdown: "0" });
	for (let i = 1; i <= 150; i++) e.pushHistory(String(i));
	expect(e.history.length).toBe(100);
	expect(e.history[99]).toBe("150");
	expect(e.canRedo).toBe(false);
});
