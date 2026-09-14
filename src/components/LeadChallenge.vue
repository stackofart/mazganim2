<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
const props = defineProps({ locale: String, unavailable: String, retryLabel: String });
const emit = defineEmits(['token']);
const host = ref(null), failed = ref(false);
let widget, disposed = false, loading = false, observer;
async function loadScript() {
  if (window.turnstile) return;
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    const timer = setTimeout(() => { script.remove(); reject(new Error('timeout')); }, 12000);
    script.onload = () => { clearTimeout(timer); resolve(); };
    script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('unavailable')); };
    document.head.append(script);
  });
}
async function initialize() {
  if (loading || disposed || widget !== undefined) return;
  loading = true; failed.value = false;
  try {
    const result = await fetch('/api/form-config', { credentials: 'omit', signal: AbortSignal.timeout(8000) });
    if (!result.ok) throw new Error('unavailable');
    const { siteKey } = await result.json();
    if (typeof siteKey !== 'string' || !siteKey) throw new Error('unavailable');
    await loadScript();
    if (disposed) return;
    widget = window.turnstile.render(host.value, {
      sitekey: siteKey, action: 'booking', language: props.locale, theme: 'light',
      size: host.value.clientWidth < 300 ? 'compact' : 'flexible',
      'response-field': false,
      callback: token => { failed.value = false; emit('token', token); },
      'expired-callback': () => emit('token', ''),
      'error-callback': () => { failed.value = true; emit('token', ''); },
    });
  } catch { failed.value = true; emit('token', ''); }
  finally { loading = false; }
}
function reset() {
  emit('token', '');
  if (widget !== undefined && window.turnstile) { failed.value = false; window.turnstile.reset(widget); }
  else initialize();
}
defineExpose({ reset });
onMounted(() => {
  // Load only near the form, so the homepage does not depend on the challenge service.
  observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); initialize(); }
  }, { rootMargin: '400px' });
  observer.observe(host.value);
});
onUnmounted(() => {
  disposed = true; observer?.disconnect(); emit('token', '');
  if (widget !== undefined && window.turnstile) window.turnstile.remove(widget);
});
</script>
<template>
  <div class="lead-challenge">
    <div ref="host"></div>
    <p v-if="failed" role="alert" class="field-error">{{ unavailable }}
      <button type="button" class="inline-button" @click="reset">{{ retryLabel }}</button>
    </p>
  </div>
</template>
