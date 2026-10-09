import { App, PluginSettingTab, Setting } from 'obsidian';
import type DarkReaderWebViewerPlugin from './main';

export interface DarkReaderSettings {
	enabled: boolean;
	followObsidianTheme: boolean;
	brightness: number;
	contrast: number;
	sepia: number;
}

export const DEFAULT_SETTINGS: DarkReaderSettings = {
	enabled: true,
	followObsidianTheme: false,
	brightness: 100,
	contrast: 90,
	sepia: 0,
};

export class DarkReaderSettingTab extends PluginSettingTab {
	plugin: DarkReaderWebViewerPlugin;

	constructor(app: App, plugin: DarkReaderWebViewerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Enable Dark Reader')
			.setDesc('Apply Dark Reader to pages opened in the native Web viewer.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enabled)
					.onChange(async (value) => {
						await this.plugin.updateSettings({ enabled: value });
					}),
			);

		new Setting(containerEl)
			.setName('Follow Obsidian theme')
			.setDesc(
				'Only enable Dark Reader while Obsidian is using its dark theme.',
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.followObsidianTheme)
					.onChange(async (value) => {
						await this.plugin.updateSettings({
							followObsidianTheme: value,
						});
					}),
			);

		new Setting(containerEl)
			.setName('Brightness')
			.setDesc('Dark Reader brightness percentage.')
			.addSlider((slider) =>
				slider
					.setLimits(50, 150, 1)
					.setValue(this.plugin.settings.brightness)
					.setDynamicTooltip()
					.onChange(async (value) => {
						await this.plugin.updateSettings({ brightness: value });
					}),
			);

		new Setting(containerEl)
			.setName('Contrast')
			.setDesc('Dark Reader contrast percentage.')
			.addSlider((slider) =>
				slider
					.setLimits(50, 150, 1)
					.setValue(this.plugin.settings.contrast)
					.setDynamicTooltip()
					.onChange(async (value) => {
						await this.plugin.updateSettings({ contrast: value });
					}),
			);

		new Setting(containerEl)
			.setName('Sepia')
			.setDesc('Dark Reader sepia percentage.')
			.addSlider((slider) =>
				slider
					.setLimits(0, 50, 1)
					.setValue(this.plugin.settings.sepia)
					.setDynamicTooltip()
					.onChange(async (value) => {
						await this.plugin.updateSettings({ sepia: value });
					}),
			);
	}
}
