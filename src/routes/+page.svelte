<script lang="ts">
// Public demo page — the thing a maintainer proudly links from the README.
// Prerendered statically (adapter-static + `export const prerender = true`
// in +layout.ts); MarkdownEditorState is a plain runes class, so
// constructing it here at component-init time is SSR-safe. The WYSIWYG
// itself seeds its contenteditable DOM inside an $effect, which never runs
// during SSR — the prerendered HTML has an empty editor surface, and that's
// fine, it hydrates on the client.

import { MarkdownEditor, MarkdownEditorState } from "$lib";

// Showcase content: exercises an H1 title, inline bold/italic/strike/code/
// link, an H2, a bulleted + a numbered list, a blockquote, a fenced code
// block, and a footnote ref + definition. The "select text / right-click /
// gutter chip" invitation lives in the body copy itself.
const showcaseMarkdown =
	"# Try editing this\n" +
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
</script>

<svelte:head>
	<title>woof-editor — round-trip markdown WYSIWYG for Svelte 5</title>
	<meta
		name="description"
		content="Contenteditable markdown editor for Svelte 5 backed by barkdown's property-tested round-trip codec. What you edit is exactly the markdown you save."
	/>
</svelte:head>

<div class="page">
	<header class="hero">
		<p class="kicker">Svelte 5 · contenteditable markdown</p>
		<h1>@kevinpeckham/woof-editor</h1>
		<p class="tagline">
			A WYSIWYG surface that serializes every edit back through <strong>barkdown</strong>'s
			property-tested round-trip codec — what you edit is exactly the markdown you save, with no
			drift.
		</p>
		<nav class="hero-links" aria-label="Project links">
			<a href="https://www.npmjs.com/package/@kevinpeckham/woof-editor">npm</a>
			<a href="https://github.com/kevinpeckham/woof-editor">GitHub</a>
			<a href="https://www.npmjs.com/package/@kevinpeckham/barkdown">@kevinpeckham/barkdown</a>
		</nav>
		<pre class="install"><code>bun add @kevinpeckham/woof-editor</code></pre>
	</header>

	<main>
		<section class="playground" aria-labelledby="playground-heading">
			<!-- Two column widths inside one section: `.playground-col` (720px)
			     matches the text column every other section uses, so the heading
			     and the caption/shortcuts row share the same left edge as
			     "Why"/"Usage". `.playground-wide` (1040px) is a deliberate
			     breakout for the toolbar + two-pane grid, which need the extra
			     width — it starts to the left of the text column on purpose. -->
			<div class="playground-col">
				<h2 id="playground-heading">Live playground</h2>
			</div>

			<div class="playground-wide">
				<div class="toolbar" role="toolbar" aria-label="Editor controls">
					<button type="button" onclick={() => editor.undo()} disabled={!editor.canUndo}>
						Undo
					</button>
					<button type="button" onclick={() => editor.redo()} disabled={!editor.canRedo}>
						Redo
					</button>
					{#if editor.hasEdits}
						<span class="dirty" role="status">Unsaved changes</span>
					{/if}
					<button
						type="button"
						class="save-btn"
						onclick={() => editor.markAsSaved()}
						disabled={!editor.hasEdits}
					>
						Mark saved
					</button>
				</div>

				<div class="panes">
					<div class="sheet">
						<MarkdownEditor {editor} class="demo-article" />
					</div>
					<div class="source-pane">
						<p class="source-label">Serialized markdown (live)</p>
						<pre class="source-code">{editor.markdownCurrent}</pre>
					</div>
				</div>
			</div>

			<div class="playground-col">
				<p class="theming-note">
					This page styles the document via the <code>class</code> prop; menus are themed with two
					CSS variables.
				</p>

				<div class="shortcuts">
					<span><kbd>⌘/Ctrl</kbd>+<kbd>Z</kbd> undo</span>
					<span><kbd>⌘/Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> redo</span>
					<span><kbd>⌘/Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>0/2/3/4</kbd> block types</span>
				</div>
			</div>
		</section>

		<section class="why" aria-labelledby="why-heading">
			<h2 id="why-heading">Why another markdown WYSIWYG</h2>
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
		</section>

		<section class="usage" aria-labelledby="usage-heading">
			<h2 id="usage-heading">Usage</h2>
			<pre class="code-block"><code>{usageSnippet}</code></pre>
		</section>
	</main>

	<footer>
		<p>
			MIT · <a href="https://github.com/kevinpeckham/woof-editor">GitHub</a> ·
			<a href="https://www.npmjs.com/package/@kevinpeckham/woof-editor">npm</a> · built with
			woof-editor v0.2.0
		</p>
	</footer>
</div>

<style>
	.page {
		--accent: #b45309;
		--ink: #1c1917;
		--muted: #57534e;
		--border: #e7e2da;
		--surface: #ffffff;
	}

	/* `margin-inline` (not the `margin: 0 auto` shorthand) deliberately: the
	   shorthand sets margin-top/bottom to 0 too, which — because a class
	   selector beats the `main > * + *` rhythm rule below on specificity —
	   silently overrode that rule's margin-top on `.why`/`.usage`, collapsing
	   the vertical rhythm between sections to 0. Setting only the inline
	   (left/right) margins here leaves margin-top unset, so `main > * + *`
	   is the sole rule controlling it and applies as intended. */
	.hero,
	.why,
	.usage,
	.playground-col,
	.playground-wide {
		margin-inline: auto;
		padding-inline: 1.25rem;
	}

	.hero,
	.why,
	.usage,
	.playground-col {
		max-width: 720px;
	}

	/* Deliberate breakout: wider than the 720px text column so the toolbar
	   and two-pane grid have room, while `.playground-col` above/below it
	   keeps the heading and caption/shortcuts row on the same left edge as
	   every other section's text (see the "Live playground" section markup). */
	.playground-wide {
		max-width: 1040px;
	}

	main {
		padding: 1rem 0 4rem;
	}
	/* Plain block stack (not flex) on purpose: these sections use
	   `margin-inline: auto` to center themselves under a max-width cap, and
	   `margin: auto` on the cross axis of a flex item is special-cased by
	   the flexbox spec to absorb stretch — which silently switches the
	   item to shrink-to-fit sizing (governed by content's intrinsic width,
	   capped at max-width) instead of filling the viewport. At a narrow
	   viewport that shrink-to-fit width can exceed the viewport itself
	   (a long unwrapped line in one of the <pre> blocks below is plenty),
	   overflowing the whole page horizontally. Plain block layout has no
	   such interaction, so `margin: auto` centers exactly as expected. */
	main > * + * {
		margin-top: 4.5rem;
	}

	/* --- Hero --- */
	.hero {
		padding-top: 4rem;
		padding-bottom: 3rem;
		text-align: center;
	}
	.kicker {
		margin: 0 0 0.75rem;
		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--muted);
	}
	.hero h1 {
		margin: 0 0 0.85rem;
		font-size: clamp(1.9rem, 5vw, 2.75rem);
		font-weight: 800;
		letter-spacing: -0.02em;
		color: var(--ink);
		/* The package name has no spaces — "/" isn't a soft-wrap opportunity
		   in Chromium's line breaking, so absent this, the longest
		   unbreakable run ("@kevinpeckham/woof-", since a hyphen IS
		   breakable) is the only thing standing between the browser and an
		   overflow: at this weight/size it comes in just a few pixels wider
		   than a 375px viewport's content width, pushing the whole page into
		   horizontal scroll. overflow-wrap: anywhere adds a fallback break
		   opportunity inside the run itself once normal wrapping can't fit
		   it, which is a much smaller cost than an overflowing page. */
		overflow-wrap: anywhere;
	}
	.tagline {
		margin: 0 auto 1.75rem;
		max-width: 46rem;
		font-size: 1.1rem;
		line-height: 1.65;
		color: var(--muted);
	}
	.hero-links {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 1.25rem;
		margin-bottom: 1.75rem;
		font-size: 0.95rem;
		font-weight: 600;
	}
	.hero-links a {
		color: var(--accent);
	}
	.install {
		display: inline-block;
		/* inline-block's shrink-to-fit sizing floors at min-content, which
		   for an unbreakable `<pre>` line equals its full unwrapped width —
		   that floor overrides max-width, silently pushing this box (and
		   the page under it) wider than the viewport at narrow widths.
		   min-width: 0 removes the floor so max-width + overflow-x can
		   actually take effect and scroll the box instead. */
		min-width: 0;
		max-width: 100%;
		margin: 0 auto;
		padding: 0.7rem 1.1rem;
		overflow-x: auto;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		background: var(--surface);
		font-size: 0.9rem;
		text-align: left;
	}
	.install code {
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
	}

	/* --- Shared section heading rhythm --- */
	h2 {
		margin: 0 0 1.25rem;
		font-size: 1.5rem;
		font-weight: 700;
		letter-spacing: -0.01em;
		color: var(--ink);
	}

	/* --- Playground --- */
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}
	.toolbar button {
		padding: 0.45rem 0.9rem;
		border: 1px solid var(--border);
		border-radius: 0.4rem;
		background: var(--surface);
		color: var(--ink);
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
	}
	.toolbar button:hover:not(:disabled) {
		border-color: var(--accent);
	}
	.toolbar button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.save-btn {
		margin-left: auto;
		border-color: var(--accent) !important;
		background: var(--accent) !important;
		color: #fff !important;
	}
	.save-btn:disabled {
		background: var(--surface) !important;
		color: var(--ink) !important;
	}
	.dirty {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--accent);
	}

	.panes {
		display: grid;
		grid-template-columns: 1.15fr 0.85fr;
		gap: 1.5rem;
		align-items: start;
	}
	@media (max-width: 800px) {
		.panes {
			grid-template-columns: 1fr;
		}
	}

	.sheet {
		--woof-accent: var(--accent);
		--woof-menu-bg: #292524;
		padding: 1.75rem 1.5rem 1.75rem 3.5rem;
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		background: var(--surface);
		box-shadow:
			0 1px 2px rgb(28 25 23 / 0.04),
			0 8px 24px -12px rgb(28 25 23 / 0.15);
		min-width: 0;
	}

	.source-pane {
		display: flex;
		flex-direction: column;
		min-width: 0;
		padding: 1.25rem;
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		background: #1c1917;
	}
	.source-label {
		margin: 0 0 0.75rem;
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #a8a29e;
	}
	.source-code {
		flex: 1;
		margin: 0;
		max-height: 30rem;
		overflow: auto;
		color: #e7e5e4;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 0.82rem;
		line-height: 1.6;
		white-space: pre-wrap;
		overflow-wrap: break-word;
	}

	.theming-note {
		margin: 1.25rem 0 0;
		font-size: 0.85rem;
		color: var(--muted);
	}
	.theming-note code {
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		background: var(--border);
		padding: 0.1em 0.35em;
		border-radius: 0.25em;
	}

	.shortcuts {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1.5rem;
		margin-top: 1rem;
		font-size: 0.85rem;
		color: var(--muted);
	}
	kbd {
		padding: 0.1em 0.4em;
		border: 1px solid var(--border);
		border-radius: 0.3em;
		background: var(--surface);
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 0.85em;
	}

	/* --- Why --- */
	.why p {
		margin: 0 0 1.1rem;
		font-size: 1.02rem;
		line-height: 1.7;
		color: var(--ink);
	}
	.why p:last-child {
		margin-bottom: 0;
	}
	.why a {
		color: var(--accent);
	}
	.why code {
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		background: #f5f0e8;
		padding: 0.1em 0.35em;
		border-radius: 0.25em;
		font-size: 0.9em;
	}

	/* --- Usage --- */
	.code-block {
		margin: 0;
		max-width: 100%;
		padding: 1.25rem;
		overflow-x: auto;
		border-radius: 0.75rem;
		background: #1c1917;
		color: #e7e5e4;
		font-size: 0.82rem;
		line-height: 1.6;
	}
	.code-block code {
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
	}

	/* --- Footer --- */
	footer {
		padding: 2rem 1.25rem 3rem;
		border-top: 1px solid var(--border);
		text-align: center;
		font-size: 0.9rem;
		color: var(--muted);
	}
	footer a {
		color: var(--accent);
	}

	/* --- Focus visibility --- */
	a:focus-visible,
	button:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	@media (max-width: 480px) {
		.sheet {
			padding-left: 3.25rem;
		}
		/* At this width the package name's longest naturally-breakable
		   segment ("@kevinpeckham/woof-", up to the hyphen — "/" isn't a
		   soft-wrap point) is only a few pixels too wide to fit at the
		   larger clamp() size, which is what overflow-wrap: anywhere above
		   is there to catch — but catching it means an arbitrary mid-word
		   split. Sizing down here lets it wrap at the hyphen normally
		   instead, which reads better; overflow-wrap: anywhere stays on
		   as the safety net for anything longer still. */
		.hero h1 {
			font-size: 1.6rem;
		}
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
