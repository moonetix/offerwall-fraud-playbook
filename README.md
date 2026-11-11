# Offerwall fraud playbook

**How to keep a rewards program honest: the signals, the detection logic, and tested code for publishers who pay users for completing offers.**

[![CI](https://github.com/moonetix/offerwall-fraud-playbook/actions/workflows/ci.yml/badge.svg)](https://github.com/moonetix/offerwall-fraud-playbook/actions/workflows/ci.yml)
[![Text: CC BY 4.0](https://img.shields.io/badge/text-CC%20BY%204.0-lightgrey.svg)](LICENSE)
[![Code: MIT](https://img.shields.io/badge/code-MIT-blue.svg)](snippets/LICENSE)
[![Tested: Node 22 and PHP 8](https://img.shields.io/badge/tested-Node%2022%20%7C%20PHP%208-555.svg)](#the-code)
[![Maintained by Moonetix](https://img.shields.io/badge/maintained%20by-Moonetix-004ABB.svg)](https://moonetix.com)

Maintained by [Moonetix](https://moonetix.com).

GPT sites, rewards apps, games with an earn screen, and Discord or Telegram communities with a points economy all share one weakness: they turn user activity into money, and some of that activity is not what it claims to be. This playbook is vendor-neutral. It covers what to look for, how to find it in your own data, and how to act without punishing honest users. The code runs, and the tests prove it.

## Chapters

| # | Chapter | What it covers |
| --- | --- | --- |
| 1 | [Threat model](chapters/01-threat-model.md) | Assets, adversaries, where value enters and leaves, the timing problem |
| 2 | [Account farms and referral rings](chapters/02-account-farms-and-referral-rings.md) | Linking accounts, paying referrals from released earnings |
| 3 | [VPN, proxy, datacenter and residential proxy traffic](chapters/03-vpn-proxy-and-datacenter-traffic.md) | Network checks, Tor and Private Relay lists, shared address space |
| 4 | [Emulators and device farms](chapters/04-emulators-and-device-farms.md) | Play Integrity, App Attest, server-side farm patterns, tiered responses |
| 5 | [Postback forgery and replay](chapters/05-postback-forgery-and-replay.md) | Signatures, signed fields, idempotency, key handling |
| 6 | [Chargebacks, reversals, and how to absorb them](chapters/06-reversals-holds-and-clawbacks.md) | Hold ledger, tiered holds, clawbacks, negative balances |
| 7 | [Cash-out fraud](chapters/07-cashout-fraud.md) | Shared destinations, earn-and-exit, account takeover |
| 8 | [KYC-lite signals](chapters/08-kyc-lite-signals.md) | Verification levels, triggers, age, privacy |
| 9 | [What to log](chapters/09-what-to-log.md) | Events, fields, retention, hashing what you only compare |
| 10 | [Review queues](chapters/10-review-queues.md) | Triggers, priorities, decisions, appeals, feedback into rules |
| 11 | [Launch checklist](chapters/11-launch-checklist.md) | 30 checks before real users arrive |
| 12 | [Incident response](chapters/12-incident-response.md) | Contain, scope, remediate, review |

Chapters 2 to 8 follow the same order: **signals**, **detection logic** with code, **responding**, **false positives**, and further reading. Start with chapter 1 and the checklist; read the rest when the problem in front of you needs it.

## Five rules that carry most of the weight

1. **Hold before you pay.** If nothing can be withdrawn until reversal risk has passed, most fraud stops being profitable. ([6](chapters/06-reversals-holds-and-clawbacks.md))
2. **Verify every postback and credit each transaction once,** enforced by a unique key, not by a check in code. ([5](chapters/05-postback-forgery-and-replay.md))
3. **Compare accounts with each other.** Shared payout destinations and devices expose more than any single-account check. ([2](chapters/02-account-farms-and-referral-rings.md))
4. **Put the strongest checks at cash-out.** It is the last point where a mistake costs nothing. ([7](chapters/07-cashout-fraud.md))
5. **Act on combinations, softly first.** Limit, hold, review, and only then deny, with a human appeal. ([10](chapters/10-review-queues.md))

## The code

Every snippet in the chapters comes from [snippets/](snippets/) and is covered by tests. No dependencies: Node.js 22 (`node:sqlite`, `node:crypto`) and PHP 8.1+ with PDO SQLite.

| File | Purpose |
| --- | --- |
| [snippets/sql/schema.sql](snippets/sql/schema.sql) | Ledger, devices, destinations, postback log, risk events, review queue |
| [snippets/sql/queries/](snippets/sql/queries/) | Seven detection queries: shared devices and destinations, sign-up bursts, reversal rates per user and per referral tree, identical offer sequences, earn-and-exit |
| [snippets/node/verify-postback.mjs](snippets/node/verify-postback.mjs) | HMAC-SHA256 postback check with constant-time comparison |
| [snippets/node/ledger.mjs](snippets/node/ledger.mjs) | Hold ledger: credit once, release, referral commission, reversal and clawback |
| [snippets/node/ip-ranges.mjs](snippets/node/ip-ranges.mjs) | IPv4 and IPv6 CIDR matching; Tor exit list and Private Relay loaders |
| [snippets/node/link-accounts.mjs](snippets/node/link-accounts.mjs) | Weighted account linking with union-find |
| [snippets/node/risk-tier.mjs](snippets/node/risk-tier.mjs) | Signals to allow, limit, review or deny |
| [snippets/php/postback.php](snippets/php/postback.php) | The same postback handler and ledger in PHP with PDO |

```sh
git clone https://github.com/moonetix/offerwall-fraud-playbook.git
cd offerwall-fraud-playbook
node --test                        # 11 tests: signatures, ledger, IP ranges, linking, tiers, every SQL query, house style
php test/php/postback_test.php     # 25 checks against the same signed postbacks
```

The postback fixtures in [test/fixtures/postbacks.json](test/fixtures/postbacks.json) were signed by the Moonetix postback code with a test key that is in the file, plus tampered copies. The SQL uses SQLite syntax; it ports to PostgreSQL with minor changes, and the PHP file notes the one change MySQL needs.

The weights, thresholds and hold lengths in the code are examples so the code runs. They are not recommendations and not anyone's production values. Set yours from your own review outcomes and reversal data.

## What you will not find here

This playbook describes attacker behavior only as far as needed to recognize it. It does not explain how to get around any check, it does not name commercial fraud detection vendors, and it does not publish any network's internal thresholds. Pull requests that add evasion techniques will be closed.

Facts about third parties, such as Google Play Integrity verdicts, Apple App Attest, the Tor exit list and iCloud Private Relay ranges, link to the vendor's own documentation, checked November 2026.

## Licenses

- **Text** (the chapters and this README): [Creative Commons Attribution 4.0 International](LICENSE). Share and adapt it with credit to "Moonetix, Offerwall fraud playbook" and a link to this repository.
- **Code** (everything in [snippets/](snippets/) and [test/](test/)): [MIT](snippets/LICENSE), so you can paste it into closed-source projects.

To cite the playbook, use [CITATION.cff](CITATION.cff) or the "Cite this repository" button on GitHub.

## About Moonetix

Moonetix is a pay-per-result affiliate network. Publishers add its offerwall to apps, games, websites and communities, and their users earn the publisher's own currency by completing offers. Every credit and every reversal reaches the publisher as a signed postback with one transaction ID, which is what chapters 5 and 6 build on. Docs: [docs.moonetix.com](https://docs.moonetix.com). Publisher sign-up: [moonetix.com/register](https://moonetix.com/register). Related: [affiliate-postback-macros](https://github.com/moonetix/affiliate-postback-macros) and [offerwall-postback-handlers](https://github.com/moonetix/offerwall-postback-handlers).
