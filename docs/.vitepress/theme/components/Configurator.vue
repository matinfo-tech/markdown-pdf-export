<script setup>
import { computed, reactive, ref, watch } from "vue";
import minimal from "../../../../templates/minimal.json";
import simple from "../../../../templates/simple.json";
import corporate from "../../../../templates/corporate.json";
import academic from "../../../../templates/academic.json";
import twoLogo from "../../../../templates/two-logo.json";
import {
  PAGE_FORMATS, PAGE_SIZES_MM, PLACEHOLDERS, SIDES, ZONES, TARGETS, SAMPLE,
  stateFromSettings, settingsFromState, toJson, toFrontMatter, renderPlaceholders,
  toMm, editorSnippets, installLinks,
} from "./configurator-lib.js";

const TEMPLATES = { minimal, simple, corporate, academic, "two-logo": twoLogo };

const tplName = ref("simple");
const state = reactive(stateFromSettings(TEMPLATES.simple));
function loadTemplate(name) {
  const fresh = stateFromSettings(TEMPLATES[name]);
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, fresh);
}
watch(tplName, loadTemplate);

// ---- placeholder picker: inserts at the caret of the last focused text field
const lastField = { part: null, key: null, el: null };
function track(part, key, event) {
  Object.assign(lastField, { part, key, el: event.target });
}
function insert(part, token) {
  const key = lastField.part === part && lastField.key ? lastField.key : "center_text";
  const current = state[part][key] ?? "";
  const el = lastField.part === part ? lastField.el : null;
  const start = el?.selectionStart ?? current.length;
  const end = el?.selectionEnd ?? current.length;
  state[part][key] = current.slice(0, start) + token + current.slice(end);
  if (el) {
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }
}

// ---- outputs
const settings = computed(() => settingsFromState(state));
const jsonText = computed(() => toJson(settings.value));
const yamlText = computed(() => toFrontMatter(settings.value));
const editors = editorSnippets();
const links = installLinks();

const tab = ref("json");
const TABS = [
  { id: "json", label: "settings.json" },
  { id: "yaml", label: "Front matter" },
  { id: "editors", label: "Editors" },
];
const os = ref("unix");
const asProject = ref(false);
const fileName = computed(() => (asProject.value ? ".markdown-pdf.json" : "settings.json"));
const projectCommands = computed(() =>
  os.value === "windows"
    ? [{ label: "PowerShell, in the repo root (copy first)", cmd: "[IO.File]::WriteAllText(\"$PWD\\.markdown-pdf.json\", (Get-Clipboard -Raw))" }]
    : [
        { label: "macOS, in the repo root (copy first)", cmd: "pbpaste > .markdown-pdf.json" },
        { label: "Linux, in the repo root (copy first)", cmd: "xclip -selection clipboard -o > .markdown-pdf.json" },
      ],
);

const status = ref("");
let statusTimer;
async function copy(text, what = "Copied") {
  try {
    if (typeof navigator === "undefined" || !navigator.clipboard) throw new Error("no clipboard");
    await navigator.clipboard.writeText(text);
    status.value = `${what} to the clipboard.`;
  } catch {
    status.value = "Copy failed — select the text and copy it manually.";
  }
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => (status.value = ""), 2500);
}
function download() {
  if (typeof document === "undefined") return;
  const url = URL.createObjectURL(new Blob([jsonText.value], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: fileName.value });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function onTabKey(e) {
  const i = TABS.findIndex((t) => t.id === tab.value);
  const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
  if (!step) return;
  tab.value = TABS[(i + step + TABS.length) % TABS.length].id;
  requestAnimationFrame(() => document.getElementById(`cfg-tab-${tab.value}`)?.focus());
}

// ---- preview geometry (everything in % of the page / cqw so it scales)
const today = new Date();
const page = computed(() => {
  let [w, h] = PAGE_SIZES_MM[state.page_format] ?? PAGE_SIZES_MM.A4;
  if ((state.orientation === "landscape") !== w > h) [w, h] = [h, w];
  const mm = (v, fallback) => (Number.isFinite(toMm(v)) ? toMm(v) : fallback);
  const margin = Object.fromEntries(SIDES.map((s) => [s, Math.max(0, mm(state.margin[s], 15))]));
  return { w, h, margin, mm };
});
const pct = (v, total) => `${Math.min(100, (v / total) * 100)}%`;
const cqw = (mm) => `${(mm / page.value.w) * 100}cqw`;
const bodyStyle = computed(() => {
  const { w, h, margin } = page.value;
  return {
    top: pct(margin.top, h), bottom: pct(margin.bottom, h),
    left: pct(margin.left, w), right: pct(margin.right, w),
    fontFamily: state.font_family || undefined,
  };
});
function zoneStyle(part) {
  const z = state[part];
  const { h, margin, mm } = page.value;
  const room = part === "header" ? margin.top : margin.bottom;
  const height = Math.min(room, mm(z.height, room));
  const pad = String(z.padding ?? "").trim().split(/\s+/);
  const padX = mm(pad[1] ?? pad[0], 0);
  const border = part === "header" ? z.border_bottom : z.border_top;
  return {
    [part === "header" ? "top" : "bottom"]: "0",
    height: pct(height, h),
    padding: `0 ${cqw(padX)}`,
    fontSize: cqw(mm(z.font_size || "9px", 3.2)),
    fontStyle: z.font_style || undefined,
    color: z.color || undefined,
    fontFamily: z.font_family || state.font_family || undefined,
    [part === "header" ? "borderBottom" : "borderTop"]: border || undefined,
  };
}
function imageStyle(part, zone) {
  const z = state[part];
  const height = page.value.mm(z[`${zone}_image_height`], page.value.mm(z.height, 12) * 0.7);
  return { height: cqw(height), minWidth: cqw(height * 2) };
}
const basename = (p) => String(p).split(/[\\/]/).pop();
</script>

<template>
  <div class="cfg">
    <div class="cfg-grid">
      <!-- ============ form ============ -->
      <form class="cfg-form" @submit.prevent>
        <label class="cfg-row">
          <span>Start from template</span>
          <select v-model="tplName">
            <option v-for="(_, name) in TEMPLATES" :key="name" :value="name">{{ name }}</option>
          </select>
        </label>

        <fieldset>
          <legend>Page</legend>
          <div class="cfg-cols">
            <label>Format
              <select v-model="state.page_format">
                <option v-for="f in PAGE_FORMATS" :key="f">{{ f }}</option>
              </select>
            </label>
            <label>Orientation
              <select v-model="state.orientation">
                <option value="portrait">portrait</option>
                <option value="landscape">landscape</option>
              </select>
            </label>
          </div>
          <div class="cfg-cols cfg-cols-4">
            <label v-for="s in SIDES" :key="s">Margin {{ s }}
              <input v-model="state.margin[s]" placeholder="15mm" />
            </label>
          </div>
          <label>Font family
            <input v-model="state.font_family" placeholder="system default, e.g. Georgia, serif" />
          </label>
          <div class="cfg-checks">
            <label><input type="checkbox" v-model="state.toc" /> Table of contents (<code>[[toc]]</code>)</label>
            <label><input type="checkbox" v-model="state.math" /> Math (KaTeX)</label>
          </div>
        </fieldset>

        <fieldset v-for="part in ['header', 'footer']" :key="part">
          <legend>
            <label class="cfg-toggle">
              <input type="checkbox" v-model="state[part + 'On']" />
              {{ part === "header" ? "Header" : "Footer" }}
            </label>
          </legend>
          <div v-if="state[part + 'On']">
            <div class="cfg-cols cfg-cols-4">
              <label>Height <input v-model="state[part].height" placeholder="15mm" /></label>
              <label>Font size <input v-model="state[part].font_size" placeholder="9px" /></label>
              <label>Color <input v-model="state[part].color" placeholder="#666" /></label>
              <label v-if="part === 'header'">Border bottom <input v-model="state.header.border_bottom" placeholder="1px solid #ddd" /></label>
              <label v-else>Border top <input v-model="state.footer.border_top" placeholder="1px solid #eee" /></label>
            </div>
            <div class="cfg-cols cfg-cols-3">
              <label v-for="z in ZONES" :key="z">{{ z }} text
                <input v-model="state[part][z + '_text']" :placeholder="z === 'center' ? '{title}' : ''"
                  @focus="track(part, z + '_text', $event)" @click="track(part, z + '_text', $event)"
                  @keyup="track(part, z + '_text', $event)" />
              </label>
            </div>
            <div class="cfg-chips" role="group" :aria-label="`Insert a placeholder into the ${part} text field you last edited`">
              <span class="cfg-hint">Insert:</span>
              <button v-for="p in PLACEHOLDERS" :key="p" type="button" class="cfg-chip"
                @mousedown.prevent @click="insert(part, p)">{{ p }}</button>
            </div>
            <div class="cfg-cols cfg-cols-4">
              <template v-for="z in ['left', 'right']" :key="z">
                <label>{{ z }} image <input v-model="state[part][z + '_image']" placeholder="@/logo.svg" /></label>
                <label>{{ z }} image height <input v-model="state[part][z + '_image_height']" placeholder="12mm" /></label>
              </template>
            </div>
            <p class="cfg-hint">Image paths are relative to the settings file; <code>@/name.svg</code> looks in <code>assets_directory</code>.</p>
          </div>
        </fieldset>
      </form>

      <!-- ============ preview ============ -->
      <figure class="cfg-preview">
        <div class="cfg-page" :style="{ aspectRatio: `${page.w} / ${page.h}` }" role="img"
          :aria-label="`Approximate preview of a ${state.page_format} ${state.orientation} page`">
          <template v-for="part in ['header', 'footer']" :key="part">
            <div v-if="state[part + 'On']" class="cfg-zone" :style="zoneStyle(part)">
              <div v-for="z in ZONES" :key="z" :class="['cfg-cell', `cfg-${z}`]">
                <span v-if="state[part][z + '_image']" class="cfg-img" :style="imageStyle(part, z)">
                  {{ basename(state[part][z + "_image"]) }}
                </span>
                <span v-if="state[part][z + '_text']">{{ renderPlaceholders(state[part][z + "_text"], today) }}</span>
              </div>
            </div>
          </template>
          <div class="cfg-body" :style="bodyStyle">
            <div class="cfg-h1">{{ SAMPLE.title }}</div>
            <div v-if="state.toc" class="cfg-toc"><i></i><i></i><i></i></div>
            <i v-for="n in 14" :key="n" class="cfg-line" :style="{ width: `${70 + ((n * 37) % 30)}%` }"></i>
          </div>
        </div>
        <figcaption>
          Approximate preview — run <code>npx -y markdown-pdf-export doc.md --watch</code> for the exact PDF.
          Sample values: title “{{ SAMPLE.title }}”, author “{{ SAMPLE.author }}”, page 1 of 5.
        </figcaption>
      </figure>
    </div>

    <!-- ============ outputs ============ -->
    <div class="cfg-tabs" role="tablist" aria-label="Output" @keydown="onTabKey">
      <button v-for="t in TABS" :id="`cfg-tab-${t.id}`" :key="t.id" type="button" role="tab"
        :aria-selected="tab === t.id" :aria-controls="`cfg-panel-${t.id}`" :tabindex="tab === t.id ? 0 : -1"
        @click="tab = t.id">{{ t.label }}</button>
    </div>
    <p class="cfg-status" aria-live="polite">{{ status }}</p>

    <section v-show="tab === 'json'" id="cfg-panel-json" role="tabpanel" aria-labelledby="cfg-tab-json">
      <div class="cfg-switch" role="radiogroup" aria-label="Operating system">
        <label v-for="(t, id) in TARGETS" :key="id"><input type="radio" v-model="os" :value="id" /> {{ t.label }}</label>
        <label class="cfg-project"><input type="checkbox" v-model="asProject" /> Save as a project file instead</label>
      </div>
      <template v-if="!asProject">
        <p>Save this once as <strong>your central settings file</strong> — every editor task, every MCP client and the CLI read it automatically:</p>
        <p class="cfg-path"><code>{{ TARGETS[os].path }}</code></p>
        <p class="cfg-hint">{{ TARGETS[os].note }}</p>
        <div v-for="c in TARGETS[os].commands" :key="c.label" class="cfg-cmd">
          <span class="cfg-hint">{{ c.label }}</span>
          <div class="cfg-codewrap"><pre><code>{{ c.cmd }}</code></pre>
            <button type="button" class="cfg-btn cfg-mini" @click="copy(c.cmd, 'Command copied')">Copy</button></div>
        </div>
        <p class="cfg-hint">Or click Download and move the file to the path above.</p>
      </template>
      <template v-else>
        <p>Save as <code>.markdown-pdf.json</code> in the repository root. It applies to every Markdown file below it and is deep-merged over your central file, so you can trim it to the keys that differ.</p>
        <div v-for="c in projectCommands" :key="c.label" class="cfg-cmd">
          <span class="cfg-hint">{{ c.label }}</span>
          <div class="cfg-codewrap"><pre><code>{{ c.cmd }}</code></pre>
            <button type="button" class="cfg-btn cfg-mini" @click="copy(c.cmd, 'Command copied')">Copy</button></div>
        </div>
        <p class="cfg-hint">Some browsers drop the leading dot of a downloaded file — rename it if needed.</p>
      </template>
      <div class="cfg-actions">
        <button type="button" class="cfg-btn cfg-primary" @click="copy(jsonText, 'Settings copied')">Copy {{ fileName }}</button>
        <button type="button" class="cfg-btn" @click="download">Download {{ fileName }}</button>
      </div>
      <pre class="cfg-out"><code>{{ jsonText }}</code></pre>
    </section>

    <section v-show="tab === 'yaml'" id="cfg-panel-yaml" role="tabpanel" aria-labelledby="cfg-tab-yaml">
      <p>For <strong>one document only</strong>: put this at the top of the Markdown file. The <code>pdf:</code> block overrides your central settings file for that document.</p>
      <div class="cfg-actions">
        <button type="button" class="cfg-btn cfg-primary" @click="copy(yamlText, 'Front matter copied')">Copy front matter</button>
      </div>
      <pre class="cfg-out"><code>{{ yamlText }}</code></pre>
    </section>

    <section v-show="tab === 'editors'" id="cfg-panel-editors" role="tabpanel" aria-labelledby="cfg-tab-editors">
      <p><strong>These entries never change — all styling comes from your settings file.</strong> They are identical for everyone, with no <code>env</code> and no paths to edit. <code>npx -y markdown-pdf-export setup</code> prints them for the editors on your machine.</p>
      <div v-for="ed in editors" :key="ed.id" class="cfg-editor">
        <h3>{{ ed.name }}</h3>
        <p v-if="ed.id === 'vscode'" class="cfg-links">
          One click: <a :href="links.vscode">Install MCP server in VS Code</a>
          (<a :href="links.vscodeWeb" target="_blank" rel="noopener">via vscode.dev</a>)
        </p>
        <p v-if="ed.id === 'cursor'" class="cfg-links">One click: <a :href="links.cursor">Install MCP server in Cursor</a></p>
        <div v-for="item in ed.items" :key="item.label" class="cfg-cmd">
          <span class="cfg-hint">{{ item.label }}<template v-if="item.file"> — <code>{{ item.file }}</code></template></span>
          <div class="cfg-codewrap"><pre><code>{{ item.code }}</code></pre>
            <button type="button" class="cfg-btn cfg-mini" @click="copy(item.code, `${ed.name} snippet copied`)">Copy</button></div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.cfg { margin-top: 1.5rem; font-size: 14px; }
.cfg-grid { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 1.5rem; align-items: start; }
@media (max-width: 860px) { .cfg-grid { grid-template-columns: 1fr; } .cfg-preview { position: static; } }
.cfg-form { display: flex; flex-direction: column; gap: 1rem; }
fieldset { border: 1px solid var(--vp-c-divider); border-radius: 8px; padding: 0.75rem 1rem 1rem; margin: 0; min-width: 0; }
legend { padding: 0 0.4rem; font-weight: 600; }
label { display: flex; flex-direction: column; gap: 0.2rem; font-size: 13px; color: var(--vp-c-text-2); min-width: 0; }
.cfg-row { flex-direction: row; align-items: center; gap: 0.75rem; font-weight: 600; color: var(--vp-c-text-1); }
.cfg-toggle, .cfg-checks label, .cfg-switch label { flex-direction: row; align-items: center; gap: 0.4rem; color: var(--vp-c-text-1); }
input:not([type]), select {
  width: 100%; padding: 0.35rem 0.5rem; border: 1px solid var(--vp-c-divider); border-radius: 6px;
  background: var(--vp-c-bg); color: var(--vp-c-text-1); font: inherit; font-size: 13px;
}
.cfg-row select { width: auto; }
input:focus-visible, select:focus-visible, button:focus-visible, a:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 1px; }
.cfg-cols { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.6rem; margin-bottom: 0.6rem; }
.cfg-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.cfg-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
@media (max-width: 560px) { .cfg-cols-3, .cfg-cols-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.cfg-checks { display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 0.6rem; }
.cfg-chips { display: flex; flex-wrap: wrap; gap: 0.3rem; align-items: center; margin-bottom: 0.6rem; }
.cfg-chip {
  font-family: var(--vp-font-family-mono); font-size: 12px; padding: 0.1rem 0.45rem; border-radius: 999px;
  border: 1px solid var(--vp-c-divider); background: var(--vp-c-bg-soft); color: var(--vp-c-text-1); cursor: pointer;
}
.cfg-chip:hover { border-color: var(--vp-c-brand-1); color: var(--vp-c-brand-1); }
.cfg-hint { font-size: 12px; color: var(--vp-c-text-2); margin: 0.25rem 0; }

.cfg-preview { position: sticky; top: calc(var(--vp-nav-height, 64px) + 1rem); margin: 0; }
.cfg-page {
  position: relative; container-type: inline-size; width: 100%; margin: 0 auto;
  background: #fff; color: #222; box-shadow: 0 2px 12px rgba(0, 0, 0, 0.18); border-radius: 2px; overflow: hidden;
}
.cfg-zone { position: absolute; left: 0; right: 0; display: flex; align-items: center; gap: 2cqw; box-sizing: border-box; line-height: 1.2; color: #444; }
.cfg-cell { flex: 1; display: flex; align-items: center; gap: 1cqw; min-width: 0; overflow: hidden; white-space: nowrap; }
.cfg-center { justify-content: center; text-align: center; }
.cfg-right { justify-content: flex-end; text-align: right; }
.cfg-img {
  display: inline-flex; align-items: center; justify-content: center; border: 1px dashed #99a; background: #eef0f6;
  color: #556; font-size: 2cqw; font-style: normal; padding: 0 0.6cqw; overflow: hidden;
}
.cfg-body { position: absolute; display: flex; flex-direction: column; gap: 1.6cqw; overflow: hidden; }
.cfg-h1 { font-size: 5cqw; font-weight: 700; color: #111; margin-bottom: 1cqw; }
.cfg-line, .cfg-toc i { display: block; height: 1.3cqw; background: #e3e5ea; border-radius: 1px; }
.cfg-toc { display: flex; flex-direction: column; gap: 1cqw; padding-left: 3cqw; margin-bottom: 2cqw; }
.cfg-toc i { background: #c9d6f0; width: 40%; }
figcaption { font-size: 12px; color: var(--vp-c-text-2); margin-top: 0.6rem; text-align: center; }

.cfg-tabs { display: flex; gap: 0.25rem; margin-top: 2rem; border-bottom: 1px solid var(--vp-c-divider); }
.cfg-tabs button {
  padding: 0.5rem 1rem; border: 0; border-bottom: 2px solid transparent; background: none;
  color: var(--vp-c-text-2); font-weight: 600; cursor: pointer; margin-bottom: -1px;
}
.cfg-tabs button[aria-selected="true"] { color: var(--vp-c-brand-1); border-bottom-color: var(--vp-c-brand-1); }
.cfg-status { min-height: 1.2em; font-size: 12px; color: var(--vp-c-brand-1); margin: 0.3rem 0; }
.cfg-switch { display: flex; flex-wrap: wrap; gap: 1rem; padding: 0.6rem 0.8rem; border-radius: 8px; background: var(--vp-c-bg-soft); }
.cfg-project { margin-left: auto; }
.cfg-path code { font-size: 15px; }
.cfg-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0.8rem 0; }
.cfg-btn {
  padding: 0.4rem 0.9rem; border-radius: 6px; border: 1px solid var(--vp-c-divider); background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1); font-weight: 600; font-size: 13px; cursor: pointer;
}
.cfg-btn:hover { border-color: var(--vp-c-brand-1); }
.cfg-primary { background: var(--vp-c-brand-3); border-color: var(--vp-c-brand-3); color: var(--vp-c-white); }
.cfg-primary:hover { background: var(--vp-c-brand-2); }
.cfg-mini { position: absolute; top: 0.4rem; right: 0.4rem; padding: 0.15rem 0.5rem; font-size: 12px; }
.cfg-cmd { margin: 0.6rem 0; }
.cfg-codewrap { position: relative; }
pre {
  margin: 0.25rem 0 0; padding: 0.75rem 4rem 0.75rem 0.9rem; border-radius: 8px; background: var(--vp-code-block-bg);
  overflow-x: auto; font-size: 13px; line-height: 1.5;
}
pre code { font-family: var(--vp-font-family-mono); color: var(--vp-code-block-color, var(--vp-c-text-1)); }
.cfg-out { padding-right: 0.9rem; max-height: 480px; }
.cfg-editor h3 { margin: 1.5rem 0 0.25rem; font-size: 16px; }
.cfg-links { margin: 0.25rem 0; font-size: 13px; }
</style>
