<script setup>
import { onMounted, onUnmounted, ref } from 'vue';

defineProps({ label: { type: String, required: true } });
const emit = defineEmits(['book']);
const bird = ref(null), dock = ref(null), flying = ref(false);
let frame, lastTime = 0, lastScroll = 0, offset = 0, speed = 0;
let reduceMotion, resizeObserver, direction = -1, flightHeight = 180;

function paint() {
  if (!bird.value) return;
  const progress = Math.min(1, -offset / flightHeight);
  // The bird drifts into the page, then returns exactly to its perch.
  const arc = Math.sin(progress * Math.PI) * 36 * direction;
  const tilt = Math.max(-12, Math.min(18, speed * .035)) * -direction;
  bird.value.style.transform = `translate3d(${arc.toFixed(2)}px,${offset.toFixed(2)}px,0) rotate(${tilt.toFixed(2)}deg)`;
}

function settle() {
  cancelAnimationFrame(frame);
  frame = undefined;
  lastTime = 0;
  offset = speed = 0;
  flying.value = false;
  lastScroll = window.scrollY;
  paint();
}

function tick(time) {
  const dt = Math.min((time - (lastTime || time - 16)) / 1000, .032);
  lastTime = time;
  // A damped spring catches up with the fixed button, without a perpetual loop.
  speed += (-offset * 100 - speed * 19) * dt;
  offset += speed * dt;
  offset = Math.min(0, offset);
  if (Math.abs(offset) < .35 && Math.abs(speed) < 3) {
    settle();
    return;
  }
  paint();
  frame = requestAnimationFrame(tick);
}

function onScroll() {
  const current = window.scrollY;
  const delta = current - lastScroll;
  lastScroll = current;
  if (reduceMotion?.matches || document.hidden || Math.abs(delta) < 1) return;
  // Downward scrolling leaves the bird behind in page space. Upward scrolling
  // gives it a smaller takeoff, keeping it above the button and inside the screen.
  offset = Math.max(-flightHeight, offset - Math.abs(delta) * (delta > 0 ? .75 : .35));
  if (offset > -4 && !frame) return;
  flying.value = true;
  if (!frame) {
    lastTime = 0;
    frame = requestAnimationFrame(tick);
  }
}

function onResize() {
  direction = getComputedStyle(dock.value).direction === 'rtl' ? 1 : -1;
  flightHeight = Math.min(200, window.innerHeight * .25);
  settle();
}

onMounted(() => {
  reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  onResize();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize, { passive: true });
  document.addEventListener('visibilitychange', settle);
  reduceMotion.addEventListener('change', settle);
  resizeObserver = new ResizeObserver(onResize);
  resizeObserver.observe(dock.value);
});

onUnmounted(() => {
  cancelAnimationFrame(frame);
  window.removeEventListener('scroll', onScroll);
  window.removeEventListener('resize', onResize);
  document.removeEventListener('visibilitychange', settle);
  reduceMotion?.removeEventListener('change', settle);
  resizeObserver?.disconnect();
});
</script>

<template>
  <div ref="dock" class="booking-dock" :class="{ 'is-flying': flying }">
    <span ref="bird" class="booking-bird" aria-hidden="true">
      <svg class="bird-silhouette" viewBox="0 80 1240 1080" fill="currentColor">
        <!-- The crest, curved neck and long feather shapes follow the existing
             bird logo; separate vector parts allow wings to move independently. -->
        <g class="bird-feet" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round">
          <path d="M713 961 742 1068 723 1100m19-32 19 32h17" />
          <path d="M810 900 816 1068 799 1100m17-32 24 32h17" />
        </g>
        <path class="bird-body" d="M752 529C837 545 900 484 958 515c44 11 50 36 78 49 40 22 56 54 55 84-41-36-78-28-111-4-60 50-82 124-109 182-82 144-209 192-359 233 171-88 263-234 323-329 40-65 85-116 142-145-29-24-60-29-95-23-53 15-97-9-130-33Z" />
        <g class="bird-wing">
          <path d="M52 160C187 330 372 417 576 473c139 47 208 153 150 306-68 194-231 318-472 315 152-66 249-87 323-194-89 19-151-32-193-95 90 18 171-12 241-41-130 32-334 49-424-158 119 59 264 69 351 50-165 28-443-45-474-287 143 121 305 154 411 161C278 484 52 389 52 160Z" />
        </g>
      </svg>
    </span>
    <a class="booking-dock-button" href="#booking-form" @click="emit('book')">
      {{ label }}
    </a>
  </div>
</template>

<style scoped>
.booking-dock { position: fixed; z-index: 25; inset-inline-end: 24px; bottom: max(22px,env(safe-area-inset-bottom)); }
.booking-dock-button { position: relative; display: flex; align-items: center; justify-content: center; gap: 10px; min-height: 52px; max-width: 230px; padding: 15px 24px; border: 1px solid #fff8e099; border-radius: 28px; background: var(--ink); color: var(--paper); box-shadow: 0 5px 20px #152c3426; font-size: 1rem; line-height: 1.35; font-weight: 550; text-align: center; transition: background .2s; }
.booking-dock-button:hover { background: #2c564c; }
.booking-bird { position: absolute; bottom: calc(100% - 4px); inset-inline-end: 17px; display: block; width: 88px; height: 77px; color: var(--ink); pointer-events: none; transform-origin: 64% 94%; filter: drop-shadow(0 1px 0 var(--paper)) drop-shadow(0 -1px 0 var(--paper)); will-change: transform; }
.bird-silhouette { display: block; width: 100%; height: 100%; overflow: visible; }
.bird-wing { transform-origin: 720px 690px; transform: rotate(-46deg) scale(.65); transition: transform .26s ease-out; }
.bird-feet { transform-origin: 790px 925px; transition: transform .2s ease, opacity .2s; }
.is-flying .bird-wing { animation: wingbeat .32s ease-in-out infinite; }
.is-flying .bird-feet { transform: rotate(-30deg) scaleY(.55); opacity: .6; }
@keyframes wingbeat {
  0%,100% { transform: rotate(-8deg) scale(1,.92); }
  50% { transform: rotate(-72deg) scale(.75,.4); }
}
[dir='rtl'] .bird-silhouette { transform: scaleX(-1); }
@media(max-width:600px) {
  .booking-dock { inset-inline-end: 16px; bottom: max(16px,env(safe-area-inset-bottom)); }
  .booking-dock-button { min-height: 48px; padding: 13px 19px; max-width: 190px; font-size: .9375rem; }
  .booking-bird { width: 76px; height: 66px; inset-inline-end: 12px; }
}
@media(prefers-reduced-motion:reduce) {
  .booking-bird { transform: none!important; will-change: auto; }
  .bird-wing,.bird-feet { animation: none!important; transition: none!important; }
}
</style>
