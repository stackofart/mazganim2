<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
import Icon from "./Icon.vue";
import { contentFor } from "../data/content.js";
import { company } from "../data/company.js";
import {
  readCampaign,
  track,
  makeRequest,
  whatsappUrl,
  sendLead,
  validateLead,
} from "../lib.js";
const props = defineProps({ locale: { type: String, default: "ru" } });
const emit = defineEmits(["privacy"]);
const values = defineModel({ required: true });
const t = computed(() => contentFor(props.locale));
const form = ref(null), fieldErrors = ref({});
const interactive = ref(false),
  error = ref(""),
  status = ref("idle");
const requestText = computed(() => {
  try {
    return makeRequest(values.value, readCampaign(), props.locale);
  } catch {
    return "";
  }
});
const contactUrl = computed(() => whatsappUrl(requestText.value || t.value.requestHello));
let unregister, submission;
watch(
  values,
  () => {
    error.value = "";
    const current = validateLead(values.value, props.locale);
    fieldErrors.value = Object.fromEntries(Object.keys(fieldErrors.value)
      .filter(key => current[key]).map(key => [key, current[key]]));
  },
  { deep: true, flush: "sync" },
);
async function revealError(field) {
  await nextTick();
  const target = field ? form.value?.querySelector(`[name="${field}"]`) : form.value?.querySelector('.form-error');
  if (!target) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  target.focus({ preventScroll: true });
  const region = target.closest('.form-field') || target;
  region.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'instant' : 'smooth' });
  if (field && !reducedMotion) {
    region.getAnimations().forEach(animation => animation.cancel());
    region.animate([0, -6, 6, -4, 4, 0].map(x => ({ transform: `translateX(${x}px)` })),
      { duration: 420, delay: 250, easing: 'ease-in-out' });
  }
}
async function submit() {
  if (status.value === "sending") return;
  error.value = "";
  fieldErrors.value = validateLead(values.value, props.locale);
  const firstInvalid = Object.keys(fieldErrors.value)[0];
  if (firstInvalid) {
    await revealError(firstInvalid);
    return;
  }
  status.value = "sending";
  submission = new AbortController();
  const timer = setTimeout(() => submission.abort(), 15000);
  try {
    await sendLead(values.value, {
      locale: props.locale,
      campaign: readCampaign(),
      signal: submission.signal,
    });
    status.value = "success";
    track("lead_submitted", {
      locale: props.locale,
    });
    values.value = {
      name: "",
      phone: "",
      note: "",
      website: "",
    };
    await nextTick();
    document.getElementById("form-success")?.focus();
  } catch (e) {
    status.value = "error";
    if (e.fieldErrors) {
      fieldErrors.value = e.fieldErrors;
      await revealError(Object.keys(e.fieldErrors)[0]);
    } else {
      error.value = t.value.sendError;
      await revealError();
    }
  } finally {
    clearTimeout(timer);
    submission = undefined;
  }
}
onMounted(() => {
  interactive.value = true;
  if (!document.modelContext?.registerTool) return;
  const controller = new AbortController();
  unregister = () => controller.abort();
  try {
    Promise.resolve(
      document.modelContext.registerTool(
        {
          name: "prepare_cleaning_request",
          title: t.value.prepare,
          description:
            "Prepare the visible AC cleaning form and message. Does not submit data or confirm a booking.",
          inputSchema: {
            type: "object",
            properties: {
              name: { type: "string", minLength: 1, maxLength: 80 },
              phone: { type: "string", minLength: 1, maxLength: 22 },
              note: { type: "string", maxLength: 300 },
            },
            required: ["name", "phone"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          async execute(input) {
            if (status.value === "sending")
              throw new Error("Submission in progress");
            if (!input || typeof input.name !== "string" || typeof input.phone !== "string" ||
              (input.note !== undefined && typeof input.note !== "string"))
              throw new Error(t.value.invalidRequest);
            const staged = { ...values.value, name: input.name, phone: input.phone, note: input.note ?? "" };
            const errors = validateLead(staged, props.locale);
            if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
            values.value = staged;
            status.value = "idle";
            await nextTick();
            document
              .getElementById("contact")
              ?.scrollIntoView({ behavior: "instant" });
            return {
              status: "prepared",
              sent: false,
              message: requestText.value,
            };
          },
        },
        { signal: controller.signal },
      ),
    ).catch(() => {});
  } catch {}
});
onUnmounted(() => {
  unregister?.();
  submission?.abort();
});
</script>
<template>
  <form ref="form" id="booking-form" class="booking-form" novalidate @submit.prevent="submit">
    <div
      v-if="status === 'success'"
      id="form-success"
      class="form-success"
      tabindex="-1"
      role="status"
    >
      <span class="service-icon"><Icon name="check" :size="28" /></span>
      <h3>{{ t.sent }}</h3>
      <p>{{ t.sentNote }}</p>
      <button type="button" class="button" @click="status = 'idle'">
        {{ t.sendAnother }}
      </button>
    </div>
    <fieldset
      v-else
      class="form-fields"
      :disabled="!interactive || status === 'sending'"
    >
      <h3>{{ t.formTitle }}</h3>
      <div class="messenger-buttons">
        <a
          v-if="contactUrl"
          :href="contactUrl"
          class="button whatsapp-button"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="t.whatsappCta"
          @click="
            track('lead_whatsapp_click', {
              locale,
              placement: 'form',
            })
          "
          ><Icon name="chat" :size="19" />WhatsApp</a
        >
        <a :href="company.telegram" class="button telegram-button" target="_blank" rel="noopener noreferrer"
          @click="track('telegram_click', { locale, placement: 'form' })"
          ><Icon name="telegram" :size="19" />Telegram</a>
      </div>
      <p class="form-subtitle">{{ t.formIntro }}</p>
      <label class="form-field">
        {{ t.name }}
        <input
          v-model="values.name"
          name="name"
          autocomplete="name"
          maxlength="80"
          :placeholder="t.namePlaceholder"
          :aria-invalid="!!fieldErrors.name"
          :aria-describedby="fieldErrors.name ? 'name-error' : undefined"
          required
        />
        <small v-if="fieldErrors.name" id="name-error" class="field-error" role="alert">{{ fieldErrors.name }}</small>
      </label>
      <label class="form-field"
        >{{ t.phone
        }}<input
          v-model="values.phone"
          name="phone"
          type="tel"
          inputmode="tel"
          autocomplete="tel"
          dir="ltr"
          maxlength="22"
          placeholder="054-123-4567"
          :aria-invalid="!!fieldErrors.phone"
          :aria-describedby="fieldErrors.phone ? 'phone-error' : 'phone-hint'"
          required
        /><small v-if="fieldErrors.phone" id="phone-error" class="field-error" role="alert">{{ fieldErrors.phone }}</small>
        <small v-else id="phone-hint">{{ t.phoneHint }}</small></label
      >
      <label class="form-field"
        >{{ t.note }} <span>({{ t.optional }})</span
        ><textarea
          v-model="values.note"
          name="note"
          maxlength="300"
          rows="2"
          :placeholder="t.notePlaceholder"
          :aria-invalid="!!fieldErrors.note"
          :aria-describedby="fieldErrors.note ? 'note-error' : undefined"
        ></textarea>
        <small v-if="fieldErrors.note" id="note-error" class="field-error" role="alert">{{ fieldErrors.note }}</small>
      </label>
      <label class="honeypot" aria-hidden="true"
        >Website<input
          v-model="values.website"
          name="_gotcha"
          tabindex="-1"
          autocomplete="off"
      /></label>
      <button
        type="submit"
        class="button form-submit"
        :disabled="status === 'sending'"
      >
        {{ status === "sending" ? t.sending : t.send
        }}<Icon name="arrow" :size="18" />
      </button>
      <p class="form-note">
        {{ t.formNote }}
        <button type="button" class="inline-button" @click="emit('privacy')">
          {{ t.privacy }}
        </button>
      </p>
      <p v-if="error" role="alert" tabindex="-1" class="form-error">{{ error }}</p>
    </fieldset>
  </form>
</template>
