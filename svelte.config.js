import adapter from "@sveltejs/adapter-auto";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes("node_modules") ? undefined : true),
	},
	kit: {
		// adapter-auto only exists to keep `svelte-kit sync` happy for the
		// local dev app; the published artifact comes out of `svelte-package`,
		// which is independent of the adapter. The `files` field in
		// package.json (with `!dist/**/*.test.*` exclusions) keeps test
		// files out of the published tarball even if svelte-package copies
		// them into dist/.
		adapter: adapter(),
	},
	preprocess: vitePreprocess(),
};

export default config;
