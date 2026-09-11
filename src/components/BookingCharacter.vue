<script setup>
import AcCharacter from "./AcCharacter.vue";
defineProps({ text: { type: Object, required: true }, mood: { type: String, default: "resigned" }, leaving: Boolean });
</script>

<template>
  <div class="booking-character" :data-mood="mood" :style="{ '--pose': mood === 'ready' ? 1 : mood === 'hopeful' ? .55 : 0 }">
    <AcCharacter />
    <p>{{ leaving ? text.leaving : text.lines[mood] }}</p>
  </div>
</template>

<style scoped>
.booking-character { display: flex; align-items: center; gap: 15px; margin: 0 0 24px; padding-bottom: 17px; border-bottom: 1px solid var(--line); }
.booking-character .ac-character { width: 110px; flex-shrink: 0; }
.booking-character p { font-size: 15px; line-height: 1.5; font-weight: 500; }
@media (max-width:360px) { .booking-character { gap: 10px; } .booking-character .ac-character { width: 85px; } .booking-character p { font-size: 14px; } }
</style>
