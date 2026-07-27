<script lang="ts">
// Public demo page — the thing a maintainer proudly links from the README.
// Prerendered statically (adapter-static + `export const prerender = true`
// in +layout.ts); MarkdownEditorState is a plain runes class, so
// constructing it here at component-init time is SSR-safe. The WYSIWYG
// itself seeds its contenteditable DOM inside an $effect, which never runs
// during SSR — the prerendered HTML has an empty editor surface, and that's
// fine, it hydrates on the client.

// type
import type { Attachment } from "svelte/attachments";
import { MarkdownEditor, MarkdownEditorState } from "$lib";
import ContextMenu from "$lib/menus/ContextMenu.svelte";

// Showcase content: exercises an H1 title, inline bold/italic/strike/code/
// link, an H2, a bulleted + a numbered list, a blockquote, a fenced code
// block, and a footnote ref + definition. The "select text / right-click /
// gutter chip" invitation lives in the body copy itself.
const showcaseMarkdown =
	"# Try Editing This\n" +
	"\n" +
	"Every edit round-trips through **barkdown**'s codec — *italic*, ~~strikethrough~~, `inline code`, and a [link](https://github.com/kevinpeckham/woof-editor) all serialize back to the exact markdown a parser would produce.\n" +
	"\n" +
	"Select text for the bubble menu, right-click for the context menu, or click the gutter chip to the left of any block to change its type.\n" +
	"\n" +
	"## Two kinds of lists\n" +
	"\n" +
	"- Bulleted items work as expected\n" +
	"- So does **emphasis** inside a bullet\n" +
	"- Undo, redo, and save are wired to the toolbar above\n" +
	"\n" +
	"1. Numbered lists too\n" +
	"2. Keyboard shortcuts are listed below the editor\n" +
	"\n" +
	"> Round-trip means the markdown you started with and the markdown you get back after editing are structurally identical — no drift, no diff noise.\n" +
	"\n" +
	"```ts\n" +
	'const editor = new MarkdownEditorState({ markdown: "# Hello" });\n' +
	"```\n" +
	"\n" +
	"This editor understands footnotes, too[^1].\n" +
	"\n" +
	"[^1]: Click the footnote number to edit its definition inline.\n";

// Static text for the usage `<pre><code>` block — no syntax highlighter
// dependency, just the README's minimal example rendered verbatim. Built by
// string concatenation (not a template literal), with the script tag's
// closing sequence split across two pieces ("<" + "/script>") so those
// characters never appear contiguously anywhere in this file's own source —
// not even inside a comment. Both Svelte's compiler and biome's linter
// locate a component's real script block by a plain text search for that
// exact closing sequence; either would wrongly treat any such occurrence,
// wherever it appeared in the file, as the end of THIS component's script.
const usageSnippet =
	'<script lang="ts">\n' +
	'  import { MarkdownEditor, MarkdownEditorState } from "@kevinpeckham/woof-editor";\n' +
	"\n" +
	"  const editor = new MarkdownEditorState({\n" +
	'    markdown: "# Hello\\n\\nEditable markdown, round-tripped through barkdown.",\n' +
	"  });\n" +
	"\n" +
	"  async function save() {\n" +
	'    await fetch("/api/articles/123", {\n' +
	'      method: "PUT",\n' +
	"      body: JSON.stringify({ markdown: editor.markdownCurrent }),\n" +
	"    });\n" +
	"    editor.markAsSaved(); // flips `hasEdits` to false without re-seeding the DOM\n" +
	"  }\n" +
	"<" +
	"/script>\n" +
	"\n" +
	"<MarkdownEditor {editor} />\n" +
	"\n" +
	"<button disabled={!editor.canUndo} onclick={() => editor.undo()}>Undo</button>\n" +
	"<button disabled={!editor.canRedo} onclick={() => editor.redo()}>Redo</button>\n" +
	"<button disabled={!editor.hasEdits} onclick={save}>Save</button>";

const editor = new MarkdownEditorState({ markdown: showcaseMarkdown });

let isMac = $state(false);
let modifierKey = $derived(isMac ? "⌘" : "Ctrl");

// Attachment for determining mac / windows for keyboard shortcuts.
// Attachments run client-side only (and re-run on reactive changes), so no
// $effect wrapper and no `browser` guard are needed inside one.
const determinePlatform: Attachment = () => {
	isMac = /mac/i.test(navigator.platform);
};
</script>

<svelte:head>
	<title>Woof Editor — round-trip markdown WYSIWYG for Svelte 5</title>
	<meta
		name="description"
		content="Contenteditable markdown editor for Svelte 5 backed by barkdown's property-tested round-trip codec. What you edit is exactly the markdown you save."
	/>
</svelte:head>

<div class="page-x-padding pt-8">
	<header class="grid grid-cols-1 lg-grid-cols-[auto_1fr] mb-8 items-baseline">
		<div class="max-w-prose">
			<h1 class="heading-1">@kevinpeckham/woof-editor</h1>
			<p class="mb-4">
				<span class="opacity-90">A WYSIWYG surface using Svelte 5 and contenteditable html that serializes every edit back through the</span> <a class="link" href="https://www.npmjs.com/package/@kevinpeckham/barkdown">barkdown</a> <span class="opacity-90">property-tested round-trip codec. What you edit is exactly the markdown you save, with no drift.</span>
			</p>
		</div>
		<nav class="flex gap-4 flex-wrap mb-6 max-h-fit lg-ml-auto" aria-label="Project links">
			<a class="button-small" href="https://www.npmjs.com/package/@kevinpeckham/woof-editor">npm</a>
			<a class="button-small" href="https://github.com/kevinpeckham/woof-editor">GitHub</a>
			<pre class="bg-offWhite/90 leading-snug rounded-md px-4 py-1.5 text-prussianBlue font-mono max-w-fit text-0.85em"><code>bun add @kevinpeckham/woof-editor</code></pre>
		</nav>
	</header>

	<hr class="opacity-20 mb-8" />

	<main {@attach determinePlatform}>
		<section class="mb-12" aria-labelledby="playground-heading">
			<!-- Two column widths inside one section: `.playground-col` (720px)
			     matches the text column every other section uses, so the heading
			     and the caption/shortcuts row share the same left edge as
			     "Why"/"Usage". `.playground-wide` (1040px) is a deliberate
			     breakout for the toolbar + two-pane grid, which need the extra
			     width — it starts to the left of the text column on purpose. -->


			<h2 class="heading-2">Live playground</h2>


			<!-- panes -->
			<div class="gap-8 grid grid-cols-1 mb-5 lg-grid-cols-2">
				<!-- editor pane -->
				<div class="">
					<div class="flex items-baseline justify-between">
						<div class="flex items-baseline gap-6">
							<h3 class="heading-3">Editor</h3>
							<button
								aria-label="Keyboard Shortcuts"
								id="shortcuts-menu-button"
								popovertarget="shortcuts-menu"
								type="button"
								class="self-justify-end ml-auto button-xsmall"
							>
								Shortcuts
							</button>
							<div id="shortcuts-menu" class="bg-blue-100 border border-current/40 min-w-32 px-3 py-2 mt-4 mr-2 rounded-md shadow text-prussianBlue" popover>




									<ul class="space-y-1.5"><li class="flex items-center gap-2 text-sm"><span class="flex items-center gap-1 shrink-0"><kbd class="px-1.5 py-0.5 text-xs font-mono bg-slate-100 border border-slate-300 rounded">{modifierKey}</kbd><kbd class="px-1.5 py-0.5 text-xs font-mono bg-slate-100 border border-slate-300 rounded">B</kbd></span> <span class="opacity-80">Bold</span></li><li class="flex items-center gap-2 text-sm"><span class="flex items-center gap-1 shrink-0"><kbd class="px-1.5 py-0.5 text-xs font-mono bg-slate-100 border border-slate-300 rounded">{modifierKey}</kbd><kbd class="px-1.5 py-0.5 text-xs font-mono bg-slate-100 border border-slate-300 rounded">I</kbd></span> <span class="opacity-80">Italic</span></li><li class="flex items-center gap-2 text-sm"><span class="flex items-center gap-1 shrink-0"><kbd class="px-1.5 py-0.5 text-xs font-mono bg-slate-100 border border-slate-300 rounded">{modifierKey}</kbd><kbd class="px-1.5 py-0.5 text-xs font-mono bg-slate-100 border border-slate-300 rounded">⌥</kbd><kbd class="px-1.5 py-0.5 text-xs font-mono bg-slate-100 border border-slate-300 rounded">2</kbd></span> <span class="opacity-80">Heading 2</span></li><li class="flex items-center gap-2 text-sm"><span class="flex items-center gap-1 shrink-0"><kbd class="px-1.5 py-0.5 text-xs font-mono bg-slate-100 border border-slate-300 rounded">{modifierKey}</kbd><kbd class="px-1.5 py-0.5 text-xs font-mono bg-slate-100 border border-slate-300 rounded">⌥</kbd><kbd class="px-1.5 py-0.5 text-xs font-mono bg-slate-100 border border-slate-300 rounded">3</kbd></span> <span class="opacity-80">Heading 3</span></li><li class="flex items-center gap-2 text-sm"><span class="flex items-center gap-1 shrink-0"><kbd class="px-1.5 py-0.5 text-xs font-mono bg-slate-100 border border-slate-300 rounded">{modifierKey}</kbd><kbd class="px-1.5 py-0.5 text-xs font-mono bg-slate-100 border border-slate-300 rounded">⌥</kbd><kbd class="px-1.5 py-0.5 text-xs font-mono bg-slate-100 border border-slate-300 rounded">4</kbd></span> <span class="opacity-80">Heading 4</span></li><li class="flex items-center gap-2 text-sm"><span class="flex items-center gap-1 shrink-0"><kbd class="px-1.5 py-0.5 text-xs font-mono bg-slate-100 border border-slate-300 rounded">{modifierKey}</kbd><kbd class="px-1.5 py-0.5 text-xs font-mono bg-slate-100 border border-slate-300 rounded">⌥</kbd><kbd class="px-1.5 py-0.5 text-xs font-mono bg-slate-100 border border-slate-300 rounded">0</kbd></span> <span class="opacity-80">Paragraph</span></li><li class="flex items-center gap-2 text-sm"><span class="flex items-center gap-1 shrink-0"><kbd class="px-1.5 py-0.5 text-xs font-mono bg-slate-100 border border-slate-300 rounded">{modifierKey}</kbd><kbd class="px-1.5 py-0.5 text-xs font-mono bg-slate-100 border border-slate-300 rounded">Z</kbd></span> <span class="opacity-80">Undo</span></li><li class="flex items-center gap-2 text-sm"><span class="flex items-center gap-1 shrink-0"><kbd class="px-1.5 py-0.5 text-xs font-mono bg-slate-100 border border-slate-300 rounded">{modifierKey}</kbd><kbd class="px-1.5 py-0.5 text-xs font-mono bg-slate-100 border border-slate-300 rounded">⇧</kbd><kbd class="px-1.5 py-0.5 text-xs font-mono bg-slate-100 border border-slate-300 rounded">Z</kbd></span> <span class="opacity-80">Redo</span></li></ul>

							</div>
						</div>
						<div class="flex items-center gap-2">
							<button class="button-xsmall" type="button" onclick={() => editor.undo()} disabled={!editor.canUndo}>
								Undo
							</button>
							<button class="button-xsmall" type="button" onclick={() => editor.redo()} disabled={!editor.canRedo}>
								Redo
							</button>
							{#if editor.hasEdits}
								<span class="italic text-=0.9em" role="status">Unsaved changes</span>
							{/if}
							<button
								type="button"
								class="self-justify-end ml-auto button-xsmall"
								onclick={() => editor.markAsSaved()}
								disabled={!editor.hasEdits}
							>
								Mark Saved
							</button>

						</div>
					</div>

					<!-- editor container -->
					<div class="
						bg-slate-200
						border
						border-current/0
						pb-6
						pt-5
						px-10
						rounded-md
						text-prussianBlue">
							<MarkdownEditor {editor} class="
						demo-article" />
					</div>

				</div>
				<!-- source pane -->
				<div class="grid grid-cols-1 place-content-start h-full grid-rows-[auto_1fr]">
					<h3 class="heading-3">Serialized Markdown (live)</h3>
					<div class="bg-white/5 border border-current/40 h-full px-4 pt-5 pb-6 rounded-md"><pre class="source-code">{editor.markdownCurrent}</pre></div>
				</div>

				<!-- note -->
				<div class="w-full mt-5">
					<h3 class="heading-3 sr-only">Styling Notes</h3>
					<div class="flex gap-6 text-0.9em border border-current/40 px-3 py-3 rounded-md">
						<p class="opacity-90">This page styles the document via the class prop. Menus are themed with two
						CSS variables.</p>
					</div>
				</div>
			</div>


		</section>

		<hr class="opacity-20 mb-8" />

		<div class="gap-8 grid grid-cols-1 mb-5 lg-grid-cols-2">
		<section aria-labelledby="why-heading">
			<h2 class="heading-2">Why Another Markdown WYSIWYG</h2>
			<div class="grid grid-cols-1 gap-3 opacity-90">
			<p>
				Most contenteditable markdown editors round-trip lossily: markdown renders to DOM, you
				edit the DOM, and a separate serializer writes markdown back out through a different path
				than the one that read it in. Content drifts a little on every save — extra whitespace,
				quote-style changes, list markers that flip.
			</p>
			<p>
				<code>woof-editor</code> serializes through
				<a href="https://www.npmjs.com/package/@kevinpeckham/barkdown">@kevinpeckham/barkdown</a>
				instead, whose DOM → markdown writer is property-tested to invert
				<a href="https://marked.js.org">marked</a>'s parser:
				<code>toMarkdown(toDom(md)) === md</code> for every canonical input.
			</p>
			<p>
				That guarantee is what lets you store editor output as canonical markdown in a database or
				a git repo — CMS bodies that survive edit → save → reload cycles without accumulating
				cruft.
			</p>
			</div>
		</section>

		<section class="mb-16" aria-labelledby="usage-heading">
			<h2 id="usage-heading" class="heading-3">Usage</h2>
			<pre class="bg-white/5 border border-current/40 px-4 pt-4 pb-6 rounded-md"><code class="source-code">{usageSnippet}</code></pre>
		</section>

		</div>
	</main>

	<hr class="opacity-20 mb-8" />

	<footer>
		<div class="flex flex-wrap gap-4 text-0.85em">
			<span class="opacity-90">MIT License</span> ·
			<a class="link" href="https://github.com/kevinpeckham/woof-editor">GitHub</a> ·
			<a class="link" href="https://www.npmjs.com/package/@kevinpeckham/woof-editor">npm</a> ·

			<span class="opacity-90 italic">built with woof-editor v0.2.0</span>
		</div>

		<div class="mb-36">
    <a
      class="inline-block font-sans text-xs mt-8 opacity-60 underline-offset-4 hover:color-[#ebf92f] hover:underline hover:opacity-80"
      href="https://www.lightningjar.com"
      rel="external"
      title="visit Lightning Jar website"
    >
      website by ⚡️ Lightning Jar
    </a>
  </div>

	</footer>
</div>

<style>

	#shortcuts-menu-button {
		anchor-name: shortcuts-menu-button;
	}
	#shortcuts-menu {
		anchor-name: shortcuts-menu;
		position-area: bottom span-right;
	}





	/* --- .demo-article typography ---
	   Overrides the editor's zero-specificity :where() fallbacks (see
	   MarkdownEditor.svelte "Bucket B"). Deliberately leaves the editor's
	   own pre/code chrome (Bucket A, normal specificity) untouched. */
	:global(.demo-article h1) {
		font-size: 1.7em;
		font-weight: 800;
		letter-spacing: -0.01em;
		line-height: 1.2;
		margin: 0 0 1.1rem;
	}
	:global(.demo-article h2) {
		font-size: 1.3em;
		font-weight: 700;
		margin: 1.75rem 0 0.75rem;
	}
	:global(.demo-article h3) {
		font-size: 1.1em;
		font-weight: 700;
		margin: 1.5rem 0 0.5rem;
	}
	:global(.demo-article p) {
		margin: 0 0 1rem;
		line-height: 1.7;
		color: #292524;
	}
	:global(.demo-article ul),
	:global(.demo-article ol) {
		margin: 0 0 1rem;
		padding-left: 1.4rem;
		line-height: 1.7;
	}
	:global(.demo-article ul) {
		list-style: disc;
	}
	:global(.demo-article ol) {
		list-style: decimal;
	}
	:global(.demo-article li) {
		margin-bottom: 0.3rem;
	}
	:global(.demo-article blockquote) {
		margin: 1.25rem 0;
		padding-left: 1rem;
		border-left: 3px solid var(--accent);
		color: var(--muted);
		font-style: italic;
	}
	:global(.demo-article a) {
		color: var(--accent);
	}
</style>
