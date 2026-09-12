<script setup>
import { company } from "../data/company.js";
defineProps({ descriptor: { type: String, required: true } });
</script>

<template>
  <img class="brand-mark" src="/images/bird-mark.webp" width="64" height="52" alt="" aria-hidden="true" />
  <span class="brand-copy">
    <span class="brand-name" lang="he" dir="rtl">{{ company.name }}</span>
    <span class="brand-separator" aria-hidden="true"> — </span>
    <span class="brand-descriptor">{{ descriptor }}<span class="brand-dot">.</span></span>
  </span>
</template>
