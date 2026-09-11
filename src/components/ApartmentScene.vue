<script setup>
defineProps({ text: { type: Object, required: true }, mood: { type: String, default: "resigned" }, leaving: Boolean });
</script>

<template>
  <figure class="apartment-scene" :data-mood="mood">
    <div class="scene-stage">
      <img class="scene-art" src="/images/quiet-apartment-natural.webp"
        srcset="/images/quiet-apartment-natural-768.webp 768w, /images/quiet-apartment-natural.webp 1536w"
        sizes="(max-width: 800px) calc(100vw - 40px), (max-width: 1320px) 55vw, 720px"
        width="1536" height="1024" :alt="text.alt" fetchpriority="high" />
    </div>
    <figcaption class="scene-speech">
      <span class="scene-quote">{{ leaving ? text.leaving : text.lines[mood] }}</span>
    </figcaption>
  </figure>
</template>

<style scoped>
.apartment-scene { position: relative; width: 100%; min-width: 0; }
.scene-stage { position: relative; aspect-ratio: 3 / 2; direction: ltr; mask-image: linear-gradient(to right, transparent, #000 3%, #000 97%, transparent); }
.scene-stage::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(to bottom, var(--paper), transparent 5%, transparent 94%, var(--paper)); }
.scene-art { display: block; width: 100%; height: auto; }
.scene-speech { display: flex; justify-content: center; align-items: center; min-height: 64px; padding: 15px 16px 0; color: var(--ink); text-align: center; }
.scene-quote { max-width: 420px; font-size: clamp(16px,1.4vw,20px); line-height: 1.5; font-weight: 400; text-wrap: balance; }
.scene-quote::before { content: '“'; color: var(--accent); padding-inline-end: 3px; }
.scene-quote::after { content: '”'; color: var(--accent); padding-inline-start: 3px; }
@media (max-width:800px) {
  .scene-speech { min-height: 57px; padding: 10px 12px 0; }
  .scene-quote { font-size: 16px; }
}
</style>
