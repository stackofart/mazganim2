import ru from "./locales/ru.json" with { type: "json" };
import he from "./locales/he.json" with { type: "json" };
import en from "./locales/en.json" with { type: "json" };
import ar from "./locales/ar.json" with { type: "json" };
import fr from "./locales/fr.json" with { type: "json" };
import { company } from "./company.js";
export const locales = { ru, he, en, ar, fr };
export const languages = [
  { code: "ru", label: "Русский", short: "RU", dir: "ltr" },
  { code: "he", label: "עברית", short: "HE", dir: "rtl" },
  { code: "en", label: "English", short: "EN", dir: "ltr" },
  { code: "ar", label: "العربية", short: "AR", dir: "rtl" },
  { code: "fr", label: "Français", short: "FR", dir: "ltr" },
];
export const localePath = (code) => (code === "ru" ? "/" : `/${code}/`);
export const localeFromPath = (path) =>
  languages.find(
    (l) =>
      path === localePath(l.code) || (l.code !== "ru" && path === `/${l.code}`),
  )?.code || "ru";
export function contentFor(code = "ru") {
  const t = locales[code] || ru;
  return {
    ...t,
    description: t.description.replaceAll("{brand}", company.name),
    shareText: t.shareText.replaceAll("{brand}", company.name),
    privacyText: t.privacyText.map(text => text.replaceAll("{brand}", company.name)),
    services: t.services.map(([name, text, details], i) => ({
      id: ["deep", "refrigerant", "disinfection"][i],
      icon: ["ac", "cylinder", "sparkle"][i],
      name,
      text,
      details,
    })),
    systemTypes: t.types.map((label, i) => ({
      value: ["wall", "central", "vrf", "unknown"][i],
      label,
    })),
    faqs: t.faqs.map(([question, answer]) => ({ question, answer })),
  };
}
export const { services, systemTypes, faqs } = contentFor("ru");
