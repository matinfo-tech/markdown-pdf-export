<script setup lang="ts">
// "Pick yours" tabs. The choice is remembered per group and a #hash that
// names a tab opens it (links from the home page use this).
import { onMounted, ref } from "vue";

const props = defineProps<{ group: string; tabs: string }>(); // tabs: "id:Label,id:Label"
const list = props.tabs.split(",").map((t) => {
  const [id, ...rest] = t.split(":");
  return { id: id.trim(), label: rest.join(":").trim() };
});
const current = ref(list[0].id);

function pick(id: string, remember = true) {
  current.value = id;
  if (remember) {
    try {
      localStorage.setItem(`mpe-tab-${props.group}`, id);
    } catch {
      /* private mode */
    }
  }
}

function onKey(e: KeyboardEvent, i: number) {
  const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
  if (!step) return;
  const next = list[(i + step + list.length) % list.length];
  pick(next.id);
  (document.getElementById(`tab-${props.group}-${next.id}`) as HTMLElement | null)?.focus();
}

onMounted(() => {
  const fromHash = location.hash.slice(1);
  if (list.some((t) => t.id === fromHash)) return pick(fromHash, false);
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(`mpe-tab-${props.group}`);
  } catch {
    /* ignore */
  }
  if (saved && list.some((t) => t.id === saved)) pick(saved, false);
});
</script>

<template>
  <div class="pick-tabs">
    <div class="tablist" role="tablist">
      <button
        v-for="(t, i) in list"
        :id="`tab-${group}-${t.id}`"
        :key="t.id"
        type="button"
        role="tab"
        :aria-selected="current === t.id"
        :tabindex="current === t.id ? 0 : -1"
        :class="{ on: current === t.id }"
        @click="pick(t.id)"
        @keydown="onKey($event, i)"
      >
        {{ t.label }}
      </button>
    </div>
    <div v-for="t in list" v-show="current === t.id" :id="t.id" :key="t.id" class="panel" role="tabpanel">
      <slot :name="t.id" />
    </div>
  </div>
</template>

<style scoped>
.pick-tabs {
  margin: 24px 0 32px;
}
.tablist {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 4px;
}
.tablist button {
  padding: 7px 14px;
  border: 1px solid var(--mpe-line);
  border-radius: 999px;
  font-size: 15px;
  font-weight: 600;
  color: var(--mpe-text);
  background: var(--mpe-surface);
}
.tablist button:hover {
  border-color: var(--mpe-muted);
}
.tablist button.on {
  border-color: var(--mpe-accent);
  background: color-mix(in srgb, var(--mpe-accent) 16%, var(--mpe-surface));
}
.panel {
  scroll-margin-top: 96px;
}
</style>
