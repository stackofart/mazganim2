import { company } from "./data/company.js";
import { contentFor } from "./data/content.js";
import { analyticsClient } from "./analytics.js";
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
  try {
    return analyticsClient()?.track(event, properties) || false;
  } catch {
    // Analytics must never interrupt a click or turn an accepted lead into an error.
    return false;
  }
}
export function normalizePhone(value) {
  const number = String(value || "").replace(/[\s()-]/g, "");
  if (/^05\d{8}$/.test(number)) return `+972${number.slice(1)}`;
  if (/^\+9725\d{8}$/.test(number)) return number;
  return null;
}
// Shared by the form and transport so invalid fields never reach the network.
export function validateLead(values, locale = "ru") {
  const t = contentFor(locale), errors = {};
  const name = String(values.name || "").trim();
  if (!name || name.length > 80) errors.name = t.validation.name;
  if (!normalizePhone(values.phone)) errors.phone = t.invalidPhone;
  if (String(values.note || "").trim().length > 300) errors.note = t.validation.note;
  return errors;
}
export function makeRequest(values, campaign = {}, locale = "ru") {
  const t = contentFor(locale);
  const clean = (value) =>
    String(value || "")
      .replace(/[\r\n]/g, " ")
      .trim()
      .slice(0, 300);
  const lines = [t.requestHello, ""];
  if (clean(values.name)) lines.push(`${t.name}: ${clean(values.name)}`);
  if (values.phone) {
    const phone = normalizePhone(values.phone);
    if (!phone) throw new Error(t.invalidPhone);
    lines.push(`${t.phone}: ${phone}`);
  }
  if (clean(values.note)) lines.push(`${t.note}: ${clean(values.note)}`);
  const source = [campaign.utm_source, campaign.utm_campaign]
    .filter((v) => typeof v === "string" && v)
    .map(clean)
    .join(" / ");
  if (source) lines.push("", `${t.source}: ${source}`);
  return lines.join("\n").trim();
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
  { locale = "ru", campaign = {}, fetcher = fetch, signal, id, turnstileToken } = {},
) {
  const t = contentFor(locale);
  const fieldErrors = validateLead(values, locale);
  if (Object.keys(fieldErrors).length) {
    throw Object.assign(new Error(Object.values(fieldErrors)[0]), { fieldErrors });
  }
  const phone = normalizePhone(values.phone);
  if (!phone) throw new Error(t.invalidPhone);
  if (values.website) throw new Error(t.sendError);
  const payload = {
    name: String(values.name || "")
      .trim()
      .slice(0, 80),
    phone,
    note: String(values.note || "").trim().slice(0, 300),
    id,
    locale,
    website: "",
    turnstileToken,
    campaign: Object.fromEntries(
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
  const result = await response.json().catch(() => ({}));
  if (response.status !== 202 || result.status !== "accepted" || result.id !== id) {
    throw Object.assign(new Error(t.sendError), { code: result.code });
  }
  return result;
}
