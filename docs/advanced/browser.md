# Browser

For people who want to choose which browser draws the PDF, or who see "No usable Chrome/Chromium browser found".

The PDF is drawn by a Chromium-based browser running in the background. Your default browser does not
change, and nothing is downloaded unless you ask.

## Which browser is used

Without any setting, the first one that starts is used:

1. Google Chrome
2. Microsoft Edge
3. Chromium downloaded with `install-browser`

Firefox and Safari cannot draw the PDF. If you use them, install Chrome or Edge alongside, or
download Chromium once:

```sh
npx -y markdown-pdf-export install-browser
```

The download is about 200 MB and happens once.

## Choose a browser

Set `MARKDOWN_PDF_BROWSER` to try one browser only:

| Value | Browser |
|---|---|
| `chrome` | Google Chrome |
| `msedge` | Microsoft Edge |
| `chrome-beta`, `chrome-dev`, `chrome-canary` | a Chrome preview channel |
| `msedge-beta`, `msedge-dev`, `msedge-canary` | an Edge preview channel |
| `chromium` | the Chromium from `install-browser` |
| a file path | that browser program |

```sh
MARKDOWN_PDF_BROWSER=msedge npx -y markdown-pdf-export report.md
```

Other Chromium-based browsers (Brave, Vivaldi, a Chromium build) work with a path to the program,
but are not tested by the project. On macOS:

```sh
MARKDOWN_PDF_BROWSER="/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" \
  npx -y markdown-pdf-export report.md
```

In an editor task or an assistant entry, set it in the `env` block (in VS Code tasks, inside
`options`):

```json
"env": { "MARKDOWN_PDF_BROWSER": "msedge" }
```

## Check which browser is used

```sh
npx -y markdown-pdf-export doctor
```

The "Browser" line shows whether a browser was found and its version. `doctor --json` also shows
`launch_options`: `{"channel":"chrome"}` for Chrome, `{"channel":"msedge"}` for Edge,
`{"channel":"chromium"}` for the downloaded Chromium, `{"executablePath":"..."}` for a path.

## "No usable Chrome/Chromium browser found"

The message lists each browser tried and why it failed. Fix it with one of:

1. Install Google Chrome or Microsoft Edge.
2. Run `npx -y markdown-pdf-export install-browser`.
3. Set `MARKDOWN_PDF_BROWSER` to a Chromium-based browser.

If `MARKDOWN_PDF_BROWSER` is set, check it first: only that browser is tried, so a wrong path gives
this error even when Chrome is installed.
