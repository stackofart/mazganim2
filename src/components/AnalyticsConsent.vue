<script setup>
import { computed, nextTick, onMounted, ref } from "vue";
import { analyticsClient } from "../analytics.js";
import { contentFor } from "../data/content.js";
const props = defineProps({ locale: { type: String, default: "ru" } });
const emit = defineEmits(["privacy"]);
const t = computed(() => contentFor(props.locale).analytics);
const visible = ref(false), panel = ref(null);
let returnFocus;
onMounted(() => { visible.value = analyticsClient().init() === null; });
async function open() {
  returnFocus = document.activeElement;
  visible.value = true;
  await nextTick();
  panel.value?.focus();
}
function choose(value) {
  analyticsClient().choose(value);
  visible.value = false;
  returnFocus?.focus();
}
defineExpose({ open });
</script>
<template>
  <section v-if="visible" ref="panel" class="analytics-consent" tabindex="-1" aria-labelledby="analytics-title">
    <div>
      <h2 id="analytics-title">{{ t.title }}</h2>
      <p>{{ t.text }} <button class="consent-details" @click="emit('privacy')">{{ t.details }}</button></p>
    </div>
    <div class="consent-actions">
      <button class="button button-secondary" @click="choose('denied')">{{ t.decline }}</button>
      <button class="button" @click="choose('granted')">{{ t.accept }}</button>
    </div>
  </section>
</template>
<style scoped>
.analytics-consent { position: fixed; inset-inline: 16px; inset-block-end: max(16px, env(safe-area-inset-bottom)); z-index: 60; max-width: 920px; margin-inline: auto; display: flex; align-items: center; gap: 24px; padding: 22px 24px; background: var(--paper); color: var(--ink); border: 1px solid #72867a; border-radius: 8px; box-shadow: 0 8px 40px #132e292b; max-height: 85dvh; overflow-y: auto; }
.analytics-consent h2 { font-size: 19px; line-height: 1.3; letter-spacing: 0; margin-bottom: 6px; text-wrap: initial; }
.analytics-consent p { font-size: 14px; line-height: 1.6; }
.consent-details { padding: 0; background: none; color: inherit; text-decoration: underline; text-underline-offset: 3px; }
.consent-actions { display: flex; gap: 12px; flex-shrink: 0; }
.consent-actions .button { min-height: 44px; padding: 12px 16px; font-size: 14px; }
@media (max-width: 760px) {
  .analytics-consent { flex-direction: column; align-items: stretch; gap: 16px; padding: 18px; inset-inline: 12px; }
  .consent-actions .button { flex: 1; }
}
</style>
