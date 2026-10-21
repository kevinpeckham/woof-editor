// Pure feature-resolution logic for creation-gating: restricts what the
// editor UI and paste can CREATE. Seeded content is never filtered — see
// README. No DOM, no Svelte — safe to unit test in node env.

import { CONVERTIBLE_TAGS_LIST } from "../actions/dom";
import type { FeatureConfig } from "../types";

export type ResolvedFeatures = {
	headingLevels: ReadonlySet<number>; // empty set = headings disabled
	bold: boolean;
	italic: boolean;
	lists: boolean;
	links: boolean;
	blockquote: boolean;
	codeBlock: boolean;
	strikethrough: boolean;
	footnotes: boolean;
	images: boolean;
	tables: boolean;
};

const ALL_HEADING_LEVELS: ReadonlySet<number> = new Set([1, 2, 3, 4, 5, 6]);

export const ALL_FEATURES: ResolvedFeatures = {
	blockquote: true,
	bold: true,
	codeBlock: true,
	footnotes: true,
	headingLevels: ALL_HEADING_LEVELS,
	images: true,
	italic: true,
	links: true,
	lists: true,
	strikethrough: true,
	tables: true,
};

function resolveHeadingLevels(headings: FeatureConfig["headings"]): ReadonlySet<number> {
	if (headings === undefined || headings === true) return ALL_HEADING_LEVELS;
	if (headings === false) return new Set();
	return new Set(headings);
}

export function resolveFeatures(config?: FeatureConfig): ResolvedFeatures {
	if (!config) return ALL_FEATURES;
	return {
		blockquote: config.blockquote ?? true,
		bold: config.bold ?? true,
		codeBlock: config.codeBlock ?? true,
		footnotes: config.footnotes ?? true,
		headingLevels: resolveHeadingLevels(config.headings),
		images: config.images ?? true,
		italic: config.italic ?? true,
		links: config.links ?? true,
		lists: config.lists ?? true,
		strikethrough: config.strikethrough ?? true,
		tables: config.tables ?? true,
	};
}

/**
 * Filters the menu's block-type conversion list to the features that are
 * enabled. Imports `CONVERTIBLE_TAGS_LIST` as the source of labels so this
 * list and the menu's list can't drift apart.
 */
export function convertibleTagsFor(features: ResolvedFeatures): { tag: string; label: string }[] {
	return CONVERTIBLE_TAGS_LIST.filter((entry) => {
		if (entry.tag === "p") return true;
		const headingMatch = /^h([1-6])$/.exec(entry.tag);
		if (headingMatch) return features.headingLevels.has(Number(headingMatch[1]));
		if (entry.tag === "blockquote") return features.blockquote;
		if (entry.tag === "ul" || entry.tag === "ol") return features.lists;
		if (entry.tag === "pre") return features.codeBlock;
		return true;
	});
}

/**
 * Maps disabled features to the HTML tags paste-sanitization should forbid
 * from creating new content. Mapping rules (exact):
 *   blockquote -> blockquote
 *   codeBlock -> pre (inline `code` is a separate construct, stays allowed)
 *   strikethrough -> del, s, strike
 *   lists -> ul, ol, li
 *   links -> a
 *   footnotes -> sup, section (the editor's footnote shape)
 *   images -> img
 *   tables -> table, thead, tbody, tfoot, tr, td, th, caption, colgroup, col
 *   bold -> strong, b
 *   italic -> em, i
 *   headings -> h{n} for each level NOT in headingLevels
 */
export function pasteForbidTagsFor(features: ResolvedFeatures): string[] {
	const forbid: string[] = [];

	if (!features.blockquote) forbid.push("blockquote");
	if (!features.codeBlock) forbid.push("pre");
	if (!features.strikethrough) forbid.push("del", "s", "strike");
	if (!features.lists) forbid.push("ul", "ol", "li");
	if (!features.links) forbid.push("a");
	if (!features.footnotes) forbid.push("sup", "section");
	if (!features.images) forbid.push("img");
	if (!features.tables) {
		forbid.push("table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption", "colgroup", "col");
	}
	if (!features.bold) forbid.push("strong", "b");
	if (!features.italic) forbid.push("em", "i");

	for (let level = 1; level <= 6; level++) {
		if (!features.headingLevels.has(level)) forbid.push(`h${level}`);
	}

	return forbid;
}
