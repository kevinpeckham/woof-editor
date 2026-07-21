import type { StorybookConfig } from "@storybook/sveltekit";

const config: StorybookConfig = {
	addons: ["@storybook/addon-docs", "@storybook/addon-a11y", "@storybook/addon-svelte-csf"],
	framework: {
		name: "@storybook/sveltekit",
		options: {},
	},
	stories: ["../stories/**/*.stories.@(js|ts|svelte)"],
};

export default config;
