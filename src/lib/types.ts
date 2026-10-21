// Public types for @kevinpeckham/woof-editor.
// See src/lib/index.ts for the exported API surface.

export type EditorConfig = {
	/**
	 * Debounce (ms) for DOM-mutation → markdown-serialization. Lower =
	 * more responsive dirty-state UI; higher = fewer serializations during
	 * fast typing. Default 250.
	 */
	serializeDebounceMs?: number;
	/** Creation gating — see `FeatureConfig`. */
	features?: FeatureConfig;
};

/**
 * Creation gating — restricts what the editor UI and paste can CREATE.
 * Seeded content is not filtered; see README.
 */
export type FeatureConfig = {
	/** true = all levels; array = only these levels offered. Default true. */
	headings?: boolean | (1 | 2 | 3 | 4 | 5 | 6)[];
	bold?: boolean;
	italic?: boolean;
	/** Gates both ordered and unordered lists. */
	lists?: boolean;
	links?: boolean;
	blockquote?: boolean;
	codeBlock?: boolean;
	strikethrough?: boolean;
	footnotes?: boolean;
	images?: boolean;
	tables?: boolean;
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
