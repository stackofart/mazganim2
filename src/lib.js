import { company } from "./data/company.js";
import { contentFor } from "./data/content.js";
export const campaignKeys = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
];
export function captureCampaign() {
  try {
    const params = new URLSearchParams(location.search);
    const campaign = Object.fromEntries(
      campaignKeys
        .filter((key) => params.has(key))
        .map((key) => [
          key,
          params
            .get(key)
            .replace(/[\r\n]/g, " ")
            .slice(0, 120),
        ]),
    );
    if (Object.keys(campaign).length)
      sessionStorage.setItem("mazganim-campaign", JSON.stringify(campaign));
  } catch {
    /* The site works with blocked browser storage. */
  }
}
export function readCampaign() {
  try {
    const data = JSON.parse(
      sessionStorage.getItem("mazganim-campaign") || "{}",
    );
    return Object.fromEntries(
      campaignKeys
        .filter((k) => typeof data[k] === "string")
        .map((k) => [k, data[k].replace(/[\r\n]/g, " ").slice(0, 120)]),
    );
  } catch {
    return {};
  }
}
export function track(event, properties = {}) {
  if (typeof window === "undefined") return;
  // Intentionally does not send anything. Connect your consent-aware analytics in one place.
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...properties, ...readCampaign() });
}
export function calculatePrice({ type, quantity }) {
  const count = Number(quantity);
  return type === "wall" && Number.isInteger(count)
    ? (company.prices[count] ?? null)
    : null;
}
export function normalizePhone(value) {
  const number = String(value || "").replace(/[\s()-]/g, "");
  if (/^05\d{8}$/.test(number)) return `+972${number.slice(1)}`;
  if (/^\+9725\d{8}$/.test(number)) return number;
  return null;
}
export function makeRequest(values, campaign = {}, locale = "ru") {
  const t = contentFor(locale);
  const type = t.systemTypes.find((type) => type.value === values.type);
  const quantity = Number(values.quantity);
  if (!type || !Number.isInteger(quantity) || quantity < 1 || quantity > 10)
    throw new Error(t.invalidRequest);
  const clean = (value) =>
    String(value || "")
      .replace(/[\r\n]/g, " ")
      .trim()
      .slice(0, 300);
  const city = clean(values.city);
  if (!city || city.length > 100) throw new Error(t.invalidRequest);
  const lines = [
    t.requestHello,
    "",
    `${t.type}: ${type.label}`,
    `${t.quantity}: ${quantity}`,
    `${t.city}: ${city}`,
  ];
  if (clean(values.name)) lines.push(`${t.name}: ${clean(values.name)}`);
  if (values.phone) {
    const phone = normalizePhone(values.phone);
    if (!phone) throw new Error(t.invalidPhone);
    lines.push(`${t.phone}: ${phone}`);
  }
  if (clean(values.note)) lines.push(`${t.note}: ${clean(values.note)}`);
  const price = calculatePrice(values);
  lines.push(`${t.estimate}: ${price === null ? t.quote : `${price} ₪`}`);
  const source = [campaign.utm_source, campaign.utm_campaign]
    .filter((v) => typeof v === "string" && v)
    .map(clean)
    .join(" / ");
  if (source) lines.push("", `${t.source}: ${source}`);
  return lines.join("\n");
}
export function whatsappUrl(message) {
  const number = company.whatsapp.replace(/\D/g, "");
  return /^\d{8,15}$/.test(number)
    ? `https://wa.me/${number}?text=${encodeURIComponent(message)}`
    : "";
}
// Single transport function: tests inject fetch so they never submit real leads.
export async function sendLead(
  values,
  { locale = "ru", campaign = {}, fetcher = fetch, signal } = {},
) {
  const t = contentFor(locale);
  const phone = normalizePhone(values.phone);
  if (!phone) throw new Error(t.invalidPhone);
  const message = makeRequest(values, campaign, locale);
  if (values.website) throw new Error(t.sendError);
  const payload = {
    name: String(values.name || "")
      .trim()
      .slice(0, 80),
    phone,
    city: String(values.city).trim().slice(0, 100),
    message,
    locale,
    _subject: `${company.name}: AC cleaning request`,
    _gotcha: "",
    ...Object.fromEntries(
      campaignKeys
        .filter((k) => typeof campaign[k] === "string")
        .map((k) => [k, campaign[k].slice(0, 120)]),
    ),
  };
  const response = await fetcher(company.formEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
    credentials: "omit",
    signal,
  });
  if (!response.ok) throw new Error(t.sendError);
  return { status: "accepted" };
}
