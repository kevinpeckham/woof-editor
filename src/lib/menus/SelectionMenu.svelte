<script lang="ts">
// fallow-ignore-file policy-violation:slx-house-rules/svelte-effect-last-resort -- every $effect below is audited (see per-site "$effect audited" comments); per-site next-line suppression is unusable because fallow (<=3.7.1) misanchors violation lines inside .svelte scripts
import {
	applyLinkToSelection,
	CONVERTIBLE_TAGS_LIST,
	changeBlockType,
	findNearestBlock,
	isFirstH1,
	isHeadingBlock,
	removeLinkFromSelection,
	toggleInlineEmphasisOnSelection,
} from "../actions/dom";
import { fitPopoverToViewport } from "../utils/fitPopoverToViewport";

/**
 * Floating bubble-menu for a live text selection inside the blog
 * WYSIWYG. Anchored above the selection's bounding rect. Bold / italic /
 * link / unlink all use manual Range implementations (no deprecated
 * `execCommand`): `toggleInlineEmphasisOnSelection` wraps/unwraps
 * `<strong>` / `<em>`, and `applyLinkToSelection` / `removeLinkFromSelection`
 * wrap one `<a>` per block when the selection spans multiple block
 * boundaries (an anchor can't validly straddle blocks).
 *
 * When the caller sets `selectionState.wholeBlock` to a non-null block
 * element, an additional "Convert to type" submenu is offered so the
 * user can promote/demote the wrapping block (P → H2 etc.) via the
 * same selection interaction.
 */

interface SelectionState {
	open: boolean;
	x: number;
	y: number;
	wholeBlock: HTMLElement | null;
	linkEl: HTMLAnchorElement | null;
}

let {
	selectionState,
	containerRef,
	onEdit,
	onClose,
}: {
	selectionState: SelectionState;
	containerRef: HTMLElement | null;
	onEdit: () => void;
	onClose: () => void;
} = $props();

let popoverEl: HTMLDivElement | null = $state(null);
let innerEl: HTMLDivElement | null = $state(null);
let showTypeSubmenu = $state(false);

// Suppress the "Convert to type" submenu when the wholeBlock is the
// article's title H1 — the title is required and must stay H1.
let isTitle = $derived(isFirstH1(selectionState.wholeBlock, containerRef));

// Hide Bold / Italic when the selection sits inside a heading — headings
// own their weight via the type scale. `wholeBlock` is only set for
// whole-block selections, so for partial selections we resolve the block
// from the live selection's anchor. Reference `selectionState.x` so this
// recomputes each time the parent re-opens the menu on a new selection.
let isHeading = $derived.by(() => {
	if (!selectionState.open || !containerRef) return false;
	void selectionState.x;
	if (selectionState.wholeBlock) {
		return isHeadingBlock(selectionState.wholeBlock);
	}
	const sel = window.getSelection();
	if (!sel || sel.rangeCount === 0) return false;
	return isHeadingBlock(findNearestBlock(sel.anchorNode, containerRef));
});

function clampToViewport() {
	if (!innerEl) return;
	const rect = innerEl.getBoundingClientRect();
	// Anchor is the selection's TOP-CENTER; place the menu so its
	// bottom sits on `y` (i.e. above the selection).
	const anchorX = selectionState.x - rect.width / 2;
	const anchorY = selectionState.y - rect.height - 6;
	const clamped = fitPopoverToViewport(
		{ x: anchorX, y: anchorY },
		{ height: rect.height, width: rect.width },
	);
	innerEl.style.left = `${clamped.x}px`;
	innerEl.style.top = `${clamped.y}px`;
}

// $effect audited: drives native popover show/hide and imperative viewport-clamped positioning of the selection menu
$effect(() => {
	if (selectionState.open) {
		showTypeSubmenu = false;
		popoverEl?.showPopover?.();
		queueMicrotask(clampToViewport);
	} else {
		popoverEl?.hidePopover?.();
	}
});

// $effect audited: imperatively re-clamps popover position to viewport after submenu toggle changes menu height
$effect(() => {
	// Reposition when submenu toggles (menu height changes).
	if (selectionState.open && showTypeSubmenu) {
		queueMicrotask(clampToViewport);
	}
});

/**
 * Toolbar buttons steal focus by default, which collapses the DOM
 * selection before our action fires. `preventDefault` on `mousedown`
 * suppresses the focus transfer so the selection survives the click.
 */
function preserveSelection(e: MouseEvent) {
	e.preventDefault();
}

function handleBold() {
	if (containerRef) toggleInlineEmphasisOnSelection("strong", containerRef);
	onEdit();
}

function handleItalic() {
	if (containerRef) toggleInlineEmphasisOnSelection("em", containerRef);
	onEdit();
}

function handleLink() {
	const existing = selectionState.linkEl?.getAttribute("href") ?? "";
	const url = window.prompt("URL:", existing);
	if (url === null || !containerRef) return;
	if (url === "") {
		removeLinkFromSelection(containerRef);
	} else if (selectionState.linkEl) {
		// Editing an existing link — just rewrite its href.
		selectionState.linkEl.setAttribute("href", url);
	} else {
		applyLinkToSelection(url, containerRef);
	}
	onEdit();
	onClose();
}

function handleUnlink() {
	if (containerRef) removeLinkFromSelection(containerRef);
	onEdit();
	onClose();
}

function handleTypeChange(targetTag: string) {
	if (!selectionState.wholeBlock) return;
	changeBlockType(selectionState.wholeBlock, targetTag);
	onEdit();
	onClose();
}
</script>

<div
	bind:this={popoverEl}
	popover="manual"
	role="menu"
	tabindex="-1"
	class="woof-menu-backdrop"
	onkeydown={(e) => {
		if (e.key === "Escape") onClose();
	}}
>
	<div bind:this={innerEl} class="woof-menu-panel" style="left: 0; top: 0;">
		<div class="woof-toolbar">
			{#if !isHeading}
				<button
					type="button"
					class="woof-toolbar-btn bold"
					onmousedown={preserveSelection}
					onclick={handleBold}
					aria-label="Bold"
					title="Bold"
				>
					B
				</button>
				<button
					type="button"
					class="woof-toolbar-btn italic"
					onmousedown={preserveSelection}
					onclick={handleItalic}
					aria-label="Italic"
					title="Italic"
				>
					I
				</button>
			{/if}
			{#if selectionState.linkEl}
				<button
					type="button"
					class="woof-toolbar-btn"
					onmousedown={preserveSelection}
					onclick={handleUnlink}
					title="Remove link"
				>
					Unlink
				</button>
			{:else}
				<button
					type="button"
					class="woof-toolbar-btn"
					onmousedown={preserveSelection}
					onclick={handleLink}
					title="Add link"
				>
					Link
				</button>
			{/if}
			{#if selectionState.wholeBlock && !isTitle}
				<div class="woof-toolbar-divider"></div>
				<button
					type="button"
					class="woof-toolbar-btn"
					onmousedown={preserveSelection}
					onclick={() => (showTypeSubmenu = !showTypeSubmenu)}
					title="Change block type"
				>
					Type
					<span class="woof-chevron">{showTypeSubmenu ? "▾" : "▸"}</span>
				</button>
			{/if}
		</div>
		{#if showTypeSubmenu && selectionState.wholeBlock && !isTitle}
			<div class="woof-submenu">
				{#each CONVERTIBLE_TAGS_LIST as option (option.tag)}
					<button
						type="button"
						class="woof-menu-item {selectionState.wholeBlock?.tagName.toLowerCase() === option.tag ? 'is-active' : ''}"
						onmousedown={preserveSelection}
						onclick={() => handleTypeChange(option.tag)}
					>
						{option.label}
					</button>
				{/each}
			</div>
		{/if}
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
		pointer-events: none;
	}
	.woof-menu-panel {
		position: absolute;
		padding: 0.25rem 0;
		background: var(--woof-menu-bg, #1e293b);
		color: var(--woof-menu-fg, #f8fafc);
		border: 1px solid var(--woof-menu-border, rgb(255 255 255 / 0.1));
		border-radius: 0.375rem;
		box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.3);
		font-size: 0.875rem;
		user-select: none;
		pointer-events: auto;
	}
	.woof-toolbar {
		display: flex;
		align-items: center;
		padding: 0 0.25rem;
	}
	.woof-toolbar-btn {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem 0.5rem;
		background: none;
		border: none;
		border-radius: 0.25rem;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.woof-toolbar-btn:hover {
		background: var(--woof-menu-hover, #334155);
	}
	.woof-toolbar-btn.bold {
		font-weight: 700;
	}
	.woof-toolbar-btn.italic {
		font-style: italic;
	}
	.woof-toolbar-divider {
		width: 1px;
		height: 1rem;
		background: rgb(255 255 255 / 0.2);
		margin: 0 0.25rem;
	}
	.woof-submenu {
		border-top: 1px solid var(--woof-menu-border, rgb(255 255 255 / 0.1));
		margin-top: 0.25rem;
		padding-top: 0.25rem;
	}
	.woof-menu-item {
		display: block;
		width: 100%;
		padding: 0.25rem 0.75rem;
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
	.woof-menu-item.is-active {
		color: var(--woof-accent-soft, #93c5fd);
	}
	.woof-chevron {
		opacity: 0.6;
	}
</style>
