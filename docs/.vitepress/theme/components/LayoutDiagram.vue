<script setup lang="ts">
// A small page drawing of a shipped header/footer template (recipes page).
import { computed } from "vue";
import { data as product } from "../data/product.data.mts";
import Sheet from "./Sheet.vue";

const props = defineProps<{ template: string }>();

const mm = (v: unknown, d: number) => {
  const m = /^\s*([\d.]+)\s*mm/.exec(String(v ?? ""));
  return m ? Number(m[1]) : d;
};

const options = computed(() => {
  const t: any = product.templates[props.template] ?? {};
  return {
    html: `<h1>Document title</h1><p>${"Body text of the document. ".repeat(14)}</p><h2>Section</h2><p>${"More text. ".repeat(24)}</p>`,
    look: "clean",
    // At thumbnail size the real 8–10px strip text would be unreadable: enlarge it.
    header: t.header ? { ...t.header, font_size: "22px" } : null,
    footer: t.footer ? { ...t.footer, font_size: "22px" } : null,
    margin: { top: mm(t.margin?.top, 15), bottom: mm(t.margin?.bottom, 15) },
    meta: { title: "Document title", author: "Alex Morgan", pages: 9 },
  };
});
</script>

<template>
  <div class="layout-diagram">
    <Sheet :options="options" :label="`Page with the ${template} template`" />
  </div>
</template>

<style scoped>
.layout-diagram {
  max-width: 340px;
  margin: 16px 0 20px;
}
</style>
