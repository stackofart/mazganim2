// One consent-aware entry point. Never pass form values, URLs or free text here.
export const measurementId = "G-4YMWN76B5B";
export const consentKey = "zeez-analytics-consent-v1";
export const consentLifetime = 180 * 24 * 60 * 60 * 1000;
const locales = ["ru", "he", "en", "ar", "fr"];
const denied = { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" };
const eventNames = {
  lead_start: "booking_click",
  lead_whatsapp_click: "whatsapp_click",
  telegram_click: "telegram_click",
  phone_click: "phone_click",
  lead_submitted: "generate_lead",
  form_start: "form_start",
  form_error: "form_error",
  prices_click: "prices_click",
  site_share: "share",
};

export function safeEvent(event, properties = {}) {
  if (!Object.hasOwn(eventNames, event)) return null;
  const params = {};
  if (locales.includes(properties.locale)) params.site_language = properties.locale;
  if (["hero", "menu", "prices", "area", "floating", "contact", "form", "faq"].includes(properties.placement)) params.placement = properties.placement;
  if (["validation", "challenge", "rate_limit", "network", "server"].includes(properties.reason)) params.error_type = properties.reason;
  if (["form_start", "form_error", "lead_submitted"].includes(event)) params.form_id = "booking-form";
  if (event === "lead_submitted") params.method = "website";
  return { name: eventNames[event], params };
}

export function analyticsPage(href, referrer = "") {
  const url = new URL(href);
  const path = /^\/(he|en|ar|fr)\/$/.test(url.pathname) ? url.pathname : "/";
  // Strip hashes and arbitrary URL parameters (including WhatsApp text / PII).
  const fields = { page_location: `https://zeez.co.il${path}`, page_referrer: "" };
  try {
    const ref = new URL(referrer);
    if (["http:", "https:"].includes(ref.protocol)) fields.page_referrer = `${ref.origin}/`;
  } catch { /* Direct visits have no referrer. */ }
  const campaigns = { utm_source: "campaign_source", utm_medium: "campaign_medium", utm_campaign: "campaign_name", utm_id: "campaign_id", utm_content: "campaign_content", utm_term: "campaign_term" };
  for (const [key, field] of Object.entries(campaigns)) {
    const value = url.searchParams.get(key) || "";
    // Campaign slugs only; never put customer data in campaign tags.
    if (/^[\p{L}\p{N}_ .-]{1,100}$/u.test(value) && !/\d{7}/.test(value.replace(/[ .-]/g, ""))) fields[field] = value;
  }
  return fields;
}

export function createAnalytics(win, doc, now = Date.now) {
  let consent = null, initialized = false, script = null;
  const enabledHost = win.location.hostname === "zeez.co.il" && win.location.protocol === "https:";
  const disableKey = `ga-disable-${measurementId}`;
  win[disableKey] = true;
  function gtag() { win.dataLayer.push(arguments); }
  function clearCookies() {
    for (const cookie of doc.cookie.split(";")) {
      const name = cookie.trim().split("=")[0];
      if (name !== "_ga" && name !== "_ga_4YMWN76B5B") continue;
      for (const domain of ["", "; Domain=zeez.co.il", "; Domain=.zeez.co.il"]) {
        doc.cookie = `${name}=; Max-Age=0; Path=/${domain}; SameSite=Lax; Secure`;
      }
    }
  }
  function loadTag() {
    if (script) return;
    script = doc.createElement("script");
    script.id = "zeez-google-analytics";
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    script.referrerPolicy = "origin";
    // A blocked tag must never affect booking or navigation; allow a later retry.
    script.onerror = () => { script?.remove(); script = null; };
    doc.head.appendChild(script);
  }
  function apply(value) {
    consent = value;
    win[disableKey] = value !== "granted" || !enabledHost;
    if (win[disableKey]) {
      if (initialized) gtag("consent", "update", denied);
      clearCookies();
      return;
    }
    if (!initialized) {
      win.dataLayer = win.dataLayer || [];
      win.gtag = gtag;
      gtag("consent", "default", denied);
      gtag("consent", "update", { ...denied, analytics_storage: "granted" });
      gtag("js", new Date(now()));
      gtag("config", measurementId, {
        ...analyticsPage(win.location.href, doc.referrer),
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        cookie_expires: consentLifetime / 1000,
        cookie_flags: "SameSite=Lax;Secure",
        site_language: locales.includes(doc.documentElement.lang) ? doc.documentElement.lang : "ru",
      });
      initialized = true;
    } else {
      gtag("consent", "update", { ...denied, analytics_storage: "granted" });
    }
    loadTag();
  }
  function readConsent() {
    try {
      const saved = JSON.parse(win.localStorage.getItem(consentKey));
      if (["granted", "denied"].includes(saved?.value) && saved.expires > now() && saved.expires <= now() + consentLifetime) return saved.value;
    } catch { /* Storage may be unavailable or the preference malformed. */ }
    return null;
  }
  const api = {
    init() { apply(readConsent()); return consent; },
    choose(value) {
      if (!["granted", "denied"].includes(value)) return;
      try { win.localStorage.setItem(consentKey, JSON.stringify({ value, expires: now() + consentLifetime })); } catch { /* Keep the choice for this page when storage is blocked. */ }
      apply(value);
    },
    track(event, properties) {
      if (consent !== "granted" || !enabledHost || win[disableKey]) return false;
      const safe = safeEvent(event, properties);
      if (!safe) return false;
      gtag("event", safe.name, { ...safe.params, send_to: measurementId });
      return true;
    },
  };
  win.addEventListener("storage", e => { if (e.key === consentKey || e.key === null) api.init(); });
  return api;
}

let client;
export function analyticsClient() {
  if (typeof window === "undefined") return null;
  return client ||= createAnalytics(window, document);
}
