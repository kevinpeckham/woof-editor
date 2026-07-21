/**
 * DOM-edit primitives for the WYSIWYG menus. Kept side-effect-free where
 * possible so menu components stay tiny and the same primitives can back
 * the element menu, selection menu, and context menu without duplication.
 *
 * All functions operate on a `container` (the contenteditable root) and
 * a `block` (a direct child block element inside it). The caller is
 * responsible for triggering any downstream markdown-serialization flush
 * after a mutation — this module has no opinion on when that runs.
 *
 * Zero framework dependencies. Tested in vitest with happy-dom.
 */

const BLOCK_TAGS = new Set([
	"p",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"blockquote",
	"pre",
	"li",
	"ul",
	"ol",
	"hr",
]);

const CONVERTIBLE_TAGS = new Set([
	"p",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"blockquote",
	"pre",
	"ul",
	"ol",
]);

/**
 * Return the first direct-child `<h1>` in `container`, if any. Consumers
 * that treat the leading H1 as the article title (a common pattern —
 * mirrors GFM's "first heading is the title" convention) can use this
 * with `isFirstH1` to protect that element from delete / change-type.
 */
export function firstH1(container: HTMLElement | null): HTMLElement | null {
	if (!container) return null;
	for (const child of Array.from(container.children)) {
		if (child.tagName.toLowerCase() === "h1") return child as HTMLElement;
	}
	return null;
}

/**
 * True when `block` is the first `<h1>` in `container` — the block a
 * consumer would treat as the article title. Menus use this to gate off
 * "Change type" and "Delete" so authors can't remove or downgrade the
 * title. Returns false when either argument is null.
 */
export function isFirstH1(block: HTMLElement | null, container: HTMLElement | null): boolean {
	if (!block || !container) return false;
	return block === firstH1(container);
}

const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

/**
 * True when `block` is a heading (H1-H6). Headings carry their own weight
 * from the type scale, so most editors hide bold / italic affordances for
 * them — bolding a heading muddies the visual hierarchy and round-trips
 * to noisy markdown.
 */
export function isHeadingBlock(block: HTMLElement | null): boolean {
	if (!block) return false;
	return HEADING_TAGS.has(block.tagName.toLowerCase());
}

/**
 * Walk from `node` up to `container`, returning the first block-level
 * ancestor (P, H1-6, LI, BLOCKQUOTE, PRE, UL, OL). Returns null if the
 * node isn't inside the container or the container itself has no block
 * ancestor.
 */
export function findNearestBlock(node: Node | null, container: HTMLElement): HTMLElement | null {
	let cur: Node | null = node;
	while (cur && cur !== container) {
		if (cur.nodeType === 1) {
			const el = cur as HTMLElement;
			if (BLOCK_TAGS.has(el.tagName.toLowerCase())) return el;
		}
		cur = cur.parentNode;
	}
	return null;
}

/**
 * Convert `block` to `targetTag`, preserving inline formatting. Returns
 * the element that now stands in `block`'s place.
 *
 * The list cases (`ul` / `ol`) have their own handling because a `<ul>`
 * can't just be a renamed `<p>` — it needs an `<li>` child.
 *
 *  - **Source is `<li>`** — extracted from its parent list. If the
 *    parent list ends up empty, the parent is removed. Target `ul`/`ol`
 *    swaps the parent's tag (bullet ↔ number toggle).
 *  - **Source is `<ul>` / `<ol>`** — target list-of-different-kind
 *    swaps the tag in place; target non-list unwraps the list into a
 *    single block of `targetTag` containing the concatenated li text.
 *  - **Source is anything else** — target `ul`/`ol` wraps the content
 *    in `<targetTag><li>…</li></targetTag>`; other targets do the plain
 *    tag rename.
 */
export function changeBlockType(block: HTMLElement, targetTag: string): HTMLElement {
	if (!CONVERTIBLE_TAGS.has(targetTag)) {
		throw new Error(`Unsupported target tag: ${targetTag}`);
	}
	const sourceTag = block.tagName.toLowerCase();
	if (sourceTag === targetTag) return block;

	const isTargetList = targetTag === "ul" || targetTag === "ol";

	// Source is <li> — extract from its parent list.
	if (sourceTag === "li") {
		const parentList = block.parentElement;
		if (isTargetList && parentList) {
			// Just swap the wrapping list's tag (ul ↔ ol).
			const newList = document.createElement(targetTag);
			while (parentList.firstChild) newList.appendChild(parentList.firstChild);
			parentList.replaceWith(newList);
			return block;
		}
		const newEl = document.createElement(targetTag);
		while (block.firstChild) newEl.appendChild(block.firstChild);
		if (parentList) {
			parentList.parentElement?.insertBefore(newEl, parentList.nextSibling);
			block.remove();
			if (!parentList.querySelector("li")) parentList.remove();
		} else {
			block.replaceWith(newEl);
		}
		return newEl;
	}

	// Source is a whole list — swap its tag or unwrap to a single block.
	if (sourceTag === "ul" || sourceTag === "ol") {
		if (isTargetList) {
			const newList = document.createElement(targetTag);
			while (block.firstChild) newList.appendChild(block.firstChild);
			block.replaceWith(newList);
			return newList;
		}
		const newEl = document.createElement(targetTag);
		const items = Array.from(block.querySelectorAll(":scope > li"));
		for (let i = 0; i < items.length; i++) {
			const li = items[i];
			while (li.firstChild) newEl.appendChild(li.firstChild);
			if (i < items.length - 1) newEl.appendChild(document.createElement("br"));
		}
		block.replaceWith(newEl);
		return newEl;
	}

	// Source is any other block. Target `ul`/`ol` needs an `<li>` wrapper.
	if (isTargetList) {
		const list = document.createElement(targetTag);
		const li = document.createElement("li");
		while (block.firstChild) li.appendChild(block.firstChild);
		list.appendChild(li);
		block.replaceWith(list);
		return list;
	}

	// Plain tag swap.
	const newEl = document.createElement(targetTag);
	while (block.firstChild) newEl.appendChild(block.firstChild);
	block.replaceWith(newEl);
	return newEl;
}

/**
 * Wrap or unwrap the block's entire inline content in `<strong>` /
 * `<em>` / `<del>`. If the block is already a single wrapper of that
 * tag, unwrap. Otherwise wrap.
 */
export function toggleBlockWrap(block: HTMLElement, tag: "strong" | "em" | "del"): void {
	const first = block.firstChild;
	const last = block.lastChild;
	if (
		first &&
		first === last &&
		first.nodeType === 1 &&
		(first as HTMLElement).tagName.toLowerCase() === tag
	) {
		const inner = first as HTMLElement;
		while (inner.firstChild) block.insertBefore(inner.firstChild, inner);
		inner.remove();
		return;
	}
	const wrapper = document.createElement(tag);
	while (block.firstChild) wrapper.appendChild(block.firstChild);
	block.appendChild(wrapper);
}

/** Remove the block from the container. */
export function removeBlock(block: HTMLElement): void {
	block.remove();
}

/**
 * Insert an empty paragraph directly before or after the given block.
 * Returns the new paragraph so callers can move the caret into it.
 */
export function insertParagraph(
	block: HTMLElement,
	position: "before" | "after",
): HTMLParagraphElement {
	const p = document.createElement("p");
	// `<br>` gives the empty paragraph height and a caret target in
	// contenteditable (browsers won't render an empty paragraph without it).
	p.appendChild(document.createElement("br"));
	if (position === "before") {
		block.before(p);
	} else {
		block.after(p);
	}
	return p;
}

/**
 * Place the caret at the start of the given element. Useful after
 * inserting a new empty paragraph so typing lands where the author
 * expects.
 */
export function placeCaretAtStart(el: HTMLElement): void {
	const range = document.createRange();
	range.selectNodeContents(el);
	range.collapse(true);
	const sel = window.getSelection();
	if (!sel) return;
	sel.removeAllRanges();
	sel.addRange(range);
}

/**
 * Menu-friendly enumeration of block types users can convert TO. Ordered
 * for the common case — paragraph first, then headings in size order,
 * then blockquote, then lists.
 */
export const CONVERTIBLE_TAGS_LIST: {
	tag: string;
	label: string;
}[] = [
	{ label: "Paragraph", tag: "p" },
	{ label: "Heading 1", tag: "h1" },
	{ label: "Heading 2", tag: "h2" },
	{ label: "Heading 3", tag: "h3" },
	{ label: "Heading 4", tag: "h4" },
	{ label: "Blockquote", tag: "blockquote" },
	{ label: "Bulleted list", tag: "ul" },
	{ label: "Numbered list", tag: "ol" },
];

/**
 * Return the in-body `<sup>` wrapping the footnote ref anchor for
 * the given number. Handles both marked-footnote's shape
 * (`<sup><a id="footnote-ref-N" data-footnote-ref>N</a></sup>`) and
 * the legacy attribute-on-sup shape (`<sup data-footnote-ref="N">`).
 */
export function findFootnoteRef(container: HTMLElement, num: number): HTMLElement | null {
	// Preferred: marked-footnote shape — anchor id = `footnote-ref-N`.
	const anchor = container.querySelector<HTMLElement>(
		`a[id="${CSS.escape(`footnote-ref-${num}`)}"]`,
	);
	if (anchor) {
		return (anchor.closest("sup") as HTMLElement | null) ?? anchor;
	}
	// Fallback: legacy shape — value on the sup itself.
	return container.querySelector<HTMLElement>(
		`sup[data-footnote-ref="${CSS.escape(String(num))}"]`,
	);
}

/**
 * Return the definition `<li>` for the given footnote number. Handles
 * both marked-footnote's shape (`li[id="footnote-N"]`) and the legacy
 * shape (`li[id="fn-N"]`).
 */
export function findFootnoteDefinition(container: HTMLElement, num: number): HTMLElement | null {
	return (
		container.querySelector<HTMLElement>(`li[id="${CSS.escape(`footnote-${num}`)}"]`) ??
		container.querySelector<HTMLElement>(`li[id="${CSS.escape(`fn-${num}`)}"]`)
	);
}

/**
 * Parse the footnote number from an id like `footnote-1`, `fn-1`, or
 * `footnote-ref-1`. Returns 0 if the id doesn't match.
 */
export function parseFootnoteNum(id: string): number {
	const m = id.match(/^(?:footnote-ref-|footnote-|fn[-:]?)(\d+)$/);
	if (!m) return 0;
	return Number.parseInt(m[1], 10) || 0;
}

/**
 * Remove a footnote entirely — both the in-body `<sup>` ref and the
 * definition `<li>`. If the footnotes `<section>` ends up with no
 * definitions afterwards, remove the section too. Numbering is NOT
 * renumbered (matches pandoc's behavior — labels stay stable, gaps
 * are fine).
 */
export function removeFootnote(container: HTMLElement, num: number): void {
	findFootnoteRef(container, num)?.remove();
	findFootnoteDefinition(container, num)?.remove();
	const section = container.querySelector<HTMLElement>("section[data-footnotes]");
	if (section) {
		const ol = section.querySelector("ol");
		if (!ol || ol.children.length === 0) section.remove();
	}
}

/**
 * Walk the footnotes state and remove:
 *  1. Any empty definition `<li>` (and its corresponding body ref).
 *  2. Any body `<sup>` ref without a matching definition (dangling ref).
 *  3. The trailing `<section data-footnotes>` if its `<ol>` is empty.
 *
 * Called before serialization so the emitted markdown never contains
 * dangling `[^N]` refs or hollow `[^N]: ` definitions.
 */
export function pruneOrphanFootnotes(container: HTMLElement): void {
	const section = container.querySelector<HTMLElement>("section[data-footnotes]");
	if (section) {
		const ol = section.querySelector("ol");
		if (ol) {
			for (const li of Array.from(ol.querySelectorAll<HTMLElement>("li"))) {
				// Strip the back-ref link when measuring emptiness — the
				// arrow character shouldn't count as content.
				const clone = li.cloneNode(true) as HTMLElement;
				for (const back of Array.from(
					clone.querySelectorAll(
						"[data-footnote-backref], [data-footnote-back-ref], .footnote-back, .footnote-backref",
					),
				)) {
					back.remove();
				}
				const text = clone.textContent?.trim() ?? "";
				if (text.length === 0) {
					const num = parseFootnoteNum(li.id || "");
					li.remove();
					if (num) findFootnoteRef(container, num)?.remove();
				}
			}
			if (ol.children.length === 0) section.remove();
		}
	}
	// Second pass: any surviving body refs without a matching definition.
	// Walk both attribute shapes: `sup[data-footnote-ref="N"]` (legacy)
	// and `a[data-footnote-ref]` (marked-footnote).
	const refCandidates = new Set<HTMLElement>();
	for (const el of Array.from(container.querySelectorAll<HTMLElement>("[data-footnote-ref]"))) {
		if (el.closest("section[data-footnotes]")) continue;
		const sup = (el.closest("sup") as HTMLElement | null) ?? el;
		refCandidates.add(sup);
	}
	for (const sup of refCandidates) {
		const anchor = sup.querySelector<HTMLElement>("a[id^='footnote-ref-']");
		let num = 0;
		if (anchor) {
			num = parseFootnoteNum(anchor.id);
		} else {
			const attr = sup.getAttribute("data-footnote-ref");
			num = attr ? Number.parseInt(attr, 10) || 0 : 0;
		}
		if (!num) continue;
		if (!findFootnoteDefinition(container, num)) sup.remove();
	}
}

/** Get the current text content of a footnote's definition `<li>`,
 *  ignoring the trailing back-ref arrow. */
export function getFootnoteText(container: HTMLElement, num: number): string {
	const li = findFootnoteDefinition(container, num);
	if (!li) return "";
	const clone = li.cloneNode(true) as HTMLElement;
	for (const back of Array.from(
		clone.querySelectorAll(
			"[data-footnote-backref], [data-footnote-back-ref], .footnote-back, .footnote-backref",
		),
	)) {
		back.remove();
	}
	const p = clone.querySelector("p");
	return (p ?? clone).textContent?.trim() ?? "";
}

/** Overwrite the text content of a footnote's definition `<li>`,
 *  preserving the back-ref link at the end so authors can still
 *  jump back to the ref. */
export function setFootnoteText(container: HTMLElement, num: number, text: string): void {
	const li = findFootnoteDefinition(container, num);
	if (!li) return;
	let p = li.querySelector("p");
	if (!p) {
		p = document.createElement("p");
		li.innerHTML = "";
		li.appendChild(p);
	}
	// Extract existing back-ref (if any) so we re-append it after
	// overwriting the paragraph text.
	const backRef = p.querySelector<HTMLAnchorElement>(
		"[data-footnote-backref], [data-footnote-back-ref], .footnote-back, .footnote-backref",
	);
	p.textContent = text;
	if (backRef) {
		p.append(" ");
		p.appendChild(backRef);
	} else {
		// No existing back-ref → mint one so the jumplink works.
		p.append(" ");
		p.appendChild(buildFootnoteBackRef(num));
	}
}

/** Build a fresh back-ref anchor for a footnote definition. */
function buildFootnoteBackRef(num: number): HTMLAnchorElement {
	const a = document.createElement("a");
	a.setAttribute("href", `#footnote-ref-${num}`);
	a.setAttribute("data-footnote-backref", "");
	a.setAttribute("aria-label", `Back to reference ${num}`);
	a.textContent = "↩";
	return a;
}

/**
 * Insert a GFM-shaped footnote reference (`<sup data-footnote-ref="N">`)
 * at the current caret position inside `block`, and append (or create)
 * the trailing `<section data-footnotes>` with a definition `<li>` for
 * the author to fill in. The serializer inverts this shape back into
 * `[^N]` refs and `[^N]: text` definitions.
 *
 * `N` is `max(existing) + 1`, or `1` if no footnotes yet.
 *
 * Returns the created `<sup>` ref (in-body) and `<li>` definition so
 * the caller can `placeCaretAtStart(definitionLi)` and scroll it into
 * view for immediate editing.
 */
export function insertFootnote(
	container: HTMLElement,
	block: HTMLElement,
): { sup: HTMLElement; definitionLi: HTMLElement; number: number } {
	// Next available number — walk both the anchor-id shape emitted by
	// marked-footnote and the legacy attribute shape.
	let maxNum = 0;
	for (const el of Array.from(
		container.querySelectorAll<HTMLElement>("[data-footnote-ref], a[id^='footnote-ref-']"),
	)) {
		let n = 0;
		if (el.tagName.toLowerCase() === "a" && el.id) {
			n = parseFootnoteNum(el.id);
		} else {
			const attr = el.getAttribute("data-footnote-ref");
			n = attr ? Number.parseInt(attr, 10) || 0 : 0;
		}
		if (n > maxNum) maxNum = n;
	}
	// Also check definition ids so we survive an author who deleted the
	// body refs but left definitions.
	for (const li of Array.from(
		container.querySelectorAll<HTMLElement>("section[data-footnotes] ol li[id]"),
	)) {
		const n = parseFootnoteNum(li.id);
		if (n > maxNum) maxNum = n;
	}
	const nextNum = maxNum + 1;

	// Build the in-body ref in marked-footnote's shape so the round-
	// trip through markdown produces an identical DOM.
	//   <sup><a id="footnote-ref-N" href="#footnote-N"
	//           data-footnote-ref aria-describedby="footnote-label">N</a></sup>
	const sup = document.createElement("sup");
	const a = document.createElement("a");
	a.id = `footnote-ref-${nextNum}`;
	a.setAttribute("href", `#footnote-${nextNum}`);
	a.setAttribute("data-footnote-ref", "");
	a.setAttribute("aria-describedby", "footnote-label");
	a.textContent = String(nextNum);
	sup.appendChild(a);

	// Insert at caret if the caret is inside the block, else at the end.
	const sel = window.getSelection();
	let inserted = false;
	if (sel && sel.rangeCount > 0) {
		const range = sel.getRangeAt(0);
		if (block.contains(range.startContainer)) {
			range.collapse(false);
			range.insertNode(sup);
			range.setStartAfter(sup);
			range.setEndAfter(sup);
			sel.removeAllRanges();
			sel.addRange(range);
			inserted = true;
		}
	}
	if (!inserted) {
		block.appendChild(sup);
	}

	// Find or create the trailing `<section class="footnotes"
	// data-footnotes>` in the exact shape marked-footnote emits.
	let section = container.querySelector<HTMLElement>("section[data-footnotes]");
	let ol: HTMLOListElement;
	if (!section) {
		section = document.createElement("section");
		section.className = "footnotes";
		section.setAttribute("data-footnotes", "");
		const h2 = document.createElement("h2");
		h2.id = "footnote-label";
		h2.className = "sr-only";
		h2.textContent = "Footnotes";
		section.appendChild(h2);
		ol = document.createElement("ol");
		section.appendChild(ol);
		container.appendChild(section);
	} else {
		const existingOl = section.querySelector("ol");
		if (existingOl) {
			ol = existingOl;
		} else {
			ol = document.createElement("ol");
			section.appendChild(ol);
		}
	}

	// Definition li — `<p>text ↩</p>` shape, empty p to start.
	const definitionLi = document.createElement("li");
	definitionLi.id = `footnote-${nextNum}`;
	const p = document.createElement("p");
	// Seed a back-ref anchor so the jumplink is available from creation.
	p.append(" ");
	p.appendChild(buildFootnoteBackRef(nextNum));
	definitionLi.appendChild(p);
	ol.appendChild(definitionLi);

	return { definitionLi, number: nextNum, sup };
}

/** Text-containing leaf blocks a single <a> may validly live inside. */
const LINK_LEAF_SELECTOR = "p,h1,h2,h3,h4,h5,h6,li,pre";

/** Nearest link-eligible leaf block for a node, bounded by `container`. */
function closestLinkLeaf(node: Node | null, container: HTMLElement): HTMLElement | null {
	const el = node?.nodeType === 3 ? node.parentElement : (node as Element | null);
	const leaf = el?.closest(LINK_LEAF_SELECTOR) as HTMLElement | null;
	return leaf && container.contains(leaf) ? leaf : null;
}

/** Replace an element with its child nodes (unwrap), preserving order. */
function unwrapElement(el: Element): void {
	const parent = el.parentNode;
	if (!parent) return;
	while (el.firstChild) parent.insertBefore(el.firstChild, el);
	parent.removeChild(el);
}

/** Nearest ancestor element with the given tag name, within `container`. */
function closestInlineTag(node: Node, tag: string, container: HTMLElement): HTMLElement | null {
	let el: HTMLElement | null =
		node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
	while (el && el !== container) {
		if (el.tagName.toLowerCase() === tag) return el;
		el = el.parentElement;
	}
	return null;
}

/**
 * Toggle an inline emphasis tag (`<strong>` / `<em>` / `<del>`) over the
 * current selection. Replaces the deprecated `execCommand("bold"|"italic")`,
 * which — in CSS mode — emitted `<span style="font-weight:bold">` that the
 * markdown serializer treats as transparent (so the edit never reached
 * the edited markdown and Save never enabled). Producing real semantic tags
 * makes the round-trip to `**` / `*` reliable.
 *
 * - If the selection is entirely inside an existing tag of this kind, it
 *   unwraps it (toggle off).
 * - Otherwise it wraps the (possibly cross-node) selection, flattening any
 *   nested same-tag so we never get `<strong><strong>`.
 *
 * Returns false when there's no usable selection.
 */
export function toggleInlineEmphasisOnSelection(
	tag: "strong" | "em" | "del",
	container: HTMLElement,
): boolean {
	const sel = window.getSelection();
	if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false;
	const range = sel.getRangeAt(0);
	if (!container.contains(range.commonAncestorContainer)) return false;

	// Toggle off: whole selection sits inside one existing <tag> → unwrap.
	const start = closestInlineTag(range.startContainer, tag, container);
	const end = closestInlineTag(range.endContainer, tag, container);
	if (start && start === end) {
		unwrapElement(start);
		container.normalize();
		sel.removeAllRanges();
		return true;
	}

	// Apply: wrap the extracted contents; flatten nested same-tag.
	const wrapper = document.createElement(tag);
	try {
		wrapper.appendChild(range.extractContents());
	} catch {
		return false;
	}
	for (const inner of Array.from(wrapper.querySelectorAll(tag))) {
		unwrapElement(inner);
	}
	range.insertNode(wrapper);
	wrapper.parentElement?.normalize();

	// Reselect the wrapped content so a subsequent toggle can detect it.
	sel.removeAllRanges();
	const nr = document.createRange();
	nr.selectNodeContents(wrapper);
	sel.addRange(nr);
	return true;
}

/**
 * Insert plain text at the current selection (replacing any selected content),
 * placing the caret after the inserted text. Replaces
 * `execCommand("insertText")` for paste-as-plain-text. Returns false when
 * there's no usable selection inside the container.
 */
export function insertPlainTextAtSelection(text: string, container: HTMLElement): boolean {
	const sel = window.getSelection();
	if (!sel || sel.rangeCount === 0) return false;
	const range = sel.getRangeAt(0);
	if (!container.contains(range.commonAncestorContainer)) return false;
	range.deleteContents();
	const node = document.createTextNode(text);
	range.insertNode(node);
	range.setStartAfter(node);
	range.collapse(true);
	sel.removeAllRanges();
	sel.addRange(range);
	return true;
}

/** Wrap a single-block range's contents in an `<a href>`. */
function wrapRangeInAnchor(range: Range, url: string): void {
	if (range.collapsed) return;
	const a = document.createElement("a");
	a.setAttribute("href", url);
	try {
		a.appendChild(range.extractContents());
	} catch {
		return;
	}
	range.insertNode(a);
	// Flatten any nested anchors the selection may have absorbed.
	for (const inner of Array.from(a.querySelectorAll("a"))) unwrapElement(inner);
	a.parentElement?.normalize();
}

/** Sub-range = intersection of `range` with a single block's contents. */
function subRangeForBlock(range: Range, block: HTMLElement): Range {
	const sub = document.createRange();
	sub.selectNodeContents(block);
	if (block.contains(range.startContainer)) {
		sub.setStart(range.startContainer, range.startOffset);
	}
	if (block.contains(range.endContainer)) {
		sub.setEnd(range.endContainer, range.endOffset);
	}
	return sub;
}

/**
 * Wrap the current selection in `<a href={url}>`. Handles selections that span
 * multiple block boundaries by creating one anchor per intersected block (an
 * `<a>` can't validly straddle block elements). Replaces the deprecated
 * `execCommand("createLink")`. Returns false when there's no usable selection.
 */
export function applyLinkToSelection(url: string, container: HTMLElement): boolean {
	const sel = window.getSelection();
	if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false;
	const range = sel.getRangeAt(0);
	if (!container.contains(range.commonAncestorContainer)) return false;

	const startLeaf = closestLinkLeaf(range.startContainer, container);
	const endLeaf = closestLinkLeaf(range.endContainer, container);

	if (startLeaf && startLeaf === endLeaf) {
		wrapRangeInAnchor(range, url);
	} else {
		const blocks = Array.from(container.querySelectorAll<HTMLElement>(LINK_LEAF_SELECTOR)).filter(
			(b) => range.intersectsNode(b),
		);
		// Wrap last→first so an earlier block's mutation can't invalidate the
		// still-live boundary nodes of a block we haven't processed yet.
		for (const block of blocks.reverse()) {
			wrapRangeInAnchor(subRangeForBlock(range, block), url);
		}
	}
	sel.removeAllRanges();
	return true;
}

/**
 * Unwrap every `<a>` intersecting the current selection (or, when collapsed,
 * the anchor under the caret). Returns false when nothing was unlinked.
 */
export function removeLinkFromSelection(container: HTMLElement): boolean {
	const sel = window.getSelection();
	if (!sel || sel.rangeCount === 0) return false;
	const range = sel.getRangeAt(0);
	const anchors = Array.from(container.querySelectorAll("a")).filter((a) =>
		range.collapsed ? a.contains(range.startContainer) : range.intersectsNode(a),
	);
	if (anchors.length === 0) return false;
	for (const a of anchors) unwrapElement(a);
	container.normalize();
	return true;
}
