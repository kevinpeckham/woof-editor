<script lang="ts">
// Local demo page. Not part of the published package — SvelteKit
// needs at least one route for `svelte-kit sync` + `bun run build`
// to succeed. Use `bun run storybook` for real component development.

import MarkdownEditor from "$lib/MarkdownEditor.svelte";
import { MarkdownEditorState } from "$lib/state/editor.svelte";

const editor = new MarkdownEditorState({
	markdown:
		"# @kevinpeckham/woof-editor\n\nThe editor is live below — click around, edit, undo/redo, right-click for the context menu. For interactive stories with realistic content (and Storybook's controls), run `bun run storybook`.",
});
</script>

<main
	style="max-width: 720px; margin: 3rem auto; padding: 0 1rem; padding-left: 48px; font-family: system-ui, sans-serif;"
>
	<h1>@kevinpeckham/woof-editor</h1>
	<p>The editor is live. Run <code>bun run storybook</code> for the full interactive story set.</p>
	<MarkdownEditor {editor} />
	<pre style="margin-top: 1rem; padding: 0.75rem; background: #f5f5f5; border-radius: 4px; font-size: 0.875rem; white-space: pre-wrap;">markdownCurrent: {editor.markdownCurrent}
hasEdits: {editor.hasEdits}</pre>
</main>
