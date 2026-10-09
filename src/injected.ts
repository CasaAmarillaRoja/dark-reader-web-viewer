import {
	disable,
	enable,
	setFetchMethod,
} from 'darkreader';
import { DARK_READER_ACTION_KEY, DARK_READER_CONTROLLER_KEY } from './protocol';
import type { DarkReaderAction, ObsidianBaseColors } from './protocol';

type DarkReaderController = {
	apply: (action: DarkReaderAction) => void;
	destroy?: () => void;
};

type InjectedWindow = Window & {
	[DARK_READER_ACTION_KEY]?: DarkReaderAction;
	[DARK_READER_CONTROLLER_KEY]?: DarkReaderController;
};

type SavedInlineColors = {
	backgroundValue: string;
	backgroundPriority: string;
	textValue: string;
	textPriority: string;
	applyBackgroundColor: boolean;
};

const EXCLUDED_BASE_COLOR_TAGS = new Set([
	'CANVAS',
	'EMBED',
	'IFRAME',
	'IMG',
	'LINK',
	'META',
	'OBJECT',
	'PICTURE',
	'SCRIPT',
	'SOURCE',
	'STYLE',
	'SVG',
	'VIDEO',
]);
const page = window as InjectedWindow;
const savedInlineColors = new Map<HTMLElement, SavedInlineColors>();
let activeBaseColors: ObsidianBaseColors | undefined;
let baseColorObserver: MutationObserver | undefined;

function isSafeColor(value: string): boolean {
	return value.length > 0 && value.length <= 100 && !/[;{}]/.test(value);
}

function parseCssAlpha(value: string): number {
	const normalized = value.trim().toLowerCase();
	if (!normalized || normalized === 'transparent') {
		return 0;
	}

	const rgbaMatch = normalized.match(
		/^rgba\([^,]+,[^,]+,[^,]+,\s*([^)]+)\)$/,
	);
	const modernColorMatch = normalized.match(/\/\s*([^)]+)\)$/);
	const alphaValue = rgbaMatch?.[1] ?? modernColorMatch?.[1];
	if (!alphaValue) {
		return 1;
	}

	const alpha = alphaValue.endsWith('%')
		? Number.parseFloat(alphaValue) / 100
		: Number.parseFloat(alphaValue);
	return Number.isFinite(alpha) ? alpha : 0;
}

function hasOpaqueBackground(element: Element): boolean {
	const styles = window.getComputedStyle(element);
	return (
		styles.backgroundImage === 'none' &&
		parseCssAlpha(styles.backgroundColor) >= 1
	);
}

function getBaseColorFixes(
	colors: ObsidianBaseColors | undefined,
): {
	invert: string[];
	css: string;
	ignoreInlineStyle: string[];
	ignoreImageAnalysis: string[];
	disableStyleSheetsProxy: boolean;
	ignoreCSSUrl: string[];
} | undefined {
	if (
		!colors ||
		!isSafeColor(colors.background) ||
		!isSafeColor(colors.text)
	) {
		return undefined;
	}

	return {
		invert: [],
		css: `html:root,
html:root body {
	background-color: ${colors.background} !important;
	color: ${colors.text} !important;
}`,
		ignoreInlineStyle: [],
		ignoreImageAnalysis: [],
		disableStyleSheetsProxy: false,
		ignoreCSSUrl: [],
	};
}

function isBaseColorTarget(element: Element): element is HTMLElement {
	return (
		element.nodeType === 1 &&
		'style' in element &&
		!EXCLUDED_BASE_COLOR_TAGS.has(element.tagName)
	);
}

function applyBaseColorsToElement(
	element: Element,
	colors: ObsidianBaseColors,
): void {
	if (!isBaseColorTarget(element)) {
		return;
	}

	if (!savedInlineColors.has(element)) {
		savedInlineColors.set(element, {
			backgroundValue: element.style.getPropertyValue('background-color'),
			backgroundPriority: element.style.getPropertyPriority(
				'background-color',
			),
			textValue: element.style.getPropertyValue('color'),
			textPriority: element.style.getPropertyPriority('color'),
			applyBackgroundColor: hasOpaqueBackground(element),
		});
	}

	const saved = savedInlineColors.get(element);
	if (saved?.applyBackgroundColor) {
		element.style.setProperty('background-color', colors.background, 'important');
	}
	element.style.setProperty('color', colors.text, 'important');
}

function applyBaseColorsToTree(
	root: Element,
	colors: ObsidianBaseColors,
): void {
	applyBaseColorsToElement(root, colors);
	root.querySelectorAll('*').forEach((element) => {
		applyBaseColorsToElement(element, colors);
	});
}

function clearBaseColors(): void {
	activeBaseColors = undefined;
	baseColorObserver?.disconnect();
	baseColorObserver = undefined;

	savedInlineColors.forEach((saved, element) => {
		element.style.setProperty(
			'background-color',
			saved.backgroundValue,
			saved.backgroundPriority,
		);
		element.style.setProperty('color', saved.textValue, saved.textPriority);
	});
	savedInlineColors.clear();
}

function applyBaseColors(colors: ObsidianBaseColors | undefined): void {
	if (
		!colors ||
		!isSafeColor(colors.background) ||
		!isSafeColor(colors.text) ||
		!document.documentElement
	) {
		clearBaseColors();
		return;
	}

	activeBaseColors = colors;
	if (!baseColorObserver) {
		baseColorObserver = new MutationObserver((mutations) => {
			if (!activeBaseColors) {
				return;
			}
			mutations.forEach((mutation) => {
				mutation.addedNodes.forEach((node) => {
					if (node.nodeType === 1) {
						const colors = activeBaseColors;
						if (colors) {
							applyBaseColorsToTree(node as Element, colors);
						}
					}
				});
			});
		});
		baseColorObserver.observe(document.documentElement, {
			childList: true,
			subtree: true,
		});
	}

	applyBaseColorsToTree(document.documentElement, colors);
}

page[DARK_READER_CONTROLLER_KEY]?.destroy?.();
setFetchMethod((url) => window.fetch(url));

page[DARK_READER_CONTROLLER_KEY] = {
	apply(action: DarkReaderAction) {
		if (action.type === 'enable') {
			enable(action.theme, getBaseColorFixes(action.baseColors));
		} else {
			disable();
		}
		applyBaseColors(action.baseColors);
	},
	destroy: clearBaseColors,
};

const action = page[DARK_READER_ACTION_KEY];
delete page[DARK_READER_ACTION_KEY];

if (action) {
	page[DARK_READER_CONTROLLER_KEY]?.apply(action);
}
