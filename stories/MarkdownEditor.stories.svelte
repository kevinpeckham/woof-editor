<script module lang="ts">
import { defineMeta } from "@storybook/addon-svelte-csf";

import MarkdownEditor from "$lib/MarkdownEditor.svelte";
import { MarkdownEditorState } from "$lib/state/editor.svelte";

const { Story } = defineMeta({
	component: MarkdownEditor,
	title: "MarkdownEditor",
});
</script>

{#snippet stubTemplate(markdown: string)}
	{@const editor = new MarkdownEditorState({ markdown })}
	<MarkdownEditor {editor} />
{/snippet}

<Story name="Default (stub)">
	{@render stubTemplate("# Hello\n\nStub editor. WYSIWYG surface lands in v0.1.0-alpha.2.")}
</Story>

<Story name="Empty">
	{@render stubTemplate("")}
</Story>
