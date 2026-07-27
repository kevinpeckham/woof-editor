// UnoCSS config for the demo site ONLY (`src/routes/**`, built via
// `bun run build:site` / `vite dev`). It is never invoked by the published
// package build (`svelte-package` runs no Vite plugins), and CI enforces
// that `src/lib/**` stays free of utility-class usage — see the
// "published package stays utility-CSS-free" step in .github/workflows/ci.yml
// (job: lint).
//
// Deliberate deviation from kevinpeckham/sk-app-template's `uno.config.ts`:
// the template imports its `colors` / `fonts` / `shortcuts` / `safelist`
// theme pieces from `src/lib/styles/*`. In THIS repo `src/lib` IS the
// published package (no `styles/` module lives there, and none should), so
// this config is fully self-contained and inlined below instead. Fonts,
// shortcuts, and a safelist are skipped until the demo site actually needs
// them — add them here (still inline, not under `src/lib`) if that changes.

import { defineConfig, presetIcons, presetWind4 } from "unocss";

export default defineConfig({
	presets: [
		presetWind4({ preflights: { reset: true } }),
		presetIcons({
			warn: true,
		}),
	],
	theme: {
		colors: {
			brand: {
				50: "#eff6ff",
				100: "#dbeafe",
				200: "#bfdbfe",
				300: "#93c5fd",
				400: "#60a5fa",
				500: "#3b82f6",
				600: "#2563eb",
				700: "#1d4ed8",
				800: "#1e40af",
				900: "#1e3a8a",
			},
		},
	},
});
