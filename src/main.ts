import { Notice, Plugin } from 'obsidian';
import { DARK_READER_INJECTOR } from './generated-injector';
import {
	DARK_READER_ACTION_KEY,
	DARK_READER_CONTROLLER_KEY,
} from './protocol';
import type {
	DarkReaderAction,
	DarkReaderThemeOptions,
	ObsidianBaseColors,
} from './protocol';
import {
	DEFAULT_SETTINGS,
	DarkReaderSettings,
	DarkReaderSettingTab,
} from './settings';

const WEB_VIEWER_VIEW_TYPE = 'webviewer';

type WebviewEventListener = EventListener;

interface WebviewElement extends HTMLElement {
	executeJavaScript(code: string, userGesture?: boolean): Promise<unknown>;
}

interface WebviewBinding {
	webview: WebviewElement;
	installed: boolean;
	applying?: Promise<void>;
	onDomReady: WebviewEventListener;
	onDidStartLoading: WebviewEventListener;
	onDestroyed: WebviewEventListener;
}

export default class DarkReaderWebViewerPlugin extends Plugin {
	settings!: DarkReaderSettings;

	private readonly bindings = new Map<WebviewElement, WebviewBinding>();
	private mutationObserver?: MutationObserver;
	private scanTimer: number | null = null;
	private themeApplyTimer: number | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.addCommand({
			id: 'toggle-dark-reader',
			name: 'Toggle web viewer dark mode',
			callback: async () => {
				await this.updateSettings({ enabled: !this.settings.enabled });
				new Notice(
					this.settings.enabled
						? 'Dark reader enabled for Web viewer.'
						: 'Dark reader disabled for Web viewer.',
				);
			},
		});

		this.addCommand({
			id: 'reapply-dark-reader',
			name: 'Reapply web viewer dark mode',
			callback: async () => {
				this.scanWebviews();
				for (const binding of this.bindings.values()) {
					binding.installed = false;
				}
				await this.applyToAllWebviews();
				new Notice('Dark reader reapplied to web viewer pages.');
			},
		});

		this.addSettingTab(new DarkReaderSettingTab(this.app, this));

		this.registerEvent(
			this.app.workspace.on('layout-change', () => this.scheduleScan()),
		);
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', () => this.scheduleScan()),
		);

		this.mutationObserver = new MutationObserver((mutations) => {
			this.scheduleScan();

			const themeChanged = mutations.some(
				(mutation) =>
					mutation.type === 'attributes' &&
					mutation.target === document.body &&
					mutation.attributeName === 'class',
			);
			if (themeChanged && this.settings.followObsidianTheme) {
				this.scheduleThemeApply();
			}
		});
		if (document.body) {
			this.mutationObserver.observe(document.body, {
				childList: true,
				subtree: true,
				attributes: true,
				attributeFilter: ['class'],
			});
		}

		this.register(() => {
			if (this.scanTimer !== null) {
				window.clearTimeout(this.scanTimer);
				this.scanTimer = null;
			}
			if (this.themeApplyTimer !== null) {
				window.clearTimeout(this.themeApplyTimer);
				this.themeApplyTimer = null;
			}
			this.mutationObserver?.disconnect();
			this.mutationObserver = undefined;

			for (const binding of [...this.bindings.values()]) {
				if (binding.installed) {
					void this.executeAction(binding.webview, { type: 'disable' });
				}
				this.unbindWebview(binding);
			}
		});

		this.scheduleScan();
	}

	async updateSettings(changes: Partial<DarkReaderSettings>): Promise<void> {
		Object.assign(this.settings, changes);
		await this.saveData(this.settings);
		await this.applyToAllWebviews();
	}

	private async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<DarkReaderSettings>,
		);
	}

	private scheduleScan(): void {
		if (this.scanTimer !== null) {
			return;
		}

		this.scanTimer = window.setTimeout(() => {
			this.scanTimer = null;
			this.scanWebviews();
		}, 0);
	}

	private scheduleThemeApply(): void {
		if (this.themeApplyTimer !== null) {
			return;
		}

		this.themeApplyTimer = window.setTimeout(() => {
			this.themeApplyTimer = null;
			void this.applyToAllWebviews();
		}, 0);
	}

	private scanWebviews(): void {
		const discovered = this.findWebviews();

		for (const webview of discovered) {
			if (!this.bindings.has(webview)) {
				this.bindWebview(webview);
			}
		}

		for (const binding of [...this.bindings.values()]) {
			if (!discovered.has(binding.webview)) {
				this.unbindWebview(binding);
			}
		}
	}

	private findWebviews(): Set<WebviewElement> {
		const webviews = new Set<WebviewElement>();

		for (const leaf of this.app.workspace.getLeavesOfType(WEB_VIEWER_VIEW_TYPE)) {
			const webview = this.asWebview(
				leaf.view.containerEl.querySelector('webview'),
			);
			if (webview) {
				webviews.add(webview);
			}
		}

		// The view type is an internal implementation detail. Keep the class
		// selector as a fallback for Obsidian versions that do not expose the
		// native Web viewer through getLeavesOfType().
		document
			.querySelectorAll('.webviewer-content webview')
			.forEach((element) => {
				const webview = this.asWebview(element);
				if (webview) {
					webviews.add(webview);
				}
			});

		return webviews;
	}

	private asWebview(element: Element | null): WebviewElement | null {
		if (
			!element ||
			typeof (element as Partial<WebviewElement>).executeJavaScript !==
				'function'
		) {
			return null;
		}
		return element as WebviewElement;
	}

	private bindWebview(webview: WebviewElement): void {
		if (this.bindings.has(webview)) {
			return;
		}

		const binding = {} as WebviewBinding;
		binding.webview = webview;
		binding.installed = false;
		binding.onDidStartLoading = () => {
			binding.installed = false;
		};
		binding.onDomReady = () => {
			binding.installed = false;
			void this.applyToBinding(binding);
		};
		binding.onDestroyed = () => {
			this.unbindWebview(binding);
		};

		webview.addEventListener('did-start-loading', binding.onDidStartLoading);
		webview.addEventListener('dom-ready', binding.onDomReady);
		webview.addEventListener('destroyed', binding.onDestroyed);
		this.bindings.set(webview, binding);

		// If the plugin is enabled after a page has already finished loading,
		// there may be no future dom-ready event. Try once immediately as well;
		// failures are harmless and the event handler remains in place.
		window.setTimeout(() => {
			if (this.bindings.get(webview) === binding) {
				void this.applyToBinding(binding);
			}
		}, 0);
	}

	private unbindWebview(binding: WebviewBinding): void {
		binding.webview.removeEventListener(
			'did-start-loading',
			binding.onDidStartLoading,
		);
		binding.webview.removeEventListener('dom-ready', binding.onDomReady);
		binding.webview.removeEventListener('destroyed', binding.onDestroyed);
		this.bindings.delete(binding.webview);
	}

	private async applyToAllWebviews(): Promise<void> {
		this.scanWebviews();
		await Promise.all(
			[...this.bindings.values()].map((binding) =>
				this.applyToBinding(binding),
			),
		);
	}

	private applyToBinding(binding: WebviewBinding): Promise<void> {
		if (binding.applying) {
			return binding.applying;
		}

		const applying = this.performApply(binding)
			.catch((error: unknown) => {
				console.warn(
					'[Dark Reader for Web Viewer] Could not update a Web viewer page:',
					error,
				);
			})
			.finally(() => {
				if (binding.applying === applying) {
					binding.applying = undefined;
				}
			});

		binding.applying = applying;
		return applying;
	}

	private async performApply(binding: WebviewBinding): Promise<void> {
		const action = this.getAction();

		if (
			!binding.installed &&
			action.type === 'disable' &&
			!action.baseColors
		) {
			return;
		}

		if (!binding.installed) {
			if (!DARK_READER_INJECTOR) {
				throw new Error(
					'Dark Reader injector is missing. Run npm run build before installing the plugin.',
				);
			}
			await binding.webview.executeJavaScript(
				this.createInstallScript(action),
				false,
			);
			binding.installed = true;
			return;
		}

		const result = await this.executeAction(binding.webview, action);
		if (result) {
			return;
		}

		binding.installed = false;
		if (action.type === 'enable') {
			await binding.webview.executeJavaScript(
				this.createInstallScript(action),
				false,
			);
			binding.installed = true;
		}
	}

	private getAction(): DarkReaderAction {
		const baseColors = this.settings.matchObsidianColors
			? this.getObsidianBaseColors()
			: undefined;
		const shouldEnableDarkReader =
			this.settings.enabled &&
			(!this.settings.followObsidianTheme || this.isObsidianDark());

		if (shouldEnableDarkReader) {
			return {
				type: 'enable',
				theme: this.getThemeOptions(),
				baseColors,
			};
		}

		return {
			type: 'disable',
			baseColors: this.settings.enabled ? baseColors : undefined,
		};
	}

	private isObsidianDark(): boolean {
		return document.body?.classList.contains('theme-dark') ?? false;
	}

	private getThemeOptions(): DarkReaderThemeOptions {
		return {
			brightness: this.settings.brightness,
			contrast: this.settings.contrast,
			sepia: this.settings.sepia,
		};
	}

	private getObsidianBaseColors(): ObsidianBaseColors {
		const styles = document.body ? getComputedStyle(document.body) : null;
		const dark = this.isObsidianDark();

		return {
			background: this.readThemeColor(
				styles,
				'--background-primary',
				dark ? '#181a1b' : '#ffffff',
			),
			text: this.readThemeColor(
				styles,
				'--text-normal',
				dark ? '#e8e6e3' : '#181a1b',
			),
		};
	}

	private readThemeColor(
		styles: CSSStyleDeclaration | null,
		property: string,
		fallback: string,
	): string {
		const value = styles?.getPropertyValue(property).trim() ?? '';
		if (!value || value.length > 100 || /[;{}]/.test(value)) {
			return fallback;
		}
		return value;
	}

	private executeAction(
		webview: WebviewElement,
		action: DarkReaderAction,
	): Promise<unknown> {
		return webview.executeJavaScript(this.createActionScript(action), false);
	}

	private createInstallScript(action: DarkReaderAction): string {
		return [
			`globalThis[${JSON.stringify(DARK_READER_ACTION_KEY)}] = ${JSON.stringify(action)};`,
			DARK_READER_INJECTOR,
		].join('\n');
	}

	private createActionScript(action: DarkReaderAction): string {
		return `(() => {
	const controller = globalThis[${JSON.stringify(DARK_READER_CONTROLLER_KEY)}];
	if (!controller || typeof controller.apply !== 'function') {
		return false;
	}
	controller.apply(${JSON.stringify(action)});
	return true;
})()`;
	}
}
