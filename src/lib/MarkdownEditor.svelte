<script lang="ts">
// STUB — v0.1.0-alpha.0. Renders a labeled placeholder so consumers
// can smoke-test the import wiring; real WYSIWYG surface lands in
// E3 (see CHANGELOG).

import type { MarkdownEditorState } from "./state/editor.svelte";

let { editor }: { editor: MarkdownEditorState } = $props();
</script>

<div
	class="woof-editor-stub"
	data-woof-editor-version="0.1.0-alpha.0"
	data-has-edits={editor.hasEdits}
>
	<p>
		@kevinpeckham/woof-editor — v0.1.0-alpha.0 (scaffold). WYSIWYG
		surface arrives in v0.1.0-alpha.2.
	</p>
	<textarea
		bind:value={editor.markdownCurrent}
		aria-label="markdown source"
		rows="12"
		style="width: 100%; font-family: ui-monospace, monospace; padding: 0.75rem;"
	></textarea>
</div>

<style>
	.woof-editor-stub {
		border: 1px dashed #bbb;
		border-radius: 6px;
		padding: 1rem;
		background: #fafafa;
	}
	.woof-editor-stub p {
		margin: 0 0 0.75rem 0;
		font-size: 0.875rem;
		color: #666;
	}
</style>
