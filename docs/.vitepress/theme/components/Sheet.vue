<script setup lang="ts">
// One white page, drawn in an isolated iframe and scaled to the box it sits in.
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { data as product } from "../data/product.data.mts";
import { PX_PER_MM, pageSize, sheetDocument, type SheetOptions } from "../lib/sheet";

const props = defineProps<{ options: SheetOptions; label?: string }>();

const box = ref<HTMLElement | null>(null);
const width = ref(0);
const doc = ref("");
const fading = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;
let observer: ResizeObserver | undefined;

const size = computed(() => pageSize(props.options.format, props.options.orientation));
const scale = computed(() => (width.value ? width.value / (size.value[0] * PX_PER_MM) : 0));

watch(
  () => props.options,
  (now, before) => {
    clearTimeout(timer);
    // The one animation on the site: the page fades when its style changes.
    if (before && (now.look !== before.look || now.font !== before.font)) {
      fading.value = true;
      setTimeout(() => (fading.value = false), 220);
    }
    timer = setTimeout(() => (doc.value = sheetDocument(product, props.options)), before ? 120 : 0);
  },
  { deep: true, immediate: true },
);

onMounted(() => {
  observer = new ResizeObserver(([entry]) => (width.value = entry.contentRect.width));
  if (box.value) observer.observe(box.value);
});
onBeforeUnmount(() => {
  observer?.disconnect();
  clearTimeout(timer);
});
</script>

<template>
  <figure class="sheet" :class="{ fading }">
    <div ref="box" class="sheet-box" :style="{ aspectRatio: `${size[0]} / ${size[1]}` }">
      <iframe
        v-if="scale"
        :srcdoc="doc"
        :title="label ?? 'Page preview'"
        tabindex="-1"
        :style="{
          width: `${size[0] * PX_PER_MM}px`,
          height: `${size[1] * PX_PER_MM}px`,
          transform: `scale(${scale})`,
        }"
      />
    </div>
  </figure>
</template>

<style scoped>
.sheet {
  margin: 0;
}
.sheet-box {
  position: relative;
  width: 100%;
  overflow: hidden;
  background: #fff;
  border-radius: 2px;
  box-shadow: var(--sheet-shadow);
  transition: opacity 0.22s ease;
}
.sheet.fading .sheet-box {
  opacity: 0.35;
}
iframe {
  position: absolute;
  top: 0;
  left: 0;
  border: 0;
  transform-origin: 0 0;
  pointer-events: none;
}
@media (prefers-reduced-motion: reduce) {
  .sheet-box {
    transition: none;
  }
}
</style>
