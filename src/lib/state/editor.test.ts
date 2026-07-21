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
