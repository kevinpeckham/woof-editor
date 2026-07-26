// Public types for @kevinpeckham/woof-editor.
// See src/lib/index.ts for the exported API surface.

export type EditorConfig = {
	/**
	 * Debounce (ms) for DOM-mutation → markdown-serialization. Lower =
	 * more responsive dirty-state UI; higher = fewer serializations during
	 * fast typing. Default 250.
	 */
	serializeDebounceMs?: number;

	/**
	 * How to handle YAML frontmatter at the top of the markdown body.
	 * Default `"ignore"` — the entire string is treated as body markdown.
	 *
	 * (Non-default modes land in a future minor version; for now only
	 * `"ignore"` is implemented.)
	 */
	frontmatterMode?: "ignore" | "preserve" | "extract";
};

/**
 * Snapshot of the editor state suitable for save-side hashing / dirty
 * comparisons. Produced by `MarkdownEditorState.snapshot()`.
 */
export type EditorSnapshot = {
	markdown: string;
	timestamp: number;
};

/**
 * DOMPurify-compatible sanitize schema. Consumers can pass a custom
 * schema to widen or tighten what's allowed on paste. Default schema
 * (defined internally) matches lj-website's escape-everything-except-
 * safe-tags posture.
 */
export type SanitizeSchema = {
	ALLOWED_TAGS?: readonly string[];
	ALLOWED_ATTR?: readonly string[];
	FORBID_TAGS?: readonly string[];
	FORBID_ATTR?: readonly string[];
};

/**
 * OpenGraph-ish preview of a link target, rendered inside the link
 * popover. Returned by the consumer's `loadLinkPreview` callback —
 * all fields except `url` are optional; missing fields simply don't
 * render.
 */
export type LinkPreview = {
	url: string;
	title?: string;
	description?: string;
	image?: string;
	siteName?: string;
	favicon?: string;
};
