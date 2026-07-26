// DOMPurify configuration for the editor's two content paths: seeding the
// contenteditable from markdown-rendered HTML, and rich-HTML paste.
//
// Why this is a module and not an inline object literal: merging the
// consumer's `sanitize` schema over the default is NOT a plain spread.
// DOMPurify resolves `USE_PROFILES` *after* `ALLOWED_TAGS` / `ALLOWED_ATTR`
// and overwrites them with the profile's own allowlists — so a config that
// carries both makes the consumer's allowlist a silent no-op. Tightening
// therefore requires dropping the profile, which is a rule worth naming,
// testing, and keeping in one place.
//
// A second wrinkle, found in re-review: dropping `USE_PROFILES` is an
// all-or-nothing move — it clears BOTH `ALLOWED_TAGS` and `ALLOWED_ATTR`
// resolution to DOMPurify's profile machinery. If the consumer supplies only
// one of the two schema fields, the OTHER one is left unset, and DOMPurify
// falls back to its full built-in default (`html ∪ svg ∪ svgFilters ∪
// mathMl`) for that dimension — which is WIDER than the html profile this
// package promises. Concretely: `{ ALLOWED_ATTR: ["href"] }` alone let
// `<svg>`/`<math>` tags through (no ALLOWED_TAGS override → default tag set
// includes svg/mathml), and `{ ALLOWED_TAGS: ["p"] }` alone let svg/mathml
// attributes like `fill` through (no ALLOWED_ATTR override → default attr
// set includes svg/mathml attrs). The fix: whenever exactly one of
// `ALLOWED_TAGS`/`ALLOWED_ATTR` is supplied, the OTHER dimension is pinned to
// the vendored html-profile list below, so nothing ever widens past "html
// profile" scope.

import type { SanitizeSchema } from "../types";

/**
 * Vendored copy of DOMPurify's `html` tag profile (`src/tags.js`'s `html`
 * export) — the tag list `USE_PROFILES: { html: true }` allows. Used to pin
 * `ALLOWED_TAGS` to the html profile when the consumer supplies only
 * `ALLOWED_ATTR` (see {@link buildSanitizeConfig}), so that dimension can't
 * silently fall back to DOMPurify's full default (html ∪ svg ∪ svgFilters ∪
 * mathMl).
 *
 * Vendored from `dompurify@3.4.12` (`node_modules/dompurify/dist/purify.es.mjs`,
 * the `html$1` constant). Re-check this list against the installed
 * dompurify's `src/tags.js` on any dompurify MAJOR version bump.
 */
export const HTML_PROFILE_TAGS = [
	"a",
	"abbr",
	"acronym",
	"address",
	"area",
	"article",
	"aside",
	"audio",
	"b",
	"bdi",
	"bdo",
	"big",
	"blink",
	"blockquote",
	"body",
	"br",
	"button",
	"canvas",
	"caption",
	"center",
	"cite",
	"code",
	"col",
	"colgroup",
	"content",
	"data",
	"datalist",
	"dd",
	"decorator",
	"del",
	"details",
	"dfn",
	"dialog",
	"dir",
	"div",
	"dl",
	"dt",
	"element",
	"em",
	"fieldset",
	"figcaption",
	"figure",
	"font",
	"footer",
	"form",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"head",
	"header",
	"hgroup",
	"hr",
	"html",
	"i",
	"img",
	"input",
	"ins",
	"kbd",
	"label",
	"legend",
	"li",
	"main",
	"map",
	"mark",
	"marquee",
	"menu",
	"menuitem",
	"meter",
	"nav",
	"nobr",
	"ol",
	"optgroup",
	"option",
	"output",
	"p",
	"picture",
	"pre",
	"progress",
	"q",
	"rp",
	"rt",
	"ruby",
	"s",
	"samp",
	"search",
	"section",
	"select",
	"shadow",
	"slot",
	"small",
	"source",
	"spacer",
	"span",
	"strike",
	"strong",
	"style",
	"sub",
	"summary",
	"sup",
	"table",
	"tbody",
	"td",
	"template",
	"textarea",
	"tfoot",
	"th",
	"thead",
	"time",
	"tr",
	"track",
	"tt",
	"u",
	"ul",
	"var",
	"video",
	"wbr",
] as const;

/**
 * Vendored copy of DOMPurify's `html` attribute profile (`src/attrs.js`'s
 * `html` export) — the attribute list `USE_PROFILES: { html: true }` allows.
 * Used to pin `ALLOWED_ATTR` to the html profile when the consumer supplies
 * only `ALLOWED_TAGS` (see {@link buildSanitizeConfig}), so that dimension
 * can't silently fall back to DOMPurify's full default (html ∪ svg ∪
 * svgFilters ∪ mathMl).
 *
 * Vendored from `dompurify@3.4.12` (`node_modules/dompurify/dist/purify.es.mjs`,
 * the `html` constant). Re-check this list against the installed dompurify's
 * `src/attrs.js` on any dompurify MAJOR version bump.
 */
export const HTML_PROFILE_ATTRS = [
	"accept",
	"action",
	"align",
	"alt",
	"autocapitalize",
	"autocomplete",
	"autopictureinpicture",
	"autoplay",
	"background",
	"bgcolor",
	"border",
	"capture",
	"cellpadding",
	"cellspacing",
	"checked",
	"cite",
	"class",
	"clear",
	"color",
	"cols",
	"colspan",
	"command",
	"commandfor",
	"controls",
	"controlslist",
	"coords",
	"crossorigin",
	"datetime",
	"decoding",
	"default",
	"dir",
	"disabled",
	"disablepictureinpicture",
	"disableremoteplayback",
	"download",
	"draggable",
	"enctype",
	"enterkeyhint",
	"exportparts",
	"face",
	"for",
	"headers",
	"height",
	"hidden",
	"high",
	"href",
	"hreflang",
	"id",
	"inert",
	"inputmode",
	"integrity",
	"ismap",
	"kind",
	"label",
	"lang",
	"list",
	"loading",
	"loop",
	"low",
	"max",
	"maxlength",
	"media",
	"method",
	"min",
	"minlength",
	"multiple",
	"muted",
	"name",
	"nonce",
	"noshade",
	"novalidate",
	"nowrap",
	"open",
	"optimum",
	"part",
	"pattern",
	"placeholder",
	"playsinline",
	"popover",
	"popovertarget",
	"popovertargetaction",
	"poster",
	"preload",
	"pubdate",
	"radiogroup",
	"readonly",
	"rel",
	"required",
	"rev",
	"reversed",
	"role",
	"rows",
	"rowspan",
	"spellcheck",
	"scope",
	"selected",
	"shape",
	"size",
	"sizes",
	"slot",
	"span",
	"srclang",
	"start",
	"src",
	"srcset",
	"step",
	"style",
	"summary",
	"tabindex",
	"title",
	"translate",
	"type",
	"usemap",
	"valign",
	"value",
	"width",
	"wrap",
	"xmlns",
] as const;

/**
 * Base config shared by the markdown-seed path and the paste path.
 *
 * `USE_PROFILES: { html: true }` is DOMPurify's curated HTML allowlist.
 * `ADD_ATTR` is *additive* (it survives alongside either the profile or an
 * explicit allowlist), which is what keeps `marked-footnote`'s markup intact.
 */
export const DEFAULT_SANITIZE = {
	ADD_ATTR: ["data-footnote-ref", "data-footnotes", "id"],
	USE_PROFILES: { html: true },
} as const;

/** Resolved DOMPurify config produced by {@link buildSanitizeConfig}. */
export type SanitizeConfig = {
	ADD_ATTR: string[];
	USE_PROFILES?: { html: true };
	ALLOWED_TAGS?: string[];
	ALLOWED_ATTR?: string[];
	FORBID_TAGS?: string[];
	FORBID_ATTR?: string[];
};

/**
 * Resolve a consumer `sanitize` schema into a DOMPurify config.
 *
 * Rules:
 * - No schema → the default config (html profile + footnote attrs).
 * - Schema providing `ALLOWED_TAGS` and/or `ALLOWED_ATTR` → `USE_PROFILES` is
 *   **omitted**, because DOMPurify would otherwise override those fields with
 *   the profile's allowlists and the consumer's tightening would do nothing.
 *   Providing an allowlist therefore *replaces* the default html profile.
 * - Schema providing **exactly one** of `ALLOWED_TAGS` / `ALLOWED_ATTR` → the
 *   OTHER dimension is pinned to the vendored {@link HTML_PROFILE_TAGS} /
 *   {@link HTML_PROFILE_ATTRS} list (not left to DOMPurify's full built-in
 *   default, which is wider than the html profile — it also covers svg,
 *   svgFilters and mathMl). This is what keeps a partial schema a genuine
 *   *tightening* rather than an accidental widening of the untouched
 *   dimension.
 * - Schema providing **both** `ALLOWED_TAGS` and `ALLOWED_ATTR` → both are
 *   used as given, no pinning needed.
 * - Schema providing only `FORBID_TAGS` / `FORBID_ATTR` → the profile is kept;
 *   forbids subtract from it, so there is nothing to override.
 * - `ADD_ATTR` is always present — it is additive under any shape.
 *
 * Pure: returns a fresh object (and fresh arrays) on every call, so callers
 * can hand it to DOMPurify without aliasing the module-level default.
 */
export function buildSanitizeConfig(schema?: SanitizeSchema): SanitizeConfig {
	const config: SanitizeConfig = { ADD_ATTR: [...DEFAULT_SANITIZE.ADD_ATTR] };

	const hasTags = schema?.ALLOWED_TAGS !== undefined;
	const hasAttr = schema?.ALLOWED_ATTR !== undefined;
	const replacesProfile = hasTags || hasAttr;
	if (!replacesProfile) config.USE_PROFILES = { ...DEFAULT_SANITIZE.USE_PROFILES };

	if (!schema) return config;

	if (schema.ALLOWED_TAGS) config.ALLOWED_TAGS = [...schema.ALLOWED_TAGS];
	else if (hasAttr) config.ALLOWED_TAGS = [...HTML_PROFILE_TAGS];

	if (schema.ALLOWED_ATTR) config.ALLOWED_ATTR = [...schema.ALLOWED_ATTR];
	else if (hasTags) config.ALLOWED_ATTR = [...HTML_PROFILE_ATTRS];

	if (schema.FORBID_TAGS) config.FORBID_TAGS = [...schema.FORBID_TAGS];
	if (schema.FORBID_ATTR) config.FORBID_ATTR = [...schema.FORBID_ATTR];

	return config;
}
