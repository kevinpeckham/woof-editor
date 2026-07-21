<script lang="ts">
// Local demo page. Not part of the published package — SvelteKit
// needs at least one route for `svelte-kit sync` + `bun run build`
// to succeed. Use `bun run storybook` for real component development.

import MarkdownEditor from "$lib/MarkdownEditor.svelte";
import { MarkdownEditorState } from "$lib/state/editor.svelte";

const editor = new MarkdownEditorState({
	markdown:
		"# @kevinpeckham/woof-editor\n\nLocal demo route. Use `bun run storybook` for component work.",
});
</script>

<main style="max-width: 720px; margin: 3rem auto; padding: 0 1rem; font-family: system-ui, sans-serif;">
	<h1>@kevinpeckham/woof-editor</h1>
	<p>v0.1.0-alpha.0 scaffold. Real editor lands in v0.1.0-alpha.2.</p>
	<MarkdownEditor {editor} />
	<pre style="margin-top: 1rem; padding: 0.75rem; background: #f5f5f5; border-radius: 4px; font-size: 0.875rem; white-space: pre-wrap;">markdownCurrent: {editor.markdownCurrent}
hasEdits: {editor.hasEdits}</pre>
</main>
