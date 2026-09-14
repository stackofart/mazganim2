import { serviceCities } from "./service-area.js";
// Extracted from stackofart/mazganim at c8a86eebd08f9fc875a120a14e60bccd3aec1956.
// Contact numbers updated by the owner on 2026-09-13.
const phones = [
  { number: "+972524464677", display: "052-446-4677" },
  { number: "+972557707506", display: "055-770-7506" },
];
export const company = {
  name: "זיז",
  siteUrl: "https://mazganim-clean-air.gerasim459.workers.dev",
  phones,
  phone: phones[0].number,
  whatsapp: phones[0].number,
  telegram: "https://t.me/zeezair",
  formEndpoint: "/api/leads",
  serviceArea: serviceCities.map(city => city.en),
  currency: "ILS",
  prices: { 1: 250, 2: 450, 3: 600 },
  verified: true,
  source: "https://github.com/stackofart/mazganim",
  sourceCommit: "c8a86eebd08f9fc875a120a14e60bccd3aec1956",
};
