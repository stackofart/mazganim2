<template>
  <svg class="ac-character" viewBox="0 0 360 190" fill="none" aria-hidden="true" focusable="false">
    <ellipse cx="180" cy="166" rx="140" ry="9" fill="#203d38" opacity=".045" />
    <g class="ac-body" stroke="#203d38" stroke-linecap="round" stroke-linejoin="round">
      <path d="M28 42 330 37 339 129 324 145 29 143 20 128Z" fill="#e8e3d5" stroke-width="1.6" />
      <path d="M20 42Q20 28 36 27L318 25Q332 26 332 40L335 114Q335 126 319 128L36 133Q22 132 21 119Z" fill="#faf6ec" stroke-width="2" />
      <path d="m34 43 281-2M40 51l263-2" opacity=".2" />
      <path d="M27 115q143-8 303-4" stroke-width="1.4" />
      <path d="M42 124q135-6 274-4l-5 20-263 3Z" fill="#203d38" />
      <g class="ac-flap">
        <path d="M41 122q141-5 278-3l-10 27q-135 5-259 0Z" fill="#e8e1d1" stroke-width="1.5" />
        <path d="M53 133q135 1 253-3" opacity=".28" />
      </g>
      <g class="ac-eyelids" stroke-width="2.3">
        <path d="M135 86q8 3 17 1m46 0q8 2 17-1" />
      </g>
      <g class="ac-eyes" fill="#203d38" stroke="none">
        <ellipse cx="147" cy="89" rx="2.5" ry="3.5" />
        <ellipse cx="203" cy="89" rx="2.5" ry="3.5" />
      </g>
      <path d="m269 65 16-.5" opacity=".4" />
      <circle cx="294" cy="65" r="2" fill="#b74a31" stroke="none" />
      <!-- These dust marks stay in every pose: interest is not a cleaning. -->
      <g stroke="#9b9078" opacity=".55">
        <path d="m51 93 4 1m5-10 1 2m-13 13 2 2m25 3 3-1m220-11 3 1m-9 11 1 2m-205 8 3-1" />
        <circle cx="67" cy="93" r=".7" /><circle cx="288" cy="101" r=".6" />
      </g>
    </g>
  </svg>
</template>

<style scoped>
.ac-character { display: block; width: 100%; overflow: visible; }
.ac-body { transform-origin: 180px 85px; transform: translateY(calc(4px - var(--pose, 0) * 4px)) rotate(calc(2deg - var(--pose, 0) * 2deg)); transition: transform 420ms ease; }
.ac-flap { transform-origin: 180px 120px; transform: translateY(calc(5px - var(--pose, 0) * 7px)) rotate(calc(2deg - var(--pose, 0) * 3deg)); transition: transform 420ms ease; }
.ac-eyelids { transform: translateY(calc(var(--pose, 0) * -5px)); transition: transform 420ms ease; }
.ac-eyes { transform: translateY(calc(var(--pose, 0) * -2px)); transition: transform 420ms ease; }
@media (prefers-reduced-motion: reduce) {
  .ac-body, .ac-flap, .ac-eyelids, .ac-eyes { transform: none; transition: none; }
}
</style>
