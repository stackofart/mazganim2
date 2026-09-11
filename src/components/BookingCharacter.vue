<script setup>
defineProps({ text: { type: Object, required: true }, mood: { type: String, default: "resigned" }, leaving: Boolean });
</script>

<template>
  <div class="booking-character" :data-mood="mood">
    <p>{{ leaving ? text.leaving : text.lines[mood] }}</p>
  </div>
</template>

<style scoped>
.booking-character { margin: 0 0 24px; padding-bottom: 17px; border-bottom: 1px solid var(--line); }
.booking-character p { font-size: 15px; line-height: 1.5; font-weight: 500; }
</style>
