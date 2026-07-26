<script lang="ts">
// fallow-ignore-file policy-violation:slx-house-rules/svelte-effect-last-resort -- one $effect below: popover show/hide + viewport clamping. It carries the heaviest residual smell in the package (five $state writes and a hand-rolled `fetchedFor` memo); the smell, its two behaviour deltas, and the planned 0.3 replacement are documented at the site rather than excused. Per-site next-line suppression is unusable because fallow (<=3.7.1) misanchors violation lines inside .svelte scripts
import type { LinkPreview } from "../types";
import { fitPopoverToViewport } from "../utils/fitPopoverToViewport";

/**
 * Link popover for the blog WYSIWYG. Opens when the author clicks a plain
 * `<a href>` in the preview. Preview loading is consumer-provided via the
 * `loadLinkPreview` prop — there is no built-in endpoint. Without a
 * callback, the popover shows just the URL + actions (no loading state,
 * no fetch). Offers two actions: open the URL in a new tab, or edit the
 * link (change href / remove).
 *
 * The panel itself is a native `popover="auto"` (light-dismiss on outside
 * click + Escape) positioned with `fixed` coords near the click point.
 */

interface LinkState {
	open: boolean;
	x: number;
	y: number;
	href: string;
}

let {
	linkState,
	loadLinkPreview,
	onOpenExternal,
	onEditHref,
	onRemove,
	onClose,
}: {
	linkState: LinkState;
	loadLinkPreview?: (url: string) => Promise<LinkPreview | null>;
	onOpenExternal: () => void;
	onEditHref: (nextHref: string) => void;
	onRemove: () => void;
	onClose: () => void;
} = $props();

let popoverEl: HTMLDivElement | null = $state(null);
let positioned = $state(false);

let editing = $state(false);
let editValue = $state("");

let loading = $state(false);
let preview = $state<LinkPreview | null>(null);
let fetchedFor = $state("");

function clampToViewport() {
	if (!popoverEl) return;
	const rect = popoverEl.getBoundingClientRect();
	const clamped = fitPopoverToViewport(
		{ x: linkState.x, y: linkState.y + 8 },
		{ height: rect.height, width: rect.width },
	);
	popoverEl.style.left = `${clamped.x}px`;
	popoverEl.style.top = `${clamped.y}px`;
	positioned = true;
}

async function loadPreview(href: string) {
	if (!href || !loadLinkPreview) return;
	loading = true;
	preview = null;
	try {
		preview = await loadLinkPreview(href);
	} catch {
		preview = null;
	} finally {
		loading = false;
		queueMicrotask(clampToViewport);
	}
}

// $effect audited: drives native popover show/hide, viewport-clamped
// positioning, and kicks off the link-preview fetch on open. The
// showPopover()/hidePopover() + post-paint clamp core is legitimate.
//
// KNOWN SMELL, and the heaviest one in this package — deliberately left for
// 0.3. This effect performs five $state writes (`positioned`, `editing`,
// `editValue`, `fetchedFor`, plus `loading`/`preview` transitively via
// loadPreview) and launches an async side effect. `fetchedFor` is the tell:
// a hand-rolled "have I already done this?" memo exists only to stop the
// effect re-firing, which means the effect is being used to model an EDGE
// (the open transition) with a primitive that models a STATE.
//
// Planned 0.3 shape: extract a mount-scoped panel rendered under
// {#if linkState.open}, with `editing`/`editValue`/`positioned` as ordinary
// local $state (correct-by-construction at mount) and the fetch fired once
// on mount. `fetchedFor` disappears entirely and this effect collapses to a
// two-liner. Two behaviour deltas to accept deliberately when doing it:
// today `fetchedFor` caches a preview across close/reopen of the same href
// (mount-scoped state would refetch), and today a FAILED fetch is never
// retried on reopen because `fetchedFor` is set before the await and never
// reset — arguably a bug the refactor fixes for free.
//
// Deferred because LinkPopover is a public export with a consumer-facing
// `loadLinkPreview` contract, uses popover="auto" light-dismiss (the
// ontoggle -> onClose bridge interacts with mount timing), and relies on the
// `unpositioned` class to hide the pre-clamp flash — mount/unmount
// reordering touches all three at once, with no component tests.
$effect(() => {
	if (linkState.open) {
		positioned = false;
		editing = false;
		editValue = linkState.href;
		popoverEl?.showPopover?.();
		queueMicrotask(clampToViewport);
		if (loadLinkPreview && linkState.href && linkState.href !== fetchedFor) {
			fetchedFor = linkState.href;
			void loadPreview(linkState.href);
		}
	} else {
		popoverEl?.hidePopover?.();
	}
});

function startEditing() {
	editing = true;
	editValue = linkState.href;
	queueMicrotask(clampToViewport);
}

function displayHost(href: string): string {
	try {
		return new URL(href).host;
	} catch {
		return href;
	}
}
</script>

<div
	bind:this={popoverEl}
	popover="auto"
	class="woof-link-panel {positioned ? '' : 'unpositioned'}"
	style="left: 0; top: 0;"
	ontoggle={(e) => {
		if ((e as ToggleEvent).newState === "closed" && linkState.open) onClose();
	}}
>
	{#if editing}
		<div class="woof-link-body">
			<div class="woof-link-label">
				Edit link URL
			</div>
			<input
				type="text"
				bind:value={editValue}
				placeholder="https://example.com"
				class="woof-link-input"
				onkeydown={(e) => {
					if (e.key === "Enter") {
						e.preventDefault();
						onEditHref(editValue.trim());
					}
				}}
			/>
			<div class="woof-link-actions spread">
				<button type="button" class="woof-link-btn-text woof-link-btn-danger" onclick={onRemove}>
					Remove link
				</button>
				<div class="woof-link-actions">
					<button type="button" class="woof-link-btn-text" onclick={() => (editing = false)}>
						Cancel
					</button>
					<button type="button" class="woof-link-btn-primary" onclick={() => onEditHref(editValue.trim())}>
						Save
					</button>
				</div>
			</div>
		</div>
	{:else}
		{#if preview?.image}
			<img src={preview.image} alt="" class="woof-link-image" loading="lazy" />
		{/if}
		<div class="woof-link-body">
			<div class="woof-link-site">
				{#if preview?.favicon}
					<img src={preview.favicon} alt="" />
				{/if}
				<span>
					{preview?.siteName || displayHost(linkState.href)}
				</span>
			</div>
			{#if loading}
				<div class="woof-link-muted">Loading preview…</div>
			{:else}
				{#if preview?.title}
					<div class="woof-link-title">
						{preview.title}
					</div>
				{/if}
				{#if preview?.description}
					<div class="woof-link-desc">
						{preview.description}
					</div>
				{/if}
			{/if}
			<div class="woof-link-url" title={linkState.href}>
				{linkState.href}
			</div>
			<div class="woof-link-actions">
				<button type="button" class="woof-link-btn" onclick={startEditing}>
					✎ Edit link
				</button>
				<button type="button" class="woof-link-btn-primary" onclick={onOpenExternal}>
					↗ Open in new tab
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.woof-link-panel {
		position: fixed;
		width: 20rem;
		margin: 0;
		padding: 0;
		background: var(--woof-popover-bg, #fff);
		color: var(--woof-popover-fg, #0f172a);
		border: 1px solid var(--woof-popover-border, #cbd5e1);
		border-radius: 0.375rem;
		box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.15);
		overflow: hidden;
		font-size: 0.875rem;
		transition: opacity 100ms;
	}
	.woof-link-panel.unpositioned {
		opacity: 0;
	}
	.woof-link-image {
		width: 100%;
		height: 8rem;
		object-fit: cover;
		background: #f1f5f9;
	}
	.woof-link-body {
		padding: 0.75rem;
	}
	.woof-link-site {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		margin-bottom: 0.25rem;
		font-size: 0.75rem;
		opacity: 0.6;
	}
	.woof-link-site img {
		width: 1rem;
		height: 1rem;
		border-radius: 0.125rem;
	}
	.woof-link-site span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.woof-link-title {
		margin-bottom: 0.25rem;
		font-weight: 600;
		line-height: 1.35;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.woof-link-desc {
		margin-bottom: 0.25rem;
		font-size: 0.75rem;
		line-height: 1.35;
		opacity: 0.7;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.woof-link-url {
		margin-bottom: 0.75rem;
		font-size: 0.75rem;
		color: var(--woof-accent, #3b82f6);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.woof-link-muted {
		margin-bottom: 0.25rem;
		opacity: 0.6;
	}
	.woof-link-actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.5rem;
	}
	.woof-link-actions.spread {
		justify-content: space-between;
	}
	.woof-link-btn {
		padding: 0.25rem 0.5rem;
		background: none;
		border: 1px solid var(--woof-popover-border, #cbd5e1);
		border-radius: 0.25rem;
		color: inherit;
		font: inherit;
		font-size: 0.75rem;
		cursor: pointer;
	}
	.woof-link-btn:hover {
		background: #f1f5f9;
	}
	.woof-link-btn-primary {
		padding: 0.25rem 0.75rem;
		background: var(--woof-gutter-bg, #081526);
		border: none;
		border-radius: 0.25rem;
		color: #fff;
		font: inherit;
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
	}
	.woof-link-btn-primary:hover {
		filter: brightness(1.2);
	}
	.woof-link-btn-text {
		padding: 0.25rem 0.5rem;
		background: none;
		border: none;
		color: inherit;
		font: inherit;
		font-size: 0.75rem;
		cursor: pointer;
		opacity: 0.6;
	}
	.woof-link-btn-text:hover {
		opacity: 1;
	}
	.woof-link-btn-danger {
		color: #dc2626;
		opacity: 1;
	}
	.woof-link-btn-danger:hover {
		text-decoration: underline;
	}
	.woof-link-input {
		width: 100%;
		margin-bottom: 0.5rem;
		padding: 0.25rem 0.5rem;
		background: var(--woof-popover-bg, #fff);
		border: 1px solid var(--woof-popover-border, #cbd5e1);
		border-radius: 0.25rem;
		color: inherit;
		font: inherit;
		font-size: 0.875rem;
	}
	.woof-link-label {
		margin-bottom: 0.375rem;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		opacity: 0.5;
	}
</style>
