import { company } from "./data/company.js";

export const campaignKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
export const systemTypes = ["wall", "multi", "vrf", "unknown"];
export const leadLocales = ["ru", "he", "en", "ar", "fr"];

export function calculatePrice({ type, quantity }) {
  const count = Number(quantity);
  return type === "wall" && Number.isInteger(count) ? (company.prices[count] ?? null) : null;
}

export function normalizePhone(value) {
  const number = String(value || "").replace(/[\s()-]/g, "");
  if (/^05\d{8}$/.test(number)) return `+972${number.slice(1)}`;
  if (/^\+9725\d{8}$/.test(number)) return number;
  return null;
}
