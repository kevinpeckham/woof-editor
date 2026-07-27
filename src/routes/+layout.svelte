<script lang="ts">
import "uno.css";

// Minimal layout. Not part of the published package — SvelteKit's
// runtime expects it during dev / test; without it, the vitest browser
// tester iframe hangs waiting for a module SvelteKit tries to load.
//
// Also carries the demo site's page-level base styles (background, font
// stack, margin reset) so every route — currently just the one — starts
// from a consistent baseline instead of the browser's default stylesheet.

let { children } = $props();
</script>

{@render children()}

<style>
	:global(html) {
		box-sizing: border-box;
	}
	:global(*),
	:global(*::before),
	:global(*::after) {
		box-sizing: inherit;
	}
	:global(body) {
		margin: 0;
		background: #faf9f7;
		color: #1c1917;
		font-family:
			system-ui,
			-apple-system,
			"Segoe UI",
			Roboto,
			"Helvetica Neue",
			Arial,
			sans-serif;
		-webkit-font-smoothing: antialiased;
		text-rendering: optimizeLegibility;
	}
</style>
