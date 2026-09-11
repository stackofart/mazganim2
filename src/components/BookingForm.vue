<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
import Icon from "./Icon.vue";
import { company } from "../data/company.js";
import { contentFor } from "../data/content.js";
import {
  readCampaign,
  track,
  makeRequest,
  whatsappUrl,
  calculatePrice,
  sendLead,
} from "../lib.js";
const props = defineProps({ locale: { type: String, default: "ru" } });
const emit = defineEmits(["privacy"]);
const values = defineModel({ required: true });
const t = computed(() => contentFor(props.locale));
const interactive = ref(false),
  ready = ref(false),
  copied = ref(false),
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
const contactUrl = computed(() => whatsappUrl(requestText.value));
let unregister, submission;
watch(
  values,
  () => {
    ready.value = false;
    copied.value = false;
    error.value = "";
  },
  { deep: true, flush: "sync" },
);
function prepareRequest() {
  error.value = "";
  try {
    makeRequest(values.value, {}, props.locale);
    ready.value = true;
    track("lead_prepared", {
      locale: props.locale,
      system_type: values.value.type,
      quantity: Number(values.value.quantity),
    });
    nextTick(() => document.getElementById("request-result")?.focus());
  } catch (e) {
    error.value = e.message;
  }
}
async function copyRequest() {
  try {
    await navigator.clipboard.writeText(requestText.value);
    copied.value = true;
    track("lead_copy", { locale: props.locale });
  } catch {
    error.value = t.value.copyError;
  }
}
async function submit() {
  if (status.value === "sending") return;
  error.value = "";
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
      quantity: Number(values.value.quantity),
    });
    values.value = {
      name: "",
      phone: "",
      city: "",
      type: values.value.type,
      quantity: values.value.quantity,
      note: "",
      website: "",
    };
    await nextTick();
    document.getElementById("form-success")?.focus();
  } catch (e) {
    status.value = "error";
    error.value = e.name === "AbortError" ? t.value.sendError : e.message;
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
              city: { type: "string", minLength: 1, maxLength: 100 },
              type: {
                type: "string",
                enum: ["wall", "multi", "vrf", "unknown"],
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
            ready.value = true;
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
  <form class="booking-form" @submit.prevent="submit">
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
      <p class="form-subtitle">{{ t.formIntro }}</p>
      <div class="form-row">
        <label
          >{{ t.name }} <span>({{ t.optional }})</span
          ><input
            v-model="values.name"
            name="name"
            autocomplete="given-name"
            maxlength="80"
            :placeholder="t.namePlaceholder" /></label
        ><label
          >{{ t.city
          }}<input
            v-model="values.city"
            name="city"
            autocomplete="address-level2"
            maxlength="100"
            :placeholder="t.cityPlaceholder"
            required
        /></label>
      </div>
      <label
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
          aria-describedby="phone-hint"
          required
        /><small id="phone-hint">{{ t.phoneHint }}</small></label
      >
      <label
        >{{ t.type
        }}<select v-model="values.type" name="system">
          <option
            v-for="type in t.systemTypes"
            :key="type.value"
            :value="type.value"
          >
            {{ type.label }}
          </option>
        </select></label
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
          ><output aria-live="polite" :aria-label="t.quantity">{{
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
      <button type="button" class="message-prepare" @click="prepareRequest">
        <Icon name="chat" :size="18" />{{ t.prepare }}
      </button>
      <p v-if="error" role="alert" class="form-error">{{ error }}</p>
      <div
        v-if="ready"
        id="request-result"
        class="request-result"
        tabindex="-1"
      >
        <strong>{{ t.ready }}</strong>
        <pre>{{ requestText }}</pre>
        <a
          v-if="contactUrl"
          :href="contactUrl"
          class="button whatsapp-button"
          target="_blank"
          rel="noopener noreferrer"
          @click="
            track('lead_whatsapp_click', {
              locale,
              system_type: values.type,
              quantity: values.quantity,
            })
          "
          ><Icon name="chat" :size="19" />{{ t.whatsapp }}</a
        >
        <p class="form-note">{{ t.messageNote }}</p>
        <button type="button" class="copy-button" @click="copyRequest">
          <Icon :name="copied ? 'check' : 'copy'" :size="17" />{{
            copied ? t.copied : t.copy
          }}</button
        ><span class="sr-only" role="status">{{ copied ? t.copied : "" }}</span>
      </div>
    </fieldset>
  </form>
</template>
