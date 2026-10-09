import {
	disable,
	enable,
	setFetchMethod,
} from 'darkreader';
import {
	DARK_READER_ACTION_KEY,
	DARK_READER_CONTROLLER_KEY,
	DarkReaderAction,
} from './protocol';

type DarkReaderController = {
	apply: (action: DarkReaderAction) => void;
};

type InjectedWindow = typeof globalThis & {
	[DARK_READER_ACTION_KEY]?: DarkReaderAction;
	[DARK_READER_CONTROLLER_KEY]?: DarkReaderController;
};

const page = globalThis as InjectedWindow;

if (!page[DARK_READER_CONTROLLER_KEY]) {
	setFetchMethod((url) => globalThis.fetch(url));

	page[DARK_READER_CONTROLLER_KEY] = {
		apply(action: DarkReaderAction) {
			if (action.type === 'enable') {
				enable(action.theme);
			} else {
				disable();
			}
		},
	};
}

const action = page[DARK_READER_ACTION_KEY];
delete page[DARK_READER_ACTION_KEY];

if (action) {
	page[DARK_READER_CONTROLLER_KEY]?.apply(action);
}
