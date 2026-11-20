// Draws one page the way the tool lays it out (margins, header and footer in
// the top/bottom margin, the tool's own stylesheets), as an HTML document for
// an <iframe srcdoc>. A browser drawing, not the real PDF: close, not exact.
import { renderText } from "../../../../studio/model.mjs";
import type { Product } from "../data/product.data.mts";

/** Portrait sizes in mm. */
export const PAGE_SIZES: Record<string, [number, number]> = {
  A3: [297, 420], A4: [210, 297], A5: [148, 210], Letter: [215.9, 279.4], Legal: [215.9, 355.6],
};
export const PX_PER_MM = 96 / 25.4;

export interface SheetOptions {
  html: string;
  look: string;
  highlight?: string;
  font?: string | null; // a font stack, or null for the look's own
  headingFont?: string | null;
  header?: Record<string, any> | null;
  footer?: Record<string, any> | null;
  margin?: Partial<Record<"top" | "right" | "bottom" | "left", number>>;
  format?: string;
  orientation?: "portrait" | "landscape";
  meta?: { title?: string; author?: string; pages?: number };
}

const esc = (s: string) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function pageSize(format = "A4", orientation = "portrait"): [number, number] {
  const [w, h] = PAGE_SIZES[format] ?? PAGE_SIZES.A4;
  return orientation === "landscape" ? [h, w] : [w, h];
}

const mmOf = (v: unknown, fallback: number) => {
  const m = /^\s*([\d.]+)\s*mm\s*$/.exec(String(v ?? ""));
  return m ? Number(m[1]) : fallback;
};

function zone(cfg: Record<string, any>, z: string, meta: SheetOptions["meta"]) {
  const structured = cfg[z];
  const text = structured?.type === "text" ? structured.content : cfg[`${z}_text`];
  const image = structured?.type === "image" ? structured.src : cfg[`${z}_image`];
  const imageH = structured?.type === "image" ? structured.height : cfg[`${z}_image_height`];
  if (image) {
    const h = mmOf(imageH, 12);
    return `<span class="logo" style="height:${h}mm;width:${(h * 2.2).toFixed(1)}mm">Logo</span>`;
  }
  return text ? esc(renderText(text, { ...meta, pages: meta?.pages ?? 9 })) : "";
}

function strip(cfg: Record<string, any> | null | undefined, where: "header" | "footer", meta: SheetOptions["meta"]) {
  if (!cfg) return "";
  const rule = where === "header" ? cfg.border_bottom : cfg.border_top;
  const inner = ["left", "center", "right"].map((z) => `<div class="z ${z}">${zone(cfg, z, meta)}</div>`).join("");
  const style = [
    `height:${mmOf(cfg.height, 12)}mm`,
    `padding:${esc(cfg.padding ?? "0 10mm")}`,
    `font-size:${esc(cfg.font_size ?? "10px")}`,
    cfg.color ? `color:${esc(cfg.color)}` : "",
  ].join(";");
  const line = rule ? `border-${where === "header" ? "bottom" : "top"}:${esc(rule)}` : "";
  return `<div class="hf ${where}" style="${style}"><div class="row" style="${line}">${inner}</div></div>`;
}

export function sheetDocument(product: Product, o: SheetOptions): string {
  const look = product.looks.find((l) => l.id === o.look) ?? product.looks[0];
  const theme = product.codeThemes.find((t) => t.file === (o.highlight ?? look.highlight));
  const [w, h] = pageSize(o.format, o.orientation);
  const m = { top: look.margin, right: look.margin, bottom: look.margin, left: look.margin, ...o.margin };
  const fonts =
    (o.font ? `:root{font-family:${o.font}}` : "") + (o.headingFont ? `h1,h2,h3,h4,h5,h6{font-family:${o.headingFont}}` : "");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${product.defaultCss}
${look.css}
${theme?.css ?? ""}
${theme?.background ? `pre.hljs{background:${theme.background}}` : ""}
${fonts}
html,body{margin:0;overflow:hidden;background:#fff}
.page{position:relative;width:${w}mm;height:${h}mm;overflow:hidden;background:#fff}
.content{position:absolute;top:${m.top}mm;left:${m.left}mm;right:${m.right}mm;bottom:${m.bottom}mm;overflow:hidden}
.content main{max-width:none}
.content>main>:first-child{margin-top:0}
.hf{position:absolute;left:0;right:0;box-sizing:border-box;display:flex;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#5b6773}
.hf.header{top:0}.hf.footer{bottom:0}
.row{flex:1;display:flex;align-items:center;justify-content:space-between;gap:4px}
.z{flex:1;display:flex;align-items:center;min-width:0;white-space:nowrap;overflow:hidden}
.z.center{justify-content:center}.z.right{justify-content:flex-end}
.logo{display:inline-flex;align-items:center;justify-content:center;border:1px dashed #b8b8b8;border-radius:2px;color:#999;font-size:9px}
</style></head><body><div class="page">${strip(o.header, "header", o.meta)}<div class="content"><main>${o.html}</main></div>${strip(o.footer, "footer", o.meta)}</div></body></html>`;
}
