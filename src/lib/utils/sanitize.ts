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

import type { SanitizeSchema } from "../types";

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
 * - Schema providing only `FORBID_TAGS` / `FORBID_ATTR` → the profile is kept;
 *   forbids subtract from it, so there is nothing to override.
 * - `ADD_ATTR` is always present — it is additive under either shape.
 *
 * Pure: returns a fresh object (and fresh arrays) on every call, so callers
 * can hand it to DOMPurify without aliasing the module-level default.
 */
export function buildSanitizeConfig(schema?: SanitizeSchema): SanitizeConfig {
	const config: SanitizeConfig = { ADD_ATTR: [...DEFAULT_SANITIZE.ADD_ATTR] };

	const replacesProfile = schema?.ALLOWED_TAGS !== undefined || schema?.ALLOWED_ATTR !== undefined;
	if (!replacesProfile) config.USE_PROFILES = { ...DEFAULT_SANITIZE.USE_PROFILES };

	if (!schema) return config;

	if (schema.ALLOWED_TAGS) config.ALLOWED_TAGS = [...schema.ALLOWED_TAGS];
	if (schema.ALLOWED_ATTR) config.ALLOWED_ATTR = [...schema.ALLOWED_ATTR];
	if (schema.FORBID_TAGS) config.FORBID_TAGS = [...schema.FORBID_TAGS];
	if (schema.FORBID_ATTR) config.FORBID_ATTR = [...schema.FORBID_ATTR];

	return config;
}
