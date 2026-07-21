<script lang="ts">
// fallow-ignore-file policy-violation:slx-house-rules/svelte-effect-last-resort -- every $effect below is audited (see per-site "$effect audited" comments); per-site next-line suppression is unusable because fallow (<=3.7.1) misanchors violation lines inside .svelte scripts
import { fitPopoverToViewport } from "../utils/fitPopoverToViewport";

/**
 * Popover editor for a single footnote's text. Anchored near the
 * clicked (or freshly-inserted) footnote ref. Opens with the current
 * definition text pre-filled; commits back to the definition `<li>` on
 * Save; supports Delete to remove both ref + definition entirely.
 *
 * Cancel semantics:
 *  - New footnote (`isNew=true`) and content is still empty → remove
 *    both ref + definition (author bailed on creating it).
 *  - Existing footnote → leave everything as-is (author changed their
 *    mind about editing).
 *
 * Save semantics:
 *  - Non-empty text → write to `<li>`'s `<p>`.
 *  - Empty text → remove the footnote entirely (blank footnotes are
 *    never useful and the pruner would strip them anyway).
 */

interface FootnoteState {
	open: boolean;
	x: number;
	y: number;
	num: number;
	initialText: string;
	isNew: boolean;
}

let {
	footnoteState,
	onSave,
	onCancel,
	onDelete,
}: {
	footnoteState: FootnoteState;
	onSave: (num: number, text: string) => void;
	onCancel: (num: number, text: string, isNew: boolean) => void;
	onDelete: (num: number) => void;
} = $props();

let popoverEl: HTMLDivElement | null = $state(null);
let innerEl: HTMLDivElement | null = $state(null);
let textareaRef: HTMLTextAreaElement | null = $state(null);
let text = $state("");

function clampToViewport() {
	if (!innerEl) return;
	const rect = innerEl.getBoundingClientRect();
	const clamped = fitPopoverToViewport(
		{ x: footnoteState.x, y: footnoteState.y },
		{ height: rect.height, width: rect.width },
	);
	innerEl.style.left = `${clamped.x}px`;
	innerEl.style.top = `${clamped.y}px`;
}

// $effect audited: drives native popover show/hide, viewport-clamped positioning, and textarea focus/select on open
$effect(() => {
	if (footnoteState.open) {
		text = footnoteState.initialText;
		popoverEl?.showPopover?.();
		queueMicrotask(() => {
			clampToViewport();
			textareaRef?.focus();
			textareaRef?.select();
		});
	} else {
		popoverEl?.hidePopover?.();
	}
});

function handleSave() {
	onSave(footnoteState.num, text);
}

function handleCancel() {
	onCancel(footnoteState.num, text, footnoteState.isNew);
}

function handleDelete() {
	onDelete(footnoteState.num);
}

function handleBackdropClick(e: MouseEvent) {
	if (e.target === popoverEl) handleCancel();
}

function handleKeydown(e: KeyboardEvent) {
	if (e.key === "Escape") {
		e.preventDefault();
		handleCancel();
	} else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
		e.preventDefault();
		handleSave();
	}
}
</script>

<div
	bind:this={popoverEl}
	popover="manual"
	role="dialog"
	aria-label="Edit footnote"
	tabindex="-1"
	class="fixed inset-0 w-screen h-screen bg-transparent p-0 border-0"
	onclick={handleBackdropClick}
	onkeydown={handleKeydown}
>
	<div
		bind:this={innerEl}
		class="absolute bg-slate-800 text-white border border-white/10 rounded-md shadow-lg p-3 w-72 text-sm"
		style="left: 0; top: 0;"
	>
		<div
			class="text-xs font-semibold uppercase tracking-wide opacity-60 mb-1.5"
		>
			Footnote [{footnoteState.num}]
		</div>
		<textarea
			bind:this={textareaRef}
			bind:value={text}
			rows="4"
			placeholder="Footnote text…"
			class="w-full px-2 py-1.5 bg-slate-900 border border-white/10 rounded text-white text-sm resize-vertical focus:outline-none focus:border-white/30"
		></textarea>
		<div class="flex items-center gap-2 mt-2">
			{#if !footnoteState.isNew}
				<button
					type="button"
					class="px-2 py-1 text-xs text-red-300 hover:bg-slate-700 rounded"
					onclick={handleDelete}
				>
					Delete
				</button>
			{/if}
			<div class="ml-auto flex gap-2">
				<button
					type="button"
					class="px-3 py-1 text-xs hover:bg-slate-700 rounded"
					onclick={handleCancel}
				>
					Cancel
				</button>
				<button
					type="button"
					class="px-3 py-1 text-xs bg-blue-500 hover:bg-blue-600 rounded font-semibold"
					onclick={handleSave}
				>
					Save
				</button>
			</div>
		</div>
	</div>
</div>
