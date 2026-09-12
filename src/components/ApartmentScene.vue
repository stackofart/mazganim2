<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
const props = defineProps({ text: { type: Object, required: true }, mood: { type: String, default: "resigned" }, leaving: Boolean });
const quoteIndex = ref(0);
const quote = computed(() => props.leaving ? props.text.leaving : props.mood !== "resigned" ? props.text.lines[props.mood] : props.text.quotes[quoteIndex.value]);
let timer;
watch(() => props.text, () => { quoteIndex.value = 0; });
onMounted(() => {
  timer = window.setInterval(() => {
    if (!document.hidden && props.mood === "resigned" && !props.leaving) {
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
      <span class="sr-only">{{ text.speaker }}:</span>
      <div class="scene-quote-slot" aria-live="off"><Transition name="quote"><span :key="quote" class="scene-quote">{{ quote }}</span></Transition></div>
    </figcaption>
  </figure>
</template>

<style scoped>
.apartment-scene { position: relative; width: 100%; min-width: 0; container-type: inline-size; }
.scene-stage { position: relative; aspect-ratio: 3 / 2; direction: ltr; mask-image: linear-gradient(to right, transparent, #000 3%, #000 97%, transparent); }
.scene-stage::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(to bottom, var(--paper), transparent 5%, transparent 94%, var(--paper)); }
.scene-art { display: block; width: 100%; height: auto; }
/* Physical coordinates follow the AC in the unmirrored illustration, including RTL. */
.scene-speech { position: absolute; top: 47%; left: 7%; width: 54%; margin: 0; padding: clamp(9px,2.4cqi,16px) clamp(12px,3.5cqi,24px); border: 1.5px solid var(--ink); border-radius: 45% 42% 44% 40% / 45% 44% 42% 48%; background: #fffaf0; color: var(--ink); text-align: center; box-shadow: 0 3px 0 #203d381a; }
.scene-speech::before { content: ''; position: absolute; top: -10px; left: 55%; width: 18px; height: 18px; border-top: 1.5px solid var(--ink); border-left: 1.5px solid var(--ink); background: #fffaf0; transform: rotate(45deg) skew(8deg,8deg); }
.scene-quote-slot { position: relative; display: grid; place-items: center; min-height: 3em; font-size: clamp(12px,3.6cqi,18px); line-height: 1.4; }
.scene-quote { grid-area: 1 / 1; font-weight: 500; text-wrap: balance; }
.quote-enter-active, .quote-leave-active { transition: opacity .25s ease; }
.quote-enter-from, .quote-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) { .quote-enter-active, .quote-leave-active { transition: none; } }
</style>
