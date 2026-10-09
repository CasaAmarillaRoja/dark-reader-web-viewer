# Dark Reader for Web Viewer

A desktop-only [Obsidian](https://obsidian.md/) plugin that applies [Dark Reader](https://github.com/darkreader/darkreader) to pages opened in Obsidian's native **Web viewer**.

It does not install a Chrome or Firefox extension. Instead, it bundles Dark Reader's public JavaScript API inside the plugin and injects it into Obsidian's Electron webview.

## Features

- Applies Dark Reader to native Web viewer tabs.
- Works with multiple Web viewer tabs.
- Reapplies Dark Reader after page navigation.
- Enable or disable it from the command palette or plugin settings.
- Optionally follows Obsidian's light/dark theme.
- Configurable brightness, contrast, and sepia values.
- Does not load Dark Reader from a remote CDN at runtime.

## Requirements

- Obsidian for desktop.
- Obsidian 1.8.3 or newer.
- The built-in **Web viewer** core plugin enabled.

Mobile Obsidian is not supported because this plugin uses Electron's desktop `<webview>` API.

## Installation

### Manual installation

1. Download `manifest.json` and `main.js` from the latest GitHub release, or build them from source.
2. Create this directory inside your vault:

   ```text
   .obsidian/plugins/dark-reader-web-viewer/
   ```

3. Copy `manifest.json` and `main.js` into that directory.
4. Restart Obsidian, or reload the application.
5. Enable **Dark Reader for Web Viewer** under **Settings → Community plugins**.

The built-in **Web viewer** core plugin must also be enabled.

### Build from source

```sh
git clone https://github.com/CasaAmarillaRoja/dark-reader-web-viewer.git
cd dark-reader-web-viewer
npm install
npm run build
```

The production plugin bundle is written to `main.js`.

For development with an automatic rebuild watcher:

```sh
npm run dev
```

## Code quality and dependency updates

Every production build runs the official [Obsidian ESLint plugin](https://github.com/obsidianmd/eslint-plugin) before TypeScript checking and bundling:

```text
npm run lint (zero warnings) → tsc --noEmit → esbuild
```

Lint warnings are treated as build failures. The configuration uses the plugin's recommended rules and checks the TypeScript source, settings UI, Obsidian API usage, command names, and user-interface text.

Refresh the linting toolchain to its latest published versions with:

```sh
npm run update:lint
```

The repository also uses Dependabot to propose dependency updates, while the lockfile keeps ordinary builds reproducible.

## Settings

Open the plugin's settings to configure:

- **Enable Dark Reader** — enable or disable page theming.
- **Follow Obsidian theme** — enable Dark Reader only while Obsidian is using its dark theme. When disabled, Dark Reader remains active regardless of Obsidian's theme.
- **Brightness** — Dark Reader brightness percentage.
- **Contrast** — Dark Reader contrast percentage.
- **Sepia** — Dark Reader sepia percentage.

The command palette provides:

- **Toggle Dark Reader for Web viewer**
- **Reapply Dark Reader to Web viewer pages**

## How it works

The plugin watches for Obsidian Web viewer elements and binds to their Electron lifecycle events. When a page reaches `dom-ready`, it uses `webview.executeJavaScript()` to install a locally bundled Dark Reader API and call `DarkReader.enable()`.

When the plugin is disabled, or when **Follow Obsidian theme** detects a switch to Obsidian's light theme, it calls `DarkReader.disable()` in the live page.

The injector is generated during the build from the [`darkreader`](https://www.npmjs.com/package/darkreader) package. No third-party script is downloaded while the plugin is running.

## Known limitations

- The native Web viewer's `webviewer` view type and DOM structure are internal Obsidian implementation details rather than a stable public plugin API. An Obsidian update may require changes.
- The plugin only affects native Web viewer tabs. It does not affect external browsers, Markdown preview, Canvas, or other embedded pages.
- Page-specific Dark Reader settings and the full browser-extension settings UI are not included.
- Cross-origin pages may behave differently from pages viewed through a full browser extension because this plugin runs through the page's Electron webview context.

## Development notes

`src/generated-injector.ts` is a build-time placeholder. `esbuild.config.mjs` replaces it with the bundled Dark Reader injector before producing `main.js`; do not edit the generated value manually.

Run the production checks with:

```sh
npm run build
node --check main.js
```

## Licence

This project is distributed under the MIT License. See [`LICENSE`](LICENSE).

Dark Reader is included under its own MIT License. See [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).
