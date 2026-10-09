import { App, PluginSettingTab, Setting } from 'obsidian';
import type { SettingDefinitionItem } from 'obsidian';
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

type SettingKey = keyof DarkReaderSettings;

export class DarkReaderSettingTab extends PluginSettingTab {
	plugin: DarkReaderWebViewerPlugin;

	constructor(app: App, plugin: DarkReaderWebViewerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem<SettingKey>[] {
		return [
			{
				type: 'group',
				heading: 'Dark reader',
				items: [
					{
						name: 'Enable dark reader',
						desc: 'Apply dark reader to pages opened in the native web viewer.',
						control: {
							type: 'toggle',
							key: 'enabled',
							defaultValue: DEFAULT_SETTINGS.enabled,
						},
					},
					{
						name: 'Follow Obsidian theme',
						desc: 'Only enable dark reader while Obsidian is using its dark theme.',
						control: {
							type: 'toggle',
							key: 'followObsidianTheme',
							defaultValue: DEFAULT_SETTINGS.followObsidianTheme,
						},
					},
					{
						name: 'Brightness',
						desc: 'Dark reader brightness percentage.',
						control: {
							type: 'slider',
							key: 'brightness',
							min: 50,
							max: 150,
							step: 1,
							defaultValue: DEFAULT_SETTINGS.brightness,
							displayFormat: (value) => `${value}%`,
						},
					},
					{
						name: 'Contrast',
						desc: 'Dark reader contrast percentage.',
						control: {
							type: 'slider',
							key: 'contrast',
							min: 50,
							max: 150,
							step: 1,
							defaultValue: DEFAULT_SETTINGS.contrast,
							displayFormat: (value) => `${value}%`,
						},
					},
					{
						name: 'Sepia',
						desc: 'Dark reader sepia percentage.',
						control: {
							type: 'slider',
							key: 'sepia',
							min: 0,
							max: 50,
							step: 1,
							defaultValue: DEFAULT_SETTINGS.sepia,
							displayFormat: (value) => `${value}%`,
						},
					},
				],
			},
		];
	}

	getControlValue(key: string): unknown {
		if (!this.isSettingKey(key)) {
			return undefined;
		}
		return this.plugin.settings[key];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		if (!this.isSettingKey(key)) {
			return;
		}

		const currentValue = this.plugin.settings[key];
		if (typeof currentValue !== typeof value) {
			return;
		}

		await this.plugin.updateSettings({
			[key]: value,
		});
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Enable dark reader')
			.setDesc('Apply dark reader to pages opened in the native web viewer.')
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
				'Only enable dark reader while Obsidian is using its dark theme.',
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
			.setDesc('Dark reader brightness percentage.')
			.addSlider((slider) =>
				slider
					.setLimits(50, 150, 1)
					.setValue(this.plugin.settings.brightness)
					.onChange(async (value) => {
						await this.plugin.updateSettings({ brightness: value });
					}),
			);

		new Setting(containerEl)
			.setName('Contrast')
			.setDesc('Dark reader contrast percentage.')
			.addSlider((slider) =>
				slider
					.setLimits(50, 150, 1)
					.setValue(this.plugin.settings.contrast)
					.onChange(async (value) => {
						await this.plugin.updateSettings({ contrast: value });
					}),
			);

		new Setting(containerEl)
			.setName('Sepia')
			.setDesc('Dark reader sepia percentage.')
			.addSlider((slider) =>
				slider
					.setLimits(0, 50, 1)
					.setValue(this.plugin.settings.sepia)
					.onChange(async (value) => {
						await this.plugin.updateSettings({ sepia: value });
					}),
			);
	}

	private isSettingKey(key: string): key is SettingKey {
		return Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key);
	}
}
