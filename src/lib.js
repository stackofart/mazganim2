import { company } from "./data/company.js";
import { systemTypes } from "./data/content.js";
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
export function makeRequest(values, campaign = {}) {
  const type = systemTypes.find((type) => type.value === values.type);
  const quantity = Number(values.quantity);
  if (!type || !Number.isInteger(quantity) || quantity < 1 || quantity > 10)
    throw new Error("Проверьте тип и количество кондиционеров.");
  const clean = (value) =>
    String(value || "")
      .replace(/[\r\n]/g, " ")
      .trim()
      .slice(0, 300);
  const city = clean(values.city);
  if (!city) throw new Error("Укажите город.");
  const lines = [
    "Здравствуйте! Хочу записаться на чистку кондиционера.",
    "",
    `Тип: ${type.label}`,
    `Количество: ${quantity}`,
    `Город: ${city}`,
  ];
  if (clean(values.name)) lines.push(`Имя: ${clean(values.name)}`);
  if (clean(values.note)) lines.push(`Комментарий: ${clean(values.note)}`);
  const source = [campaign.utm_source, campaign.utm_campaign]
    .filter((v) => typeof v === "string" && v)
    .map(clean)
    .join(" / ");
  if (source) lines.push("", `Источник: ${source}`);
  return lines.join("\n");
}
export function whatsappUrl(message) {
  const number = company.whatsapp.replace(/\D/g, "");
  return /^\d{8,15}$/.test(number)
    ? `https://wa.me/${number}?text=${encodeURIComponent(message)}`
    : "";
}
