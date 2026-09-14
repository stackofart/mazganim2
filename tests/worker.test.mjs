import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker, { deliverOne, drainOutbox } from '../worker/index.js';
const schema = readFileSync(new URL('../migrations/0001_lead_outbox.sql', import.meta.url), 'utf8');
const origin = 'https://zeez.co.il';
test('legacy domains redirect to the primary domain without losing language or campaign parameters', async () => {
  const env = { ASSETS: { fetch: async () => new Response('static') } };
  for (const host of ['www.zeez.co.il', 'mazganim-clean-air.gerasim459.workers.dev']) {
    for (const [path, expected] of [['/', '/'], ['/he/', '/he/'], ['/en', '/en/'], ['/ru/', '/'], ['/sitemap.xml', '/sitemap.xml']]) {
      for (const method of ['GET', 'HEAD']) {
        const query = '?utm_source=google&gclid=abc%2B123&gbraid=test';
        const result = await worker.fetch(new Request(`https://${host}${path}${query}`, { method }), env, {});
        assert.equal(result.status, 301);
        assert.equal(result.headers.get('Location'), `${origin}${expected}${query}`);
      }
    }
  }
  assert.equal(await (await worker.fetch(new Request(origin + '/he/'), env, {})).text(), 'static');
  assert.equal(await (await worker.fetch(new Request('http://127.0.0.1/he/'), env, {})).text(), 'static');
  assert.equal((await worker.fetch(new Request('https://www.zeez.co.il/api/leads'), env, {})).status, 405);
  assert.equal((await worker.fetch(new Request('https://www.zeez.co.il/api/leads', { method: 'POST' }), env, {})).status, 403);
});
function fixture(t) {
  const db = new DatabaseSync(':memory:'); db.exec(schema); t.after(() => db.close());
  const emails = [], pending = [];
  const env = { TURNSTILE_SECRET: 'test-secret', TURNSTILE_SITE_KEY: 'test-key',
    LEAD_RATE_LIMITER: { limit: async () => ({ success: true }) },
    EMAIL: { send: async message => { emails.push(message); return { messageId: 'test-mail' }; } },
    ASSETS: { fetch: async () => new Response('static') },
    LEADS_DB: { prepare(sql) {
      let args = [];
      return { bind(...values) { args = values; return this; },
        async first() { return db.prepare(sql).get(...args) ?? null; },
        async all() { return { results: db.prepare(sql).all(...args) }; },
        async run() { return db.prepare(sql).run(...args); } };
    } },
  };
  t.mock.method(globalThis, 'fetch', async () => Response.json({ success: true, hostname: 'zeez.co.il', action: 'booking' }));
  const ctx = { waitUntil(promise) { pending.push(promise); } };
  const payload = { id: crypto.randomUUID(), name: 'Тест', phone: '0524464677', note: '', locale: 'ru', campaign: {}, website: '', turnstileToken: 'test-token' };
  const request = (body = payload, headers = {}) => new Request(origin + '/api/leads', {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  return { db, env, ctx, payload, request, emails, pending, submit: (body, headers) => worker.fetch(request(body, headers), env, ctx) };
}
test('lead is durably saved before acceptance; a lost response can be safely replayed', async t => {
  const f = fixture(t); const result = await f.submit();
  assert.equal(result.status, 202); assert.equal((await result.json()).id, f.payload.id);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM leads').get().n, 1);
  await Promise.all(f.pending);
  assert.equal(f.emails.length, 1); assert.equal(f.emails[0].to, 'gerasim459@gmail.com');
  assert.equal(f.emails[0].from.email, 'requests@zeez.co.il');
  assert.equal(f.db.prepare('SELECT status FROM leads').get().status, 'mail_accepted');
  assert.equal((await f.submit({ ...f.payload, turnstileToken: 'expired' })).status, 202);
  assert.equal(f.emails.length, 1);
  assert.equal((await f.submit({ ...f.payload, note: 'different' })).status, 409);
});
test('host, Origin, media type, body limits and malformed data fail before storage', async t => {
  const f = fixture(t);
  assert.equal((await f.submit(undefined, { Origin: 'https://attacker.test' })).status, 403);
  assert.equal((await f.submit(undefined, { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  assert.equal((await f.submit(undefined, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await f.submit('x'.repeat(8193))).status, 413);
  assert.equal((await f.submit('{')).status, 400);
  for (const bad of [null, [], { name: [] }, { name: 'x\r\nBcc: a@evil.test' }, { phone: '123' }, { note: 'x'.repeat(301) }, { website: 'spam' }, { to: 'evil@test.com' }, { campaign: { extra: 'x' } }, { id: "'; DROP TABLE leads; --" }]) {
    assert.equal((await f.submit(bad === null || Array.isArray(bad) ? bad : { ...f.payload, ...bad })).status, 400);
  }
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM leads').get().n, 0);
  assert.equal(f.emails.length, 0);
});
test('Turnstile checks success, hostname and action and fails closed on outages', async t => {
  const f = fixture(t);
  for (const answer of [{ success: false }, { success: true, hostname: 'evil.test', action: 'booking' }, { success: true, hostname: 'zeez.co.il', action: 'login' }]) {
    globalThis.fetch.mock.mockImplementation(async () => Response.json(answer));
    assert.equal((await f.submit()).status, 400);
  }
  globalThis.fetch.mock.mockImplementation(async () => { throw new Error('unavailable'); });
  assert.equal((await f.submit()).status, 503);
  f.env.LOCAL_DEVELOPMENT = 'true';
  // A local development flag must never bypass production checks.
  globalThis.fetch.mock.mockImplementation(async () => Response.json({ success: true, hostname: 'localhost' }));
  assert.equal((await f.submit()).status, 400);
});
test('missing bindings, rate limits and a failed database never return success', async t => {
  const f = fixture(t);
  f.env.LEAD_RATE_LIMITER.limit = async () => ({ success: false });
  assert.equal((await f.submit()).status, 429);
  f.env.LEAD_RATE_LIMITER.limit = async () => ({ success: true });
  const secret = f.env.TURNSTILE_SECRET; delete f.env.TURNSTILE_SECRET;
  assert.equal((await f.submit()).status, 503); f.env.TURNSTILE_SECRET = secret;
  f.env.LEADS_DB.prepare = () => { throw new Error('DB unavailable'); };
  assert.equal((await f.submit()).status, 503);
  assert.equal(f.emails.length, 0);
  assert.equal(await (await worker.fetch(new Request(origin + '/'), f.env, f.ctx)).text(), 'static');
});
test('concurrent replays save one lead and one worker holds the delivery lease', async t => {
  const f = fixture(t);
  const replies = await Promise.all(Array.from({ length: 4 }, () => f.submit()));
  assert.ok(replies.every(r => r.status === 202)); await Promise.all(f.pending);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM leads').get().n, 1);
  assert.equal(f.emails.length, 1);
});
test('email failure keeps a durable outbox record and cron retries it', async t => {
  const f = fixture(t);
  const good = f.env.EMAIL.send;
  f.env.EMAIL.send = async () => { throw Object.assign(new Error('never log private message'), { code: 'E_DELIVERY_FAILED' }); };
  assert.equal((await f.submit()).status, 202); await Promise.all(f.pending);
  let row = f.db.prepare('SELECT * FROM leads').get();
  assert.equal(row.status, 'pending'); assert.equal(row.attempts, 1); assert.equal(row.last_error, 'E_DELIVERY_FAILED');
  f.env.EMAIL.send = good;
  await drainOutbox(f.env, row.next_attempt + 1);
  row = f.db.prepare('SELECT * FROM leads').get(); assert.equal(row.status, 'mail_accepted'); assert.equal(row.attempts, 2);
});
test('a crashed sender lease is recovered; unresolved requests survive retention cleanup', async t => {
  const f = fixture(t); await f.submit(); await Promise.all(f.pending);
  const now = Date.now();
  f.db.prepare("UPDATE leads SET status='sending', created_at=?, next_attempt=?, lease_until=?, lease_id='crashed'").run(now-40*86400000, now-1000, now-1000);
  await deliverOne(f.env, f.payload.id, now);
  assert.equal(f.emails.length, 2);
  f.db.prepare("UPDATE leads SET status='pending', next_attempt=?, mail_accepted_at=NULL").run(now+86400000);
  await drainOutbox(f.env, now);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM leads').get().n, 1);
  f.db.prepare("UPDATE leads SET status='mail_accepted', mail_accepted_at=?").run(now-31*86400000);
  await drainOutbox(f.env, now);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM leads').get().n, 0);
});
test('atomic per-phone cap prevents excessive repeated leads without discarding prior requests', async t => {
  const f = fixture(t);
  for (let i=0;i<3;i++) { assert.equal((await f.submit({ ...f.payload, id: crypto.randomUUID() })).status, 202); await Promise.all(f.pending); }
  assert.equal((await f.submit()).status, 429);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM leads').get().n, 3);
});
test('API exposes neither submitted details nor a public outbox', async t => {
  const f = fixture(t);
  for (const path of ['/api/leads/'+f.payload.id, '/api/admin', '/api/outbox']) assert.equal((await worker.fetch(new Request(origin+path), f.env, f.ctx)).status,404);
  assert.equal((await worker.fetch(new Request(origin+'/api/leads'), f.env, f.ctx)).status,405);
});
test('mail acceptance followed by a database outage is recovered with the same request ID', async t => {
  const f = fixture(t); const prepare = f.env.LEADS_DB.prepare;
  f.env.LEADS_DB.prepare = sql => {
    if (sql.includes("SET status = 'mail_accepted'")) throw new Error('DB write unavailable');
    return prepare(sql);
  };
  assert.equal((await f.submit()).status, 202); await Promise.all(f.pending);
  const row = f.db.prepare('SELECT * FROM leads').get();
  assert.equal(row.status, 'sending'); assert.equal(f.emails.length, 1);
  f.env.LEADS_DB.prepare = prepare;
  await drainOutbox(f.env, row.lease_until + 1);
  assert.equal(f.emails.length, 2);
  assert.equal(f.emails[0].subject, f.emails[1].subject);
  assert.equal(f.db.prepare('SELECT status FROM leads').get().status, 'mail_accepted');
});
test('a saved request survives loss of the final database acknowledgement', async t => {
  const f = fixture(t); const prepare = f.env.LEADS_DB.prepare; let reads = 0;
  f.env.LEADS_DB.prepare = sql => {
    if (sql.startsWith('SELECT payload_hash') && ++reads === 2) throw new Error('lost acknowledgement');
    return prepare(sql);
  };
  assert.equal((await f.submit()).status, 503);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM leads').get().n, 1);
  f.env.LEADS_DB.prepare = prepare;
  assert.equal((await f.submit()).status, 202);
  await drainOutbox(f.env);
  assert.equal(f.emails.length, 1);
});
