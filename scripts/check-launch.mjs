import { company } from "../src/data/company.js";
const errors = [];
if (!company.verified)
  errors.push("Confirm the company details and set company.verified = true.");
if (!company.phones.length || company.phones.some(({ number }) => !/^\+\d{8,15}$/.test(number)))
  errors.push("Set the real company phones in E.164 format.");
if (!company.serviceArea.length) errors.push("Add confirmed service cities.");
if (errors.length) {
  console.error("Public launch is not ready:\n- " + errors.join("\n- "));
  process.exit(1);
}
console.log("Company details are configured for public launch.");
