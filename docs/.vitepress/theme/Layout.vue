<script setup lang="ts">
// Default layout plus a band that tells readers they are in the Advanced part.
import DefaultTheme from "vitepress/theme";
import { useRoute, withBase } from "vitepress";
import { computed } from "vue";

const route = useRoute();
const advanced = computed(() => /\/(advanced|reference)\//.test(route.path));
</script>

<template>
  <DefaultTheme.Layout>
    <template #doc-before>
      <p v-if="advanced" class="advanced-band">
        Advanced: settings, options and details for people who want full control.
        Most people only need <a :href="withBase('/studio')">Studio</a>.
      </p>
    </template>
  </DefaultTheme.Layout>
</template>
