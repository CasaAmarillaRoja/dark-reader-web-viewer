export const DARK_READER_CONTROLLER_KEY = '__obsidianDarkReaderController';
export const DARK_READER_ACTION_KEY = '__obsidianDarkReaderAction';

export interface DarkReaderThemeOptions {
	brightness: number;
	contrast: number;
	sepia: number;
}

export type DarkReaderAction =
	| {
			type: 'enable';
			theme: DarkReaderThemeOptions;
	  }
	| {
			type: 'disable';
	  };
