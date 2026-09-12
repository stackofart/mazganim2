<script setup>
import { onMounted, onUnmounted, ref, useId } from 'vue';

defineProps({ label: { type: String, required: true } });
const emit = defineEmits(['book']);
const bird = ref(null), dock = ref(null), flying = ref(false), onDark = ref(false);
const silhouetteId = useId();
const wingClipId = `${silhouetteId}-wing`;
const bodyClipId = `${silhouetteId}-body`;
const birdMaskId = `${silhouetteId}-mask`;
let contrastTime = 0;

function updateContrast(time = 0) {
  if (!bird.value || (time && time - contrastTime < 64)) return;
  contrastTime = time;
  const rect = bird.value.getBoundingClientRect();
  // Sample beneath the actual flying silhouette, including inside the light form.
  // The decorative bird ignores hit testing, so it cannot sample itself.
  let element = document.elementFromPoint(
    Math.max(0, Math.min(window.innerWidth - 1, rect.left + rect.width * .65)),
    Math.max(0, Math.min(window.innerHeight - 1, rect.top + rect.height * .6)),
  );
  while (element) {
    const channels = getComputedStyle(element).backgroundColor.match(/[\d.]+/g)?.map(Number);
    if (channels?.length >= 3 && (channels[3] ?? 1) > .85) {
      const [r, g, b] = channels;
      onDark.value = (r * .2126 + g * .7152 + b * .0722) < 140;
      return;
    }
    element = element.parentElement;
  }
  onDark.value = false;
}
let frame, lastTime = 0, lastScroll = 0, offset = 0, speed = 0;
let reduceMotion, resizeObserver, direction = -1, flightHeight = 180;

function paint() {
  if (!bird.value) return;
  const progress = Math.min(1, -offset / flightHeight);
  // The bird drifts into the page, then returns exactly to its perch.
  const arc = Math.sin(progress * Math.PI) * 36 * direction;
  const tilt = Math.max(-12, Math.min(18, speed * .035)) * -direction;
  bird.value.style.transform = `translate3d(${arc.toFixed(2)}px,${offset.toFixed(2)}px,0) rotate(${tilt.toFixed(2)}deg)`;
  // Ease the wingbeat back to the exact logo shape and lower the feet as the
  // bird approaches the button, rather than snapping to a seated pose.
  bird.value.style.setProperty('--airborne', Math.min(1, -offset / 55).toFixed(3));
}

function settle() {
  cancelAnimationFrame(frame);
  frame = undefined;
  lastTime = 0;
  offset = speed = 0;
  flying.value = false;
  lastScroll = window.scrollY;
  paint();
  updateContrast();
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
  updateContrast(time);
  paint();
  frame = requestAnimationFrame(tick);
}

function onScroll() {
  const current = window.scrollY;
  const delta = current - lastScroll;
  lastScroll = current;
  if (reduceMotion?.matches) {
    updateContrast();
    return;
  }
  if (document.hidden || Math.abs(delta) < 1) return;
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
  <div ref="dock" class="booking-dock" :class="{ 'is-flying': flying, 'is-on-dark': onDark }">
    <span ref="bird" class="booking-bird" aria-hidden="true">
      <svg class="bird-silhouette" viewBox="0 120 1160 1160">
        <defs>
          <!-- Extract the green bird from the actual logo. The terracotta sun
               has R > G and is excluded; SourceAlpha preserves the exact edges. -->
          <filter :id="silhouetteId" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
            <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -10 10 0 0 0" result="green" />
            <feComposite in="green" in2="SourceAlpha" operator="in" result="bird-alpha" />
            <!-- Keep filter output independent of inherited color: WebKit can
                 retain the old filtered pixels when only currentColor changes. -->
            <feFlood flood-color="#ffffff" />
            <feComposite in2="bird-alpha" operator="in" />
          </filter>
          <!-- This seam follows the transparent gap in the original logo.
               Both pieces retain the original pixels and reunite at rest. -->
          <clipPath :id="wingClipId" clipPathUnits="userSpaceOnUse">
            <path d="M0 0H740V520L750 560 780 600 810 640 798 680 781 720 762 760 742 800 717 840 693 880 663 920 625 960 577 1000 515 1040 450 1080V1280H0Z" />
          </clipPath>
          <clipPath :id="bodyClipId" clipPathUnits="userSpaceOnUse">
            <path d="M740 0H1280V1280H450V1080L515 1040 577 1000 625 960 663 920 693 880 717 840 742 800 762 760 781 720 798 680 810 640 780 600 750 560 740 520Z" />
          </clipPath>
          <mask :id="birdMaskId" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" width="1280" height="1280" mask-type="alpha">
            <image href="/images/bird-mark.webp" width="1280" height="1280" :filter="'url(#' + silhouetteId + ')'" />
          </mask>
        </defs>
        <g class="bird-feet" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round">
          <path class="bird-foot bird-foot-back" d="M745 920 752 1045 721 1209m0 0-21 25m21-25 17 25h18" />
          <path class="bird-foot bird-foot-front" d="M805 880 826 1045 826 1209m0 0-20 25m20-25 18 25h18" />
        </g>
        <g class="bird-wing">
          <g :clip-path="'url(#' + wingClipId + ')'">
            <rect class="bird-paint" width="1280" height="1280" fill="currentColor" :mask="'url(#' + birdMaskId + ')'" />
          </g>
        </g>
        <g :clip-path="'url(#' + bodyClipId + ')'">
          <rect class="bird-paint" width="1280" height="1280" fill="currentColor" :mask="'url(#' + birdMaskId + ')'" />
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
.booking-bird { --airborne: 0; position: absolute; bottom: calc(100% - 4px); inset-inline-end: 17px; display: block; width: 96px; height: 96px; color: var(--ink); pointer-events: none; transform-origin: 64% 94%; filter: drop-shadow(0 1px 1px #152c3426); will-change: transform; }
.bird-silhouette { display: block; width: 100%; height: 100%; overflow: visible; }
.is-on-dark .booking-bird { color: var(--paper); }
.bird-wing { transform-origin: 690px 750px; }
.is-flying .bird-wing { animation: bird-wingbeat .38s ease-in-out infinite; }
.bird-foot { transform: rotate(calc(32deg * var(--airborne))) scaleY(calc(1 - .5 * var(--airborne))); }
.bird-foot-back { transform-origin: 745px 920px; }
.bird-foot-front { transform-origin: 805px 880px; }
@keyframes bird-wingbeat {
  0%,100% { transform: none; }
  50% { transform: rotate(calc(-50deg * var(--airborne))) scale(calc(1 - .1 * var(--airborne)),calc(1 - .45 * var(--airborne))); }
}
@media(max-width:600px) {
  .booking-dock { inset-inline-end: 16px; bottom: max(16px,env(safe-area-inset-bottom)); }
  .booking-dock-button { min-height: 48px; padding: 13px 19px; max-width: 190px; font-size: .9375rem; }
  .booking-bird { width: 84px; height: 84px; inset-inline-end: 12px; }
}
@media(prefers-reduced-motion:reduce) {
  .booking-bird { transform: none!important; will-change: auto; }
  .bird-wing { animation: none!important; }
  .bird-foot { transform: none!important; }
}
</style>
