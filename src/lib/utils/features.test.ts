// Pure feature-resolution logic. Node env — no DOM needed.
import { describe, expect, test } from "vitest";

import { ALL_FEATURES, convertibleTagsFor, pasteForbidTagsFor, resolveFeatures } from "./features";

describe("resolveFeatures", () => {
	test("absent config enables everything", () => {
		const f = resolveFeatures(undefined);
		expect(f).toEqual(ALL_FEATURES);
		expect([...f.headingLevels].sort()).toEqual([1, 2, 3, 4, 5, 6]);
		expect(f.footnotes).toBe(true);
	});

	test("explicit false disables; omitted fields stay enabled", () => {
		const f = resolveFeatures({ blockquote: false, codeBlock: false });
		expect(f.blockquote).toBe(false);
		expect(f.codeBlock).toBe(false);
		expect(f.bold).toBe(true);
		expect(f.headingLevels.size).toBe(6);
	});

	test("headings accepts a level array", () => {
		const f = resolveFeatures({ headings: [1, 2, 3] });
		expect([...f.headingLevels].sort()).toEqual([1, 2, 3]);
	});

	test("headings: false empties the level set", () => {
		expect(resolveFeatures({ headings: false }).headingLevels.size).toBe(0);
	});

	test("mutating one call's headingLevels does not affect later calls (no shared mutable default)", () => {
		const first = resolveFeatures(undefined);
		(first.headingLevels as Set<number>).add(99);
		(first.headingLevels as Set<number>).delete(1);

		const second = resolveFeatures(undefined);
		expect([...second.headingLevels].sort()).toEqual([1, 2, 3, 4, 5, 6]);
		expect(second.headingLevels).not.toBe(first.headingLevels);
		expect(ALL_FEATURES.headingLevels.has(99)).toBe(false);
	});
});

describe("convertibleTagsFor", () => {
	test("full features match the full menu list shape", () => {
		const list = convertibleTagsFor(ALL_FEATURES);
		expect(list.map((o) => o.tag)).toEqual([
			"p",
			"h1",
			"h2",
			"h3",
			"h4",
			"blockquote",
			"ul",
			"ol",
			"pre",
		]);
	});

	test("replicator's restricted set", () => {
		const f = resolveFeatures({
			blockquote: false,
			codeBlock: false,
			footnotes: false,
			images: false,
			strikethrough: false,
			tables: false,
		});
		expect(convertibleTagsFor(f).map((o) => o.tag)).toEqual([
			"p",
			"h1",
			"h2",
			"h3",
			"h4",
			"ul",
			"ol",
		]);
	});

	test("heading levels filter the heading entries; paragraph always present", () => {
		const f = resolveFeatures({
			blockquote: false,
			codeBlock: false,
			headings: [2, 3],
			lists: false,
		});
		expect(convertibleTagsFor(f).map((o) => o.tag)).toEqual(["p", "h2", "h3"]);
	});
});

describe("pasteForbidTagsFor", () => {
	test("fully-enabled features forbid nothing", () => {
		expect(pasteForbidTagsFor(ALL_FEATURES)).toEqual([]);
	});

	test("disabled features map to their tags", () => {
		const f = resolveFeatures({
			blockquote: false,
			bold: false,
			codeBlock: false,
			footnotes: false,
			headings: false,
			images: false,
			italic: false,
			links: false,
			lists: false,
			strikethrough: false,
			tables: false,
		});
		const forbid = pasteForbidTagsFor(f);
		for (const tag of [
			"blockquote",
			"pre",
			"strong",
			"b",
			"em",
			"i",
			"del",
			"s",
			"strike",
			"ul",
			"ol",
			"li",
			"a",
			"sup",
			"section",
			"img",
			"table",
			"thead",
			"tbody",
			"tfoot",
			"tr",
			"td",
			"th",
			"caption",
			"colgroup",
			"col",
			"h1",
			"h2",
			"h3",
			"h4",
			"h5",
			"h6",
		]) {
			expect(forbid, `expected ${tag} forbidden`).toContain(tag);
		}
	});

	test("partial heading levels forbid only the disabled levels", () => {
		const f = resolveFeatures({ headings: [1, 2] });
		const forbid = pasteForbidTagsFor(f);
		expect(forbid).toEqual(expect.arrayContaining(["h3", "h4", "h5", "h6"]));
		expect(forbid).not.toContain("h1");
		expect(forbid).not.toContain("h2");
	});

	test("codeBlock: false forbids pre but NOT inline code", () => {
		const f = resolveFeatures({ codeBlock: false });
		const forbid = pasteForbidTagsFor(f);
		expect(forbid).toContain("pre");
		expect(forbid).not.toContain("code");
	});
});
