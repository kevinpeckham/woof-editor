/// <reference types="vitest/config" />

import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

// Node-only vitest for now. The browser project has been attempted three
// times (E1 with sveltekit()+storybook plugins, E3 with raw svelte(),
// E4 with sveltekit()+--disable-gpu launch args) and hangs every time
// with the Chromium GPU process pegged at 98% CPU. Kevin's briefing on
// upstream sk-app-template pinned that project's hang on
// @varlock/vite-integration serving error HTML to the tester iframe —
// but this package doesn't use varlock, so we're hitting a different
// failure mode. Needs a dedicated debugging session that diffs a known-
// good sk-app-template fork's config against ours to spot the divergence
// rather than iterating variations. Node tests (state class + DOM
// primitives via happy-dom) cover the pure-logic surface — 36/36 pass.
export default defineConfig({
	plugins: [svelte()],
	test: {
		environment: "node",
		exclude: [
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
