<script module lang="ts">
import { defineMeta } from "@storybook/addon-svelte-csf";
import { expect, userEvent, waitFor } from "storybook/test";

import MarkdownEditor from "../src/lib/MarkdownEditor.svelte";
import { MarkdownEditorState } from "../src/lib/state/editor.svelte";

const { Story } = defineMeta({
	component: MarkdownEditor,
	title: "MarkdownEditor",
});

/**
 * Regression test for "keyboard undo silently fails within the debounce
 * window".
 *
 * Cmd/Ctrl+Z pressed before the serialize debounce has fired forces a
 * synchronous `flushToMarkdown()`, which sets `isSyncingFromWysiwyg = true`
 * and queues its clear in a microtask. Svelte enqueues the effect flush at
 * the batch's FIRST write, so the flush runs before that clear — the flush's
 * write and the undo's write coalesce into one batch, the seed effect reads
 * a stale `true`, and skips. The DOM then never reverts: undo looks dead.
 *
 * The story deliberately raises `serializeDebounceMs` (via the public
 * `config` prop) so "inside the debounce window" is a guarantee rather than
 * a race against a 250ms wall-clock timer. The code path under test is
 * identical — what matters is that `flushTimer` is still pending when the
 * keydown handler runs, which is exactly what the raised debounce pins down.
 */
async function playUndoWithinDebounce({ canvasElement }: { canvasElement: HTMLElement }) {
	const body = canvasElement.querySelector<HTMLElement>(".woof-editor-body");
	if (!body) throw new Error("contenteditable body not found");

	// Seeding happens in a post-mount effect.
	await waitFor(() => {
		expect(body.querySelector("p")?.textContent).toBe("hello");
	});
	const paragraph = body.querySelector("p");
	const textNode = paragraph?.firstChild as Text | undefined;
	if (!textNode) throw new Error("paragraph text node not found");

	// Drop the caret at the end of "hello" and type one character.
	body.focus();
	const range = document.createRange();
	range.setStart(textNode, textNode.length);
	range.collapse(true);
	const selection = window.getSelection();
	selection?.removeAllRanges();
	selection?.addRange(range);
	await userEvent.keyboard("x");

	// Guard assertion: proves the simulated typing really mutated the DOM.
	// Without it the undo assertion below could pass vacuously (a test that
	// never typed anything would "revert" trivially).
	await waitFor(() => {
		expect(body.textContent).toContain("hellox");
	});

	// Immediately undo — still inside the debounce window, so nothing has
	// been serialized yet and the keydown handler must force the flush.
	await userEvent.keyboard("{Control>}z{/Control}");

	await waitFor(() => {
		expect(body.textContent).not.toContain("hellox");
		expect(body.querySelector("p")?.textContent).toBe("hello");
	});
}
</script>

{#snippet editorTemplate(initialMd: string, serializeDebounceMs = 250)}
	{@const editor = new MarkdownEditorState({ markdown: initialMd })}
	<div style="max-width: 720px; margin: 1rem auto; padding-left: 48px;">
		<MarkdownEditor {editor} config={{ serializeDebounceMs }} />
		<div style="margin-top: 1rem; padding: 0.75rem; background: #f5f5f5; border-radius: 4px; font-family: ui-monospace, monospace; font-size: 0.75rem; white-space: pre-wrap;">
			<strong style="font-family: system-ui;">Serialized markdown (updates on edit):</strong>{"\n"}{editor.markdownCurrent}
		</div>
	</div>
{/snippet}

<Story name="Rich content" asChild>
	{@render editorTemplate(`# Article Title

This is the leading paragraph. Try clicking the **⋮ gutter button** to the left of any block for the element menu, or select text to see the inline selection menu.

## Formatting

Inline **bold**, *italic*, ~~strikethrough~~, and [links](https://example.com) all round-trip through barkdown.

## Lists

- Bullet one
- Bullet two
- Bullet three with **emphasis inside**

1. Ordered one
2. Ordered two

## Blockquote

> The DOM inside the contenteditable is an "escape from Svelte" region — Svelte does not re-render it. All mutations serialize back to markdown via barkdown.

## Footnotes

Editors get in-text footnote refs[^1] that round-trip to markdown.

[^1]: The definition lives at the end of the article and is edited via the FootnoteEditor popover.
`)}
</Story>

<Story name="Minimal / empty" asChild>
	{@render editorTemplate("")}
</Story>

<Story name="Single title only" asChild>
	{@render editorTemplate("# Just a title\n")}
</Story>

<Story name="Undo within debounce window" asChild play={playUndoWithinDebounce}>
	{@render editorTemplate("# Title\n\nhello", 5000)}
</Story>
