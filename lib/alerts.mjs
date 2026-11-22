/**
 * GitHub alerts: a blockquote whose first line is exactly one of
 * `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]` or `[!CAUTION]`
 * becomes a styled callout.
 *
 *   > [!WARNING]
 *   > Back up your data first.
 *
 * Same rules as GitHub: the marker must sit alone on the first line, and
 * nothing else is configurable, so no document text ever reaches the
 * markup unescaped. Nested blockquotes inside an alert are kept intact.
 */

const TYPES = {
  note: "Note",
  tip: "Tip",
  important: "Important",
  warning: "Warning",
  caution: "Caution",
};

const MARKER_RE = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(?:\n|$)/i;

function convertAlerts(state) {
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type !== "blockquote_open") continue;

    // The first block inside must be a paragraph that starts with the marker.
    const paraOpen = tokens[i + 1];
    const inline = tokens[i + 2];
    if (paraOpen?.type !== "paragraph_open" || inline?.type !== "inline") continue;
    const match = MARKER_RE.exec(inline.content);
    if (!match) continue;

    // Find the matching close, counting nested blockquotes.
    let depth = 0;
    let close = -1;
    for (let j = i; j < tokens.length; j++) {
      if (tokens[j].type === "blockquote_open") depth++;
      else if (tokens[j].type === "blockquote_close" && --depth === 0) {
        close = j;
        break;
      }
    }
    if (close === -1) continue;

    const type = match[1].toLowerCase();
    tokens[i].type = "github_alert_open";
    tokens[i].tag = "div";
    tokens[i].meta = { type };
    tokens[close].type = "github_alert_close";
    tokens[close].tag = "div";

    inline.content = inline.content.slice(match[0].length);
    if (inline.content.trim() === "") {
      // Marker was the whole paragraph: drop it rather than leave an empty <p>.
      tokens.splice(i + 1, 3);
    }
  }
}

/** markdown-it plugin. */
export function githubAlerts(md) {
  md.core.ruler.after("block", "github_alerts", convertAlerts);
  md.renderer.rules.github_alert_open = (tokens, idx) => {
    const { type } = tokens[idx].meta;
    return (
      `<div class="markdown-alert markdown-alert-${type}">\n` +
      `<p class="markdown-alert-title">${TYPES[type]}</p>\n`
    );
  };
  md.renderer.rules.github_alert_close = () => "</div>\n";
}
