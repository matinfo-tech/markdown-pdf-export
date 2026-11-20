<script setup lang="ts">
// Studio online: the same choices and words as Studio, on the same model
// (studio/model.mjs), drawn by the browser. The result is a settings file.
import { computed, reactive, ref } from "vue";
import { data as product } from "../data/product.data.mts";
import { frontMatter, render } from "../lib/markdown";
import {
  CHIPS, FIRST_LAYOUT, LAYOUTS, MARGINS, TEXT_SIZES, ZONES,
  draftToSettings, emptyDraft, lookDefaults, matchLayout, renderText,
} from "../../../../studio/model.mjs";
import Sheet from "./Sheet.vue";
import PickTabs from "./PickTabs.vue";
import CopyCommand from "./CopyCommand.vue";

const SCHEMA = "https://markdown-pdf.matinfo.tech/schema/settings.schema.json";
const LOGO_PATH = "assets/logo.png";
const SAMPLE = { title: "Quarterly report", author: "Alex Morgan", pages: 9 };
const SAMPLE_MD = `# Quarterly report

Revenue grew for the third quarter in a row. The team shipped two releases,
closed the oldest support tickets and cut the build time in half.

## Summary

- Releases: **2**, both on schedule
- Support backlog: down from 41 tickets to 12

| Month     | Revenue | Change |
|-----------|--------:|-------:|
| July      |  41,200 |   +4 % |
| August    |  43,900 |   +7 % |

\`\`\`python
def growth(a, b):
    return (b - a) / a
\`\`\`

> Headers and footers repeat on every page.
`;

const ctx = {
  looks: Object.fromEntries(
    product.looks.map((l) => [l.id, { margin: { left: `${l.margin}mm` }, highlight: l.highlight }]),
  ),
};

const draft = reactive(emptyDraft());
{
  const first = LAYOUTS.find((l) => l.id === FIRST_LAYOUT)!;
  draft.header = first.header();
  draft.footer = first.footer();
}

const selected = ref<{ area: "header" | "footer"; zone: string } | null>({ area: "header", zone: "left" });
const copied = ref(false);

const settings = computed(() => draftToSettings(draft, {}, ctx));
const json = computed(() => JSON.stringify({ $schema: SCHEMA, ...settings.value }, null, 2) + "\n");
const layout = computed(() => matchLayout(draft));
const slot = computed(() => (selected.value ? draft[selected.value.area][selected.value.zone] : null));
const html = render(frontMatter(SAMPLE_MD).body);

const mm = (v: unknown, d: number) => {
  const m = /^\s*([\d.]+)\s*mm/.exec(String(v ?? ""));
  return m ? Number(m[1]) : d;
};

const sheet = computed(() => {
  const s: any = settings.value;
  const look = product.looks.find((l) => l.id === draft.look)!;
  const base = look.margin;
  return {
    html,
    look: draft.look,
    highlight: draft.highlight,
    font: draft.font !== "look" ? product.fonts[draft.font] ?? null : null,
    headingFont: draft.heading_font !== "look" ? product.fonts[draft.heading_font] ?? null : null,
    header: s.header ?? null,
    footer: s.footer ?? null,
    format: draft.page_format,
    orientation: draft.orientation,
    margin: {
      top: mm(s.margin?.top, base), right: mm(s.margin?.right, base),
      bottom: mm(s.margin?.bottom, base), left: mm(s.margin?.left, base),
    },
    meta: SAMPLE,
  };
});

function pickLook(id: string) {
  draft.look = id;
  const d = lookDefaults(id, ctx.looks);
  draft.margin = d.margin;
  draft.highlight = d.highlight;
}

function pickLayout(id: string) {
  const l = LAYOUTS.find((x) => x.id === id)!;
  draft.header = l.header();
  draft.footer = l.footer();
  // Online there is no file picker: a logo spot uses the default path so the sheet shows it.
  for (const a of ["header", "footer"] as const)
    for (const z of ZONES) if (draft[a][z].kind === "image" && !draft[a][z].image) draft[a][z].image = LOGO_PATH;
}

function spotText(s: any) {
  if (s.kind === "image") return "Logo";
  return s.text ? renderText(s.text, SAMPLE) : "";
}

function setKind(kind: "text" | "image" | "none") {
  const s = slot.value;
  if (!s) return;
  s.kind = kind;
  if (kind === "image") s.image = LOGO_PATH;
  if (kind === "none") s.text = "";
}

function insert(text: string) {
  const s = slot.value;
  if (!s) return;
  s.kind = "text";
  s.text = s.text ? `${s.text} ${text}` : text;
}

function download() {
  const url = URL.createObjectURL(new Blob([json.value], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "settings.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copy() {
  try {
    await navigator.clipboard.writeText(json.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1600);
  } catch {
    /* clipboard blocked */
  }
}

const AREA_NAMES = { header: "Top", footer: "Bottom" } as const;
const ZONE_NAMES: Record<string, string> = { left: "left", center: "middle", right: "right" };
const hasLogo = computed(() =>
  (["header", "footer"] as const).some((a) => ZONES.some((z) => draft[a][z].kind === "image")),
);
</script>

<template>
  <div class="studio-online">
    <section class="rail" aria-label="Page design">
      <h2>Page style</h2>
      <div class="looks" role="radiogroup" aria-label="Page style">
        <button
          v-for="l in product.looks" :key="l.id" type="button" role="radio"
          :aria-checked="draft.look === l.id" :class="{ on: draft.look === l.id }" @click="pickLook(l.id)"
        >
          <b>{{ l.label }}</b><span>{{ l.description }}</span>
        </button>
      </div>

      <h2>Fonts and paper</h2>
      <div class="fields">
        <label for="so-font">Text font</label>
        <select id="so-font" v-model="draft.font">
          <option value="look">From the page style</option>
          <option v-for="(label, id) in product.fontLabels" :key="id" :value="id">{{ label }}</option>
        </select>
        <label for="so-hfont">Title font</label>
        <select id="so-hfont" v-model="draft.heading_font">
          <option value="look">From the page style</option>
          <option v-for="(label, id) in product.fontLabels" :key="id" :value="id">{{ label }}</option>
        </select>
        <label for="so-format">Paper</label>
        <div class="row">
          <select id="so-format" v-model="draft.page_format">
            <option v-for="f in ['A4', 'Letter', 'Legal', 'A3', 'A5']" :key="f">{{ f }}</option>
          </select>
          <div class="seg" role="radiogroup" aria-label="Orientation">
            <button v-for="[v, t] in [['portrait', 'Portrait'], ['landscape', 'Landscape']]" :key="v" type="button"
              role="radio" :aria-checked="draft.orientation === v" :class="{ on: draft.orientation === v }"
              @click="draft.orientation = v">
              <svg class="ico" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true">
                <rect v-if="v === 'portrait'" x="4" y="2" width="8" height="12" rx="1.2"/>
                <rect v-else x="2" y="4" width="12" height="8" rx="1.2"/>
              </svg>
              {{ t }}
            </button>
          </div>
        </div>
        <span class="label">Margins</span>
        <div class="seg" role="radiogroup" aria-label="Margins">
          <button v-for="m in Object.keys(MARGINS)" :key="m" type="button" role="radio"
            :aria-checked="draft.margin === m" :class="{ on: draft.margin === m }" @click="draft.margin = m">
            {{ m[0].toUpperCase() + m.slice(1) }}
          </button>
        </div>
        <label for="so-code">Code colours</label>
        <select id="so-code" v-model="draft.highlight">
          <option v-for="t in product.codeThemes" :key="t.file" :value="t.file">{{ t.label }}</option>
        </select>
      </div>

      <h2>Header and footer</h2>
      <div class="seg wrap" aria-label="Starting layout">
        <button v-for="l in LAYOUTS" :key="l.id" type="button" :class="{ on: layout === l.id }"
          :aria-pressed="layout === l.id" @click="pickLayout(l.id)">{{ l.label }}</button>
      </div>

      <div class="mini" aria-label="Spots on the page. Pick one to change it.">
        <template v-for="area in (['header', 'footer'] as const)" :key="area">
          <div class="spots" :class="[area, { line: draft[area].line }]">
            <button
              v-for="z in ZONES" :key="z" type="button"
              :class="{ on: selected?.area === area && selected?.zone === z, empty: draft[area][z].kind === 'none' }"
              :aria-label="`${AREA_NAMES[area]} ${ZONE_NAMES[z]}: ${spotText(draft[area][z]) || 'empty'}`"
              @click="selected = { area, zone: z }"
            >{{ spotText(draft[area][z]) || "+" }}</button>
          </div>
          <div v-if="area === 'header'" class="lines" aria-hidden="true"><i /><i /><i /><i /></div>
        </template>
      </div>

      <div v-if="slot && selected" class="editor">
        <p class="where">{{ AREA_NAMES[selected.area] }} {{ ZONE_NAMES[selected.zone] }}</p>
        <div class="seg">
          <button type="button" :class="{ on: slot.kind !== 'image' }" @click="setKind('text')">Text</button>
          <button type="button" :class="{ on: slot.kind === 'image' }" @click="setKind('image')">Logo</button>
          <button type="button" class="clear" @click="setKind('none')"><svg class="ico" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 4.5h11M6 4.5V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M4 4.5l.6 8.1a1 1 0 0 0 1 .9h4.8a1 1 0 0 0 1-.9l.6-8.1M6.7 7v4M9.3 7v4"/></svg>Clear</button>
        </div>
        <template v-if="slot.kind !== 'image'">
          <input v-model="slot.text" type="text" placeholder="Type here, or pick something below"
            aria-label="Text in this spot" @input="slot.kind = slot.text ? 'text' : 'none'" />
          <div class="chips">
            <button v-for="c in CHIPS" :key="c.label" type="button" class="chip" @click="insert(c.insert)">{{ c.label }}</button>
          </div>
        </template>
        <template v-else>
          <label class="label" for="so-size">Logo size</label>
          <input id="so-size" v-model.number="slot.size" type="range" min="50" max="200" step="5" />
        </template>
      </div>

      <div class="fields">
        <span class="label">Lines</span>
        <div>
          <label class="check"><input v-model="draft.header.line" type="checkbox" /> Line under the header</label>
          <label class="check"><input v-model="draft.footer.line" type="checkbox" /> Line above the footer</label>
        </div>
        <span class="label">Text size</span>
        <div class="row">
          <div class="seg" role="radiogroup" aria-label="Text size">
            <button v-for="(px, k) in TEXT_SIZES" :key="k" type="button" role="radio" :aria-checked="draft.text_size === k"
              :class="{ on: draft.text_size === k }" @click="draft.text_size = k">{{ { s: "Small", m: "Medium", l: "Large" }[k] }}</button>
          </div>
          <input v-model="draft.color" type="color" aria-label="Text colour" title="Text colour" />
        </div>
      </div>
    </section>

    <section class="desk" aria-label="Preview and result">
      <Sheet :options="sheet" label="Preview of the page" />
      <p class="note">Drawn by your browser. Studio on your computer shows the real PDF.</p>

      <div class="result">
        <h2>Your settings file</h2>
        <div class="actions">
          <button type="button" class="primary" @click="download"><svg class="ico" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M3 13h10"/></svg>Download settings.json</button>
          <button type="button" @click="copy">
            <svg v-if="copied" class="ico" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 8.5 3.5 3.5L13 4.5"/></svg>
            <svg v-else class="ico" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5V4A1.5 1.5 0 0 0 9 2.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5"/></svg>
            {{ copied ? "Copied" : "Copy" }}
          </button>
        </div>
        <p>Use it with one command. It checks the file and puts it where every export looks for it.</p>
        <PickTabs group="os" tabs="mac:macOS,windows:Windows,linux:Linux">
          <template #mac><CopyCommand command="npx -y markdown-pdf-export init --from ~/Downloads/settings.json" /></template>
          <template #windows><CopyCommand command="npx -y markdown-pdf-export init --from $HOME\Downloads\settings.json" /></template>
          <template #linux><CopyCommand command="npx -y markdown-pdf-export init --from ~/Downloads/settings.json" /></template>
        </PickTabs>
        <p class="hint">
          The file must be in your Downloads folder, as <code>settings.json</code>. Windows: use PowerShell.
          Already have a settings file? Add <code>--force</code>; the old one is kept as a <code>.bak</code> copy.
        </p>
        <details>
          <summary>Or copy it by hand</summary>
          <PickTabs group="os" tabs="mac:macOS,windows:Windows,linux:Linux">
            <template #mac><code class="path">~/.config/markdown-pdf-export/settings.json</code></template>
            <template #windows><code class="path">%APPDATA%\markdown-pdf-export\settings.json</code></template>
            <template #linux><code class="path">~/.config/markdown-pdf-export/settings.json</code></template>
          </PickTabs>
        </details>
        <p v-if="hasLogo" class="logo-note">
          Logo: put your image in a folder named <code>assets</code> next to the file, as <code>logo.png</code>.
        </p>
        <details>
          <summary>Show the file</summary>
          <pre><code>{{ json }}</code></pre>
        </details>
      </div>
    </section>
  </div>
</template>

<style scoped>
.studio-online {
  display: grid;
  grid-template-columns: minmax(0, 400px) minmax(0, 1fr);
  gap: 48px;
  align-items: start;
}
h2 {
  font-family: var(--mpe-serif);
  font-size: 19px;
  margin: 28px 0 12px !important;
  padding: 0 !important;
  border: 0 !important;
}
.rail h2:first-child {
  margin-top: 0;
}
.looks {
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
}
.looks button {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 7px 10px;
  text-align: left;
  font-size: 14px;
  border: 1px solid var(--mpe-line);
  border-radius: 8px;
  background: var(--mpe-surface);
  color: var(--mpe-text);
}
.looks button span {
  font-size: 12.5px;
  line-height: 1.35;
  color: var(--mpe-muted);
}
.looks button.on,
.seg button.on {
  border-color: var(--mpe-accent);
  background: color-mix(in srgb, var(--mpe-accent) 16%, var(--mpe-surface));
}
.fields {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr);
  gap: 10px 12px;
  align-items: center;
  margin-top: 16px;
}
.fields label,
.label {
  font-size: 14px;
  color: var(--mpe-muted);
}
select,
input[type="text"] {
  width: 100%;
  padding: 4px 10px;
  border: 1px solid var(--mpe-line);
  border-radius: 6px;
  background: var(--mpe-surface);
  color: var(--mpe-text);
  font-size: 14px;
}
.row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.row select {
  width: 90px;
}
.seg {
  display: flex;
  flex: 1 1 0;
  gap: 4px;
}
.seg.wrap {
  flex-wrap: wrap;
}
.seg button,
.chip,
.actions button {
  padding: 5px 10px;
  border: 1px solid var(--mpe-line);
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  background: var(--mpe-surface);
  color: var(--mpe-text);
  flex: 1 1 0;
  white-space: nowrap;
}
.seg button.clear {
  flex: 0 0 80px;
}
.seg button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.seg .ico {
  flex: none;
}
.mini {
  margin: 16px 0 12px;
  padding: 10px 12px;
  background: #fff;
  border-radius: 4px;
  box-shadow: var(--sheet-shadow);
  color: #333;
}
.spots {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
  padding: 4px 0;
}
.spots.header.line {
  border-bottom: 1px solid #c9d1d9;
}
.spots.footer.line {
  border-top: 1px solid #c9d1d9;
}
.spots button {
  min-height: 30px;
  padding: 2px 6px;
  border: 1px dashed transparent;
  border-radius: 4px;
  font-size: 12px;
  color: #444;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.spots button:nth-child(2) {
  text-align: center;
}
.spots button:nth-child(3) {
  text-align: right;
}
.spots button.empty {
  color: #aaa;
  border-color: #ddd;
}
.spots button:hover {
  border-color: #bbb;
}
.spots button.on {
  border: 1px solid var(--mpe-accent);
  background: #fdeceb;
}
.lines {
  display: grid;
  gap: 6px;
  padding: 14px 6px;
}
.lines i {
  height: 5px;
  border-radius: 2px;
  background: #e6e6e6;
}
.lines i:last-child {
  width: 60%;
}
.editor {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--mpe-line);
  border-radius: 8px;
  background: var(--mpe-surface);
}
.editor .where {
  margin: 0;
  font-weight: 600;
}
.chips {
  /* Six chips: two rows of three. */
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
}
.chip {
  overflow: hidden;
  text-overflow: ellipsis;
}
.check {
  display: block;
  font-size: 14px;
  color: var(--mpe-text);
}
input[type="color"] {
  width: 34px;
  height: 34px;
  padding: 0 2px;
  border: 1px solid var(--mpe-line);
  border-radius: 6px;
  background: var(--mpe-surface);
}
.desk {
  position: sticky;
  top: calc(var(--vp-nav-height) + 24px);
}
.desk > :first-child,
.desk .note {
  max-width: min(520px, calc((100vh - var(--vp-nav-height) - 90px) * 0.707));
}
.note,
.logo-note {
  font-size: 13px;
  color: var(--mpe-muted);
}
.result {
  margin-top: 24px;
  max-width: 520px;
}
.actions {
  display: flex;
  gap: 8px;
}
.actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.actions .ico {
  flex: none;
}
.actions .primary {
  border-color: transparent;
  background: var(--mpe-accent);
  color: #fff;
}
.actions .primary:hover {
  background: var(--mpe-accent-hover);
}
.hint {
  font-size: 14px;
  color: var(--mpe-muted);
}
.path {
  display: block;
  margin-top: 8px;
  word-break: break-all;
}
pre {
  max-height: 320px;
  overflow: auto;
  font-size: 12.5px;
}
@media (max-width: 900px) {
  .studio-online {
    grid-template-columns: 1fr;
  }
  .desk {
    position: static;
  }
}
</style>
