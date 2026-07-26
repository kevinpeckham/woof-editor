// Sanitize-config test suite.
//
// Runs in the plain **node** environment (no `@vitest-environment` marker)
// on purpose. `isomorphic-dompurify` binds DOMPurify to jsdom when there is
// no global `window`, and jsdom is the only DOM available here that
// DOMPurify actually behaves correctly on.
//
// Do NOT switch this file to happy-dom. Under happy-dom, DOMPurify is
// measurably broken — with NO config at all, `sanitize("<p>y</p>")` returns
// `"y"` (block elements dropped) and `sanitize("<p>a</p><script>alert(1)</script>")`
// returns the `<script>` tag INTACT. Behavioral sanitizer assertions written
// against happy-dom would therefore be meaningless-to-actively-misleading.
// Real browsers and jsdom both behave correctly; happy-dom's DOM traversal
// is simply too incomplete for DOMPurify's NodeIterator walk.

import DOMPurify from "isomorphic-dompurify";
import { describe, expect, test } from "vitest";

import { buildSanitizeConfig, DEFAULT_SANITIZE } from "./sanitize";

describe("buildSanitizeConfig — config shape", () => {
	test("no schema → the default config (html profile + footnote attrs)", () => {
		const config = buildSanitizeConfig();
		expect(config.USE_PROFILES).toEqual({ html: true });
		expect(config.ADD_ATTR).toEqual([...DEFAULT_SANITIZE.ADD_ATTR]);
		expect(config.ALLOWED_TAGS).toBeUndefined();
		expect(config.ALLOWED_ATTR).toBeUndefined();
	});

	test("returns a fresh object each call (callers can't mutate the default)", () => {
		const a = buildSanitizeConfig();
		const b = buildSanitizeConfig();
		expect(a).not.toBe(b);
		expect(a.ADD_ATTR).not.toBe(b.ADD_ATTR);
		expect(a.ADD_ATTR).not.toBe(DEFAULT_SANITIZE.ADD_ATTR);
	});

	// The core regression: DOMPurify lets USE_PROFILES OVERRIDE ALLOWED_TAGS /
	// ALLOWED_ATTR, so any config that keeps the profile makes those two
	// schema fields silent no-ops.
	test("ALLOWED_TAGS present → USE_PROFILES is omitted", () => {
		const config = buildSanitizeConfig({ ALLOWED_TAGS: ["p", "strong"] });
		expect(config.USE_PROFILES).toBeUndefined();
		expect(config.ALLOWED_TAGS).toEqual(["p", "strong"]);
	});

	test("ALLOWED_ATTR present → USE_PROFILES is omitted", () => {
		const config = buildSanitizeConfig({ ALLOWED_ATTR: ["href"] });
		expect(config.USE_PROFILES).toBeUndefined();
		expect(config.ALLOWED_ATTR).toEqual(["href"]);
	});

	test("only FORBID_* present → USE_PROFILES is kept", () => {
		const config = buildSanitizeConfig({ FORBID_ATTR: ["style"], FORBID_TAGS: ["em"] });
		expect(config.USE_PROFILES).toEqual({ html: true });
		expect(config.FORBID_TAGS).toEqual(["em"]);
		expect(config.FORBID_ATTR).toEqual(["style"]);
	});

	test("ADD_ATTR is always present, allowlist or not", () => {
		for (const schema of [
			undefined,
			{ ALLOWED_TAGS: ["p"] },
			{ ALLOWED_ATTR: ["href"] },
			{ FORBID_TAGS: ["em"] },
		]) {
			expect(buildSanitizeConfig(schema).ADD_ATTR).toEqual([...DEFAULT_SANITIZE.ADD_ATTR]);
		}
	});

	test("all four schema fields overlay together", () => {
		const config = buildSanitizeConfig({
			ALLOWED_ATTR: ["href"],
			ALLOWED_TAGS: ["p", "a"],
			FORBID_ATTR: ["style"],
			FORBID_TAGS: ["em"],
		});
		expect(config).toEqual({
			ADD_ATTR: [...DEFAULT_SANITIZE.ADD_ATTR],
			ALLOWED_ATTR: ["href"],
			ALLOWED_TAGS: ["p", "a"],
			FORBID_ATTR: ["style"],
			FORBID_TAGS: ["em"],
		});
	});

	test("readonly schema arrays are copied into mutable ones", () => {
		const allowedTags: readonly string[] = Object.freeze(["p"]);
		const config = buildSanitizeConfig({ ALLOWED_TAGS: allowedTags });
		expect(config.ALLOWED_TAGS).not.toBe(allowedTags);
		expect(() => config.ALLOWED_TAGS?.push("h1")).not.toThrow();
	});
});

describe("buildSanitizeConfig — behavior through DOMPurify", () => {
	test("ALLOWED_TAGS actually tightens (the no-op regression)", () => {
		const clean = DOMPurify.sanitize(
			"<h1>x</h1><p>y</p>",
			buildSanitizeConfig({ ALLOWED_TAGS: ["p", "strong"] }),
		);
		expect(clean).not.toContain("<h1>");
		expect(clean).toContain("<p>y</p>");
	});

	test("ALLOWED_ATTR actually tightens", () => {
		const clean = DOMPurify.sanitize(
			'<p class="c" title="t">y</p>',
			buildSanitizeConfig({ ALLOWED_ATTR: ["title"] }),
		);
		expect(clean).not.toContain("class=");
		expect(clean).toContain('title="t"');
	});

	test("default config keeps marked-footnote's data-footnote-ref markup", () => {
		const clean = DOMPurify.sanitize(
			'<sup><a href="#user-content-fn-1" id="footnote-ref-1" data-footnote-ref>1</a></sup>',
			buildSanitizeConfig(),
		);
		expect(clean).toContain("data-footnote-ref");
		expect(clean).toContain('id="footnote-ref-1"');
		expect(clean).toContain("<sup>");
	});

	test("FORBID_TAGS strips em while the html profile stays in force", () => {
		const clean = DOMPurify.sanitize(
			"<p><em>i</em>t</p>",
			buildSanitizeConfig({ FORBID_TAGS: ["em"] }),
		);
		expect(clean).not.toContain("<em>");
		// The profile is still applied, so the surrounding block survives.
		expect(clean).toContain("<p>");
	});

	test("script tags and on* handlers are stripped under the default config", () => {
		const config = buildSanitizeConfig();
		expect(DOMPurify.sanitize("<p>a</p><script>alert(1)</script>", config)).not.toContain(
			"<script",
		);
		expect(DOMPurify.sanitize('<img src=x onerror="alert(1)">', config)).not.toContain("onerror");
	});

	test("javascript:/vbscript:/data: are stripped from link hrefs", () => {
		const config = buildSanitizeConfig();
		for (const href of [
			"javascript:alert(1)",
			"vbscript:msgbox(1)",
			"data:text/html;base64,PHM+",
		]) {
			expect(DOMPurify.sanitize(`<a href="${href}">x</a>`, config)).not.toContain("href=");
		}
	});

	// Documented scope limit, asserted so it can't drift silently: DOMPurify's
	// default `ALLOWED_URI_REGEXP` permits `data:` on media sources. README /
	// CHANGELOG must not claim `data:` is stripped everywhere.
	test("data: IS allowed on img src by DOMPurify default (documented limitation)", () => {
		const clean = DOMPurify.sanitize(
			'<img src="data:image/png;base64,iVBORw0KGgo=">',
			buildSanitizeConfig(),
		);
		expect(clean).toContain("data:image/png");
	});
});
