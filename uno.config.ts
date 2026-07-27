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

import { defineConfig, presetIcons, presetWebFonts, presetWind4, } from "unocss";

export default defineConfig({
	presets: [
		presetIcons({
			warn: true,
		}),
		presetWebFonts({
			fonts: {
				sans: {
					name: "Atkinson Hyperlegible",
					weights: ["400", "700"],
				},
			},
			provider: "bunny",
		}),
		presetWind4({ preflights: { reset: true } }),
	],
	safelist: [
		"contents",
		"flex",
		"font-sans",
		"bg-prussianBlue",
		"text-slate-50",
		"max-w-screen",
		"min-h-screen",
		"overflow-x-hidden",
		"relative"
	],
	shortcuts: [
		["button", `
			border
			border-current
			inline-flex
			items-center
			justify-center
			leading-none
			max-w-fit
			opacity-90
			text-nowrap
			hover-opacity-100
			hover-text-maximumYellow`],
		["button-small", `
			bg-white/5
			button
			px-3
			py-1.5
			rounded-sm
			text-0.85em`],
		["button-xsmall", `
			button
			px-2
			py-1
			rounded-sm
			text-0.85em`],
		[
			"heading-1",
			"text-balance font-700 text-maximumYellow mb-3 text-32px lg:text-42px leading-snug",
		],
		[
			"heading-2",
			`
			font-700
			leading-snug
			mb-3
			text-20px
			text-balance
			text-maximumYellow
			lg-text-24px `,
		],
		[
			"heading-3",
			`
			font-400
			leading-snug
			mb-3
			text-1.1em
			text-balance`,
		],
		["link", "decoration-current/80 opacity-90 underline underline-offset-4 hover-opacity-100 hover-text-maximumYellow hover-decoration-current"],
		["pill", "bg-white/10 inline-flex items-center font-mono border border-current/60 gap-1 opacity-90 px-3 py-1 rounded-full text-0.85em"],
		["page-x-padding", "px-4 sm:px-6 md:px-7 lg:px-8 xl:px-16 2xl:px-24"],
		["source-code", "font-mono text-0.85em text-wrap"],
	],
	theme: {
		colors: {
			cultured: "oklch(97.55% 0 264.54)",
			maximumYellow: "oklch(94.2% 0.2 114.02)",
			middleBlue: "oklch(78.35% 0.09 208.36)",
			offWhite: "oklch(99.04% 0 286.36)",
			prussianBlue: "oklch(25.27% 0.05 258.95)",
		},
	},
});
