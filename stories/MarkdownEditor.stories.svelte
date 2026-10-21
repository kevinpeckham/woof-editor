<script module lang="ts">
import { defineMeta } from "@storybook/addon-svelte-csf";
import { expect, userEvent, waitFor, within } from "storybook/test";

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

/**
 * Regression test pinning creation-gating's effect on the element menu
 * (gutter-chip popover), using replicator's exact restricted subset:
 * `{ blockquote: false, codeBlock: false, strikethrough: false,
 * footnotes: false, images: false, tables: false }` (bold/italic/links/
 * lists/headings are left at their defaults — enabled).
 *
 * `ElementMenu` filters its "Change type" submenu through
 * `convertibleTagsFor(features)` and gates "Add footnote" on
 * `features.footnotes` (see `src/lib/menus/ElementMenu.svelte` and
 * `src/lib/utils/features.ts`). This story exercises the real popover in a
 * real browser (not a unit test against the filter function) so a future
 * change to the menu's markup — e.g. a gate accidentally dropped, or an
 * item moved outside its `{#if}` — fails here even if the pure-function
 * tests still pass.
 */
async function playRestrictedFeatures({ canvasElement }: { canvasElement: HTMLElement }) {
	const body = canvasElement.querySelector<HTMLElement>(".woof-editor-body");
	if (!body) throw new Error("contenteditable body not found");

	// Seeding happens in a post-mount effect.
	await waitFor(() => {
		expect(body.querySelector("p")?.textContent).toBe("A paragraph to click into.");
	});
	const paragraph = body.querySelector("p");
	if (!paragraph) throw new Error("paragraph not found");

	// Click into the paragraph to place the caret. The gutter chip only
	// mounts once `activeBlock` is tracked via `selectionchange`.
	await userEvent.click(paragraph);

	await waitFor(() => {
		expect(canvasElement.querySelector(".woof-gutter-btn")).toBeTruthy();
	});
	const gutterButton = canvasElement.querySelector<HTMLButtonElement>(".woof-gutter-btn");
	if (!gutterButton) throw new Error("gutter button not found");
	await userEvent.click(gutterButton);

	// `ElementMenu` renders into a native `popover` element that is a
	// template-level sibling of the editor shell, not nested inside it —
	// query the document (scoped to the open popover, since all three
	// menus share the same backdrop/panel class names) rather than
	// canvasElement or the editor container.
	await waitFor(() => {
		expect(document.querySelector(".woof-menu-backdrop:popover-open")).toBeTruthy();
	});
	const menuBackdrop = document.querySelector<HTMLElement>(".woof-menu-backdrop:popover-open");
	if (!menuBackdrop) throw new Error("element menu not open");
	const menu = within(menuBackdrop);

	// Open the "Change type" submenu.
	const changeType = await menu.findByText("Change type");
	await userEvent.click(changeType);

	// Positive assertions first — an empty/unopened menu can't pass these,
	// so the negative assertions below aren't vacuous.
	expect(await menu.findByText("Paragraph")).toBeTruthy();
	expect(menu.getByText("Heading 2")).toBeTruthy();
	expect(menu.getByText("Bulleted list")).toBeTruthy();

	// Gated-off block types never render as submenu options.
	expect(menu.queryByText("Blockquote")).toBeNull();
	expect(menu.queryByText("Code block")).toBeNull();

	// Footnotes are gated off entirely — the item doesn't render at all.
	expect(menu.queryByText("Add footnote")).toBeNull();

	// Guard against over-gating regressions: this config leaves bold
	// enabled, so "Bold whole block" must still render.
	expect(menu.getByText("Bold whole block")).toBeTruthy();

	await userEvent.keyboard("{Escape}");

	await waitFor(() => {
		expect(document.querySelector(".woof-menu-backdrop:popover-open")).toBeNull();
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

{#snippet restrictedFeaturesTemplate()}
	{@const editor = new MarkdownEditorState({
		markdown: `# Title

A paragraph to click into.

- Item one
- Item two
`,
	})}
	<div style="max-width: 720px; margin: 1rem auto; padding-left: 48px;">
		<MarkdownEditor
			{editor}
			config={{
				features: {
					blockquote: false,
					codeBlock: false,
					footnotes: false,
					images: false,
					strikethrough: false,
					tables: false,
				},
			}}
		/>
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

<Story name="Restricted features" asChild play={playRestrictedFeatures}>
	{@render restrictedFeaturesTemplate()}
</Story>
