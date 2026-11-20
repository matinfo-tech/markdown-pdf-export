<script setup lang="ts">
import { ref } from "vue";

const props = withDefaults(defineProps<{ command?: string; size?: "large" | "normal" }>(), {
  command: "npx -y markdown-pdf-export studio",
  size: "normal",
});
const copied = ref(false);

async function copy() {
  try {
    await navigator.clipboard.writeText(props.command);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1600);
  } catch {
    /* clipboard blocked: the text stays selectable */
  }
}
</script>

<template>
  <div class="copy-command" :class="size">
    <code>{{ command }}</code>
    <button type="button" @click="copy" :aria-label="`Copy: ${command}`">
      {{ copied ? "Copied" : "Copy" }}
    </button>
    <span class="sr-only" aria-live="polite">{{ copied ? "Copied to the clipboard" : "" }}</span>
  </div>
</template>

<style scoped>
.copy-command {
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 100%;
  padding: 10px 10px 10px 16px;
  margin: 16px 0;
  border: 1px solid var(--mpe-line);
  border-radius: 8px;
  background: var(--mpe-surface);
}
.copy-command.large {
  padding: 14px 14px 14px 20px;
}
code {
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  white-space: nowrap;
  font-family: var(--vp-font-family-mono);
  font-size: 15px;
  color: var(--mpe-text);
  background: none;
  padding: 0;
}
.large code {
  font-size: 16px;
}
button {
  flex: none;
  padding: 6px 14px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 14px;
  color: #fff;
  background: var(--mpe-accent);
}
button:hover {
  background: var(--mpe-accent-hover);
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
</style>
