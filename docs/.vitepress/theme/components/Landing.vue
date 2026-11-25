<script setup lang="ts">
// Home page. The hero is a working demo: edit the Markdown, pick a page
// style, the sheet follows. Everything else stays quiet.
import { computed, ref } from "vue";
import { withBase } from "vitepress";
import { data as product } from "../data/product.data.mts";
import { frontMatter, render } from "../lib/markdown";
import Sheet from "./Sheet.vue";
import CopyCommand from "./CopyCommand.vue";

const SOURCE = `---
title: Quarterly report
---

# Quarterly report

Revenue grew for the third quarter in a row.

- Releases: **2**, both on schedule
- Support backlog: down from 41 to 12

| Month  | Revenue |
|--------|--------:|
| July   |  41,200 |
| August |  43,900 |

\`\`\`js
const growth = (a, b) => (b - a) / a;
\`\`\`
`;

const text = ref(SOURCE);
const look = ref("report");

const parsed = computed(() => frontMatter(text.value));
const options = computed(() => ({
  html: render(parsed.value.body),
  look: look.value,
  header: {
    height: "12mm", padding: "0 15mm", font_size: "9px", border_bottom: "1px solid #c9d1d9",
    left_text: "{title}", right_text: "{date}",
  },
  footer: { height: "12mm", padding: "0 15mm", font_size: "9px", center_text: "Page {page} of {pages}" },
  margin: { top: 22, bottom: 20 },
  meta: { title: parsed.value.meta.title || "Document", pages: 9 },
}));

// Same order as the banner, then the other editors. `mono` logos are drawn
// as a mask in the text colour so they work on light and dark pages.
const EDITORS = [
  { name: "VS Code", href: "/editors#vscode", logo: "vs-code" },
  { name: "Copilot", href: "/editors#copilot-cli", logo: "copilot", mono: true },
  { name: "Cursor", href: "/editors#cursor", logo: "cursor", mono: true },
  { name: "Terminal", href: "/editors#terminal", logo: "terminal", mono: true },
  { name: "MCP client", href: "/advanced/assistant-tools", logo: "mcp", mono: true },
  { name: "Claude", href: "/editors#claude-code", logo: "claude" },
  { name: "Zed", href: "/editors#zed", logo: "zed", mono: true },
  { name: "JetBrains", href: "/editors#other", logo: "jetbrains" },
  { name: "Vim", href: "/editors#other", logo: "vim" },
];
const logoSrc = (logo: string) => withBase(`/img/editor-logo/${logo}.svg`);

// The two editor extensions, side by side below the editor tiles.
const VSCODE_URL = "https://marketplace.visualstudio.com/items?itemName=matinfo-tech.markdown-pdf-export";
const OPEN_VSX_URL = "https://open-vsx.org/extension/matinfo-tech/markdown-pdf-export";
const ZED_URL = "https://github.com/matinfo-tech/zed-markdown-pdf-export";
</script>

<template>
  <div class="landing">
    <section class="hero">
      <div>
        <h1>Write Markdown.<br />Get a page worth sending.</h1>
        <p class="lead">
          Turn any Markdown file into a clean PDF with your header, footer, page numbers and logo.
          Pick the look once, then export from your editor, your AI assistant or the terminal.
        </p>
        <CopyCommand size="large" />
        <p class="hint">
          Paste this in a terminal. It opens Studio in your browser, where you design your pages on
          the real PDF. <a :href="withBase('/start')">First time? Three short steps.</a>
        </p>
        <p class="hint">
          Using VS Code?
          <a href="https://marketplace.visualstudio.com/items?itemName=matinfo-tech.markdown-pdf-export" target="_blank" rel="noopener">Install the extension</a>:
          no terminal, no Node.js.
        </p>
        <label class="try" for="demo-source">Or try it here: edit the text, pick a style.</label>
        <textarea id="demo-source" v-model="text" spellcheck="false" rows="12" />
      </div>
      <div>
        <Sheet :options="options" label="Preview of the page" />
        <div class="looks" role="radiogroup" aria-label="Page style">
          <button
            v-for="l in product.looks"
            :key="l.id"
            type="button"
            role="radio"
            :aria-checked="look === l.id"
            :class="{ on: look === l.id }"
            :title="l.description"
            @click="look = l.id"
          >
            {{ l.label }}
          </button>
        </div>
        <p class="note">
          Drawn by your browser.
          <a :href="withBase(`/samples/${look}.pdf`)" target="_blank" rel="noopener">Open the real PDF made with {{ product.looks.find((l) => l.id === look)?.label }}</a>
        </p>
      </div>
    </section>

    <section class="band">
      <h2>Three steps</h2>
      <ol class="steps">
        <li><b>Open Studio</b><span>One line in a terminal. Nothing to install first except Node.js.</span></li>
        <li><b>Pick your look</b><span>Page style, fonts, header and footer, logo. You see the real PDF as you click.</span></li>
        <li><b>Export</b><span>From your editor, by asking your AI assistant, or from the terminal. Every export uses your look.</span></li>
      </ol>
    </section>

    <section class="band">
      <h2>Works where you write</h2>
      <ul class="where">
        <li v-for="e in EDITORS" :key="e.name">
          <a :href="withBase(e.href)">
            <span
              v-if="e.mono"
              class="logo mono"
              :style="{ '--logo': `url(${logoSrc(e.logo)})` }"
              aria-hidden="true"
            />
            <img v-else class="logo" :src="logoSrc(e.logo)" alt="" width="40" height="40" />
            {{ e.name }}
          </a>
        </li>
      </ul>
    </section>

    <section class="band">
      <h2>Made for your editor</h2>
      <p class="lead">Two extensions do the setup for you. Same settings file, same PDFs.</p>
      <div class="exts">
        <article class="ext vscode">
          <header>
            <img class="ext-logo" :src="logoSrc('vs-code')" alt="" width="44" height="44" />
            <div>
              <h3>VS Code</h3>
              <span class="badge">Marketplace · Open VSX</span>
            </div>
          </header>
          <p class="pitch">The real PDF beside your Markdown, as you type.</p>
          <ul class="ticks">
            <li>PDF preview to the side, drawn again as you type</li>
            <li><b>Design pages</b>: Studio inside the editor</li>
            <li>Export with <kbd>⌘K</kbd> <kbd>⌘E</kbd> or one click</li>
            <li>Copilot tools included, no Node.js needed</li>
          </ul>
          <div class="actions">
            <a class="btn primary" :href="VSCODE_URL" target="_blank" rel="noopener">Install from the Marketplace</a>
            <a class="btn" :href="OPEN_VSX_URL" target="_blank" rel="noopener">Open VSX</a>
          </div>
          <a class="details" :href="withBase('/editors#vscode')">What it does, and the setup without it</a>
        </article>

        <article class="ext zed">
          <header>
            <span class="ext-logo mono" :style="{ '--logo': `url(${logoSrc('zed')})` }" aria-hidden="true" />
            <div>
              <h3>Zed</h3>
              <span class="badge">Dev extension · GitHub</span>
            </div>
          </header>
          <p class="pitch">Ask the Agent, get the PDF.</p>
          <ul class="ticks">
            <li>Ask <i>Export this file to PDF</i> in the Agent panel</li>
            <li>Ask it to <i>open Studio</i> and design your pages</li>
            <li>Zed fetches and updates the exporter: no Node.js to install</li>
            <li>Optional <kbd>⌘K</kbd> <kbd>⌘E</kbd> shortcut, no AI needed</li>
          </ul>
          <div class="actions">
            <a class="btn primary" :href="ZED_URL" target="_blank" rel="noopener">Get it on GitHub</a>
            <a class="btn" :href="withBase('/editors#zed')">How to install</a>
          </div>
          <p class="details">Not in Zed's extension list yet: it installs as a dev extension.</p>
        </article>
      </div>
    </section>

    <section class="band">
      <h2>No terminal at hand?</h2>
      <p class="lead">
        <a :href="withBase('/online')">Design your pages online</a> and download the settings file.
        Same choices as Studio, nothing to install.
      </p>
      <p class="more">
        Need more control? Settings, per-document options, custom CSS:
        <a :href="withBase('/advanced/')">Advanced</a>.
      </p>
    </section>
  </div>
</template>

<style scoped>
.hint {
  margin: 0;
  font-size: 15px;
  color: var(--mpe-muted);
}
.try {
  display: block;
  margin: 36px 0 8px;
  font-size: 15px;
  color: var(--mpe-muted);
}
textarea {
  width: 100%;
  padding: 14px 16px;
  border: 1px solid var(--mpe-line);
  border-radius: 8px;
  background: var(--mpe-surface);
  color: var(--mpe-text);
  font-family: var(--vp-font-family-mono);
  font-size: 13.5px;
  line-height: 1.55;
  resize: vertical;
}
textarea:focus {
  border-color: var(--mpe-muted);
}
.looks {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 18px;
}
.looks button {
  padding: 6px 12px;
  border: 1px solid var(--mpe-line);
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
  color: var(--mpe-text);
  background: var(--mpe-surface);
}
.looks button:hover {
  border-color: var(--mpe-muted);
}
.looks button.on {
  border-color: var(--mpe-accent);
  background: color-mix(in srgb, var(--mpe-accent) 16%, var(--mpe-surface));
}
.note {
  margin: 10px 0 0;
  font-size: 13px;
  color: var(--mpe-muted);
}

/* ── the two editor extensions ─────────────────────────────────────────── */
.exts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
  margin-top: 28px;
}
.ext {
  --brand: #0078d4;
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 28px 28px 24px;
  border: 1px solid var(--mpe-line);
  border-radius: 16px;
  overflow: hidden;
  /* a faint wash of the editor's colour in the top corner */
  background:
    radial-gradient(120% 70% at 100% 0%, color-mix(in srgb, var(--brand) 14%, transparent), transparent 60%),
    var(--mpe-surface);
  transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s;
}
.ext.zed {
  --brand: #6b7cff;
}
.ext::before {
  content: "";
  position: absolute;
  inset: 0 0 auto;
  height: 3px;
  background: linear-gradient(90deg, var(--brand), color-mix(in srgb, var(--brand) 20%, transparent));
}
.ext:hover {
  border-color: color-mix(in srgb, var(--brand) 55%, var(--mpe-line));
  transform: translateY(-2px);
  box-shadow: 0 14px 32px -18px color-mix(in srgb, var(--brand) 60%, transparent);
}
.ext header {
  display: flex;
  align-items: center;
  gap: 14px;
}
.ext-logo {
  flex: none;
  width: 44px;
  height: 44px;
  object-fit: contain;
}
.ext-logo.mono {
  background: currentColor;
  -webkit-mask: var(--logo) center / contain no-repeat;
  mask: var(--logo) center / contain no-repeat;
}
.ext h3 {
  margin: 0;
  font-family: var(--mpe-serif);
  font-size: 24px;
  line-height: 1.1;
}
.badge {
  display: inline-block;
  margin-top: 5px;
  padding: 2px 9px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: color-mix(in srgb, var(--brand) 75%, var(--mpe-text));
  background: color-mix(in srgb, var(--brand) 12%, transparent);
}
.pitch {
  margin: 20px 0 14px;
  font-family: var(--mpe-serif);
  font-size: 19px;
  line-height: 1.4;
}
.ticks {
  flex: 1;
  margin: 0 0 22px;
  padding: 0;
  list-style: none;
}
.ticks li {
  position: relative;
  padding-left: 26px;
  margin: 8px 0;
  font-size: 15px;
  line-height: 1.5;
  color: var(--mpe-muted);
}
.ticks li::before {
  content: "";
  position: absolute;
  left: 2px;
  top: 0.45em;
  width: 12px;
  height: 7px;
  border-left: 2px solid var(--brand);
  border-bottom: 2px solid var(--brand);
  transform: rotate(-45deg);
}
.ticks b,
.ticks i {
  color: var(--mpe-text);
}
.ext kbd {
  padding: 1px 6px;
  border: 1px solid var(--mpe-line);
  border-bottom-width: 2px;
  border-radius: 5px;
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  color: var(--mpe-text);
  background: var(--mpe-desk);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.landing .ext .btn {
  display: inline-flex;
  align-items: center;
  padding: 9px 16px;
  border: 1px solid var(--mpe-line);
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--mpe-text);
  background: var(--mpe-desk);
  text-decoration: none;
  transition: border-color 0.15s, background 0.15s;
}
.landing .ext .btn:hover {
  border-color: var(--mpe-muted);
}
.landing .ext .btn.primary {
  border-color: var(--mpe-accent);
  color: #fff;
  background: var(--mpe-accent);
}
.landing .ext .btn.primary:hover {
  border-color: var(--mpe-accent-hover);
  background: var(--mpe-accent-hover);
}
.landing .ext .btn:focus-visible {
  outline: 2px solid var(--mpe-accent);
  outline-offset: 2px;
}
.details {
  margin: 14px 0 0;
  font-size: 13px;
  color: var(--mpe-muted);
}
@media (max-width: 860px) {
  .exts {
    grid-template-columns: 1fr;
  }
  .ext {
    padding: 24px 20px 20px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .ext,
  .landing .ext .btn {
    transition: none;
  }
  .ext:hover {
    transform: none;
  }
}
</style>
