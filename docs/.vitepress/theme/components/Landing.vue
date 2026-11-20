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

const EDITORS = [
  ["VS Code", "vscode"], ["Zed", "zed"], ["Cursor", "cursor"], ["Claude", "claude-code"],
  ["JetBrains and Vim", "other"], ["Terminal", "terminal"],
];
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
        <li v-for="[name, id] in EDITORS" :key="id">
          <a :href="withBase(`/editors#${id}`)">{{ name }}</a>
        </li>
      </ul>
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
</style>
