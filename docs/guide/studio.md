# Design your pages (Studio)

Studio is a page in your browser where you choose how your PDFs look: page style, font, paper,
header and footer. The right side shows the real PDF and updates as you click.

```sh
npx -y markdown-pdf-export studio
```

![Studio: choices on the left, the real PDF on the right](/img/studio.png)

## What you do there

1. **Page style.** Pick one of five looks: Clean, Report, Academic, Compact or Technical.
2. **Fonts and paper.** Pick a font for the text and another for the titles, then paper size,
   orientation, margins and the colours used for code blocks (light or dark themes). Fonts come
   from your computer, so a PDF made on another machine can fall back to a similar one.
3. **Header and footer.** Pick a starting point, then click any spot on the small page to change
   it. Type text, or press a button such as *Title*, *Page 1 of 9* or *Date* to insert it. To add a
   logo, drop an image on a spot or press *Logo…*, then set its size with the slider. Lines under
   the header and above the footer stop at the page margins, like the text.
4. **Save.** Every export from your editor, your AI assistant or the command line now uses this
   layout.

*Add to my editor* shows the one-time setup for VS Code, Zed, Cursor and Claude, with a button to do
it for you where that is safe.

## Good to know

- Studio saves to your settings file (`~/.config/markdown-pdf-export/settings.json`). The previous
  version is kept next to it as `settings.json.bak`.
- Logos are copied into an `assets` folder next to the settings file.
- `studio --project` saves a `.markdown-pdf.json` in the current folder instead, for a layout that
  belongs to one project.
- `studio --file report.md` previews your own document instead of the sample.
- Options you wrote by hand in the settings file are kept. A header or footer that uses the
  [structured form](/reference/header-footer-schema) is shown as locked and left untouched.

## What Studio does not do

Studio offers three spots at the top and three at the bottom, each with text or a logo. It is not a
free-form page designer: there is no dragging, no web fonts, and no per-spot styling. For those, edit
the [settings file](/guide/global-settings) directly; Studio and hand-written settings work together.

## Privacy and safety

Studio runs on your computer only. It listens on `127.0.0.1`, each launch has its own private link,
and it stops by itself a few minutes after you close the page. Nothing is uploaded anywhere.
