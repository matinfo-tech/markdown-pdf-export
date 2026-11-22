/**
 * @fileoverview Raw HTML filter for the Markdown body.
 *
 * markdown-it runs with `html: true`, so raw HTML in a document reaches the
 * browser that prints the PDF. A document is not always written by the person
 * exporting it (cloned repository, AI output, MCP call), so in the default
 * "safe" mode:
 *
 *   - `<script>`, `<iframe>`, `<object>`, `<applet>`, `<frameset>`,
 *     `<noembed>`, `<noframes>` are removed together with their content;
 *   - any other opening or closing tag of a disallowed element has its `<`
 *     escaped to `&lt;`, so it shows as text (GFM "Disallowed Raw HTML");
 *   - `on*=` event handler attributes and `srcdoc` are renamed so they do
 *     nothing, and `javascript:` / `vbscript:` / non-image `data:` URLs are
 *     replaced with `#`.
 *
 * `<style>` and everything else (div, span, img, page break markers, inline
 * `style=`) is kept.
 *
 * The filter works only on the HTML the author wrote (html_block and
 * html_inline tokens), never on markup the renderer generates (code
 * highlighting, KaTeX, TOC, anchors), and it is context free on purpose: a
 * disallowed tag name is escaped wherever it appears in a raw HTML token,
 * even inside an attribute value or a comment, so parser-state tricks cannot
 * hide one. It is a second line of defence: in safe mode the page is also
 * printed with JavaScript disabled and a Content-Security-Policy that blocks
 * scripts, frames and plugins (see export.mjs).
 */

/** Removed with everything between the opening and the closing tag. */
export const REMOVED_ELEMENTS = [
  "script",
  "iframe",
  "object",
  "applet",
  "frameset",
  "noembed",
  "noframes",
];

/** Opening and closing tags shown as text instead of being interpreted. */
export const ESCAPED_ELEMENTS = [
  ...REMOVED_ELEMENTS,
  "embed",
  "frame",
  "portal",
  "fencedframe",
  "meta",
  "base",
  "link",
  "form",
  "title",
  "textarea",
  "xmp",
  "plaintext",
];

/** Allowed values of the `sanitize` setting. */
export const SANITIZE_MODES = ["safe", "none"];

const names = (list) => list.join("|");

// `(?=[\s/>]|$)` ends a tag name the way the HTML tokenizer does, so
// `<scripts>` is left alone but `<script/x>` is caught.
const PAIRED = new RegExp(
  `<(${names(REMOVED_ELEMENTS)})(?=[\\s/>]|$)[^>]*>[\\s\\S]*?<\\/\\1(?=[\\s/>]|$)[^>]*>`,
  "gi",
);
const DISALLOWED_TAG = new RegExp(`<(\\/?)(${names(ESCAPED_ELEMENTS)})(?=[\\s/>]|$)`, "gi");
const OPENING = new RegExp(`^<(${names(REMOVED_ELEMENTS)})(?=[\\s/>]|$)`, "i");

// An attribute name starts after whitespace, "/" or the quote that closed the
// previous value. Event handlers: on + letters, then "=".
const EVENT_HANDLER = /([\s/"'])(on[a-z]+|srcdoc)(\s*=)/gi;
const URL_ATTRIBUTE =
  /([\s/"'])(href|src|xlink:href|action|formaction|data|poster|background|cite|ping)(\s*=\s*)("[^"]*"|'[^']*'|[^\s"'>]+)/gi;

const NAMED_ENTITIES = { colon: ":", tab: "\t", newline: "\n", nbsp: " " };

function decodeEntities(value) {
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => safeFromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_, dec) => safeFromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (match, name) => NAMED_ENTITIES[name.toLowerCase()] ?? match);
}

function safeFromCodePoint(code) {
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
}

/**
 * Scheme of a URL that would run code or embed a document: "javascript",
 * "vbscript" or "data" (data:image/... is fine). Entities, whitespace and
 * control characters are removed first, like a browser does before reading
 * the scheme.
 * @param {string} raw attribute value, quotes included or not
 * @returns {string|null}
 */
export function dangerousScheme(raw) {
  const unquoted = raw.replace(/^["']|["']$/g, "");
  // eslint-disable-next-line no-control-regex
  const compact = decodeEntities(unquoted).replace(/[\u0000-\u0020\u007f-\u00a0]/g, "").toLowerCase();
  if (compact.startsWith("javascript:")) return "javascript";
  if (compact.startsWith("vbscript:")) return "vbscript";
  if (compact.startsWith("data:") && !compact.startsWith("data:image/")) return "data";
  return null;
}

/**
 * Clean one piece of raw HTML written by the author.
 * @param {string} html
 * @param {Set<string>} [removed] collects what was removed, e.g. "<script>", "onclick"
 * @returns {string}
 */
export function sanitizeHtmlFragment(html, removed = new Set()) {
  return html
    .replace(PAIRED, (_, name) => {
      removed.add(`<${name.toLowerCase()}>`);
      return "";
    })
    .replace(DISALLOWED_TAG, (_, slash, name) => {
      removed.add(`<${name.toLowerCase()}>`);
      return `&lt;${slash}${name}`;
    })
    .replace(EVENT_HANDLER, (_, before, name, equals) => {
      removed.add(name.toLowerCase());
      return `${before}data-removed-${name}${equals}`;
    })
    .replace(URL_ATTRIBUTE, (match, before, name, equals, value) => {
      const scheme = dangerousScheme(value);
      if (!scheme) return match;
      removed.add(`${scheme}: URL`);
      return `${before}${name}${equals}"#"`;
    });
}

/**
 * markdown-it plugin. Cleans html_block and html_inline tokens; for inline
 * HTML an opening tag such as `<script>` and its matching closing tag are
 * separate tokens, so the pair and the text between them are dropped together.
 *
 * After `md.render()`, `env.removedHtml` (a Set) lists what was removed when
 * an env object was passed to render.
 * @param {import("markdown-it")} md
 */
export function sanitizeRawHtml(md) {
  md.core.ruler.push("sanitize_raw_html", (state) => {
    const removed = new Set();
    for (const token of state.tokens) {
      if (token.type === "html_block") {
        token.content = sanitizeHtmlFragment(token.content, removed);
      } else if (token.type === "inline" && token.children) {
        dropInlinePairs(token.children, removed);
        for (const child of token.children) {
          if (child.type === "html_inline") {
            child.content = sanitizeHtmlFragment(child.content, removed);
          }
        }
      }
    }
    if (state.env && typeof state.env === "object") {
      state.env.removedHtml = new Set([...(state.env.removedHtml ?? []), ...removed]);
    }
  });
}

function dropInlinePairs(children, removed) {
  for (let i = 0; i < children.length; i++) {
    const open = children[i];
    if (open.type !== "html_inline") continue;
    const name = OPENING.exec(open.content)?.[1]?.toLowerCase();
    if (!name) continue;
    const closing = new RegExp(`^<\\/${name}(?=[\\s/>]|$)`, "i");
    const end = children.findIndex(
      (child, j) => j > i && child.type === "html_inline" && closing.test(child.content),
    );
    if (end === -1) continue;
    for (let j = i; j <= end; j++) {
      children[j].type = "text";
      children[j].content = "";
      children[j].children = null;
    }
    removed.add(`<${name}>`);
    i = end;
  }
}

/**
 * Make text safe to place inside a `<style>` element: it cannot close the
 * element early. `<\/style` is the same in CSS strings and comments, where
 * such text can legitimately appear.
 * @param {string} css
 */
export function cssForStyleElement(css) {
  return String(css).replace(/<\/(style)/gi, "<\\/$1");
}
