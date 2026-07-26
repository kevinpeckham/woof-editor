/// <reference types="vitest/config" />

import path from "node:path";
import { fileURLToPath } from "node:url";

import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { sveltekit } from "@sveltejs/kit/vite";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const dirname =
	typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// Real-browser coverage lives in the `storybook` project below: it runs the
// stories in `stories/**/*.stories.svelte` through Chromium via
// `@storybook/addon-vitest`'s `storybookTest` plugin — mirroring the vite
// config in kevinpeckham's `sk-app-template`, where this architecture is
// already proven.
// `vitest-browser-svelte` direct-render was abandoned; see CHANGELOG 0.2.0.
export default defineConfig({
	// storybook's own `@testing-library/dom` (a transitive dep, not ours) nests
	// its own `aria-query` copy; without this, the browser-mode dev server
	// serves that nested copy unbundled and its CJS named exports don't
	// resolve through Vite's on-the-fly ESM interop. Pre-bundling it via
	// optimizeDeps fixes the "does not provide an export named 'elementRoles'"
	// crash on the storybook project's setup file.
	optimizeDeps: {
		include: ["@testing-library/dom"],
	},
	plugins: [sveltekit()],
	server: {
		// Comma-separated extra hosts (e.g. the lj-bench dev VM's Caddy
		// domain). Vite's own __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS env var
		// only carries a single host, hence this project-level variable.
		allowedHosts: process.env.DEV_ALLOWED_HOSTS?.split(",").filter(Boolean),
		// Unique port in the lj-bench VM's dev-server scheme (Storybook keeps 6006).
		port: 5223,
		strictPort: true,
	},
	test: {
		expect: {
			requireAssertions: true,
		},
		projects: [
			{
				// Node-only unit project: state-class + DOM-primitive tests.
				extends: "./vite.config.ts",
				test: {
					environment: "node",
					exclude: [
						"src/**/*.svelte.{test,spec}.{js,ts}",
						"node_modules/**",
						"dist/**",
						".svelte-kit/**",
					],
					include: ["src/**/*.{test,spec}.{js,ts}"],
					name: "unit",
				},
			},
			{
				extends: true,
				plugins: [
					// The plugin will run tests for the stories defined in your Storybook config
					// See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
					storybookTest({
						configDir: path.join(dirname, ".storybook"),
					}),
				],
				test: {
					browser: {
						enabled: true,
						headless: true,
						instances: [
							{
								browser: "chromium",
							},
						],
						provider: playwright({}),
					},
					name: "storybook",
				},
			},
		],
	},
});
