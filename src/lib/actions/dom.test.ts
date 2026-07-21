// @vitest-environment happy-dom
//
// DOM primitives test suite — ported from lightning-jar/replicator's
// tests/lib/utils/blogWysiwygActions.test.ts. Runs under happy-dom
// (per-file environment marker above) because the tests need a real
// DOM with Range / Selection support; the rest of the node vitest
// project stays in pure node env.

import { describe, expect, test } from "vitest";

import {
	changeBlockType,
	findFootnoteDefinition,
	findFootnoteRef,
	findNearestBlock,
	firstH1,
	getFootnoteText,
	insertFootnote,
	insertParagraph,
	insertPlainTextAtSelection,
	isFirstH1,
	isHeadingBlock,
	parseFootnoteNum,
	pruneOrphanFootnotes,
	removeBlock,
	removeFootnote,
	setFootnoteText,
	toggleBlockWrap,
	toggleInlineEmphasisOnSelection,
} from "./dom";

function mount(html: string): HTMLElement {
	const container = document.createElement("div");
	container.innerHTML = html;
	document.body.appendChild(container);
	return container;
}

function selectRange(startNode: Node, startOffset: number, endNode: Node, endOffset: number): void {
	const sel = window.getSelection();
	const range = document.createRange();
	range.setStart(startNode, startOffset);
	range.setEnd(endNode, endOffset);
	sel?.removeAllRanges();
	sel?.addRange(range);
}

describe("firstH1 / isFirstH1", () => {
	test("returns the first direct-child h1", () => {
		const c = mount("<p>x</p><h1>Title</h1><h1>Second</h1>");
		const h1 = firstH1(c);
		expect(h1?.textContent).toBe("Title");
	});

	test("returns null when there is no h1", () => {
		expect(firstH1(mount("<p>x</p>"))).toBeNull();
		expect(firstH1(null)).toBeNull();
	});

	test("isFirstH1 true only for the leading h1", () => {
		const c = mount("<h1>Title</h1><h1>Other</h1>");
		const [first, second] = Array.from(c.querySelectorAll("h1"));
		expect(isFirstH1(first as HTMLElement, c)).toBe(true);
		expect(isFirstH1(second as HTMLElement, c)).toBe(false);
		expect(isFirstH1(null, c)).toBe(false);
	});
});

describe("isHeadingBlock", () => {
	test("true for h1-h6, false otherwise", () => {
		const c = mount("<h3>h</h3><p>p</p><ul><li>l</li></ul>");
		expect(isHeadingBlock(c.querySelector("h3"))).toBe(true);
		expect(isHeadingBlock(c.querySelector("p"))).toBe(false);
		expect(isHeadingBlock(c.querySelector("li"))).toBe(false);
		expect(isHeadingBlock(null)).toBe(false);
	});
});

describe("findNearestBlock", () => {
	test("walks up to the nearest block-level ancestor", () => {
		const c = mount("<p>hello <strong>bold</strong> tail</p>");
		const strongText = c.querySelector("strong")?.firstChild;
		if (!strongText) throw new Error("fixture broken: no strong text");
		const block = findNearestBlock(strongText, c);
		expect(block?.tagName.toLowerCase()).toBe("p");
	});

	test("returns null when node is outside the container", () => {
		const c = mount("<p>x</p>");
		const outside = document.createElement("span");
		expect(findNearestBlock(outside, c)).toBeNull();
	});
});

describe("changeBlockType", () => {
	test("plain tag swap p -> h2 preserves inline content", () => {
		const c = mount("<p>hello <em>there</em></p>");
		const p = c.querySelector("p");
		if (!p) throw new Error("fixture broken");
		const result = changeBlockType(p, "h2");
		expect(result.tagName.toLowerCase()).toBe("h2");
		expect(c.querySelector("h2")?.innerHTML).toBe("hello <em>there</em>");
		expect(c.querySelector("p")).toBeNull();
	});

	test("p -> ul wraps content in a single li", () => {
		const c = mount("<p>item text</p>");
		const p = c.querySelector("p");
		if (!p) throw new Error("fixture broken");
		const result = changeBlockType(p, "ul");
		expect(result.tagName.toLowerCase()).toBe("ul");
		expect(c.querySelector("ul > li")?.textContent).toBe("item text");
	});

	test("ul -> ol swaps the list tag in place", () => {
		const c = mount("<ul><li>a</li><li>b</li></ul>");
		const ul = c.querySelector("ul");
		if (!ul) throw new Error("fixture broken");
		const result = changeBlockType(ul, "ol");
		expect(result.tagName.toLowerCase()).toBe("ol");
		expect(c.querySelectorAll("ol > li").length).toBe(2);
		expect(c.querySelector("ul")).toBeNull();
	});

	test("ul -> p unwraps items joined by <br>", () => {
		const c = mount("<ul><li>a</li><li>b</li></ul>");
		const ul = c.querySelector("ul");
		if (!ul) throw new Error("fixture broken");
		const result = changeBlockType(ul, "p");
		expect(result.tagName.toLowerCase()).toBe("p");
		expect(result.innerHTML).toBe("a<br>b");
	});

	test("li -> ul swaps the wrapping list's tag (was ol)", () => {
		const c = mount("<ol><li>only</li></ol>");
		const li = c.querySelector("li");
		if (!li) throw new Error("fixture broken");
		changeBlockType(li, "ul");
		expect(c.querySelector("ul > li")?.textContent).toBe("only");
		expect(c.querySelector("ol")).toBeNull();
	});

	test("li -> p extracts the item and removes an emptied parent list", () => {
		const c = mount("<ul><li>solo</li></ul>");
		const li = c.querySelector("li");
		if (!li) throw new Error("fixture broken");
		const result = changeBlockType(li, "p");
		expect(result.tagName.toLowerCase()).toBe("p");
		expect(result.textContent).toBe("solo");
		expect(c.querySelector("ul")).toBeNull();
	});

	test("same source/target tag returns the block unchanged", () => {
		const c = mount("<p>x</p>");
		const p = c.querySelector("p");
		if (!p) throw new Error("fixture broken");
		expect(changeBlockType(p, "p")).toBe(p);
	});

	test("throws on an unsupported target tag", () => {
		const c = mount("<p>x</p>");
		const p = c.querySelector("p");
		if (!p) throw new Error("fixture broken");
		expect(() => changeBlockType(p, "marquee")).toThrow();
	});
});

describe("toggleBlockWrap", () => {
	test("wraps the whole block content when not already wrapped", () => {
		const c = mount("<p>hello</p>");
		const p = c.querySelector("p");
		if (!p) throw new Error("fixture broken");
		toggleBlockWrap(p, "strong");
		expect(c.querySelector("p")?.innerHTML).toBe("<strong>hello</strong>");
	});

	test("unwraps when the block is a single wrapper of that tag", () => {
		const c = mount("<p><em>hello</em></p>");
		const p = c.querySelector("p");
		if (!p) throw new Error("fixture broken");
		toggleBlockWrap(p, "em");
		expect(c.querySelector("p")?.innerHTML).toBe("hello");
	});
});

describe("removeBlock / insertParagraph", () => {
	test("removeBlock detaches the element", () => {
		const c = mount("<p>a</p><p>b</p>");
		removeBlock(c.querySelectorAll("p")[0] as HTMLElement);
		expect(c.querySelectorAll("p").length).toBe(1);
		expect(c.textContent).toBe("b");
	});

	test("insertParagraph before/after places an empty <p><br></p>", () => {
		const c = mount("<p id='anchor'>x</p>");
		const anchor = c.querySelector("#anchor") as HTMLElement;
		const after = insertParagraph(anchor, "after");
		expect(after.previousElementSibling).toBe(anchor);
		expect(after.innerHTML).toBe("<br>");
		const before = insertParagraph(anchor, "before");
		expect(before.nextElementSibling).toBe(anchor);
	});
});

describe("toggleInlineEmphasisOnSelection", () => {
	test("wraps the selected substring in <strong>", () => {
		const c = mount("<p>hello world foo</p>");
		const text = c.querySelector("p")?.firstChild;
		if (!text) throw new Error("fixture broken");
		selectRange(text, 6, text, 11); // "world"
		expect(toggleInlineEmphasisOnSelection("strong", c)).toBe(true);
		const strong = c.querySelector("strong");
		expect(strong?.textContent).toBe("world");
		expect(c.querySelector("p")?.textContent).toBe("hello world foo");
	});

	test("unwraps when the selection sits fully inside an existing tag", () => {
		const c = mount("<p>a <em>middle</em> b</p>");
		const emText = c.querySelector("em")?.firstChild;
		if (!emText) throw new Error("fixture broken");
		selectRange(emText, 0, emText, 6); // whole "middle"
		expect(toggleInlineEmphasisOnSelection("em", c)).toBe(true);
		expect(c.querySelector("em")).toBeNull();
		expect(c.querySelector("p")?.textContent).toBe("a middle b");
	});

	test("returns false for a collapsed / empty selection", () => {
		const c = mount("<p>hello</p>");
		const text = c.querySelector("p")?.firstChild;
		if (!text) throw new Error("fixture broken");
		selectRange(text, 2, text, 2); // collapsed
		expect(toggleInlineEmphasisOnSelection("strong", c)).toBe(false);
	});
});

describe("insertPlainTextAtSelection", () => {
	test("inserts text at the caret, replacing the selection", () => {
		const c = mount("<p>hello world</p>");
		const text = c.querySelector("p")?.firstChild;
		if (!text) throw new Error("fixture broken");
		selectRange(text, 6, text, 11); // "world"
		expect(insertPlainTextAtSelection("there", c)).toBe(true);
		expect(c.querySelector("p")?.textContent).toBe("hello there");
	});

	test("returns false when the selection is outside the container", () => {
		const c = mount("<p>x</p>");
		const other = mount("<p>outside</p>");
		const otherText = other.querySelector("p")?.firstChild;
		if (!otherText) throw new Error("fixture broken");
		selectRange(otherText, 0, otherText, 3);
		expect(insertPlainTextAtSelection("nope", c)).toBe(false);
	});
});

describe("parseFootnoteNum", () => {
	test("parses footnote-N / fn-N / footnote-ref-N", () => {
		expect(parseFootnoteNum("footnote-3")).toBe(3);
		expect(parseFootnoteNum("fn-7")).toBe(7);
		expect(parseFootnoteNum("footnote-ref-2")).toBe(2);
	});

	test("returns 0 for non-matching ids", () => {
		expect(parseFootnoteNum("random")).toBe(0);
		expect(parseFootnoteNum("")).toBe(0);
	});
});

describe("footnote insert / find / read / write / remove", () => {
	function withCaretIn(block: HTMLElement): void {
		const range = document.createRange();
		range.selectNodeContents(block);
		range.collapse(false);
		const sel = window.getSelection();
		sel?.removeAllRanges();
		sel?.addRange(range);
	}

	test("insertFootnote seeds a sup ref + a definition li, numbered from 1", () => {
		const c = mount("<p>body text</p>");
		const p = c.querySelector("p");
		if (!p) throw new Error("fixture broken");
		withCaretIn(p);
		const { sup, definitionLi, number } = insertFootnote(c, p);
		expect(number).toBe(1);
		expect(sup.querySelector("a")?.id).toBe("footnote-ref-1");
		expect(definitionLi.id).toBe("footnote-1");
		expect(findFootnoteRef(c, 1)).not.toBeNull();
		expect(findFootnoteDefinition(c, 1)).not.toBeNull();
	});

	test("second insert increments the number", () => {
		const c = mount("<p>body text</p>");
		const p = c.querySelector("p");
		if (!p) throw new Error("fixture broken");
		withCaretIn(p);
		insertFootnote(c, p);
		withCaretIn(p);
		const second = insertFootnote(c, p);
		expect(second.number).toBe(2);
	});

	test("set/getFootnoteText round-trips while preserving the back-ref", () => {
		const c = mount("<p>body</p>");
		const p = c.querySelector("p");
		if (!p) throw new Error("fixture broken");
		withCaretIn(p);
		insertFootnote(c, p);
		setFootnoteText(c, 1, "See the source.");
		expect(getFootnoteText(c, 1)).toBe("See the source.");
		const def = findFootnoteDefinition(c, 1);
		expect(def?.querySelector("[data-footnote-backref]")).not.toBeNull();
	});

	test("removeFootnote drops both ref + definition and the empty section", () => {
		const c = mount("<p>body</p>");
		const p = c.querySelector("p");
		if (!p) throw new Error("fixture broken");
		withCaretIn(p);
		insertFootnote(c, p);
		removeFootnote(c, 1);
		expect(findFootnoteRef(c, 1)).toBeNull();
		expect(findFootnoteDefinition(c, 1)).toBeNull();
		expect(c.querySelector("section[data-footnotes]")).toBeNull();
	});
});

describe("pruneOrphanFootnotes", () => {
	test("removes an empty definition li and its body ref", () => {
		const c = mount("<p>body</p>");
		const p = c.querySelector("p");
		if (!p) throw new Error("fixture broken");
		const range = document.createRange();
		range.selectNodeContents(p);
		range.collapse(false);
		const sel = window.getSelection();
		sel?.removeAllRanges();
		sel?.addRange(range);
		insertFootnote(c, p);
		pruneOrphanFootnotes(c);
		expect(c.querySelector("section[data-footnotes]")).toBeNull();
		expect(findFootnoteRef(c, 1)).toBeNull();
	});

	test("removes a dangling body ref that has no definition", () => {
		const c = mount('<p>text<sup data-footnote-ref="5">5</sup></p>');
		pruneOrphanFootnotes(c);
		expect(c.querySelector("sup[data-footnote-ref]")).toBeNull();
	});
});
