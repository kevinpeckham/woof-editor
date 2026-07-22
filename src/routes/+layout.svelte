<script lang="ts">
	// Minimal layout. Not part of the published package — SvelteKit's
	// runtime expects it during dev / test; without it, the vitest browser
	// tester iframe hangs waiting for a module SvelteKit tries to load.

	let { children } = $props();
</script>

{@render children()}
