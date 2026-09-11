<script setup>
import AcCharacter from "./AcCharacter.vue";
defineProps({ text: { type: Object, required: true }, mood: { type: String, default: "resigned" }, anticipation: { type: Number, default: 0 }, leaving: Boolean });
</script>

<template>
  <figure class="apartment-scene" :data-mood="mood" :style="{ '--pose': anticipation }">
    <svg class="apartment-window" viewBox="0 0 620 500" fill="none" role="img" :aria-label="text.alt">
      <g stroke="#203d38" stroke-linejoin="round" stroke-linecap="round">
        <!-- An open window, warm rooftops and solar water heaters. -->
        <path d="M348 105h224v293H348Z" fill="#e9e4d5" stroke-width="1.6" />
        <path d="M359 115h203v270H359Z" fill="#dedfcb" stroke-width="1" />
        <circle cx="509" cy="175" r="37" fill="#b74a31" stroke="none" />
        <path d="M359 296h37v-22h57v40h40v-48h45v33h24v86H359Z" fill="#d3c4a5" stroke="none" />
        <path d="M358 323h24v-24h57v86h-81ZM476 311h58v74h-58Z" fill="#f6f1e5" stroke-width="1.1" />
        <path d="M400 299v-12h19v12m-27-12h33m-17-12h15v8h-15Zm88 36v-12h21v12m-21-13 7-9h20l-7 9Z" stroke-width="1.1" />
        <path d="M396 320h10v15h-10Zm23 0h9v15h-9Zm-23 28h10v15h-10Zm98-17h11v16h-11Zm21 0h9v16h-9Z" fill="#203d38" opacity=".65" stroke="none" />
        <path d="m359 115 45 22v245l-45 3Z" fill="#f6f1e5" stroke-width="1.5" />
        <path d="m366 132 29 14v99l-29-6Zm0 120 29 4v114l-29 3Z" fill="#e8e8d9" stroke-width="1" />
        <path d="m387 256 6 1v13" stroke-width="2" />
        <path d="M343 385h234v13H343Z" fill="#eee7d7" stroke-width="1.5" />
        <path d="m343 398 12 8h235l-13-8" opacity=".25" />
        <path d="M563 122v254M349 104l-9-8m229 5 8-6" opacity=".25" />
        <!-- The bird listens; its head and wing have separate pivots. -->
        <g class="scene-bird">
          <path d="m450 357-29 15 15-28Z" fill="#203d38" stroke-width="1.5" />
          <path d="M441 346q-1-26 23-28 29 1 29 28-4 26-28 26-20-1-24-26Z" fill="#203d38" stroke-width="1.5" />
          <path d="m457 368-3 17m19-17 3 17m-28 0h11m11 0h11" stroke-width="1.7" />
          <g class="bird-head">
            <path d="M455 326q-12-23 9-30 22-5 24 17l-3 18" fill="#203d38" stroke-width="1.5" />
            <path d="m456 309-12 5 14 3" fill="#b74a31" stroke="#b74a31" />
            <circle cx="465" cy="308" r="2.2" fill="#f6f1e5" stroke="none" />
          </g>
          <path class="bird-wing" d="M477 331q-26 0-26 26 20 5 34-12" fill="#416452" stroke="#83947b" stroke-width="1.1" />
          <path d="m458 348 9-5m-10 11 16-8" stroke="#99a28c" stroke-width=".8" opacity=".5" />
        </g>
        <path d="M56 410h204m-173 7h66" stroke="#b4b8a7" stroke-width="1" />
      </g>
    </svg>
    <AcCharacter class="apartment-ac" />
    <figcaption class="scene-speech">
      <span class="scene-quote">{{ leaving ? text.leaving : text.lines[mood] }}</span>
    </figcaption>
  </figure>
</template>

<style scoped>
.apartment-scene { position: relative; width: 100%; min-width: 0; aspect-ratio: 620 / 500; direction: ltr; }
.apartment-window { width: 100%; height: auto; display: block; overflow: visible; }
.apartment-ac { position: absolute; width: 60%; left: 0; top: 35%; }
.scene-speech { position: absolute; width: 53%; top: 6%; left: 4%; color: var(--ink); text-align: start; direction: inherit; }
.scene-quote { display: block; max-width: 290px; font-size: clamp(20px,2.1vw,29px); line-height: 1.35; font-weight: 500; text-wrap: balance; }
.scene-quote::after { content: ''; display: block; width: 24px; height: 22px; margin-top: 13px; margin-inline-start: 30px; border-inline-start: 1px solid #9b9f8e; transform: skew(-20deg); }
.bird-head { transform-origin: 470px 325px; transform: rotate(calc(-14deg + var(--pose, 0) * 26deg)); transition: transform 420ms ease; }
.bird-wing { transform-origin: 478px 333px; transform: rotate(calc(var(--pose, 0) * 18deg)); transition: transform 420ms ease; }
.scene-bird { transform: translateY(calc(var(--pose, 0) * -3px)); transition: transform 420ms ease; }
.apartment-scene[data-mood='ready'] .bird-wing { transform: rotate(48deg); }
:global([dir='rtl']) .scene-speech { direction: rtl; }
@media (max-width:800px) {
  .scene-speech { width: 60%; }
  .scene-quote { font-size: clamp(18px,4.4vw,28px); }
  .scene-quote::after { display: none; }
}
@media (prefers-reduced-motion:reduce) {
  .bird-head, .bird-wing, .scene-bird, .apartment-scene[data-mood='ready'] .bird-wing { transform: none; transition: none; }
}
</style>
