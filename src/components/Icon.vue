<script setup>
defineProps({ name: String, size: { type: [Number, String], default: 24 } });
const paths = {
  mountain: ["M2 20 10 5l5 9 3-5 5 11Z", "m7 11 3 2 3-2", "M2 23h21"],
  gauge: ["M4 14a8 8 0 1 1 16 0", "m12 12 4-4", "M3 16h18v5H3z", "M7 18v1m5-1v1m5-1v1"],
  air: [
    "M3 8h12a3 3 0 1 0-3-3",
    "M2 12h17a3 3 0 1 1-3 3",
    "M4 16h5a3 3 0 1 1-3 3",
  ],
  arrow: ["M5 12h14", "m13 6 6 6-6 6"],
  check: ["m5 12 4 4L19 6"],
  shield: ["M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6z", "m8 12 3 3 5-6"],
  drop: [
    "M12 3s-7 8-7 12a7 7 0 0 0 14 0c0-4-7-12-7-12Z",
    "M9 16a3 3 0 0 0 3 3",
  ],
  sparkle: ["m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"],
  ac: [
    "M5 4h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
    "M3 10h18",
    "M7 17v3m5-3v4m5-4v3",
    "M16 7h2",
  ],
  home: ["m3 10 9-7 9 7", "M5 9v12h14V9", "M9 21v-8h6v8"],
  clock: ["M12 8v5l3 2", "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0"],
  phone: [
    "M7 3H4a1 1 0 0 0-1 1c0 10 7 17 17 17a1 1 0 0 0 1-1v-3l-5-2-2 2a15 15 0 0 1-7-7l2-2-2-5Z",
  ],
  chat: [
    "M21 11.5a9 9 0 0 1-13 8L3 21l1.5-5A9 9 0 1 1 21 11.5Z",
    "M8 9c1 3 2 4 5 5l2-1",
  ],
  plus: ["M12 5v14M5 12h14"],
  close: ["m6 6 12 12M6 18 18 6"],
  menu: ["M4 6h16M4 12h16M4 18h16"],
  pin: [
    "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z",
    "M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  ],
  leaf: ["M20 3C8 2 2 8 5 15s15 4 15-12Z", "M4 21 15 10"],
  chevron: ["m6 9 6 6 6-6"],
  copy: ["M9 9h11v12H9z", "M15 6V3H3v12h3"],
  globe: [
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
    "M3 12h18",
    "M12 3c5 5 5 13 0 18-5-5-5-13 0-18",
  ],
};
</script>
<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.65"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path v-for="(d, i) in paths[name] || paths.sparkle" :key="i" :d="d" />
  </svg>
</template>
