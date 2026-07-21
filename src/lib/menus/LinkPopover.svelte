<script lang="ts">
// fallow-ignore-file policy-violation:slx-house-rules/svelte-effect-last-resort -- every $effect below is audited (see per-site "$effect audited" comments); per-site next-line suppression is unusable because fallow (<=3.7.1) misanchors violation lines inside .svelte scripts
import { fitPopoverToViewport } from "../utils/fitPopoverToViewport";

/**
 * Link popover for the blog WYSIWYG. Opens when the author clicks a plain
 * `<a href>` in the preview. Fetches an OpenGraph preview of the target
 * (via `/api/link-preview`) and offers two actions: open the URL in a new
 * tab, or edit the link (change href / remove).
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
	onOpenExternal,
	onEditHref,
	onRemove,
	onClose,
}: {
	linkState: LinkState;
	onOpenExternal: () => void;
	onEditHref: (nextHref: string) => void;
	onRemove: () => void;
	onClose: () => void;
} = $props();

interface Preview {
	url: string;
	title: string;
	description: string;
	image: string;
	siteName: string;
	favicon: string;
}

let popoverEl: HTMLDivElement | null = $state(null);
let positioned = $state(false);

let editing = $state(false);
let editValue = $state("");

let loading = $state(false);
let preview = $state<Preview | null>(null);
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
	if (!href) return;
	loading = true;
	preview = null;
	try {
		const resp = await fetch(`/api/link-preview?url=${encodeURIComponent(href)}`);
		if (resp.ok) preview = (await resp.json()) as Preview;
	} catch {
		preview = null;
	} finally {
		loading = false;
		queueMicrotask(clampToViewport);
	}
}

// $effect audited: drives native popover show/hide, viewport-clamped positioning, and kicks off link-preview fetch on open
$effect(() => {
	if (linkState.open) {
		positioned = false;
		editing = false;
		editValue = linkState.href;
		popoverEl?.showPopover?.();
		queueMicrotask(clampToViewport);
		if (linkState.href && linkState.href !== fetchedFor) {
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
	class="fixed w-80 bg-white text-rich-black border border-slate-300 rounded-md shadow-xl overflow-hidden text-sm transition-opacity {positioned
		? 'opacity-100'
		: 'opacity-0'}"
	style="left: 0; top: 0; margin: 0;"
	ontoggle={(e) => {
		if ((e as ToggleEvent).newState === "closed" && linkState.open) onClose();
	}}
>
	{#if editing}
		<div class="p-3">
			<div class="text-xs uppercase tracking-wide opacity-50 mb-1.5">
				Edit link URL
			</div>
			<input
				type="text"
				bind:value={editValue}
				placeholder="https://example.com"
				class="w-full px-2 py-1 border rounded text-sm mb-2"
				onkeydown={(e) => {
					if (e.key === "Enter") {
						e.preventDefault();
						onEditHref(editValue.trim());
					}
				}}
			/>
			<div class="flex items-center gap-2 justify-between">
				<button
					type="button"
					class="text-xs px-2 py-1 text-red-600 hover:underline"
					onclick={onRemove}
				>
					Remove link
				</button>
				<div class="flex gap-2">
					<button
						type="button"
						class="text-xs px-2 py-1 opacity-60 hover:opacity-100"
						onclick={() => (editing = false)}
					>
						Cancel
					</button>
					<button
						type="button"
						class="text-xs px-3 py-1 bg-blue text-white rounded font-semibold"
						onclick={() => onEditHref(editValue.trim())}
					>
						Save
					</button>
				</div>
			</div>
		</div>
	{:else}
		{#if preview?.image}
			<img
				src={preview.image}
				alt=""
				class="w-full h-32 object-cover bg-slate-100"
				loading="lazy"
			/>
		{/if}
		<div class="p-3">
			<div class="flex items-center gap-1.5 text-xs opacity-60 mb-1">
				{#if preview?.favicon}
					<img src={preview.favicon} alt="" class="w-4 h-4 rounded-sm" />
				{/if}
				<span class="truncate">
					{preview?.siteName || displayHost(linkState.href)}
				</span>
			</div>
			{#if loading}
				<div class="text-sm opacity-60 mb-1">Loading preview…</div>
			{:else}
				{#if preview?.title}
					<div class="font-600 leading-snug mb-1 line-clamp-2">
						{preview.title}
					</div>
				{/if}
				{#if preview?.description}
					<div class="text-xs opacity-70 leading-snug line-clamp-3 mb-1">
						{preview.description}
					</div>
				{/if}
			{/if}
			<div class="text-xs text-blue-600 truncate mb-3" title={linkState.href}>
				{linkState.href}
			</div>
			<div class="flex items-center gap-2 justify-end">
				<button
					type="button"
					class="text-xs px-2 py-1 border rounded hover:bg-slate-100"
					onclick={startEditing}
				>
					✎ Edit link
				</button>
				<button
					type="button"
					class="text-xs px-3 py-1 bg-oxford text-white rounded font-semibold"
					onclick={onOpenExternal}
				>
					↗ Open in new tab
				</button>
			</div>
		</div>
	{/if}
</div>
