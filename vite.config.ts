/// <reference types="vitest/config" />

import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

// Node-only vitest for now. Extensive debugging session (see repo Git log
// commits around this file) confirmed:
//
//   - `lightning-jar/sk-app-template` (post-PR#3) + a real Spinner.svelte
//     test running through vitest-browser-svelte + Playwright Chromium
//     PASSES. So the ecosystem works.
//   - The SAME trivial Spinner test copied into woof-editor with the
//     same versions HANGS with Chromium's GPU process pegged at 98% CPU.
//   - Downgrading vitest-browser-svelte 3 → 2.1.1 (matching template):
//     no help.
//   - Swapping svelte() ↔ sveltekit() plugin: no help.
//   - Adding the SvelteKit scaffold files template has but we didn't
//     (hooks.client, hooks.server, +layout, app.d.ts): no help.
//   - Nuking .svelte-kit / node_modules/.vite* + resyncing: no help.
//   - Chromium launch args --disable-gpu --disable-software-rasterizer
//     --disable-webgl --disable-webgl2 --in-process-gpu: no help. Still
//     98% CPU on the GPU process.
//   - vitest debug log (DEBUG=vitest:*) shows the browser session
//     connects to the orchestrator and receives a "run test" dispatch;
//     then the browser goes silent (never reports test start/finish).
//
// Real root cause remains unknown. Something about woof-editor's config
// (not any file I've been able to isolate) is a load-bearing divergence
// from the template. Options for a fresh debugging pass:
//   - Try `@web/test-runner` instead of vitest browser mode
//   - Try attaching to Chromium via CDP directly, skip the vitest
//     tester iframe layer
//   - Move real component tests into support-securelogix once the
//     package is integrated there (that project has a proven SvelteKit
//     setup; if tests work there against woof-editor as an external
//     dep, we've dodged the config-divergence question entirely)
//
// State-class + DOM-primitive tests (36/36) all run cleanly in the node
// project below, so pure-logic coverage is intact.
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
