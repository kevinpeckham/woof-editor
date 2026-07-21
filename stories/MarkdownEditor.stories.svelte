<script module lang="ts">
import { defineMeta } from "@storybook/addon-svelte-csf";

import MarkdownEditor from "../src/lib/MarkdownEditor.svelte";
import { MarkdownEditorState } from "../src/lib/state/editor.svelte";

const { Story } = defineMeta({
	component: MarkdownEditor,
	title: "MarkdownEditor",
});
</script>

{#snippet editorTemplate(initialMd: string)}
	{@const editor = new MarkdownEditorState({ markdown: initialMd })}
	<div style="max-width: 720px; margin: 1rem auto;">
		<MarkdownEditor {editor} />
		<div style="margin-top: 1rem; padding: 0.75rem; background: #f5f5f5; border-radius: 4px; font-family: ui-monospace, monospace; font-size: 0.75rem; white-space: pre-wrap;">
			<strong style="font-family: system-ui;">Serialized markdown (updates on edit):</strong>{"\n"}{editor.markdownCurrent}
		</div>
	</div>
{/snippet}

<Story name="Rich content">
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

<Story name="Minimal / empty">
	{@render editorTemplate("")}
</Story>

<Story name="Single title only">
	{@render editorTemplate("# Just a title\n")}
</Story>
