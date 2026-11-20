/**
 * @fileoverview Page break markers. A document can start a new page with any
 * of these, so people can write what they already know:
 *
 *   <div class="page"></div>          (also page-break, pagebreak, page_break,
 *   <div class="new-page"></div>       new-page, newpage, break-page)
 *   <hr class="page-break">
 *   <!-- page-break -->               (also pagebreak, page_break, new-page,
 *                                       newpage, page)
 *   <div style="page-break-after: always"></div>   (plain CSS, always worked)
 *
 * `<div class="page-break-before">` breaks before the element instead.
 */

export const PAGE_BREAK_CLASSES = [
  "page",
  "page-break",
  "pagebreak",
  "page_break",
  "new-page",
  "newpage",
  "break-page",
];

/** CSS that makes the classes work. Always added, even without the default stylesheet. */
export const PAGE_BREAK_CSS =
  `${PAGE_BREAK_CLASSES.map((c) => `.${c}`).join(",")}{break-after:page;page-break-after:always}` +
  `.page-break-before{break-before:page;page-break-before:always}`;

const COMMENT = /^<!--\s*(?:page[-_ ]?break|new[-_ ]?page|page)\s*-->\s*$/i;

/**
 * markdown-it plugin: turn `<!-- page-break -->` style comments into a page
 * break element. Comments inside code blocks are untouched (they are not html tokens).
 * @param {import("markdown-it")} md
 */
export function pageBreakComments(md) {
  md.core.ruler.push("page_break_comments", (state) => {
    for (const token of state.tokens) {
      if (token.type === "html_block" && COMMENT.test(token.content.trim())) {
        token.content = '<div class="page-break"></div>\n';
      } else if (token.type === "inline" && token.children) {
        for (const child of token.children) {
          if (child.type === "html_inline" && COMMENT.test(child.content.trim())) {
            child.content = '<span class="page-break"></span>';
          }
        }
      }
    }
  });
}
