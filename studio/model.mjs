/**
 * Studio model: converts between a settings file and the handful of choices
 * the Studio screen offers. Pure functions, no DOM and no Node APIs, so the
 * browser and the unit tests share this file.
 *
 * Draft shape:
 *   { look, font, heading_font, highlight, page_format, orientation, margin,
 *     header: Area, footer: Area, text_size, color }
 *   font / heading_font = a preset name, "look" (whatever the page style
 *   brings) or "custom" (a hand-written font_family kept from the file)
 *   Area = { left: Slot, center: Slot, right: Slot, line: boolean, custom: boolean }
 *   Slot = { kind: "none" | "text" | "image", text: string, image: string, size: number }
 *          size = logo size in percent (100 = 12 mm tall)
 */

export const ZONES = ["left", "center", "right"];
export const MARGINS = { narrow: 10, normal: 15, wide: 25 };
export const TEXT_SIZES = { s: "8px", m: "10px", l: "12px" };
export const LINE = "1px solid #c9d1d9";
export const DEFAULT_COLOR = "#5b6773";
export const DEFAULT_HIGHLIGHT = "github.css";
export const LOGO = { baseMm: 12, min: 50, max: 200, step: 5 };

export const CHIPS = [
  { label: "Title", insert: "{title}" },
  { label: "Page number", insert: "{page}" },
  { label: "Page 1 of 9", insert: "Page {page} of {pages}" },
  { label: "Date", insert: "{date}" },
  { label: "Author", insert: "{author}" },
  { label: "File name", insert: "{filename}" },
];

const slot = (text = "") => ({ kind: text ? "text" : "none", text, image: "", size: 100 });
const logo = (image = "", size = 100) => ({ kind: "image", text: "", image, size });
const area = (left, center, right, line = false) => ({
  left: typeof left === "object" ? left : slot(left),
  center: typeof center === "object" ? center : slot(center),
  right: typeof right === "object" ? right : slot(right),
  line,
  custom: false,
});

/** Starting points offered above the page diagram. */
export const LAYOUTS = [
  {
    id: "none",
    label: "None",
    header: () => area(),
    footer: () => area(),
  },
  {
    id: "numbers",
    label: "Page numbers",
    header: () => area(),
    footer: () => area("", "{page} / {pages}", ""),
  },
  {
    id: "titled",
    label: "Title and date",
    header: () => area("{title}", "", "{date}", true),
    footer: () => area("", "Page {page} of {pages}", ""),
  },
  {
    id: "report",
    label: "Report",
    header: () => area("{title}", "", "{author}", true),
    footer: () => area("{date}", "", "Page {page} of {pages}", true),
  },
  {
    id: "letterhead",
    label: "Logo",
    header: () => area(logo(), "", "{title}", true),
    footer: () => area("", "Page {page} of {pages}", ""),
  },
];

/** What Studio proposes to someone who has no settings file yet. */
export const FIRST_LAYOUT = "titled";

export function emptyDraft() {
  return {
    look: "clean",
    font: "look",
    heading_font: "look",
    highlight: DEFAULT_HIGHLIGHT,
    page_format: "A4",
    orientation: "portrait",
    margin: "normal",
    header: area(),
    footer: area(),
    text_size: "m",
    color: DEFAULT_COLOR,
  };
}

const isPlain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const mm = (value) => {
  const m = /^\s*([\d.]+)\s*mm\s*$/.exec(String(value ?? ""));
  return m ? Number(m[1]) : null;
};
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const nameOfMargin = (side) => Object.entries(MARGINS).find(([, v]) => v === side)?.[0] ?? null;

/** Side margin a look brings, in mm (15 when it has none). */
export function lookMargin(look, looks = {}) {
  return mm(looks[look]?.margin?.left) ?? MARGINS.normal;
}

/** What picking a look suggests for the controls it influences. */
export function lookDefaults(look, looks = {}) {
  return {
    margin: nameOfMargin(lookMargin(look, looks)) ?? "normal",
    highlight: looks[look]?.highlight ?? DEFAULT_HIGHLIGHT,
  };
}

const sizeFromHeight = (height) => {
  const h = mm(height);
  return h === null ? 100 : clamp(Math.round((h / LOGO.baseMm) * 100), LOGO.min, LOGO.max);
};

/** One zone of a settings header/footer → Slot, or null when Studio cannot show it. */
function readZone(cfg, zone) {
  const structured = cfg[zone];
  if (structured !== undefined && structured !== null) {
    if (isPlain(structured) && structured.type === "text" && typeof structured.content === "string") {
      return slot(structured.content);
    }
    if (isPlain(structured) && structured.type === "image" && typeof structured.src === "string") {
      return logo(structured.src, sizeFromHeight(structured.height));
    }
    return null;
  }
  const image = cfg[`${zone}_image`];
  if (typeof image === "string" && image) return logo(image, sizeFromHeight(cfg[`${zone}_image_height`]));
  const text = cfg[`${zone}_text`];
  return slot(typeof text === "string" ? text : "");
}

function readArea(cfg, lineKey) {
  const out = area();
  if (!isPlain(cfg)) return out;
  for (const zone of ZONES) {
    const s = readZone(cfg, zone);
    if (s === null) return { ...area(), custom: true };
    out[zone] = s;
  }
  out.line = Boolean(cfg[lineKey]);
  return out;
}

const SIDES = ["top", "right", "bottom", "left"];
const sameMargin = (a, b) => isPlain(a) && isPlain(b) && SIDES.every((s) => mm(a[s]) === mm(b[s]));

/**
 * Settings file content → draft.
 * @param {object} raw        parsed settings file (not expanded)
 * @param {{looks?: object, templates?: object}} [ctx]  preset data from the server
 */
export function settingsToDraft(raw, ctx = {}) {
  const draft = emptyDraft();
  if (!isPlain(raw)) return draft;
  const looks = ctx.looks ?? {};
  const template = isPlain(ctx.templates?.[raw.template]) ? ctx.templates[raw.template] : {};

  if (typeof raw.look === "string" && looks[raw.look]) draft.look = raw.look;
  const defaults = lookDefaults(draft.look, looks);
  if (typeof raw.font === "string") draft.font = raw.font;
  else if (typeof raw.font_family === "string" && raw.font_family) draft.font = "custom";
  if (typeof raw.heading_font === "string") draft.heading_font = raw.heading_font;
  else if (typeof raw.heading_font_family === "string" && raw.heading_font_family) draft.heading_font = "custom";
  draft.highlight = typeof raw.highlight_style === "string" ? raw.highlight_style : defaults.highlight;
  if (typeof raw.page_format === "string") draft.page_format = raw.page_format;
  if (raw.orientation === "landscape") draft.orientation = "landscape";

  const header = raw.header ?? template.header;
  const footer = raw.footer ?? template.footer;
  draft.header = readArea(header, "border_bottom");
  draft.footer = readArea(footer, "border_top");

  const size = (isPlain(header) && header.font_size) || (isPlain(footer) && footer.font_size);
  draft.text_size = size === TEXT_SIZES.s ? "s" : size === TEXT_SIZES.l ? "l" : "m";
  const color = (isPlain(header) && header.color) || (isPlain(footer) && footer.color);
  if (typeof color === "string" && /^#[0-9a-f]{3,8}$/i.test(color)) draft.color = color;

  draft.margin = defaults.margin;
  if (isPlain(raw.margin)) {
    // Named only when Studio would write these exact margins back; anything
    // else was set by hand and is kept as it is.
    draft.margin = nameOfMargin(mm(raw.margin.left)) ?? "custom";
    if (draft.margin !== "custom" && !sameMargin(draftToSettings(draft, raw, ctx).margin, raw.margin)) {
      draft.margin = "custom";
    }
  }
  return draft;
}

const filledImage = (s) => s.kind === "image" && s.image;
const hasContent = (a) => ZONES.some((z) => (a[z].kind === "text" && a[z].text.trim()) || filledImage(a[z]));
const logoMm = (s) => Number(((LOGO.baseMm * clamp(s.size ?? 100, LOGO.min, LOGO.max)) / 100).toFixed(1));

const AREA_KEYS = [
  "height", "padding", "font_size", "color", "border_bottom", "border_top",
  ...ZONES.flatMap((z) => [z, `${z}_text`, `${z}_image`, `${z}_image_height`]),
];

function writeArea(a, previous, { lineKey, side, size, color }) {
  if (!hasContent(a)) return null;
  const out = isPlain(previous) ? { ...previous } : {};
  for (const key of AREA_KEYS) delete out[key];
  const tallest = Math.max(0, ...ZONES.filter((z) => filledImage(a[z])).map((z) => logoMm(a[z])));
  const height = Math.max(12, Math.ceil(tallest + 6));
  out.height = `${height}mm`;
  out.padding = `0 ${side}mm`; // text and rule line up with the page margins
  out.font_size = size;
  out.color = color;
  if (a.line) out[lineKey] = LINE;
  for (const zone of ZONES) {
    const s = a[zone];
    if (s.kind === "text" && s.text.trim()) out[`${zone}_text`] = s.text;
    if (filledImage(s)) {
      out[`${zone}_image`] = s.image;
      out[`${zone}_image_height`] = `${logoMm(s)}mm`;
    }
  }
  return { cfg: out, height };
}

/**
 * Draft → settings file content. Keys Studio does not manage are kept as-is.
 * @param {object} draft
 * @param {object} [raw]   current file content
 * @param {{looks?: object}} [ctx]
 */
export function draftToSettings(draft, raw = {}, ctx = {}) {
  const out = isPlain(raw) ? { ...raw } : {};
  delete out.template; // expanded into header/footer below
  const looks = ctx.looks ?? {};
  const defaults = lookDefaults(draft.look, looks);

  if (draft.look === "clean") delete out.look;
  else out.look = draft.look;

  for (const [choice, preset, stack] of [
    [draft.font, "font", "font_family"],
    [draft.heading_font, "heading_font", "heading_font_family"],
  ]) {
    if (choice === "custom") continue; // hand-written stack stays
    delete out[stack];
    if (choice === "look") delete out[preset];
    else out[preset] = choice;
  }

  if (draft.highlight === defaults.highlight) delete out.highlight_style;
  else out.highlight_style = draft.highlight;

  if (draft.page_format === "A4") delete out.page_format;
  else out.page_format = draft.page_format;
  if (draft.orientation === "landscape") out.orientation = "landscape";
  else delete out.orientation;

  const fromLook = lookMargin(draft.look, looks);
  const base =
    draft.margin === "custom" ? (mm(raw?.margin?.left) ?? fromLook) : (MARGINS[draft.margin] ?? fromLook);
  const style = { side: base, size: TEXT_SIZES[draft.text_size] ?? TEXT_SIZES.m, color: draft.color };

  // Header and footer are drawn inside the page margin: grow it to make room.
  let top = base;
  let bottom = base;
  if (!draft.header.custom) {
    const h = writeArea(draft.header, raw?.header, { ...style, lineKey: "border_bottom" });
    if (h) {
      out.header = h.cfg;
      top = Math.max(base, h.height + 8);
    } else delete out.header;
  }
  if (!draft.footer.custom) {
    const f = writeArea(draft.footer, raw?.footer, { ...style, lineKey: "border_top" });
    if (f) {
      out.footer = f.cfg;
      bottom = Math.max(base, f.height + 8);
    } else delete out.footer;
  }

  if (draft.margin !== "custom") {
    const asTheLook = base === fromLook && top === base && bottom === base;
    if (asTheLook) delete out.margin;
    else out.margin = { top: `${top}mm`, right: `${base}mm`, bottom: `${bottom}mm`, left: `${base}mm` };
  }
  return out;
}

/** Which starting layout a draft matches, if any (for highlighting the picker). */
export function matchLayout(draft) {
  const key = (a) => ZONES.map((z) => `${a[z].kind}:${a[z].kind === "text" ? a[z].text : ""}`).join("|") + a.line;
  for (const l of LAYOUTS) {
    if (key(l.header()) === key(draft.header) && key(l.footer()) === key(draft.footer)) return l.id;
  }
  return null;
}

/** Human rendering of a slot text for the page diagram ("{page}" → "1"). */
export function renderText(text, sample = {}) {
  const today = sample.date ?? new Date().toISOString().slice(0, 10);
  const values = {
    page: "1",
    pages: String(sample.pages ?? 2),
    title: sample.title ?? "Document title",
    author: sample.author ?? "Author",
    filename: sample.filename ?? "document.md",
    date: today,
    time: "09:30",
    datetime: `${today} 09:30`,
  };
  return String(text).replace(/\{(\w+)(?::[^}]*)?\}/g, (all, name) => values[name] ?? all);
}
