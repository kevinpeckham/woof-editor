import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes("node_modules") ? undefined : true),
	},
	kit: {
		// adapter-static builds the prerendered demo site (`bun run build:site`,
		// output in `build/`); the published artifact still comes out of
		// `svelte-package`, which is independent of the adapter. The `files`
		// field in package.json (with `!dist/**/*.test.*` exclusions) keeps
		// test files out of the published tarball even if svelte-package
		// copies them into dist/.
		adapter: adapter(),
	},
	preprocess: vitePreprocess(),
};

export default config;
