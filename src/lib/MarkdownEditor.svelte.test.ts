// Browser smoke test — proves the vitest `browser` project + Playwright
// Chromium wiring works. Real component tests land alongside the E3 port.

import { expect, test } from "vitest";

import { render } from "vitest-browser-svelte";

import MarkdownEditor from "./MarkdownEditor.svelte";
import { MarkdownEditorState } from "./state/editor.svelte";

test("stub renders with the expected version marker", async () => {
	const editor = new MarkdownEditorState({ markdown: "# Hello" });
	const screen = await render(MarkdownEditor, { editor });
	const stub = screen.container.querySelector('[data-woof-editor-version="0.1.0-alpha.0"]');
	expect(stub).not.toBeNull();
});
