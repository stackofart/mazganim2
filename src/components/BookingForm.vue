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
  calculatePrice,
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
const price = computed(() => calculatePrice(values.value));
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
  const region = target.closest('.form-field, .quantity-row') || target;
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
      system_type: values.value.type,
      service: values.value.service,
      quantity: Number(values.value.quantity),
    });
    values.value = {
      name: "",
      phone: "",
      city: "",
      type: values.value.type,
      service: values.value.service,
      quantity: values.value.quantity,
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
              service: { type: "string", enum: ["cleaning", "refrigerant"] },
              city: { type: "string", minLength: 1, maxLength: 100 },
              type: {
                type: "string",
                enum: ["wall", "central", "vrf", "unknown"],
              },
              quantity: { type: "integer", minimum: 1, maximum: 10 },
            },
            required: ["city", "type", "quantity"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          async execute(input) {
            if (status.value === "sending")
              throw new Error("Submission in progress");
            if (
              !input ||
              typeof input.city !== "string" ||
              typeof input.quantity !== "number"
            )
              throw new Error(t.value.invalidRequest);
            const staged = { ...values.value, ...input };
            makeRequest(staged, {}, props.locale);
            values.value = staged;
            status.value = "idle";
            await nextTick();
            document
              .getElementById("contact")
              ?.scrollIntoView({ behavior: "instant" });
            return {
              status: "prepared",
              sent: false,
              price: price.value,
              currency: "ILS",
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
              system_type: values.type,
              quantity: values.quantity,
            })
          "
          ><Icon name="chat" :size="19" />WhatsApp</a
        >
        <a :href="company.telegram" class="button telegram-button" target="_blank" rel="noopener noreferrer"
          @click="track('telegram_click', { locale, placement: 'form' })"
          ><Icon name="telegram" :size="19" />Telegram</a>
      </div>
      <p class="form-subtitle">{{ t.formIntro }}</p>
      <label class="form-field">{{ t.serviceLabel }}
        <select v-model="values.service" name="service" :aria-invalid="!!fieldErrors.service" :aria-describedby="fieldErrors.service ? 'service-error' : undefined" @change="track('service_select', { service: values.service, locale })">
          <option value="cleaning">{{ t.serviceOptions[0] }}</option>
          <option value="refrigerant">{{ t.serviceOptions[1] }}</option>
        </select>
        <small v-if="fieldErrors.service" id="service-error" class="field-error" role="alert">{{ fieldErrors.service }}</small>
      </label>
      <div class="form-row">
        <label
          >{{ t.name }} <span>({{ t.optional }})</span
          ><input
            v-model="values.name"
            name="name"
            autocomplete="given-name"
            maxlength="80"
            :placeholder="t.namePlaceholder" /></label
        ><label class="form-field"
          >{{ t.city
          }}<input
            v-model="values.city"
            name="city"
            :aria-invalid="!!fieldErrors.city"
            :aria-describedby="fieldErrors.city ? 'city-error' : undefined"
            autocomplete="address-level2"
            maxlength="100"
            :placeholder="t.cityPlaceholder"
            required
        /><small v-if="fieldErrors.city" id="city-error" class="field-error" role="alert">{{ fieldErrors.city }}</small></label>
      </div>
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
        >{{ t.type
        }}<select v-model="values.type" name="system" :aria-invalid="!!fieldErrors.system" :aria-describedby="fieldErrors.system ? 'system-error' : undefined">
          <option
            v-for="type in t.systemTypes"
            :key="type.value"
            :value="type.value"
          >
            {{ type.label }}
          </option>
        </select><small v-if="fieldErrors.system" id="system-error" class="field-error" role="alert">{{ fieldErrors.system }}</small></label
      >
      <div class="quantity-row">
        <span id="quantity-label">{{ t.quantity }}</span>
        <div
          class="quantity-control"
          role="group"
          aria-labelledby="quantity-label"
        >
          <button
            type="button"
            :aria-label="t.decrease"
            :disabled="values.quantity <= 1"
            @click="values.quantity--"
          >
            −</button
          ><output name="quantity" tabindex="-1" :aria-invalid="!!fieldErrors.quantity" :aria-describedby="fieldErrors.quantity ? 'quantity-error' : undefined" aria-live="polite" :aria-label="t.quantity">{{
            values.quantity
          }}</output
          ><button
            type="button"
            :aria-label="t.increase"
            :disabled="values.quantity >= 10"
            @click="values.quantity++"
          >
            +
          </button>
        </div>
        <small v-if="fieldErrors.quantity" id="quantity-error" class="field-error" role="alert">{{ fieldErrors.quantity }}</small>
      </div>
      <div class="estimate-row" aria-live="polite">
        <span>{{ t.estimate }}</span
        ><strong
          ><bdi v-if="price !== null">{{ price }} ₪</bdi
          ><template v-else>{{ t.quote }}</template></strong
        >
      </div>
      <label
        >{{ t.note }} <span>({{ t.optional }})</span
        ><textarea
          v-model="values.note"
          name="note"
          maxlength="300"
          rows="2"
          :placeholder="t.notePlaceholder"
        ></textarea>
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
