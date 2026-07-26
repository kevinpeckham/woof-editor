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
	class="woof-menu-backdrop"
	onclick={handleBackdropClick}
	onkeydown={handleKeydown}
>
	<div bind:this={innerEl} class="woof-fn-panel" style="left: 0; top: 0;">
		<div class="woof-fn-label">
			Footnote [{footnoteState.num}]
		</div>
		<textarea
			bind:this={textareaRef}
			bind:value={text}
			rows="4"
			placeholder="Footnote text…"
			class="woof-fn-textarea"
		></textarea>
		<div class="woof-fn-actions">
			{#if !footnoteState.isNew}
				<button type="button" class="woof-btn woof-btn-danger" onclick={handleDelete}>
					Delete
				</button>
			{/if}
			<div class="woof-fn-actions-end">
				<button type="button" class="woof-btn" onclick={handleCancel}>
					Cancel
				</button>
				<button type="button" class="woof-btn woof-btn-primary" onclick={handleSave}>
					Save
				</button>
			</div>
		</div>
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
	.woof-fn-panel {
		position: absolute;
		width: 18rem;
		padding: 0.75rem;
		background: var(--woof-menu-bg, #1e293b);
		color: var(--woof-menu-fg, #f8fafc);
		border: 1px solid var(--woof-menu-border, rgb(255 255 255 / 0.1));
		border-radius: 0.375rem;
		box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.3);
		font-size: 0.875rem;
	}
	.woof-fn-label {
		margin-bottom: 0.375rem;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		opacity: 0.6;
	}
	.woof-fn-textarea {
		width: 100%;
		padding: 0.375rem 0.5rem;
		background: var(--woof-input-bg, #0f172a);
		border: 1px solid var(--woof-menu-border, rgb(255 255 255 / 0.1));
		border-radius: 0.25rem;
		color: inherit;
		font: inherit;
		font-size: 0.875rem;
		resize: vertical;
	}
	.woof-fn-textarea:focus {
		outline: none;
		border-color: rgb(255 255 255 / 0.3);
	}
	.woof-fn-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}
	.woof-fn-actions-end {
		display: flex;
		gap: 0.5rem;
		margin-left: auto;
	}
	.woof-btn {
		padding: 0.25rem 0.75rem;
		background: none;
		border: none;
		border-radius: 0.25rem;
		color: inherit;
		font: inherit;
		font-size: 0.75rem;
		cursor: pointer;
	}
	.woof-btn:hover {
		background: var(--woof-menu-hover, #334155);
	}
	.woof-btn-primary {
		background: var(--woof-accent, #3b82f6);
		font-weight: 600;
	}
	.woof-btn-primary:hover {
		background: var(--woof-accent, #3b82f6);
		filter: brightness(1.1);
	}
	.woof-btn-danger {
		color: var(--woof-danger, #fca5a5);
	}
</style>
