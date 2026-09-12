<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import Icon from "./Icon.vue";
const props = defineProps({ text: { type: Object, required: true }, mood: { type: String, default: "resigned" }, leaving: Boolean });
const quoteIndex = ref(0), paused = ref(false), mounted = ref(false);
const quote = computed(() => props.leaving ? props.text.leaving : props.mood !== "resigned" ? props.text.lines[props.mood] : props.text.quotes[quoteIndex.value]);
let timer;
watch(() => props.text, () => { quoteIndex.value = 0; });
onMounted(() => {
  mounted.value = true;
  timer = window.setInterval(() => {
    if (!paused.value && !document.hidden && props.mood === "resigned" && !props.leaving) {
      quoteIndex.value = (quoteIndex.value + 1) % props.text.quotes.length;
    }
  }, 30_000);
});
onUnmounted(() => window.clearInterval(timer));
</script>

<template>
  <figure class="apartment-scene" :data-mood="mood">
    <div class="scene-stage">
      <img class="scene-art" src="/images/quiet-apartment-open.webp"
        srcset="/images/quiet-apartment-open-768.webp 768w, /images/quiet-apartment-open.webp 1536w"
        sizes="(max-width: 800px) calc(100vw - 40px), (max-width: 1320px) 55vw, 720px"
        width="1536" height="1024" :alt="text.alt" fetchpriority="high" />
    </div>
    <figcaption class="scene-speech">
      <div class="scene-speaker">
        <span><Icon name="ac" :size="18" />{{ text.speaker }}</span>
        <button class="scene-pause" type="button" :disabled="!mounted" :aria-label="paused ? text.resume : text.pause" :title="paused ? text.resume : text.pause" @click="paused = !paused">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path v-if="paused" d="M4 2.5 13 8 4 13.5Z" /><path v-else d="M4 3h3v10H4zM9 3h3v10H9z" /></svg>
        </button>
      </div>
      <div class="scene-quote-slot" aria-live="off"><Transition name="quote"><span :key="quote" class="scene-quote">{{ quote }}</span></Transition></div>
    </figcaption>
  </figure>
</template>

<style scoped>
.apartment-scene { position: relative; width: 100%; min-width: 0; }
.scene-stage { position: relative; aspect-ratio: 3 / 2; direction: ltr; mask-image: linear-gradient(to right, transparent, #000 3%, #000 97%, transparent); }
.scene-stage::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(to bottom, var(--paper), transparent 5%, transparent 94%, var(--paper)); }
.scene-art { display: block; width: 100%; height: auto; }
.scene-speech { position: relative; max-width: 460px; margin: 18px auto 0; padding: 0 20px 15px; border: 1px solid var(--line); border-radius: 12px; background: #fcf8ef; color: var(--ink); text-align: center; }
.scene-speech::before { content: ''; position: absolute; top: -7px; left: 24%; width: 12px; height: 12px; border-top: 1px solid var(--line); border-left: 1px solid var(--line); background: #fcf8ef; transform: rotate(45deg); }
.scene-speaker { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--muted); }
.scene-speaker > span { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 550; }
.scene-pause { display: grid; place-items: center; min-width: 44px; height: 44px; margin-inline-end: -12px; background: transparent; color: var(--muted); border-radius: 50%; }
.scene-pause:hover { color: var(--accent); }
.scene-quote-slot { display: grid; place-items: center; min-height: 3em; font-size: clamp(16px,1.4vw,20px); line-height: 1.5; }
.scene-quote { grid-area: 1 / 1; max-width: 420px; font-weight: 400; text-wrap: balance; }
.scene-quote::before { content: '“'; color: var(--accent); padding-inline-end: 3px; }
.scene-quote::after { content: '”'; color: var(--accent); padding-inline-start: 3px; }
.quote-enter-active, .quote-leave-active { transition: opacity .25s ease; }
.quote-enter-from, .quote-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) { .quote-enter-active, .quote-leave-active { transition: none; } }
@media (max-width:800px) {
  .scene-speech { margin-top: 14px; padding-inline: 16px; }
  .scene-quote-slot { font-size: 16px; }
}
</style>
