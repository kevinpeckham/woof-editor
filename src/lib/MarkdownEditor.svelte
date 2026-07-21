<script lang="ts">
// fallow-ignore-file policy-violation:slx-house-rules/svelte-effect-last-resort -- every $effect below is audited (see per-site "$effect audited" comments); per-site next-line suppression is unusable because fallow (<=3.7.1) misanchors violation lines inside .svelte scripts

// Importing this util registers `marked-footnote` as a side effect —
// keep so the WYSIWYG and the preview share one marked configuration.
// Markdown ⇄ DOM codec: our published @kevinpeckham/barkdown package
// (extracted from this component's original utils; adds tables, images,
// and property-tested round-trip guarantees). Sanitization stays here —
// it is deliberately out of the codec's scope.
import { toDom, toMarkdown } from "@kevinpeckham/barkdown";
import DOMPurify from "isomorphic-dompurify";
import { untrack } from "svelte";
import {
	changeBlockType,
	findFootnoteDefinition,
	findFootnoteRef,
	findNearestBlock,
	getFootnoteText,
	isFirstH1,
	parseFootnoteNum,
	placeCaretAtStart,
	pruneOrphanFootnotes,
	removeFootnote,
	setFootnoteText,
} from "./actions/dom";
import ContextMenu from "./menus/ContextMenu.svelte";
import ElementMenu from "./menus/ElementMenu.svelte";
import FootnoteEditor from "./menus/FootnoteEditor.svelte";
import LinkPopover from "./menus/LinkPopover.svelte";
import SelectionMenu from "./menus/SelectionMenu.svelte";
import type { MarkdownEditorState } from "./state/editor.svelte";

/**
 * WYSIWYG surface for the blog editor's preview pane. Owns a
 * contenteditable subtree that:
 *
 * 1. Seeds itself from `editor.markdownCurrent` (via `marked` +
 *    dompurify) on mount and on external markdown changes (LLM chat,
 *    toggling from the markdown pane, article reload).
 * 2. Serializes back to markdown on every DOM mutation via
 *    `serializeHtmlToMarkdown`, debounced 250ms so keystrokes don't
 *    thrash. The write sets `editor.isSyncingFromWysiwyg = true`
 *    so the seed-effect below skips its re-seed and doesn't clobber
 *    the caret.
 * 3. Flushes any pending debounce on unmount so toggling to the
 *    markdown pane never drops work.
 * 4. Tracks the caret's containing block via `selectionchange` and
 *    exposes it through a gutter "⋮" button. Clicking the button
 *    opens `ElementMenu` for structural edits (change
 *    type, bold-whole, italic-whole, delete).
 *
 * The DOM inside the contenteditable is intentionally an "escape from
 * Svelte" region — Svelte does not re-render it. `containerRef.innerHTML`
 * is written imperatively.
 */

let { editor }: { editor: MarkdownEditorState } = $props();

let shellRef: HTMLDivElement | null = $state(null);
let containerRef: HTMLDivElement | null = $state(null);
let flushTimer: ReturnType<typeof setTimeout> | null = null;

// Element-menu state.
let activeBlock: HTMLElement | null = $state(null);
let gutterButtonTop: number | null = $state(null);

// Short block-type label for the gutter button (replaces the ⋮ icon) so the
// author can see the current block's type at a glance.
const gutterLabel = $derived.by(() => {
	const tag = activeBlock?.tagName;
	switch (tag) {
		case "P":
			return "P";
		case "H1":
		case "H2":
		case "H3":
		case "H4":
		case "H5":
		case "H6":
			return tag;
		case "BLOCKQUOTE":
			return "BQ";
		case "UL":
			return "BL"; // bulleted list
		case "OL":
			return "NL"; // numbered list
		case "LI":
			return activeBlock?.parentElement?.tagName === "OL" ? "NL" : "BL";
		case "PRE":
			return "CB"; // code block
		default:
			return tag ? tag.slice(0, 2) : "¶";
	}
});
let menuState = $state({ open: false, x: 0, y: 0 });

// Selection bubble-menu state.
let selectionState = $state<{
	open: boolean;
	x: number;
	y: number;
	wholeBlock: HTMLElement | null;
	linkEl: HTMLAnchorElement | null;
}>({
	linkEl: null,
	open: false,
	wholeBlock: null,
	x: 0,
	y: 0,
});

// Right-click context menu state.
let contextState = $state<{
	open: boolean;
	x: number;
	y: number;
	block: HTMLElement | null;
	hasSelection: boolean;
	linkEl: HTMLAnchorElement | null;
}>({
	block: null,
	hasSelection: false,
	linkEl: null,
	open: false,
	x: 0,
	y: 0,
});

// Link popover state — opened when the author clicks a plain content
// `<a href>` in the preview. Offers open-in-new-tab + edit. The anchor
// DOM node is held separately (non-serialized) for edit/remove.
let linkState = $state<{ open: boolean; x: number; y: number; href: string }>({
	href: "",
	open: false,
	x: 0,
	y: 0,
});
let activeLinkAnchor: HTMLAnchorElement | null = null;

// Footnote-editor popover state. Opened from the element/context menus
// after `insertFootnote` (isNew=true), or from a click on an existing
// `<sup data-footnote-ref>` in the body (isNew=false).
let footnoteState = $state<{
	open: boolean;
	x: number;
	y: number;
	num: number;
	initialText: string;
	isNew: boolean;
}>({
	initialText: "",
	isNew: false,
	num: 0,
	open: false,
	x: 0,
	y: 0,
});

function seedFromMarkdown(md: string) {
	if (!containerRef) return;
	const rawHtml = toDom(md);
	const clean = DOMPurify.sanitize(rawHtml, {
		ADD_ATTR: ["data-footnote-ref", "data-footnotes", "id"],
		USE_PROFILES: { html: true },
	});
	containerRef.innerHTML = clean;
	// Loading fresh content invalidates the tracked block.
	activeBlock = null;
	gutterButtonTop = null;
}

function flushToMarkdown() {
	if (!containerRef) return;
	// Prune empty footnote definitions + dangling refs before serialization
	// so the emitted markdown never contains `[^N]: ` with no body. Skips
	// if the footnote editor is open — the definition-in-progress is
	// intentionally empty until the author saves.
	if (!footnoteState.open) {
		pruneOrphanFootnotes(containerRef);
	}
	const newMd = toMarkdown(containerRef);
	if (newMd === editor.markdownCurrent) return;
	editor.isSyncingFromWysiwyg = true;
	editor.markdownCurrent = newMd;
	// Snapshot for undo/redo. The state class dedupes vs. the last entry
	// and skips while a replay is in flight — safe to call on every flush.
	editor.pushHistory(newMd);
	// Clear the flag on the next microtask so the seed-effect that
	// re-runs due to the write sees the flag and skips its re-seed.
	queueMicrotask(() => {
		editor.isSyncingFromWysiwyg = false;
	});
}

function scheduleFlush() {
	if (flushTimer) clearTimeout(flushTimer);
	flushTimer = setTimeout(() => {
		flushTimer = null;
		flushToMarkdown();
	}, 250);
}

function handleInput() {
	scheduleFlush();
	// Typing can move the caret to a new block (e.g. Enter). Reposition
	// the gutter button after the browser has settled.
	queueMicrotask(updateGutterButtonPosition);
}

function updateGutterButtonPosition() {
	if (!containerRef || !shellRef || !activeBlock) {
		gutterButtonTop = null;
		return;
	}
	if (!containerRef.contains(activeBlock)) {
		activeBlock = null;
		gutterButtonTop = null;
		return;
	}
	const shellRect = shellRef.getBoundingClientRect();
	const blockRect = activeBlock.getBoundingClientRect();
	gutterButtonTop = blockRect.top - shellRect.top;
}

function updateActiveBlockFromSelection() {
	if (!containerRef) return;
	const sel = window.getSelection();
	if (!sel || sel.rangeCount === 0) return;
	const range = sel.getRangeAt(0);
	if (!containerRef.contains(range.startContainer)) return;
	const block = findNearestBlock(range.startContainer, containerRef);
	if (block !== activeBlock) {
		activeBlock = block;
	}
	updateGutterButtonPosition();
}

function handleGutterClick(e: MouseEvent) {
	e.preventDefault();
	e.stopPropagation();
	if (!activeBlock) return;
	// Flush any pending edits so the menu operates on the freshest DOM.
	if (flushTimer) {
		clearTimeout(flushTimer);
		flushTimer = null;
		flushToMarkdown();
	}
	const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
	menuState = { open: true, x: rect.right + 4, y: rect.top };
}

function handleMenuEdit() {
	// A menu action just mutated the DOM. Flush + refresh the tracked
	// block (it may have been replaced or removed).
	flushToMarkdown();
	queueMicrotask(() => {
		updateActiveBlockFromSelection();
	});
}

function handleMenuClose() {
	menuState = { ...menuState, open: false };
}

/**
 * Compute selection state and either open or close the bubble-menu.
 * Called on mouseup/keyup and selectionchange (with debouncing where
 * appropriate). We deliberately DON'T fire on every selectionchange
 * (that fires many times while dragging) — mouseup + keyup catch the
 * intent moments.
 */
function updateSelectionMenu() {
	if (!containerRef) return;
	const sel = window.getSelection();
	if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
		if (selectionState.open) selectionState = { ...selectionState, open: false };
		return;
	}
	const range = sel.getRangeAt(0);
	if (!containerRef.contains(range.commonAncestorContainer)) {
		if (selectionState.open) selectionState = { ...selectionState, open: false };
		return;
	}
	const text = sel.toString();
	if (text.trim().length === 0) {
		if (selectionState.open) selectionState = { ...selectionState, open: false };
		return;
	}
	const rect = range.getBoundingClientRect();
	if (rect.width === 0 && rect.height === 0) {
		if (selectionState.open) selectionState = { ...selectionState, open: false };
		return;
	}

	// Is the selection entirely inside a single `<a>` element?
	const startEl =
		range.startContainer.nodeType === 1
			? (range.startContainer as HTMLElement)
			: range.startContainer.parentElement;
	const linkEl = (startEl?.closest("a") ?? null) as HTMLAnchorElement | null;

	// Does the selection exactly span one whole block's text content?
	let wholeBlock: HTMLElement | null = null;
	const block = findNearestBlock(range.startContainer, containerRef);
	if (block && block.textContent && text.trim() === block.textContent.trim()) {
		wholeBlock = block;
	}

	selectionState = {
		linkEl,
		open: true,
		wholeBlock,
		x: rect.left + rect.width / 2,
		y: rect.top,
	};
}

function handleContainerMouseUp() {
	// Wait a beat so the browser finalizes the selection.
	queueMicrotask(updateSelectionMenu);
}

// Block-type shortcuts: Cmd/Ctrl + Alt + <number> converts the block
// containing the caret/selection (Google-Docs convention). We key off
// `e.code` (Digit2 / Numpad2) not `e.key`, because Option+2 on macOS
// yields a special character ("™") for `e.key`.
const BLOCK_TYPE_SHORTCUTS: Record<string, string> = {
	Digit0: "p",
	Digit2: "h2",
	Digit3: "h3",
	Digit4: "h4",
	Numpad0: "p",
	Numpad2: "h2",
	Numpad3: "h3",
	Numpad4: "h4",
};

function handleContainerKeyDown(e: KeyboardEvent) {
	if (!(e.metaKey || e.ctrlKey) || !e.altKey || e.shiftKey) return;
	const tag = BLOCK_TYPE_SHORTCUTS[e.code];
	if (!tag || !containerRef) return;

	// Work purely off the caret — no text selection required, so the
	// shortcut fires from an empty block too. When the caret sits directly
	// in the container (common for a freshly-created empty block), resolve
	// to the child block at the caret offset before walking up.
	const sel = window.getSelection();
	if (!sel || sel.rangeCount === 0) return;
	const range = sel.getRangeAt(0);
	let anchor: Node | null = range.startContainer;
	if (anchor === containerRef) {
		const idx = Math.min(range.startOffset, containerRef.children.length - 1);
		anchor = containerRef.children[idx] ?? null;
	}
	const block = findNearestBlock(anchor, containerRef);
	if (!block) return;
	// The article-title H1 is protected — it must stay the title.
	if (isFirstH1(block, containerRef)) return;

	e.preventDefault();
	const newEl = changeBlockType(block, tag);
	// Drop the caret into the new block so the author can start typing the
	// heading immediately (the old element was replaced).
	if (newEl) placeCaretAtStart(newEl);
	// Close any open menus (the block element was replaced).
	if (selectionState.open) selectionState = { ...selectionState, open: false };
	if (menuState.open) menuState = { ...menuState, open: false };
	flushToMarkdown();
}

function handleContainerKeyUp(e: KeyboardEvent) {
	// Shift+arrow keys extend selection. Also handle Enter/Space that
	// would collapse it. The general shape: recompute after any keyup.
	if (e.key === "Shift" || e.key.startsWith("Arrow") || e.key === "Home" || e.key === "End") {
		queueMicrotask(updateSelectionMenu);
	} else {
		// Any typing key collapses the selection → close the menu.
		if (selectionState.open) {
			selectionState = { ...selectionState, open: false };
		}
	}
}

function handleSelectionMenuEdit() {
	// A selection-menu action just mutated the DOM. Flush + recompute the
	// selection state (the selection may have collapsed if the action
	// replaced the range).
	flushToMarkdown();
	queueMicrotask(updateSelectionMenu);
}

function handleSelectionMenuClose() {
	selectionState = { ...selectionState, open: false };
}

/**
 * Right-click (or Cmd/Ctrl-click) opens a context menu at the cursor
 * that adapts to what the click landed on. Suppresses the browser's
 * native menu. Also closes the other two menus so we don't stack.
 */
function handleContextMenu(e: MouseEvent) {
	if (!containerRef) return;
	e.preventDefault();

	// Compute block under the cursor.
	const target = e.target as Node | null;
	const block = findNearestBlock(target, containerRef);

	// Compute selection state.
	const sel = window.getSelection();
	let hasSelection = false;
	let linkEl: HTMLAnchorElement | null = null;
	if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
		const range = sel.getRangeAt(0);
		if (containerRef.contains(range.commonAncestorContainer) && sel.toString().trim().length > 0) {
			hasSelection = true;
			const startEl =
				range.startContainer.nodeType === 1
					? (range.startContainer as HTMLElement)
					: range.startContainer.parentElement;
			linkEl = (startEl?.closest("a") ?? null) as HTMLAnchorElement | null;
		}
	}
	if (!hasSelection) {
		// No selection: still check for a link at the click target so
		// the "Add link" / "Remove link" state matches.
		const targetEl =
			target?.nodeType === 1 ? (target as HTMLElement) : (target?.parentElement ?? null);
		linkEl = (targetEl?.closest("a") ?? null) as HTMLAnchorElement | null;
	}

	// Close the other two menus so a single menu is visible at a time.
	if (menuState.open) menuState = { ...menuState, open: false };
	if (selectionState.open) selectionState = { ...selectionState, open: false };

	contextState = {
		block,
		hasSelection,
		linkEl,
		open: true,
		x: e.clientX,
		y: e.clientY,
	};
}

function handleContextMenuEdit() {
	flushToMarkdown();
	queueMicrotask(() => {
		updateActiveBlockFromSelection();
	});
}

function handleContextMenuClose() {
	contextState = { ...contextState, open: false };
}

/**
 * Open the footnote editor popover for the given ref. Called by the
 * element/context menus after `insertFootnote` (isNew=true) and by
 * `handleContainerClick` when the author clicks an existing ref in
 * the body (isNew=false).
 */
function openFootnoteEditor(
	sup: HTMLElement,
	definitionLi: HTMLElement,
	num: number,
	isNew: boolean,
) {
	const rect = sup.getBoundingClientRect();
	const p = definitionLi.querySelector("p");
	footnoteState = {
		initialText: p?.textContent ?? "",
		isNew,
		num,
		open: true,
		x: rect.right + 4,
		y: rect.bottom + 4,
	};
}

function handleFootnoteSave(num: number, text: string) {
	if (!containerRef) return;
	const trimmed = text.trim();
	if (!trimmed) {
		removeFootnote(containerRef, num);
	} else {
		setFootnoteText(containerRef, num, trimmed);
	}
	footnoteState = { ...footnoteState, open: false };
	flushToMarkdown();
}

function handleFootnoteCancel(num: number, text: string, isNew: boolean) {
	if (!containerRef) return;
	// Cancel on a fresh footnote with no content → discard entirely.
	// Cancel on an existing footnote → leave as it was.
	if (isNew && !text.trim()) {
		removeFootnote(containerRef, num);
	}
	footnoteState = { ...footnoteState, open: false };
	flushToMarkdown();
}

function handleFootnoteDelete(num: number) {
	if (!containerRef) return;
	removeFootnote(containerRef, num);
	footnoteState = { ...footnoteState, open: false };
	flushToMarkdown();
}

// --- Link popover handlers ---
function handleLinkClose() {
	linkState = { ...linkState, open: false };
	activeLinkAnchor = null;
}
function handleLinkOpenExternal() {
	const href = activeLinkAnchor?.getAttribute("href") ?? linkState.href;
	if (href) window.open(href, "_blank", "noopener,noreferrer");
	handleLinkClose();
}
function handleLinkEditHref(nextHref: string) {
	if (!activeLinkAnchor) return handleLinkClose();
	const next = nextHref.trim();
	if (!next) {
		// Empty URL → unwrap the anchor (remove the link, keep the text).
		unwrapAnchor(activeLinkAnchor);
	} else {
		activeLinkAnchor.setAttribute("href", next);
	}
	handleLinkClose();
	flushToMarkdown();
}
function handleLinkRemove() {
	if (activeLinkAnchor) unwrapAnchor(activeLinkAnchor);
	handleLinkClose();
	flushToMarkdown();
}
function unwrapAnchor(a: HTMLAnchorElement) {
	const parent = a.parentNode;
	if (!parent) return;
	while (a.firstChild) parent.insertBefore(a.firstChild, a);
	parent.removeChild(a);
}

/**
 * Delegated click handler.
 *
 * - Click on a body footnote ref (`<a data-footnote-ref>` outside the
 *   footnotes section) → open the footnote editor popover instead of
 *   following the anchor. Anchor jumping inside a contenteditable is
 *   flaky, and the popover UX is what the author actually wants.
 * - Click on a back-ref in the footnotes section
 *   (`<a data-footnote-backref>`) → scroll the corresponding body ref
 *   into view. This is the jumplink the author uses to hop from the
 *   note back to where it was cited.
 * - Everything else passes through so contenteditable caret positioning
 *   works normally.
 */
function handleContainerClick(e: MouseEvent) {
	if (!containerRef) return;
	const target = e.target as HTMLElement | null;
	if (!target) return;

	// Plain content link (`<a href="http(s)://…">`, not a footnote ref) →
	// Cmd/Ctrl-click opens it in a new tab; a plain click opens the link
	// popover (preview + open + edit). Footnote/in-page (`#…`) anchors fall
	// through to the footnote handling below.
	const plainAnchor = target.closest?.("a[href]") as HTMLAnchorElement | null;
	if (
		plainAnchor &&
		containerRef.contains(plainAnchor) &&
		!plainAnchor.hasAttribute("data-footnote-ref") &&
		!plainAnchor.hasAttribute("data-footnote-backref") &&
		!plainAnchor.hasAttribute("data-footnote-back-ref") &&
		!plainAnchor.closest("section[data-footnotes]")
	) {
		const href = plainAnchor.getAttribute("href") ?? "";
		if (href && !href.startsWith("#")) {
			e.preventDefault();
			if (e.metaKey || e.ctrlKey) {
				window.open(href, "_blank", "noopener,noreferrer");
				return;
			}
			activeLinkAnchor = plainAnchor;
			linkState = { href, open: true, x: e.clientX, y: e.clientY };
			return;
		}
	}

	// Back-ref (definitions section → body).
	const backRef = target.closest?.(
		"[data-footnote-backref], [data-footnote-back-ref]",
	) as HTMLAnchorElement | null;
	if (backRef && containerRef.contains(backRef)) {
		e.preventDefault();
		const href = backRef.getAttribute("href") ?? "";
		const m = href.match(/#footnote-ref-(\d+)$/);
		const num = m ? Number.parseInt(m[1], 10) : 0;
		if (!num) return;
		const bodyRef = findFootnoteRef(containerRef, num);
		bodyRef?.scrollIntoView({ behavior: "smooth", block: "center" });
		return;
	}

	// Forward ref (body → footnote editor popover).
	const anchor = target.closest?.("a[data-footnote-ref]") as HTMLAnchorElement | null;
	const legacySup = target.closest?.("sup[data-footnote-ref]") as HTMLElement | null;
	let sup: HTMLElement | null = null;
	let num = 0;
	if (anchor && containerRef.contains(anchor)) {
		if (anchor.closest("section[data-footnotes]")) return;
		sup = anchor.closest("sup");
		num = parseFootnoteNum(anchor.id);
	} else if (legacySup && containerRef.contains(legacySup)) {
		if (legacySup.closest("section[data-footnotes]")) return;
		sup = legacySup;
		const attr = legacySup.getAttribute("data-footnote-ref");
		num = attr ? Number.parseInt(attr, 10) || 0 : 0;
	}
	if (!sup || !num) return;
	e.preventDefault();
	const li = findFootnoteDefinition(containerRef, num);
	if (li) {
		openFootnoteEditor(sup, li, num, false);
		// Ensure the initialText we hand to the popover is authoritative —
		// prefer the utility so back-ref arrows aren't counted as content.
		footnoteState = {
			...footnoteState,
			initialText: getFootnoteText(containerRef, num),
		};
	}
}

// Seed on mount + re-seed on outside markdown changes. Both cases are
// unified: the effect depends on markdownCurrent (reactive) and
// containerRef (reactive via bind:this). It runs once ref is set + any
// time markdown changes. When the change came from us (via
// flushToMarkdown), `isSyncingFromWysiwyg` is true and we skip.
// $effect audited: seeds contenteditable DOM from markdown outside Svelte's template (marked/dompurify escape-region)
$effect(() => {
	const md = editor.markdownCurrent;
	const ref = containerRef;
	if (!ref) return;
	if (untrack(() => editor.isSyncingFromWysiwyg)) return;
	untrack(() => {
		if (flushTimer) {
			clearTimeout(flushTimer);
			flushTimer = null;
		}
		seedFromMarkdown(md);
	});
});

// Wire selectionchange globally + scroll listener locally. Both drive
// gutter button positioning + activeBlock tracking.
// $effect audited: attaches document selectionchange + container scroll listeners on a bind:this ref with cleanup
$effect(() => {
	if (!containerRef) return;
	const onSelChange = () => updateActiveBlockFromSelection();
	const onScroll = () => updateGutterButtonPosition();
	document.addEventListener("selectionchange", onSelChange);
	containerRef.addEventListener("scroll", onScroll, { passive: true });
	return () => {
		document.removeEventListener("selectionchange", onSelChange);
		containerRef?.removeEventListener("scroll", onScroll);
	};
});

// Flush any pending debounce on unmount.
// $effect audited: unmount cleanup: flushes pending debounced markdown serialization timer
$effect(() => {
	return () => {
		if (flushTimer) {
			clearTimeout(flushTimer);
			flushToMarkdown();
		}
	};
});
</script>

<!-- shell: just a positioning parent for the gutter button. Scroll +
     white background + page dimensions all live on the "page" wrapper
     in `+page.svelte` now (mirrors doc-editor's document view). -->
<div bind:this={shellRef} class="wysiwyg-shell relative">
	{#if activeBlock && gutterButtonTop !== null}
		<button
			type="button"
			class="wysiwyg-gutter-btn absolute z-10 h-6 min-w-6 px-1 rounded bg-oxford text-white text-[10px] font-mono font-semibold flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity leading-none shadow"
			style="top: {gutterButtonTop + 6}px; left: -38px;"
			onclick={handleGutterClick}
			onmousedown={(e) => e.preventDefault()}
			title="Edit block ({gutterLabel})"
			aria-label="Edit block, type {gutterLabel}"
		>
			{gutterLabel}
		</button>
	{/if}

	<div
		bind:this={containerRef}
		contenteditable="true"
		role="textbox"
		aria-multiline="true"
		aria-label="Markdown editor body"
		tabindex="0"
		oninput={handleInput}
		onmouseup={handleContainerMouseUp}
		onkeydown={handleContainerKeyDown}
		onkeyup={handleContainerKeyUp}
		oncontextmenu={handleContextMenu}
		onclick={handleContainerClick}
		class="blog-wysiwyg article-body focus:outline-none"
	></div>
</div>

<ElementMenu
	{activeBlock}
	{containerRef}
	{menuState}
	onEdit={handleMenuEdit}
	onClose={handleMenuClose}
	onOpenFootnoteEditor={openFootnoteEditor}
/>
<SelectionMenu
	{selectionState}
	{containerRef}
	onEdit={handleSelectionMenuEdit}
	onClose={handleSelectionMenuClose}
/>
<ContextMenu
	{contextState}
	{containerRef}
	onEdit={handleContextMenuEdit}
	onClose={handleContextMenuClose}
	onOpenFootnoteEditor={openFootnoteEditor}
/>
<LinkPopover
	{linkState}
	onOpenExternal={handleLinkOpenExternal}
	onEditHref={handleLinkEditHref}
	onRemove={handleLinkRemove}
	onClose={handleLinkClose}
/>
<FootnoteEditor
	{footnoteState}
	onSave={handleFootnoteSave}
	onCancel={handleFootnoteCancel}
	onDelete={handleFootnoteDelete}
/>

<style>
	/* article-body's shortcut covers h2..h6 + p + a + lists but not h1
	   (the old read-only preview rendered h1 outside the article-body
	   container). Now that the WYSIWYG owns the whole body, style h1
	   inline so the article title reads like a title. */
	.blog-wysiwyg :global(> h1) {
		font-size: 1.75em;
		font-weight: 700;
		line-height: 1.15;
		margin-bottom: 1.25rem;
	}

	/* Code — fenced blocks scroll horizontally instead of painting past
	   the page edge (pre defaults to white-space: pre + overflow:
	   visible, so one long line escapes the 816px sheet); inline code
	   gets a subtle chip treatment and wraps. */
	.blog-wysiwyg :global(pre) {
		max-width: 100%;
		overflow-x: auto;
		background: rgba(8, 21, 38, 0.05);
		border-radius: 0.375rem;
		padding: 0.75rem 1rem;
		margin: 1rem 0;
		font-size: 0.85em;
		line-height: 1.5;
	}
	.blog-wysiwyg :global(code) {
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		background: rgba(8, 21, 38, 0.06);
		padding: 0.1em 0.35em;
		border-radius: 0.25em;
		font-size: 0.875em;
		overflow-wrap: break-word;
	}
	.blog-wysiwyg :global(pre code) {
		background: none;
		padding: 0;
		border-radius: 0;
		font-size: inherit;
		overflow-wrap: normal;
	}

	/* Body footnote refs — small superscript link with a distinct
	   color so the author can tell them apart from regular text. */
	.blog-wysiwyg :global(sup a[data-footnote-ref]) {
		text-decoration: none;
		color: inherit;
		font-weight: 600;
		padding: 0 0.15em;
		border-radius: 0.15em;
		cursor: pointer;
	}
	.blog-wysiwyg :global(sup a[data-footnote-ref]:hover) {
		background: rgba(0, 90, 156, 0.12);
	}

	/* Footnotes section — visually separated from the article body,
	   smaller/muted text, and an actually-visible heading. */
	.blog-wysiwyg :global(section[data-footnotes]) {
		margin-top: 3rem;
		padding-top: 1.5rem;
		border-top: 1px solid rgba(8, 21, 38, 0.12);
		font-size: 0.85em;
		opacity: 0.75;
	}
	.blog-wysiwyg :global(section[data-footnotes] > .sr-only),
	.blog-wysiwyg :global(section[data-footnotes] > h2) {
		/* Override .sr-only visually-hides inside our editor so authors
		   see the heading even when marked-footnote generates it as
		   sr-only. */
		position: static !important;
		width: auto !important;
		height: auto !important;
		padding: 0 !important;
		margin: 0 0 0.75rem 0 !important;
		overflow: visible !important;
		clip: auto !important;
		white-space: normal !important;
		font-size: 1em;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		opacity: 1;
	}
	.blog-wysiwyg :global(section[data-footnotes] ol) {
		padding-left: 1.5rem;
		margin: 0;
		list-style: decimal;
	}
	.blog-wysiwyg :global(section[data-footnotes] li) {
		margin-bottom: 0.4rem;
	}
	.blog-wysiwyg :global(section[data-footnotes] li p) {
		margin: 0;
		line-height: 1.5;
	}

	/* Back-ref jumplink — the "↩" arrow at the end of each definition.
	   Full opacity + underline on hover so it reads as clickable
	   despite the surrounding muted opacity. */
	.blog-wysiwyg :global(a[data-footnote-backref]) {
		text-decoration: none;
		margin-left: 0.35rem;
		opacity: 0.9;
		cursor: pointer;
	}
	.blog-wysiwyg :global(a[data-footnote-backref]:hover) {
		text-decoration: underline;
	}
</style>
