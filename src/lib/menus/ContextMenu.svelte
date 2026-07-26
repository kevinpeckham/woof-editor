<script lang="ts">
// fallow-ignore-file policy-violation:slx-house-rules/svelte-effect-last-resort -- every $effect below is audited (see per-site "$effect audited" comments); per-site next-line suppression is unusable because fallow (<=3.7.1) misanchors violation lines inside .svelte scripts
import {
	applyLinkToSelection,
	CONVERTIBLE_TAGS_LIST,
	changeBlockType,
	insertFootnote,
	insertParagraph,
	insertPlainTextAtSelection,
	isFirstH1,
	isHeadingBlock,
	placeCaretAtStart,
	removeBlock,
	removeLinkFromSelection,
	toggleBlockWrap,
	toggleInlineEmphasisOnSelection,
} from "../actions/dom";
import { fitPopoverToViewport } from "../utils/fitPopoverToViewport";

/**
 * Contextual right-click / Cmd-click menu for the blog WYSIWYG. Anchored
 * at the click point. Adaptive: combines selection actions (when there
 * is a live selection) with block actions (change type / bold-whole /
 * delete) with structural actions that don't need either (insert
 * paragraph before/after, paste plain).
 *
 * Rendered near the click, clamped to viewport via `fitPopoverToViewport`.
 */

interface ContextState {
	open: boolean;
	x: number;
	y: number;
	block: HTMLElement | null;
	hasSelection: boolean;
	linkEl: HTMLAnchorElement | null;
}

let {
	contextState,
	containerRef,
	onEdit,
	onClose,
	onOpenFootnoteEditor,
}: {
	contextState: ContextState;
	containerRef: HTMLElement | null;
	onEdit: () => void;
	onClose: () => void;
	onOpenFootnoteEditor: (
		sup: HTMLElement,
		definitionLi: HTMLElement,
		number: number,
		isNew: boolean,
	) => void;
} = $props();

let popoverEl: HTMLDivElement | null = $state(null);
let innerEl: HTMLDivElement | null = $state(null);
let showTypeSubmenu = $state(false);

// See `ElementMenu` — the article-title H1 can't be
// downgraded or deleted from any menu surface.
let isTitle = $derived(isFirstH1(contextState.block, containerRef));

// Bold / italic are hidden (both for the whole block and for a selection
// inside it) when the block under the cursor is a heading — headings own
// their weight via the type scale.
let isHeading = $derived(isHeadingBlock(contextState.block));

// Footnotes on the H1 (article title) don't make sense — hide the option.
let isH1 = $derived(contextState.block?.tagName === "H1");

function clampToViewport() {
	if (!innerEl) return;
	const rect = innerEl.getBoundingClientRect();
	const clamped = fitPopoverToViewport(
		{ x: contextState.x, y: contextState.y },
		{ height: rect.height, width: rect.width },
	);
	innerEl.style.left = `${clamped.x}px`;
	innerEl.style.top = `${clamped.y}px`;
}

// $effect audited: drives native popover show/hide and imperative viewport-clamped positioning of the context menu
$effect(() => {
	if (contextState.open) {
		showTypeSubmenu = false;
		popoverEl?.showPopover?.();
		queueMicrotask(clampToViewport);
	} else {
		popoverEl?.hidePopover?.();
	}
});

// $effect audited: imperatively re-clamps popover position to viewport after submenu toggle changes menu height
$effect(() => {
	if (contextState.open && showTypeSubmenu) {
		queueMicrotask(clampToViewport);
	}
});

function preserveSelection(e: MouseEvent) {
	e.preventDefault();
}

function apply(mutation: () => void) {
	mutation();
	onClose();
	onEdit();
}

function handleBoldSelection() {
	if (containerRef) toggleInlineEmphasisOnSelection("strong", containerRef);
	onClose();
	onEdit();
}
function handleItalicSelection() {
	if (containerRef) toggleInlineEmphasisOnSelection("em", containerRef);
	onClose();
	onEdit();
}
function handleLink() {
	const existing = contextState.linkEl?.getAttribute("href") ?? "";
	const url = window.prompt("URL:", existing);
	if (url === null || !containerRef) return;
	if (url === "") {
		removeLinkFromSelection(containerRef);
	} else if (contextState.linkEl) {
		contextState.linkEl.setAttribute("href", url);
	} else {
		applyLinkToSelection(url, containerRef);
	}
	onClose();
	onEdit();
}
function handleUnlink() {
	if (containerRef) removeLinkFromSelection(containerRef);
	onClose();
	onEdit();
}

function handleBoldBlock() {
	apply(() => {
		if (contextState.block) toggleBlockWrap(contextState.block, "strong");
	});
}
function handleItalicBlock() {
	apply(() => {
		if (contextState.block) toggleBlockWrap(contextState.block, "em");
	});
}
function handleDeleteBlock() {
	apply(() => {
		if (contextState.block) removeBlock(contextState.block);
	});
}
function handleTypeChange(targetTag: string) {
	apply(() => {
		if (contextState.block) changeBlockType(contextState.block, targetTag);
	});
}

function handleInsertBefore() {
	apply(() => {
		if (!contextState.block) return;
		const p = insertParagraph(contextState.block, "before");
		placeCaretAtStart(p);
	});
}
function handleInsertAfter() {
	apply(() => {
		if (!contextState.block) return;
		const p = insertParagraph(contextState.block, "after");
		placeCaretAtStart(p);
	});
}

function handleAddFootnote() {
	if (!contextState.block || !containerRef) return onClose();
	const { sup, definitionLi, number } = insertFootnote(containerRef, contextState.block);
	onClose();
	onOpenFootnoteEditor(sup, definitionLi, number, true);
}

async function handlePastePlain() {
	try {
		const text = await navigator.clipboard.readText();
		if (containerRef) insertPlainTextAtSelection(text, containerRef);
		onClose();
		onEdit();
	} catch {
		// User denied clipboard permission — fall back to noop with hint.
		window.alert(
			"Paste as plain text failed — clipboard permission denied. Use Cmd/Ctrl+Shift+V instead.",
		);
		onClose();
	}
}

function handleBackdropClick(e: MouseEvent) {
	if (e.target === popoverEl) onClose();
}
</script>

<div
	bind:this={popoverEl}
	popover="manual"
	role="menu"
	tabindex="-1"
	class="woof-menu-backdrop"
	onclick={handleBackdropClick}
	oncontextmenu={(e) => {
		e.preventDefault();
		onClose();
	}}
	onkeydown={(e) => {
		if (e.key === "Escape") onClose();
	}}
>
	<div bind:this={innerEl} class="woof-menu-panel" style="left: 0; top: 0;">
		{#if contextState.hasSelection}
			{#if !isHeading}
				<button
					type="button"
					class="woof-menu-item"
					onmousedown={preserveSelection}
					onclick={handleBoldSelection}
				>
					Bold selection
				</button>
				<button
					type="button"
					class="woof-menu-item"
					onmousedown={preserveSelection}
					onclick={handleItalicSelection}
				>
					Italic selection
				</button>
			{/if}
			{#if contextState.linkEl}
				<button
					type="button"
					class="woof-menu-item"
					onmousedown={preserveSelection}
					onclick={handleUnlink}
				>
					Remove link
				</button>
			{:else}
				<button
					type="button"
					class="woof-menu-item"
					onmousedown={preserveSelection}
					onclick={handleLink}
				>
					Add link…
				</button>
			{/if}
			<hr class="woof-menu-hr" />
		{/if}

		{#if contextState.block}
			{#if !isTitle}
				<button type="button" class="woof-menu-item" onclick={() => (showTypeSubmenu = !showTypeSubmenu)}>
					<span>Change block type</span>
					<span class="woof-chevron">{showTypeSubmenu ? "▾" : "▸"}</span>
				</button>
				{#if showTypeSubmenu}
					<div class="woof-submenu">
						{#each CONVERTIBLE_TAGS_LIST as option (option.tag)}
							<button
								type="button"
								class="woof-menu-item {contextState.block?.tagName.toLowerCase() === option.tag ? 'is-active' : ''}"
								onclick={() => handleTypeChange(option.tag)}
							>
								{option.label}
							</button>
						{/each}
					</div>
				{/if}
			{:else}
				<div class="woof-menu-note" title="The article title must be a Heading 1">
					Article title (H1, required)
				</div>
			{/if}

			{#if !isHeading}
				<button type="button" class="woof-menu-item" onclick={handleBoldBlock}>
					Bold whole block
				</button>
				<button type="button" class="woof-menu-item" onclick={handleItalicBlock}>
					Italic whole block
				</button>
			{/if}

			<hr class="woof-menu-hr" />

			<button type="button" class="woof-menu-item" onclick={handleInsertBefore}>
				Insert paragraph before
			</button>
			<button type="button" class="woof-menu-item" onclick={handleInsertAfter}>
				Insert paragraph after
			</button>
			{#if !isH1}
			<button type="button" class="woof-menu-item" onclick={handleAddFootnote}>
				Add footnote
			</button>
			{/if}

			{#if !isTitle}
				<hr class="woof-menu-hr" />

				<button type="button" class="woof-menu-item danger" onclick={handleDeleteBlock}>
					Delete block
				</button>
			{/if}
		{/if}

		<hr class="woof-menu-hr" />
		<button type="button" class="woof-menu-item" onclick={handlePastePlain}>
			Paste as plain text
		</button>
	</div>
</div>

<style>
	.woof-menu-backdrop {
		position: fixed;
		inset: 0;
		width: 100vw;
		height: 100vh;
		background: transparent;
		border: 0;
		padding: 0;
		margin: 0;
	}
	.woof-menu-panel {
		position: absolute;
		min-width: 200px;
		padding: 0.25rem 0;
		background: var(--woof-menu-bg, #1e293b);
		color: var(--woof-menu-fg, #f8fafc);
		border: 1px solid var(--woof-menu-border, rgb(255 255 255 / 0.1));
		border-radius: 0.375rem;
		box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.3);
		font-size: 0.875rem;
		user-select: none;
	}
	.woof-menu-item {
		display: flex;
		width: 100%;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.375rem 0.75rem;
		background: none;
		border: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.woof-menu-item:hover {
		background: var(--woof-menu-hover, #334155);
	}
	.woof-menu-item.danger {
		color: var(--woof-danger, #fca5a5);
	}
	.woof-menu-item.is-active {
		color: var(--woof-accent-soft, #93c5fd);
	}
	.woof-menu-hr {
		border: none;
		border-top: 1px solid var(--woof-menu-border, rgb(255 255 255 / 0.1));
		margin: 0.25rem 0;
	}
	.woof-submenu {
		margin-left: 0.5rem;
		padding-left: 0.25rem;
		border-left: 1px solid rgb(255 255 255 / 0.2);
	}
	.woof-submenu .woof-menu-item {
		padding: 0.25rem 0.75rem;
	}
	.woof-menu-note {
		padding: 0.375rem 0.75rem;
		font-size: 0.75rem;
		opacity: 0.5;
	}
	.woof-chevron {
		opacity: 0.6;
	}
</style>
