import { readFileSync } from 'node:fs';
const config = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
const database = config.d1_databases?.find(item => item.binding === 'LEADS_DB');
const key = config.vars?.TURNSTILE_SITE_KEY;
if (!database?.database_id || /^0{8}-/.test(database.database_id) || !key || /^[123]x000/.test(key)) {
  console.error('Email deployment is not ready: configure the real D1 database and production Turnstile site key first.');
  process.exit(1);
}
if (config.vars?.LOCAL_DEVELOPMENT || config.vars?.TURNSTILE_SECRET) {
  console.error('Do not put the Turnstile secret or local test settings in the production config.');
  process.exit(1);
}
console.log('Public email bindings are configured. The secret, domain verification and real email receipt still require deployment verification.');
