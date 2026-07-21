/// <reference types="vitest/config" />

import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

// This is a LIBRARY, not a SvelteKit app — we deliberately use the raw
// `svelte()` vite plugin instead of `sveltekit()`. svelte-kit sync
// (tsconfig gen) + svelte-package (dist build) still work — they read
// svelte.config.js, not this file.
//
// Vitest browser project is intentionally not enabled here. E1's initial
// attempt hung on the tester-iframe (chromium GPU at 98%, zero test
// output); swapping sveltekit() → svelte() didn't fix it (tried again in
// E3 — same hang). The state class + dom-action tests all run cleanly in
// the node project with per-file `@vitest-environment happy-dom` for
// tests that need a DOM. Real browser tests for the WYSIWYG surface land
// in a follow-up alpha once the root cause of the iframe hang is chased
// down (candidate: use `@web/test-runner` instead of vitest's browser
// mode, or attach chrome-devtools-protocol directly).
export default defineConfig({
	plugins: [svelte()],
	test: {
		environment: "node",
		exclude: [
			// .svelte browser tests skipped until the browser project works.
			"src/**/*.svelte.{test,spec}.{js,ts}",
			"node_modules/**",
			"dist/**",
			".svelte-kit/**",
		],
		expect: {
			requireAssertions: true,
		},
		include: ["src/**/*.{test,spec}.{js,ts}"],
	},
});
