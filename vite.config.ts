/// <reference types="vitest/config" />

import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

// This is a LIBRARY, not a SvelteKit app — we deliberately use the raw
// `svelte()` vite plugin instead of `sveltekit()`. sveltekit() installs
// its own request router that intercepts Vitest browser mode's tester-
// iframe URL, serving the app's /+page.svelte in place of the test
// runtime. svelte() alone gives us .svelte compilation without the
// interception. svelte-kit sync (tsconfig gen) + svelte-package (dist
// build) still work — they read svelte.config.js, not this file.
//
// E1: node-only vitest projects. Browser project + storybook project
// deferred to E3 — WYSIWYG surface will need real browser tests then,
// and by then we'll have solved the tester-iframe issue (or moved to
// a different browser-test approach like @web/test-runner).
export default defineConfig({
	plugins: [svelte()],
	test: {
		environment: "node",
		exclude: [
			// Skip .svelte browser tests until E3.
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
