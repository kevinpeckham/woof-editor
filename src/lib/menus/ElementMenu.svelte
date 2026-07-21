<script lang="ts">
// fallow-ignore-file policy-violation:slx-house-rules/svelte-effect-last-resort -- every $effect below is audited (see per-site "$effect audited" comments); per-site next-line suppression is unusable because fallow (<=3.7.1) misanchors violation lines inside .svelte scripts
import {
	CONVERTIBLE_TAGS_LIST,
	changeBlockType,
	insertFootnote,
	isFirstH1,
	isHeadingBlock,
	removeBlock,
	toggleBlockWrap,
} from "../actions/dom";
import { fitPopoverToViewport } from "../utils/fitPopoverToViewport";

/**
 * Native popover-driven menu for the currently-active block in the blog
 * WYSIWYG. The parent (`MarkdownEditor`) tracks which block the caret is
 * in, and drives this menu's open/close + position via `menuState`.
 *
 * Menu items:
 * - Change type ▸ — submenu of P / H1..H4 / Blockquote
 * - Bold whole block — wraps children in `<strong>` or unwraps if
 *   already fully wrapped
 * - Italic whole block — same for `<em>`
 * - Delete block
 *
 * Every button is `type="button"` because the WYSIWYG mounts inside
 * the editor form.
 */

interface MenuState {
	open: boolean;
	x: number;
	y: number;
}

let {
	activeBlock,
	containerRef,
	menuState,
	onEdit,
	onClose,
	onOpenFootnoteEditor,
}: {
	activeBlock: HTMLElement | null;
	containerRef: HTMLElement | null;
	menuState: MenuState;
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

// The article-title H1 (first <h1> in the body) is the source of truth
// for `editor.titleCurrent`. Authors can't downgrade its type or
// delete it — those two menu entries hide entirely for that block.
let isTitle = $derived(isFirstH1(activeBlock, containerRef));

// Headings carry their own weight from the type scale — bold / italic on a
// heading muddies the hierarchy and round-trips to noisy markdown. Hide
// those two entries for any H1-H6 block.
let isHeading = $derived(isHeadingBlock(activeBlock));

// Footnotes on the H1 (article title) don't make sense — hide the option.
let isH1 = $derived(activeBlock?.tagName === "H1");

function clampToViewport() {
	if (!innerEl) return;
	const rect = innerEl.getBoundingClientRect();
	const clamped = fitPopoverToViewport(
		{ x: menuState.x, y: menuState.y },
		{ height: rect.height, width: rect.width },
	);
	innerEl.style.left = `${clamped.x}px`;
	innerEl.style.top = `${clamped.y}px`;
}

/**
 * Drive the native popover open/close from `menuState.open`. Fit-to-
 * viewport after render so tall submenu content doesn't clip.
 */
// $effect audited: drives native popover show/hide and imperative viewport-clamped positioning of the element menu
$effect(() => {
	if (menuState.open) {
		showTypeSubmenu = false;
		popoverEl?.showPopover?.();
		queueMicrotask(clampToViewport);
	} else {
		popoverEl?.hidePopover?.();
	}
});

// $effect audited: imperatively re-clamps popover position to viewport after submenu toggle changes menu height
$effect(() => {
	// Recompute clamp whenever the submenu toggles (menu height changed).
	if (menuState.open && showTypeSubmenu) {
		queueMicrotask(clampToViewport);
	}
});

function close() {
	onClose();
}

function apply(mutation: () => void) {
	if (!activeBlock) return close();
	mutation();
	close();
	onEdit();
}

function handleTypeChange(targetTag: string) {
	apply(() => {
		if (activeBlock) changeBlockType(activeBlock, targetTag);
	});
}

function handleBold() {
	apply(() => {
		if (activeBlock) toggleBlockWrap(activeBlock, "strong");
	});
}

function handleItalic() {
	apply(() => {
		if (activeBlock) toggleBlockWrap(activeBlock, "em");
	});
}

function handleDelete() {
	apply(() => {
		if (activeBlock) removeBlock(activeBlock);
	});
}

function handleAddFootnote() {
	if (!activeBlock || !containerRef) return close();
	const { sup, definitionLi, number } = insertFootnote(containerRef, activeBlock);
	close();
	// Parent opens the footnote-editor popover anchored to the ref.
	// It also handles the flush; we skip onEdit() so the newly-inserted
	// (empty) footnote isn't pruned before the author gets to type.
	onOpenFootnoteEditor(sup, definitionLi, number, true);
}

function handleBackdropClick(e: MouseEvent) {
	// Only close if the click landed on the backdrop, not the inner menu.
	if (e.target === popoverEl) close();
}
</script>

<div
	bind:this={popoverEl}
	popover="manual"
	role="menu"
	tabindex="-1"
	class="fixed inset-0 w-screen h-screen bg-transparent p-0 border-0"
	onclick={handleBackdropClick}
	onkeydown={(e) => {
		if (e.key === "Escape") close();
	}}
>
	<div
		bind:this={innerEl}
		class="absolute bg-slate-800 text-white border border-white/10 rounded-md shadow-lg py-1 min-w-[190px] text-sm select-none"
		style="left: {menuState.x}px; top: {menuState.y}px;"
	>
		{#if !isTitle}
			<!-- Change type -->
			<button
				type="button"
				class="w-full text-left px-3 py-1.5 hover:bg-slate-700 flex items-center justify-between"
				onclick={() => (showTypeSubmenu = !showTypeSubmenu)}
			>
				<span>Change type</span>
				<span class="opacity-60">{showTypeSubmenu ? "▾" : "▸"}</span>
			</button>
			{#if showTypeSubmenu}
				<div class="ml-2 border-l border-white/20 pl-1">
					{#each CONVERTIBLE_TAGS_LIST as option (option.tag)}
						<button
							type="button"
							class="w-full text-left px-3 py-1 hover:bg-slate-700 {activeBlock?.tagName.toLowerCase() ===
							option.tag
								? 'text-blue-300'
								: ''}"
							onclick={() => handleTypeChange(option.tag)}
						>
							{option.label}
						</button>
					{/each}
				</div>
			{/if}

			<hr class="border-white/10 my-1" />
		{:else}
			<div
				class="px-3 py-1.5 text-xs opacity-50"
				title="The article title must be a Heading 1"
			>
				Article title (H1, required)
			</div>
			<hr class="border-white/10 my-1" />
		{/if}

		{#if !isHeading}
			<button
				type="button"
				class="w-full text-left px-3 py-1.5 hover:bg-slate-700"
				onclick={handleBold}
			>
				Bold whole block
			</button>
			<button
				type="button"
				class="w-full text-left px-3 py-1.5 hover:bg-slate-700"
				onclick={handleItalic}
			>
				Italic whole block
			</button>

			<hr class="border-white/10 my-1" />
		{/if}

		{#if !isH1}
			<button
				type="button"
				class="w-full text-left px-3 py-1.5 hover:bg-slate-700"
				onclick={handleAddFootnote}
			>
				Add footnote
			</button>
		{/if}

		{#if !isTitle}
			<hr class="border-white/10 my-1" />

			<button
				type="button"
				class="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-red-300"
				onclick={handleDelete}
			>
				Delete block
			</button>
		{/if}
	</div>
</div>
