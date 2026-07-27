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
