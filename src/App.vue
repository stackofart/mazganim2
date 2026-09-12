<script setup>
import { ref, computed, onMounted } from "vue";
import Icon from "./components/Icon.vue";
import BookingForm from "./components/BookingForm.vue";
import ApartmentScene from "./components/ApartmentScene.vue";
import BrandMark from "./components/BrandMark.vue";
import BookingBird from "./components/BookingBird.vue";
import { sceneCopy } from "./data/scene.js";
import { useSceneInteraction } from "./composables/useSceneInteraction.js";
import { company } from "./data/company.js";
import { contentFor, languages, localePath } from "./data/content.js";
import { captureCampaign, track, whatsappUrl } from "./lib.js";
const props = defineProps({ locale: { type: String, default: "ru" } });
const t = computed(() => contentFor(props.locale));
const scene = computed(() => sceneCopy[props.locale] || sceneCopy.ru);
const heroBooking = ref(null);
const heroInteraction = useSceneInteraction(heroBooking);
const direction = computed(() =>
  ["he", "ar"].includes(props.locale) ? "rtl" : "ltr",
);
const menuOpen = ref(false),
  privacyDialog = ref(null),
  shareStatus = ref("");
const booking = ref({
  name: "",
  city: "",
  phone: "",
  service: "cleaning",
  type: "wall",
  quantity: 1,
  note: "",
  website: "",
});
const nav = computed(() =>
  [...["services", "process", "prices", "faq"].map((id, i) => ({
    id,
    label: t.value.nav[i],
  })), { id: "area", label: t.value.areaNav }],
);
const phoneUrl = `tel:${company.phone}`;
const directWhatsapp = computed(() => whatsappUrl(t.value.requestHello));
function startLead() {
  track("lead_start", { locale: props.locale });
  menuOpen.value = false;
}
function switchLanguage(event) {
  location.assign(localePath(event.target.value));
}
async function shareSite() {
  const url = new URL(localePath(props.locale), location.origin);
  url.searchParams.set("utm_source", "referral");
  url.searchParams.set("utm_medium", "share");
  try {
    if (navigator.share)
      await navigator.share({
        title: `${company.name} — ${t.value.pageTitle}`,
        text: t.value.shareText,
        url: url.href,
      });
    else {
      await navigator.clipboard.writeText(url.href);
      shareStatus.value = t.value.shared;
    }
    track("site_share", { locale: props.locale });
  } catch (e) {
    if (e.name !== "AbortError") shareStatus.value = t.value.shareError;
  }
}
onMounted(() => {
  captureCampaign();
  document.documentElement.lang = props.locale;
  document.documentElement.dir = direction.value;
});
</script>
<template>
  <div :dir="direction" :lang="locale" class="site-content">
    <a class="skip-link" href="#main">{{ t.skip }}</a>
    <header class="site-header">
      <div class="container header-inner">
        <a class="brand" :href="localePath(locale)" :aria-label="`${company.name} — ${t.brandDescriptor}`">
          <BrandMark :descriptor="t.brandDescriptor" />
        </a>
        <nav class="desktop-nav" :aria-label="t.menu">
          <a v-for="item in nav" :key="item.id" :href="`#${item.id}`">{{
            item.label
          }}</a>
        </nav>
        <div class="header-actions">
          <label class="language-select"
            ><Icon name="globe" :size="17" /><span class="sr-only">{{
              t.language
            }}</span
            ><select :value="locale" @change="switchLanguage">
              <option
                v-for="lang in languages"
                :key="lang.code"
                :value="lang.code"
              >
                {{ lang.label }}
              </option>
            </select></label
          ><button
            class="menu-button"
            :aria-expanded="menuOpen"
            aria-controls="mobile-nav"
            :aria-label="t.menu"
            @click="menuOpen = !menuOpen"
          >
            <Icon :name="menuOpen ? 'close' : 'menu'" />
          </button>
        </div>
      </div>
      <nav
        v-if="menuOpen"
        id="mobile-nav"
        class="mobile-nav"
        :aria-label="t.menu"
      >
        <a
          v-for="item in nav"
          :key="item.id"
          :href="`#${item.id}`"
          @click="menuOpen = false"
          >{{ item.label }}</a
        >
        <a href="#booking-form" @click="startLead">{{ t.book }}</a>
      </nav>
    </header>
    <main id="main">
      <section class="hero container" @pointermove.passive="heroInteraction.move" @pointerleave="heroInteraction.resetPointer">
        <div class="hero-copy">
          <div class="eyebrow">
            <span class="tiny-line"></span>{{ t.sourceSlogan }}
          </div>
          <h1><span>{{ scene.headline[0] }}</span> <span>{{ scene.headline[1] }}</span></h1>
          <p class="hero-description">{{ scene.intro }}</p>
          <p class="hero-price">{{ scene.price.replace('{price}', company.prices[1]) }}</p>
          <div class="hero-actions">
            <a ref="heroBooking" href="#booking-form" class="button"
              @pointerenter="heroInteraction.enter" @pointerleave="heroInteraction.exit" @focus="heroInteraction.focus" @blur="heroInteraction.blur"
              @click="startLead"
              >{{ t.book }}</a
            ><a href="#prices" class="button button-secondary"
              >{{ t.nav[2] }}</a
            >
          </div>
        </div>
        <ApartmentScene :text="scene" :mood="heroInteraction.pose.value.mood" :leaving="heroInteraction.leaving.value" />
      </section>
      <div class="benefits-wrap">
        <div class="container benefits">
          <div v-for="(benefit, i) in t.benefits" :key="i">
            <Icon :name="['shield', 'ac', 'pin', 'chat'][i]" /><span
              >{{ benefit[0] }}<br /><strong>{{ benefit[1] }}</strong></span
            >
          </div>
        </div>
      </div>
      <section id="services" class="section container">
        <div class="section-heading">
          <div>
            <div class="eyebrow">{{ t.servicesEyebrow }}</div>
            <h2>{{ t.servicesTitle }}</h2>
          </div>
          <p>{{ t.servicesIntro }}</p>
        </div>
        <div class="service-grid">
          <article
            v-for="service in t.services"
            :key="service.id"
            :id="service.id"
            class="service-card"
          >
            <div class="service-top"><span class="service-icon"><Icon :name="service.icon" :size="29" /></span><span class="service-number" aria-hidden="true">0{{ t.services.indexOf(service) + 1 }}</span></div>
            <h3>{{ service.name }}</h3>
            <p>{{ service.text }}</p>
            <ul class="service-points"><li v-for="point in service.details" :key="point"><Icon name="check" :size="15" />{{ point }}</li></ul>
          </article>
        </div>
      </section>
      <section id="process" class="process-section">
        <div class="container">
          <div class="section-heading">
            <div>
              <div class="eyebrow">{{ t.processEyebrow }}</div>
              <h2>{{ t.processTitle }}</h2>
            </div>
            <p>{{ t.processIntro }}</p>
          </div>
          <div class="steps">
            <article v-for="(step, i) in t.steps" :key="i">
              <span class="step-number">0{{ i + 1 }}</span>
              <h3>{{ step[0] }}</h3>
              <p>{{ step[1] }}</p>
            </article>
          </div>
          <a class="text-link process-book" href="#booking-form" @click="startLead">{{ t.book }}<Icon name="arrow" :size="18" /></a>
        </div>
      </section>
      <section id="prices" class="section container price-section">
        <div class="section-heading">
          <div>
            <div class="eyebrow">{{ t.pricingEyebrow }}</div>
            <h2>{{ t.pricingTitle }}</h2>
          </div>
        </div>
        <p class="pricing-intro">{{ t.pricingIntro }}</p>
        <dl class="price-grid">
          <div
            v-for="quantity in [1, 2, 3]"
            :key="quantity"
            class="price-option"
          >
            <dt class="price-label">{{ t.priceLabels[quantity - 1] }}</dt>
            <dd class="price-value"><bdi>{{ company.prices[quantity] }} <span>₪</span></bdi></dd>
          </div>
        </dl>
        <div class="gas-callout"><Icon name="cylinder" :size="36" /><div><h3>{{ t.gasPriceTitle }}</h3><p>{{ t.gasPriceText }}</p></div></div>
        <div class="price-bottom">
          <p>{{ t.priceNote }} {{ t.estimateNote }}</p>
          <a class="text-link" href="#contact" @click="startLead"
            >{{ t.book }}<Icon name="arrow" :size="18"
          /></a>
        </div>
      </section>
      <section id="area" class="area-section">
        <div class="container area-layout">
          <div class="area-copy">
            <div class="eyebrow">{{ t.regionKicker }}</div>
            <h2>{{ t.regionTitle }}</h2>
            <p>{{ t.regionText }}</p>
            <a
              :href="phoneUrl"
              class="text-link"
              @click="track('phone_click', { locale })"
              ><Icon name="phone" :size="18" /><bdi>{{
                company.displayPhone
              }}</bdi></a
            >
          </div>
          <div class="area-cities">
            <div v-for="group in t.cityGroups" :key="group.title" class="city-group">
              <h3>{{ group.title }}</h3>
              <ul class="city-list">
                <li v-for="city in group.cities" :key="city"><Icon name="pin" :size="15" />{{ city }}</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
      <section id="guide" class="section container guide-section">
        <div class="section-heading"><div><div class="eyebrow">{{ t.guideEyebrow }}</div><h2>{{ t.guideTitle }}</h2></div><Icon name="leaf" :size="48" /></div>
        <div class="guide-grid"><article v-for="(guide, i) in t.guides" :key="guide[0]"><span class="guide-index" aria-hidden="true">0{{ i + 1 }}</span><h3>{{ guide[0] }}</h3><p>{{ guide[1] }}</p></article></div>
      </section>
      <section id="faq" class="faq-section container section">
        <div>
          <div class="eyebrow">{{ t.faqEyebrow }}</div>
          <h2>{{ t.faqTitle }}</h2>
          <p>{{ t.faqIntro }}</p>
          <a class="text-link" href="#contact"
            >{{ t.ask }}<Icon name="arrow" :size="18"
          /></a>
        </div>
        <div class="faq-list">
          <details v-for="faq in t.faqs" :key="faq.question">
            <summary>
              {{ faq.question
              }}<span class="faq-plus"><Icon name="plus" :size="18" /></span>
            </summary>
            <p>{{ faq.answer }}</p>
          </details>
        </div>
      </section>
      <section id="contact" class="booking-section">
        <div class="container booking-layout">
          <div class="booking-copy">
            <div class="eyebrow">{{ t.bookingEyebrow }}</div>
            <h2>
              {{ t.bookingTitle[0] }}<br />
              <span>{{ t.bookingTitle[1] }}</span>
            </h2>
            <p>{{ t.bookingIntro }}</p>
            <a
              :href="phoneUrl"
              class="contact-phone"
              @click="track('phone_click', { locale })"
              ><Icon name="phone" :size="20" /><bdi>{{
                company.displayPhone
              }}</bdi></a
            >
            <div class="contact-channels">
              <a
                :href="company.telegram"
                target="_blank"
                rel="noopener noreferrer"
                @click="track('telegram_click', { locale })"
                ><Icon name="telegram" :size="18" />Telegram</a
              ><a
                v-if="directWhatsapp"
                :href="directWhatsapp"
                target="_blank"
                rel="noopener noreferrer"
                @click="track('lead_whatsapp_click', { locale })"
                ><Icon name="chat" :size="18" />WhatsApp</a
              >
            </div>
          </div>
          <BookingForm
            v-model="booking"
            :locale="locale"
            @privacy="privacyDialog.showModal()"
          />
        </div>
      </section>
    </main>
    <footer class="container footer">
      <a class="brand" :href="localePath(locale)"
        ><BrandMark :descriptor="t.brandDescriptor" /></a
      ><span>{{ t.footer }}</span
      ><button class="footer-privacy" @click="privacyDialog.showModal()">
        {{ t.privacyLink }}</button
      ><span>© 2026 <bdi>{{ company.name }}</bdi></span>
      <div class="footer-tools">
        <nav class="footer-languages" :aria-label="t.language">
        <a
          v-for="lang in languages"
          :key="lang.code"
          :href="localePath(lang.code)"
          :lang="lang.code"
          :hreflang="lang.code"
          :aria-current="locale === lang.code ? 'page' : undefined"
          >{{ lang.label }}</a
        >
        </nav>
        <div class="footer-share">
          <button class="share-button" @click="shareSite">
            {{ t.share }}<Icon name="arrow" :size="18" />
          </button>
          <span class="share-status" role="status">{{ shareStatus }}</span>
        </div>
      </div>
    </footer>
    <BookingBird :label="t.book" @book="startLead" />
    <dialog
      ref="privacyDialog"
      class="detail-dialog"
      @click="(e) => e.target === privacyDialog && privacyDialog.close()"
      aria-labelledby="privacy-title"
    >
      <div class="dialog-content">
        <button
          class="dialog-close"
          :aria-label="t.close"
          @click="privacyDialog.close()"
        >
          <Icon name="close" />
        </button>
        <h2 id="privacy-title">{{ t.privacyTitle }}</h2>
        <p v-for="paragraph in t.privacyText" :key="paragraph">
          {{ paragraph }}
        </p>
        <button class="button" @click="privacyDialog.close()">
          {{ t.understood }}
        </button>
      </div>
    </dialog>
  </div>
</template>
