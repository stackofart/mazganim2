import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnalytics, safeEvent, analyticsPage, consentKey, consentLifetime, measurementId } from '../src/analytics.js';

function browser({ stored, hostname = 'zeez.co.il', blockedStorage = false } = {}) {
  const storage = new Map(stored ? [[consentKey, JSON.stringify(stored)]] : []);
  const scripts = [], deletedCookies = [], listeners = {};
  const win = {
    location: { hostname, protocol: 'https:', href: `https://${hostname}/he/?text=PRIVATE&phone=0541234567&utm_source=google&utm_medium=cpc#booking-form` },
    localStorage: {
      getItem(key) { if (blockedStorage) throw Error('blocked'); return storage.get(key) ?? null; },
      setItem(key, value) { if (blockedStorage) throw Error('blocked'); storage.set(key, value); },
    },
    addEventListener(name, fn) { listeners[name] = fn; },
  };
  const doc = {
    referrer: 'https://example.org/private/person?email=test@example.org', documentElement: { lang: 'he' },
    get cookie() { return '_ga=123; _ga_4YMWN76B5B=456; essential=stay'; },
    set cookie(value) { deletedCookies.push(value); },
    head: { appendChild(script) { scripts.push(script); } },
    createElement() { return { remove() {} }; },
  };
  const client = createAnalytics(win, doc, () => 1000);
  return { client, win, scripts, deletedCookies, storage, listeners, commands: () => (win.dataLayer || []).map(args => [...args]) };
}

test('no Google script, cookie or event is created before consent or after refusal', () => {
  const b = browser();
  assert.equal(b.client.init(), null);
  assert.equal(b.client.track('lead_submitted', { locale: 'ru' }), false);
  b.client.choose('denied');
  assert.equal(b.scripts.length, 0);
  assert.deepEqual(b.commands(), []);
  assert.equal(b.win[`ga-disable-${measurementId}`], true);
  assert.equal(JSON.parse(b.storage.get(consentKey)).value, 'denied');
});

test('grant loads once, sets consent before config, denies ads and sends only safe events', () => {
  const b = browser(); b.client.init(); b.client.choose('granted'); b.client.choose('granted');
  assert.equal(b.scripts.length, 1);
  assert.equal(b.scripts[0].src, `https://www.googletagmanager.com/gtag/js?id=${measurementId}`);
  const commands = b.commands();
  assert.equal(commands[0][1], 'default'); assert.equal(commands[0][2].analytics_storage, 'denied');
  assert.equal(commands[1][2].analytics_storage, 'granted');
  assert.equal(commands[1][2].ad_user_data, 'denied');
  const configs = commands.filter(x => x[0] === 'config'); assert.equal(configs.length, 1);
  assert.equal(configs[0][2].allow_google_signals, false);
  assert.equal(configs[0][2].allow_ad_personalization_signals, false);
  assert.equal(configs[0][2].page_location, 'https://zeez.co.il/he/');
  assert.equal(configs[0][2].page_referrer, 'https://example.org/');
  assert.equal(configs[0][2].campaign_source, 'google');
  assert.equal(b.client.track('lead_submitted', { locale: 'he', placement: 'form', name: 'PRIVATE', phone: '0541234567', note: 'SECRET' }), true);
  assert.deepEqual(b.commands().at(-1), ['event', 'generate_lead', { site_language: 'he', placement: 'form', form_id: 'booking-form', method: 'website', send_to: measurementId }]);
  assert.doesNotMatch(JSON.stringify(b.commands()), /PRIVATE|SECRET|0541234567|person\?/);
});

test('withdrawal disables automatic and custom collection, removes only our GA cookies, and syncs across tabs', () => {
  const b = browser({ stored: { value: 'granted', expires: 2000 } });
  assert.equal(b.client.init(), 'granted'); b.client.choose('denied');
  const count = b.commands().length;
  assert.equal(b.client.track('telegram_click'), false);
  assert.equal(b.commands().length, count);
  assert.equal(b.win[`ga-disable-${measurementId}`], true);
  assert.equal(b.commands().at(-1)[2].analytics_storage, 'denied');
  assert.ok(b.deletedCookies.some(x => x.startsWith('_ga_4YMWN76B5B=;')));
  assert.ok(b.deletedCookies.every(x => !x.includes('essential')));
  b.storage.set(consentKey, JSON.stringify({ value: 'granted', expires: 2000 }));
  b.listeners.storage({ key: consentKey }); assert.equal(b.win[`ga-disable-${measurementId}`], false);
  b.storage.clear(); b.listeners.storage({ key: null });
  assert.equal(b.win[`ga-disable-${measurementId}`], true);
});

test('expired / invalid preferences fail closed; blocked storage and ad blockers do not break the site', () => {
  for (const stored of [{value:'granted',expires:999}, {value:'granted',expires:1001+consentLifetime}, {value:'yes',expires:2000}]) {
    const b = browser({stored}); assert.equal(b.client.init(), null); assert.equal(b.scripts.length, 0);
  }
  const b = browser({blockedStorage:true}); b.client.init();
  assert.doesNotThrow(() => b.client.choose('granted'));
  b.scripts[0].onerror(); assert.doesNotThrow(() => b.client.choose('granted'));
  assert.equal(b.scripts.length, 2);
  assert.equal(b.commands().filter(x=>x[0]==='config').length, 1);
  assert.doesNotThrow(() => b.client.choose('denied'));
});

test('local previews never pollute production analytics', () => {
  for (const hostname of ['127.0.0.1','localhost','mazganim-clean-air.gerasim459.workers.dev']) {
    const b=browser({hostname}); b.client.init(); b.client.choose('granted');
    assert.equal(b.client.track('phone_click'), false); assert.equal(b.scripts.length, 0);
  }
});

test('event allowlist discards free text, arbitrary URLs and unapproved events', () => {
  assert.equal(safeEvent('unknown', {phone:'0541234567'}), null);
  assert.deepEqual(safeEvent('lead_whatsapp_click', {placement:'form',locale:'ru', link_url:'https://wa.me/?text=SECRET',text:'SECRET'}), {name:'whatsapp_click',params:{site_language:'ru',placement:'form'}});
  assert.deepEqual(safeEvent('form_error', {reason:'0541234567',locale:'SECRET',placement:'SECRET'}), {name:'form_error',params:{form_id:'booking-form'}});
  assert.equal(safeEvent('lead_start').name, 'booking_click');
});

test('URLs lose personal parameters, paths and fragments while campaign slugs survive', () => {
  const fields=analyticsPage('https://zeez.co.il/private-name?utm_source=test@example.org&utm_campaign=054-123-4567&email=SECRET#SECRET', 'javascript:secret');
  assert.deepEqual(fields, {page_location:'https://zeez.co.il/',page_referrer:''});
  assert.equal(analyticsPage('https://zeez.co.il/?utm_campaign=summer_2026').campaign_name, 'summer_2026');
});
