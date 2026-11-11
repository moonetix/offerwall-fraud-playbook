import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

import { verifyPostback } from '../snippets/node/verify-postback.mjs';
import { applyPostback, releaseDue, balances, toMicros } from '../snippets/node/ledger.mjs';
import { createMatcher, parseTorExitList, parsePrivateRelayCsv, networkOf } from '../snippets/node/ip-ranges.mjs';
import { linkAccounts } from '../snippets/node/link-accounts.mjs';
import { riskTier } from '../snippets/node/risk-tier.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = JSON.parse(readFileSync(join(ROOT, 'test/fixtures/postbacks.json'), 'utf8'));
const byName = Object.fromEntries(fixtures.cases.map((c) => [c.name, new URLSearchParams(c.query)]));
const DAY = 86400;

function freshDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(join(ROOT, 'snippets/sql/schema.sql'), 'utf8'));
  return db;
}

function sql(name) {
  return readFileSync(join(ROOT, 'snippets/sql/queries', `${name}.sql`), 'utf8');
}

const fromParams = (p) => ({ tx: p.get('tx'), user: p.get('user'), reward: p.get('reward'), status: p.get('status'), offerId: p.get('offer_id') });

test('signature check accepts real postbacks and rejects tampered ones', () => {
  for (const c of fixtures.cases) {
    assert.equal(verifyPostback(new URLSearchParams(c.query), fixtures.key), c.valid, c.name);
  }
  assert.equal(verifyPostback(byName.credit, ''), false, 'empty key never verifies');
});

test('amounts are parsed exactly', () => {
  assert.equal(toMicros('75.5'), 75_500_000);
  assert.equal(toMicros('0.000001'), 1);
  assert.equal(toMicros('150'), 150_000_000);
  for (const bad of ['-1', '1e3', '1.1234567', '', '0x10']) assert.throws(() => toMicros(bad), RangeError, bad);
});

test('ledger: retries, replays and reversals during the hold cost nothing', () => {
  const db = freshDb();
  const opts = { now: 1000, holdSeconds: 7 * DAY };
  assert.equal(applyPostback(db, fromParams(byName.credit), opts), 'credited');
  assert.equal(applyPostback(db, fromParams(byName.credit), opts), 'duplicate');
  assert.deepEqual(balances(db, 'u_alice'), { held: 500_000_000, available: 0, commissions: 0, cashedOut: 0, spendable: 0 });

  assert.equal(applyPostback(db, fromParams(byName['reversal of the credit']), { ...opts, now: 2000 }), 'reversed_while_held');
  assert.equal(applyPostback(db, fromParams(byName['reversal of the credit']), { ...opts, now: 2001 }), 'duplicate');
  assert.equal(applyPostback(db, fromParams(byName.credit), { ...opts, now: 3000 }), 'duplicate', 'replayed credit after reversal');
  assert.equal(balances(db, 'u_alice').held, 0);

  assert.equal(applyPostback(db, fromParams(byName['reversal without a credit']), opts), 'ignored');
  const lateCredit = { tx: 'tx_2005', user: 'u_carol', reward: '900', status: '1' };
  assert.equal(applyPostback(db, lateCredit, opts), 'duplicate', 'tombstone blocks a late credit');
  assert.equal(balances(db, 'u_carol').held, 0);
});

test('ledger: release, referral commission, and clawback after cash-out', () => {
  const db = freshDb();
  db.prepare('INSERT INTO users (id, created_at) VALUES (?, 0)').run('u_ref');
  db.prepare('INSERT INTO users (id, created_at, referred_by) VALUES (?, 0, ?)').run('u_bob', 'u_ref');
  const opts = { now: 0, holdSeconds: 3 * DAY };
  applyPostback(db, fromParams(byName['credit for bob']), opts);
  applyPostback(db, fromParams(byName['decimal reward']), { ...opts, now: 5 * DAY });

  assert.equal(releaseDue(db, { now: 3 * DAY, referralRateBp: 1000 }), 1);
  assert.deepEqual(balances(db, 'u_bob'), { held: 75_500_000, available: 300_000_000, commissions: 0, cashedOut: 0, spendable: 300_000_000 });
  assert.equal(balances(db, 'u_ref').commissions, 30_000_000);
  assert.equal(releaseDue(db, { now: 3 * DAY, referralRateBp: 1000 }), 0, 'release is idempotent');

  db.prepare(`INSERT INTO cashouts (user_id, amount_micros, method, destination_hash, state, requested_at)
              VALUES ('u_bob', 300000000, 'paypal', 'h1', 'paid', ?)`).run(4 * DAY);
  const reversal = { tx: 'tx_2003', user: 'u_bob', reward: '300', status: '2' };
  assert.equal(applyPostback(db, reversal, { ...opts, now: 6 * DAY }), 'reversed_after_release');
  assert.equal(balances(db, 'u_bob').spendable, -300_000_000, 'debt is visible, not lost');
  assert.equal(balances(db, 'u_ref').commissions, 0, 'commission follows its source');
});

test('ip ranges: IPv4, IPv6, Tor list and Private Relay CSV', () => {
  const tor = parseTorExitList('# comment\n171.25.193.25\n80.67.167.81\nnot-an-ip\n');
  const relay = parsePrivateRelayCsv('172.224.226.0/27,GB,GB-EN,London,\n2a02:26f7:b3c0:4000::/64,GB,GB-EN,London,\n');
  const match = createMatcher([...tor, ...relay, { cidr: '198.51.100.0/24', label: 'hosting' }, { cidr: '2001:db8::/32', label: 'hosting' }]);
  assert.equal(match('171.25.193.25'), 'tor_exit');
  assert.equal(match('171.25.193.26'), null);
  assert.equal(match('172.224.226.31'), 'icloud_private_relay');
  assert.equal(match('172.224.226.32'), null);
  assert.equal(match('2a02:26f7:b3c0:4000::1234'), 'icloud_private_relay');
  assert.equal(match('198.51.100.200'), 'hosting');
  assert.equal(match('2001:db8:ffff::1'), 'hosting');
  assert.equal(match('::ffff:198.51.100.7'), null, 'mapped addresses are a different family');
  assert.equal(match('garbage'), null);
  assert.equal(networkOf('203.0.113.77'), '203.0.113.0/24');
  assert.equal(networkOf('2001:db8:abcd:12::1'), '2001:db8:abcd::/48');
});

test('account linking: strong shared values link, crowded values do not', () => {
  const crowd = Array.from({ length: 30 }, (_, i) => ({ id: `cgnat${i}`, signals: { network: ['100.64.0.0/24'] } }));
  const clusters = linkAccounts([
    { id: 'a', signals: { payout: ['p1'], device: ['d1'], network: ['n1'] } },
    { id: 'b', signals: { payout: ['p1'], device: ['d2'], network: ['n1'] } },
    { id: 'c', signals: { device: ['d2'], network: ['n9'] } },
    { id: 'sister', signals: { network: ['n7'] } },
    { id: 'brother', signals: { network: ['n7'] } },
    ...crowd,
  ]);
  assert.deepEqual(clusters, [{ members: ['a', 'b'], sharedKinds: ['network', 'payout'] }]);
});

test('risk tiers: soft signals never deny on their own', () => {
  assert.equal(riskTier({ countryMismatch: true }).tier, 'allow');
  assert.equal(riskTier({ datacenterIp: true }).tier, 'limit');
  assert.equal(riskTier({ sharedPayoutDestination: true, velocity: true }).tier, 'review');
  const everything = { datacenterIp: true, vpnOrProxy: true, torExit: true, sharedDevice: true, velocity: true, highReversalRate: true };
  assert.equal(riskTier(everything).tier, 'review');
  assert.deepEqual(riskTier({ velocity: true, tamperedApp: true }), { tier: 'deny', score: null, reasons: ['tamperedApp'] });
});

test('detection queries return the seeded patterns', () => {
  const db = freshDb();
  const users = [
    ['u1', 100, null, 'n1'], ['u2', 200, 'u1', 'n1'], ['u3', 300, 'u1', 'n1'], ['u4', 400, 'u1', 'n1'],
    ['u5', 90000, null, 'n2'],
  ];
  for (const [id, at, ref, net] of users) {
    db.prepare('INSERT INTO users (id, created_at, referred_by, signup_network) VALUES (?, ?, ?, ?)').run(id, at, ref, net);
  }
  for (const [u, d] of [['u2', 'd1'], ['u3', 'd1'], ['u4', 'd1'], ['u5', 'd5']]) {
    db.prepare('INSERT INTO user_devices VALUES (?, ?, 0)').run(u, d);
  }
  for (const [u, h] of [['u2', 'w1'], ['u3', 'w1'], ['u5', 'w5']]) {
    db.prepare("INSERT INTO payout_destinations VALUES (?, 'crypto', ?, 0)").run(u, h);
  }
  let n = 0;
  const credit = (u, offer, at, state = 'available') => db.prepare(`INSERT INTO reward_ledger
      (transaction_id, user_id, offer_id, amount_micros, state, credited_at) VALUES (?, ?, ?, 1000000, ?, ?)`)
    .run(`t${++n}`, u, offer, state, at);
  for (const u of ['u2', 'u3', 'u4']) {
    credit(u, 'o7', 1000); credit(u, 'o3', 1100, 'reversed'); credit(u, 'o9', 1200, 'reversed');
  }
  credit('u5', 'o3', 1000); credit('u5', 'o7', 5000); credit('u5', 'o9', 9000);
  db.prepare("INSERT INTO cashouts (user_id, amount_micros, method, destination_hash, state, requested_at) VALUES ('u2', 1000000, 'crypto', 'w1', 'paid', 1300)").run();

  assert.deepEqual(db.prepare(sql('accounts_per_device')).all({ min_accounts: 2 }).map((r) => [r.device_id, r.accounts]), [['d1', 3]]);
  assert.deepEqual(db.prepare(sql('shared_payout_destinations')).all().map((r) => [r.destination_hash, r.accounts]), [['w1', 2]]);
  assert.deepEqual(db.prepare(sql('signup_bursts')).all({ since: 0, min_signups: 3 }).map((r) => [r.signup_network, r.signups]), [['n1', 4]]);
  const rates = db.prepare(sql('reversal_rate_by_user')).all({ min_credits: 3 });
  assert.equal(rates[0].reversal_rate, 0.667);
  assert.equal(rates.at(-1).user_id, 'u5');
  const tree = db.prepare(sql('referral_tree_reversal_rate')).all({ min_credits: 3 });
  assert.deepEqual([tree[0].referrer_id, tree[0].referred_accounts, tree[0].tree_rate, tree[0].site_rate], ['u1', 3, 0.667, 0.5]);
  const seq = db.prepare(sql('identical_offer_sequences')).all({ first_n: 3, min_accounts: 2 });
  assert.deepEqual(seq.map((r) => [r.sequence, r.accounts]), [['o7>o3>o9', 3]]);
  const exit = db.prepare(sql('earn_and_exit')).all({ max_seconds: 3600, now: 1300 + 30 * 86400, quiet_seconds: 14 * 86400 });
  assert.deepEqual(exit.map((r) => [r.user_id, r.seconds_to_cashout]), [['u2', 300]]);
});

test('every query file is exercised by a test', () => {
  const src = readFileSync(fileURLToPath(import.meta.url), 'utf8');
  for (const f of readdirSync(join(ROOT, 'snippets/sql/queries'))) {
    assert.ok(src.includes(`sql('${f.replace(/\.sql$/, '')}')`), f);
  }
});
