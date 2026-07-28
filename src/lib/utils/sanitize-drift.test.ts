// Drift check: the vendored HTML_PROFILE_TAGS / HTML_PROFILE_ATTRS in
// sanitize.ts are a hand-copied snapshot of DOMPurify's `html` tag/attribute
// profile (`USE_PROFILES: { html: true }`), used to pin the "other" dimension
// when a consumer's `sanitize` schema supplies only ALLOWED_TAGS or only
// ALLOWED_ATTR (see sanitize.ts's docblock). Now that the peerDependencies
// range spans two majors of the `isomorphic-dompurify` wrapper (`^2 || ^3`),
// a consumer's installed `dompurify` can be a different version than the one
// these lists were vendored from — and DOMPurify's html profile DOES change
// across releases (new HTML elements/attributes get added). If it drifts
// silently, `buildSanitizeConfig()`'s single-dimension pin quietly stops
// matching "the html profile" and starts being either too loose or too tight
// compared to what the installed DOMPurify itself would produce under
// `USE_PROFILES: { html: true }`.
//
// This test reads the INSTALLED dompurify package's own source (not our
// vendored copy) and diffs it against the vendored lists, failing loudly on
// any mismatch.
//
// Why node-env (no `@vitest-environment happy-dom` marker): this file does
// pure filesystem/text work (no DOMPurify.sanitize calls), but it lives
// alongside sanitize.test.ts's DOMPurify-through-jsdom tests and follows the
// same node-env convention documented there — happy-dom's DOM is
// measurably too incomplete for DOMPurify to behave correctly on, so
// anything DOMPurify-adjacent in this package defaults to node.
//
// Extraction approach: dompurify's package.json `exports` map only exposes
// the "." entry point (plus a couple of prebuilt dist files) — subpath
// imports like `dompurify/src/tags` are blocked
// (ERR_PACKAGE_PATH_NOT_EXPORTED). So instead of importing, we resolve the
// package's on-disk root via `createRequire(...).resolve("dompurify")` and
// read `src/tags.ts` / `src/attrs.ts` as plain text, regex-extracting the
// `export const html = freeze([ ... ] as const)` array contents. Those two
// files are TypeScript source (not compiled output) but their shape is
// simple and stable: a single `export const html = freeze([...] as const)`
// per file, one quoted string literal per line.
//
// If this test ever fails because the freshly-installed dompurify is NEWER
// than the vendored snapshot and its html profile genuinely changed:
// re-vendor the lists in src/lib/utils/sanitize.ts from the installed
// dompurify and update its provenance comment. That is this test working as
// designed, not a bug in the test.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { HTML_PROFILE_ATTRS, HTML_PROFILE_TAGS } from "./sanitize";

const require = createRequire(import.meta.url);

/** Resolve dompurify's package root on disk (its `exports` map blocks subpath imports, so we read source files directly rather than importing them). */
function resolveDompurifyRoot(): string {
	// e.g. .../node_modules/dompurify/dist/purify.cjs.js
	const resolvedEntry = require.resolve("dompurify");
	// .../node_modules/dompurify/dist -> .../node_modules/dompurify
	return path.dirname(path.dirname(resolvedEntry));
}

/**
 * Extract the quoted string literals inside a top-level
 * `export const <name> = freeze([ ... ] as const);` block from a dompurify
 * `src/*.ts` source file's text.
 */
function extractFreezeList(source: string, exportName: string): string[] {
	const blockPattern = new RegExp(
		`export const ${exportName} = freeze\\(\\[([\\s\\S]*?)\\] as const\\);`,
	);
	const match = blockPattern.exec(source);
	if (!match) {
		throw new Error(
			`Could not locate "export const ${exportName} = freeze([...] as const);" block — ` +
				"dompurify's src file shape may have changed; update the extraction regex in sanitize-drift.test.ts.",
		);
	}
	const body = match[1];
	const items: string[] = [];
	const itemPattern = /'([^']+)'/g;
	let itemMatch: RegExpExecArray | null;
	// biome-ignore lint/suspicious/noAssignInExpressions: standard regex-exec-loop idiom
	while ((itemMatch = itemPattern.exec(body)) !== null) {
		items.push(itemMatch[1]);
	}
	return items;
}

const dompurifyRoot = resolveDompurifyRoot();
const dompurifyPackageJson = JSON.parse(
	readFileSync(path.join(dompurifyRoot, "package.json"), "utf-8"),
) as { version?: string };
const installedDompurifyVersion = dompurifyPackageJson.version ?? "<unknown>";

const tagsSource = readFileSync(path.join(dompurifyRoot, "src", "tags.ts"), "utf-8");
const attrsSource = readFileSync(path.join(dompurifyRoot, "src", "attrs.ts"), "utf-8");

const installedHtmlTags = extractFreezeList(tagsSource, "html");
const installedHtmlAttrs = extractFreezeList(attrsSource, "html");

function diffSets(vendored: readonly string[], installed: readonly string[]) {
	const vendoredSet = new Set(vendored);
	const installedSet = new Set(installed);
	const missingFromVendored = installed.filter((item) => !vendoredSet.has(item)); // installed has, vendored lacks
	const extraInVendored = vendored.filter((item) => !installedSet.has(item)); // vendored has, installed lacks
	return { extraInVendored, missingFromVendored };
}

describe("HTML_PROFILE_TAGS / HTML_PROFILE_ATTRS — drift check against installed dompurify", () => {
	// Guard against silent extraction rot: if the regex extraction above ever
	// stops matching dompurify's source shape (e.g. a future dompurify version
	// reformats src/tags.ts), it must fail LOUDLY (throw, or produce an
	// obviously-too-small list) rather than silently returning an empty/tiny
	// array that would make the equality assertions below vacuously pass.
	test("extracted installed-dompurify lists are non-trivial (extraction guard)", () => {
		expect(installedHtmlTags.length).toBeGreaterThan(100);
		expect(installedHtmlTags).toContain("p");
		expect(installedHtmlTags).toContain("a");
		expect(installedHtmlTags).toContain("table");

		expect(installedHtmlAttrs.length).toBeGreaterThan(40);
		expect(installedHtmlAttrs).toContain("href");
		expect(installedHtmlAttrs).toContain("title");
	});

	test("vendored HTML_PROFILE_TAGS matches the installed dompurify's html tag profile exactly", () => {
		const { extraInVendored, missingFromVendored } = diffSets(HTML_PROFILE_TAGS, installedHtmlTags);
		const message =
			`HTML_PROFILE_TAGS (src/lib/utils/sanitize.ts) has drifted from installed dompurify@${installedDompurifyVersion}'s html tag profile.\n` +
			`  Missing from vendored (present in installed): ${JSON.stringify(missingFromVendored)}\n` +
			`  Extra in vendored (absent from installed): ${JSON.stringify(extraInVendored)}\n` +
			"  Fix: re-vendor the lists in src/lib/utils/sanitize.ts from the installed dompurify and update its provenance comment.";
		expect(missingFromVendored, message).toEqual([]);
		expect(extraInVendored, message).toEqual([]);
	});

	test("vendored HTML_PROFILE_ATTRS matches the installed dompurify's html attribute profile exactly", () => {
		const { extraInVendored, missingFromVendored } = diffSets(
			HTML_PROFILE_ATTRS,
			installedHtmlAttrs,
		);
		const message =
			`HTML_PROFILE_ATTRS (src/lib/utils/sanitize.ts) has drifted from installed dompurify@${installedDompurifyVersion}'s html attribute profile.\n` +
			`  Missing from vendored (present in installed): ${JSON.stringify(missingFromVendored)}\n` +
			`  Extra in vendored (absent from installed): ${JSON.stringify(extraInVendored)}\n` +
			"  Fix: re-vendor the lists in src/lib/utils/sanitize.ts from the installed dompurify and update its provenance comment.";
		expect(missingFromVendored, message).toEqual([]);
		expect(extraInVendored, message).toEqual([]);
	});
});
