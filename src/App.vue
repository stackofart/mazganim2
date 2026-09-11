<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from "vue";
import Icon from "./components/Icon.vue";
import { company } from "./data/company.js";
import { services, systemTypes, faqs } from "./data/content.js";
import {
  captureCampaign,
  readCampaign,
  track,
  makeRequest,
  whatsappUrl,
} from "./lib.js";
const menuOpen = ref(false);
const interactive = ref(false);
const detailDialog = ref(null);
const privacyDialog = ref(null);
const selectedService = ref(services[0]);
const values = reactive({
  name: "",
  city: "",
  type: "wall",
  quantity: 1,
  note: "",
});
const ready = ref(false);
const error = ref("");
const copied = ref(false);
const shareStatus = ref("");
const requestText = computed(() => {
  try {
    return makeRequest(values, readCampaign());
  } catch {
    return "";
  }
});
const contactUrl = computed(() => whatsappUrl(requestText.value));
const phoneUrl = computed(() =>
  company.phone ? `tel:${company.phone.replace(/[^+\d]/g, "")}` : "",
);
let unregister;
function openService(service) {
  selectedService.value = service;
  detailDialog.value.showModal();
  track("service_view", { service: service.id });
}
function startLead() {
  track("lead_start");
  menuOpen.value = false;
}
function prepareRequest() {
  error.value = "";
  copied.value = false;
  try {
    makeRequest(values);
    ready.value = true;
    track("lead_prepared", {
      system_type: values.type,
      quantity: Number(values.quantity),
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
    track("lead_copy");
  } catch {
    error.value =
      "Не удалось скопировать автоматически. Выделите и скопируйте текст запроса ниже.";
  }
}
async function shareSite() {
  const url = new URL("/", location.origin);
  url.searchParams.set("utm_source", "referral");
  url.searchParams.set("utm_medium", "share");
  try {
    if (navigator.share)
      await navigator.share({
        title: "Mazganim — чистка кондиционеров",
        text: "Забота о чистом воздухе дома.",
        url: url.href,
      });
    else {
      await navigator.clipboard.writeText(url.href);
      shareStatus.value = "Ссылка скопирована";
    }
    track("site_share");
  } catch (e) {
    if (e.name !== "AbortError")
      shareStatus.value = "Скопируйте ссылку из адресной строки.";
  }
}
onMounted(() => {
  interactive.value = true;
  captureCampaign();
  const context = document.modelContext;
  if (context?.registerTool) {
    const controller = new AbortController();
    unregister = () => controller.abort();
    try {
      Promise.resolve(
        context.registerTool(
          {
            name: "prepare_cleaning_request",
            title: "Подготовить запрос на чистку",
            description:
              "Заполняет видимую форму и готовит текст запроса. Ничего не отправляет и не подтверждает запись.",
            inputSchema: {
              type: "object",
              properties: {
                city: { type: "string" },
                type: { type: "string", enum: systemTypes.map((t) => t.value) },
                quantity: { type: "integer", minimum: 1, maximum: 10 },
              },
              required: ["city", "type", "quantity"],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false, untrustedContentHint: false },
            async execute(input) {
              if (
                !input ||
                typeof input.city !== "string" ||
                input.city.trim().length > 100 ||
                typeof input.quantity !== "number"
              )
                throw new Error("Некорректные параметры запроса.");
              const staged = {
                ...values,
                city: input.city,
                type: input.type,
                quantity: input.quantity,
              };
              makeRequest(staged);
              Object.assign(values, staged);
              ready.value = true;
              copied.value = false;
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
    } catch {
      /* Optional progressive enhancement. */
    }
  }
});
onUnmounted(() => unregister?.());
</script>

<template>
  <a class="skip-link" href="#main">Перейти к содержимому</a>
  <header class="site-header">
    <div class="container header-inner">
      <a class="brand" href="/" aria-label="Mazganim — главная"
        ><span class="brand-mark"><Icon name="air" :size="29" /></span
        ><span>mazganim<span class="brand-dot">.</span></span></a
      >
      <nav class="desktop-nav" aria-label="Основная навигация">
        <a href="#services">Услуги</a><a href="#process">Как мы работаем</a
        ><a href="#prices">Стоимость</a><a href="#faq">Вопросы</a>
      </nav>
      <div class="header-actions">
        <span class="language"><Icon name="globe" :size="17" /> RU</span
        ><a class="button button-small" href="#contact" @click="startLead"
          >Записаться <Icon name="arrow" :size="17" /></a
        ><button
          class="menu-button"
          :aria-expanded="menuOpen"
          aria-controls="mobile-nav"
          aria-label="Открыть меню"
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
      aria-label="Мобильная навигация"
    >
      <a
        v-for="link in [
          ['services', 'Услуги'],
          ['process', 'Как мы работаем'],
          ['prices', 'Стоимость'],
          ['faq', 'Вопросы'],
        ]"
        :href="`#${link[0]}`"
        @click="menuOpen = false"
        >{{ link[1] }}</a
      >
    </nav>
  </header>
  <main id="main">
    <section class="hero container">
      <div class="hero-copy">
        <div class="eyebrow">
          <span class="tiny-line"></span> ПРОФЕССИОНАЛЬНАЯ ЧИСТКА КОНДИЦИОНЕРОВ
        </div>
        <h1>
          Дома прохладно.<br />А воздух<br />
          <span>по-настоящему чистый.</span>
        </h1>
        <p class="hero-description">
          Позаботимся о вашем кондиционере,<br class="desktop-only" />
          чтобы вы просто наслаждались свежестью.
        </p>
        <div class="hero-actions">
          <a href="#contact" class="button" @click="startLead"
            >Заказать чистку <Icon name="arrow" :size="19" /></a
          ><a href="#services" class="text-link"
            >Что входит в чистку <span>↗</span></a
          >
        </div>
        <div class="hero-note">
          <Icon name="shield" :size="18" /> Бережно к вашему дому. Внимательно к
          деталям.
        </div>
      </div>
      <div class="hero-visual">
        <img
          class="hero-photo"
          src="/images/hero.jpg"
          width="1536"
          height="1024"
          alt="Светлая гостиная с настенным кондиционером"
          fetchpriority="high"
        />
        <div class="image-caption">
          <span class="caption-icon"><Icon name="air" :size="22" /></span>
          <div>
            <strong>Свежесть, которую чувствуешь.</strong
            ><span>С первого вдоха.</span>
          </div>
          <Icon class="caption-spark" name="sparkle" :size="24" />
        </div>
        <span class="photo-label">CLEAN AIR. CLEAR MIND.</span>
      </div>
    </section>
    <div class="benefits-wrap">
      <div class="container benefits">
        <div>
          <Icon name="air" /><span
            >Воздух без пыли<br /><strong>и неприятных запахов</strong></span
          >
        </div>
        <div>
          <Icon name="drop" /><span
            >Глубокая очистка<br /><strong>внутреннего блока</strong></span
          >
        </div>
        <div>
          <Icon name="home" /><span
            >Аккуратная работа<br /><strong>у вас дома</strong></span
          >
        </div>
        <div>
          <Icon name="chat" /><span
            >Простая запись<br /><strong>в WhatsApp</strong></span
          >
        </div>
      </div>
    </div>
    <section id="services" class="section container">
      <div class="section-heading">
        <div>
          <div class="eyebrow">МАЛЕНЬКАЯ ЗАБОТА. БОЛЬШАЯ РАЗНИЦА.</div>
          <h2>Больше, чем просто чистые фильтры</h2>
        </div>
        <p>Чистота начинается внутри.<br />Уделяем внимание каждой детали.</p>
      </div>
      <div class="service-grid">
        <article
          v-for="service in services"
          :key="service.id"
          class="service-card"
        >
          <span class="service-icon"
            ><Icon :name="service.icon" :size="29"
          /></span>
          <h3>{{ service.name }}</h3>
          <p>{{ service.text }}</p>
          <button
            class="service-link"
            @click="openService(service)"
            :aria-label="`Подробнее: ${service.name}`"
          >
            Что входит <Icon name="arrow" :size="19" />
          </button>
        </article>
      </div>
    </section>
    <section id="process" class="process-section">
      <div class="container">
        <div class="section-heading">
          <div>
            <div class="eyebrow">ВСЁ ПРОСТО. ВСЁ ПО ПОРЯДКУ.</div>
            <h2>От первого сообщения<br />до свежего воздуха</h2>
          </div>
          <p>Понятный процесс.<br />Никаких лишних хлопот.</p>
        </div>
        <div class="steps">
          <article
            v-for="(step, i) in [
              {
                title: 'Расскажите о кондиционере',
                text: 'Укажите тип, количество блоков и ваш город. Если не знаете модель — разберёмся вместе.',
              },
              {
                title: 'Согласуем детали',
                text: 'Обсудим объём работ, стоимость и удобное для вас время до приезда специалиста.',
              },
              {
                title: 'Позаботимся о чистоте',
                text: 'Защитим рабочую зону, проведём обслуживание и проверим кондиционер после сборки.',
              },
            ]"
            :key="i"
          >
            <span class="step-number">0{{ i + 1 }}</span>
            <h3>{{ step.title }}</h3>
            <p>{{ step.text }}</p>
          </article>
        </div>
      </div>
    </section>
    <section id="prices" class="section container pricing-section">
      <div class="pricing-copy">
        <div class="eyebrow">БЕЗ СЮРПРИЗОВ В КОНЦЕ</div>
        <h2>Сначала стоимость.<br /><span>Потом — работа.</span></h2>
        <p>
          Каждый кондиционер немного отличается. Согласуем цену для вашей
          системы и объём работ до визита.
        </p>
        <a class="text-link" href="#contact" @click="startLead"
          >Узнать стоимость <Icon name="arrow" :size="18"
        /></a>
      </div>
      <div class="price-factors">
        <div>
          <span class="factor-icon"><Icon name="ac" /></span>
          <div>
            <h3>Тип кондиционера</h3>
            <p>Настенный, канальный или кассетный</p>
          </div>
          <span class="factor-number">01</span>
        </div>
        <div>
          <span class="factor-icon"><Icon name="home" /></span>
          <div>
            <h3>Количество блоков</h3>
            <p>Один или несколько за один визит</p>
          </div>
          <span class="factor-number">02</span>
        </div>
        <div>
          <span class="factor-icon"><Icon name="shield" /></span>
          <div>
            <h3>Состояние и доступ</h3>
            <p>Загрязнение и особенности установки</p>
          </div>
          <span class="factor-number">03</span>
        </div>
      </div>
    </section>
    <section id="faq" class="faq-section container section">
      <div>
        <div class="eyebrow">ПОЛЕЗНО ЗНАТЬ</div>
        <h2>
          Вопросы,<br />
          которые нам задают
        </h2>
        <p>Не нашли свой ответ?<br />Обсудим всё при записи.</p>
        <a class="text-link" href="#contact"
          >Задать вопрос <Icon name="arrow" :size="18"
        /></a>
      </div>
      <div class="faq-list">
        <details v-for="(faq, i) in faqs" :key="i">
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
          <div class="eyebrow">ВАШ СЛЕДУЮЩИЙ ВДОХ — СВЕЖЕЕ</div>
          <h2>
            Начнём<br />
            с вашего<br />
            <span>кондиционера.</span>
          </h2>
          <p>
            Пара деталей — и мы сможем обсудить<br class="desktop-only" />
            стоимость и удобное время.
          </p>
          <a
            v-if="phoneUrl"
            :href="phoneUrl"
            class="contact-phone"
            @click="track('phone_click')"
            ><Icon name="phone" :size="20" /> {{ company.phone }}</a
          >
          <p v-if="company.serviceArea.length" class="service-area">
            <Icon name="pin" :size="18" /> {{ company.serviceArea.join(" · ") }}
          </p>
          <div class="booking-promise">
            <Icon name="shield" :size="19" /><span
              >Вы подтверждаете запись только<br />после согласования всех
              деталей.</span
            >
          </div>
        </div>
        <form
          class="booking-form"
          @submit.prevent="prepareRequest"
          @input="
            ready = false;
            copied = false;
          "
        >
          
          <fieldset :disabled="!interactive" class="form-fields">
            <h3>Запрос на чистку</h3>
            <p class="form-subtitle">Подготовим сообщение для WhatsApp.</p>
            <div class="form-row">
              <label
                >Ваше имя <span>(необязательно)</span
                ><input
                  v-model="values.name"
                  name="name"
                  autocomplete="given-name"
                  maxlength="80"
                  placeholder="Как к вам обращаться" /></label
              ><label
                >Город<input
                  v-model="values.city"
                  name="city"
                  autocomplete="address-level2"
                  maxlength="100"
                  placeholder="Где нужна чистка"
                  required
              /></label>
            </div>
            <label
              >Тип кондиционера<select v-model="values.type" name="system">
                <option
                  v-for="type in systemTypes"
                  :key="type.value"
                  :value="type.value"
                >
                  {{ type.label }}
                </option>
              </select></label
            >
            <div class="quantity-row">
              <span id="quantity-label">Количество блоков</span>
              <div
                class="quantity-control"
                role="group"
                aria-labelledby="quantity-label"
              >
                <button
                  type="button"
                  aria-label="Уменьшить количество"
                  :disabled="values.quantity <= 1"
                  @click="
                    values.quantity--;
                    ready = false;
                  "
                >
                  −</button
                ><output aria-live="polite" aria-label="Количество">{{
                  values.quantity
                }}</output
                ><button
                  type="button"
                  aria-label="Увеличить количество"
                  :disabled="values.quantity >= 10"
                  @click="
                    values.quantity++;
                    ready = false;
                  "
                >
                  +
                </button>
              </div>
            </div>
            <label
              >Есть что добавить? <span>(необязательно)</span
              ><textarea
                v-model="values.note"
                maxlength="300"
                rows="2"
                placeholder="Например, появился запах или давно не чистили"
                name="note"
              ></textarea></label
            ><button type="submit" class="button form-submit">
              Подготовить запрос <Icon name="arrow" :size="18" />
            </button>
            <p class="form-note">
              Сообщение отправится только после вашего действия в WhatsApp.
              <button
                type="button"
                class="inline-button"
                @click="privacyDialog.showModal()"
              >
                О данных
              </button>
            </p>
            <p v-if="error" role="alert" class="form-error">{{ error }}</p>
            <div
              v-if="ready"
              id="request-result"
              class="request-result"
              tabindex="-1"
            >
              <strong>Ваш запрос готов</strong>
              <pre>{{ requestText }}</pre>
              <a
                v-if="contactUrl"
                :href="contactUrl"
                class="button whatsapp-button"
                target="_blank"
                rel="noopener noreferrer"
                @click="
                  track('lead_whatsapp_click', {
                    system_type: values.type,
                    quantity: values.quantity,
                  })
                "
                ><Icon name="chat" :size="19" /> Открыть WhatsApp</a
              >
              <p v-else class="contact-unavailable">
                Номер компании пока не добавлен. Запрос можно скопировать;
                запись ещё не отправлена.
              </p>
              <button type="button" class="copy-button" @click="copyRequest">
                <Icon :name="copied ? 'check' : 'copy'" :size="17" />
                {{
                  copied ? "Запрос скопирован" : "Скопировать запрос"
                }}</button
              ><span class="sr-only" role="status">{{
                copied ? "Запрос скопирован в буфер обмена" : ""
              }}</span>
            </div>
          </fieldset>
        </form>
      </div>
    </section>
    <section class="referral-strip container">
      <div>
        <Icon name="air" :size="30" />
        <p>
          Свежим воздухом приятно делиться.<span
            >Расскажите о нас тем, о ком заботитесь.</span
          >
        </p>
      </div>
      <button class="share-button" @click="shareSite">
        Поделиться сайтом <Icon name="arrow" :size="18" /></button
      ><span class="share-status" role="status">{{ shareStatus }}</span>
    </section>
  </main>
  <footer class="container footer">
    <a class="brand" href="/"><Icon name="air" :size="28" /> mazganim.</a
    ><span>Чистый кондиционер. Комфортный дом.</span
    ><button class="footer-privacy" @click="privacyDialog.showModal()">
      Конфиденциальность</button
    ><span>© 2026 Mazganim</span>
  </footer>
  <dialog
    ref="detailDialog"
    class="detail-dialog"
    @click="(e) => e.target === detailDialog && detailDialog.close()"
    aria-labelledby="service-dialog-title"
  >
    <div class="dialog-content">
      <button
        class="dialog-close"
        aria-label="Закрыть"
        @click="detailDialog.close()"
      >
        <Icon name="close" /></button
      ><span class="service-icon"
        ><Icon :name="selectedService.icon" :size="28"
      /></span>
      <h2 id="service-dialog-title">{{ selectedService.name }}</h2>
      <p>{{ selectedService.text }}</p>
      <ul class="check-list">
        <li v-for="detail in selectedService.details" :key="detail">
          <Icon name="check" :size="18" /> {{ detail }}
        </li>
      </ul>
      <p class="dialog-note">
        Точный состав работ зависит от модели и состояния системы. Обсудим его
        до начала обслуживания.
      </p>
      <a
        href="#contact"
        class="button"
        @click="
          detailDialog.close();
          startLead();
        "
        >Обсудить чистку <Icon name="arrow" :size="18"
      /></a>
    </div>
  </dialog>
  <dialog
    ref="privacyDialog"
    class="detail-dialog"
    @click="(e) => e.target === privacyDialog && privacyDialog.close()"
    aria-labelledby="privacy-title"
  >
    <div class="dialog-content">
      <button
        class="dialog-close"
        aria-label="Закрыть"
        @click="privacyDialog.close()"
      >
        <Icon name="close" />
      </button>
      <h2 id="privacy-title">Ваши данные</h2>
      <p>
        Форма составляет текст запроса прямо в вашем браузере. Имя, город и
        комментарий не сохраняются сайтом и не отправляются на сервер.
      </p>
      <p>
        При переходе в WhatsApp текст передаётся в приложение. Вы сами решаете,
        отправить ли его компании; далее действуют правила WhatsApp.
      </p>
      <p>
        Метки рекламного перехода могут сохраняться на время текущей вкладки и
        добавляться к запросу. Они помогают понять, откуда вы узнали о сайте.
        Сайт не подключает рекламные пиксели и не использует рекламные cookies.
      </p>
      <p>
        Хостинг обрабатывает технические данные, необходимые для доставки
        страниц. Чтобы запросить удаление уже отправленной переписки, обратитесь
        к компании в том же чате.
      </p>
      <button class="button" @click="privacyDialog.close()">Понятно</button>
    </div>
  </dialog>
</template>
