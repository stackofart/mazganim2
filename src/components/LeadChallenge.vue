<script setup>
import { ref, onMounted, onUnmounted } from "vue";
const props = defineProps({ locale: { type: String, required: true }, text: { type: Object, required: true } });
const emit = defineEmits(["token"]);
const container = ref(null), state = ref("loading");
let widget, disposed = false;
const controller = new AbortController();

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let script = document.getElementById("lead-turnstile-script");
    const timer = setTimeout(() => { cleanup(); reject(new Error("Timeout")); }, 15000);
    const loaded = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); script?.remove(); reject(new Error("Script unavailable")); };
    function cleanup() {
      clearTimeout(timer);
      script?.removeEventListener("load", loaded);
      script?.removeEventListener("error", failed);
    }
    if (!script) {
      script = document.createElement("script");
      script.id = "lead-turnstile-script";
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.addEventListener("load", loaded);
      script.addEventListener("error", failed);
      document.head.appendChild(script);
    } else {
      script.addEventListener("load", loaded);
      script.addEventListener("error", failed);
    }
  });
}

async function initialize() {
  state.value = "loading";
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch("/api/lead-config", { signal: controller.signal, credentials: "omit" });
    if (!response.ok) throw new Error("Unavailable");
    const { siteKey } = await response.json();
    if (!siteKey) throw new Error("Unavailable");
    await loadTurnstile();
    if (disposed) return;
    widget = window.turnstile.render(container.value, {
      sitekey: siteKey, action: "lead", language: props.locale, size: "compact", theme: "light",
      "response-field": false,
      callback: token => { state.value = "ready"; emit("token", token); },
      "expired-callback": () => { emit("token", ""); window.turnstile.reset(widget); },
      "error-callback": () => { state.value = "error"; emit("token", ""); },
      "timeout-callback": () => { state.value = "error"; emit("token", ""); },
    });
    state.value = "checking";
  } catch { if (!disposed) state.value = "unavailable"; }
  finally { clearTimeout(timer); }
}

function reset() {
  emit("token", "");
  if (widget !== undefined && window.turnstile) {
    state.value = "checking";
    window.turnstile.reset(widget);
  }
}
defineExpose({ reset });
onMounted(initialize);
onUnmounted(() => {
  disposed = true;
  controller.abort();
  emit("token", "");
  if (widget !== undefined) window.turnstile?.remove(widget);
});
</script>

<template>
  <div class="lead-challenge">
    <div ref="container"></div>
    <p v-if="state === 'loading' || state === 'checking'" class="form-note" role="status">{{ text.challengeLoading }}</p>
    <p v-if="state === 'unavailable'" class="form-error" role="alert">{{ text.formUnavailable }}</p>
    <p v-if="state === 'error'" class="form-error" role="alert">
      {{ text.challengeError }}
      <button type="button" class="inline-button" @click="reset">{{ text.challengeRetry }}</button>
    </p>
  </div>
</template>

<style scoped>
.lead-challenge { margin-block: 20px; }
</style>
