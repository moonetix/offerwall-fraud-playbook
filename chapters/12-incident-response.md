# 12. Incident response

Sooner or later something gets through: a farm that passed every check, a leaked key, a bug that credits twice. The goal is to stop the loss in minutes, understand it in hours, and fix the cause in days, without hurting the users who did nothing wrong.

## Common triggers

- A network reports a reversal wave or flags a sub ID.
- Your own alert fires: rejected signatures, a jump in duplicates, sign-up bursts, a reversal rate spike.
- Cash-out volume jumps without a matching rise in credits.
- A user reports a balance they did not earn, or one that vanished.

## First hour: contain

1. **Name an owner.** One person coordinates; everyone else reports to them.
2. **Stop money leaving, narrowly.** Pause cash-outs for the affected accounts, cluster or source. Pause all cash-outs only if you cannot scope it. Holds already protect most of the ledger.
3. **If a secret may have leaked, rotate it now.** Postback key, link salt, API keys. Confirm with the network how the switch works so genuine postbacks keep flowing.
4. **If the postback endpoint is being abused,** check that signature failures are rejected and logged, and add the source addresses the network publishes to an allowlist as an extra layer.
5. **Preserve evidence.** Snapshot the relevant ledger rows, postback logs and admin logs before anyone cleans up.

## Same day: scope

- Which accounts, sources and time window? Start from the trigger and walk the links: shared devices, destinations, networks, referral trees.
- What has already left? Separate held, available and cashed-out amounts.
- What will the networks reverse? Expect reversals for the affected results over the following weeks and reserve for them.
- Was any control bypassed, or did one never exist? The answer decides the fix.

## Within days: remediate

- Cancel rewards from rule-breaking activity under the rule your terms state, and reverse commissions built on them.
- Decide per account. Real users caught in the scope get their rewards back and an apology if they were held.
- Fix the cause: the missing check, the rule that did not fire, the bug.
- Add a test or a query that would have caught it, and an alert that will catch it next time.

## Talking to users and partners

- Tell affected users what happened to their account and what they can do, in plain words, without describing the detection.
- Tell your offer partners what you found and what you changed. They see the reversals anyway; hearing it from you first is better for the relationship.
- If personal data was exposed, follow your legal notification duties.

## Post-incident review

Within two weeks, write a short, blameless review:

| Section | Content |
| --- | --- |
| Summary | What happened, in three sentences |
| Timeline | Detection, containment, resolution, with times |
| Impact | Money held, paid, lost; users affected |
| Root cause | The missing or failed control |
| Changes | Each fix, with an owner and a date |
| Signals | What would have caught it earlier |

Feed the signals into your rules and the review queue ([chapter 10](10-review-queues.md)).

## Runbook to prepare before you need it

- Who can pause cash-outs, and how, per account, per cluster and globally.
- How to rotate each secret, and the network contact for each.
- The queries for scoping: the files in [snippets/sql/queries](../snippets/sql/queries/).
- Where evidence is stored and who may access it.

## Further reading

- [Bot traffic on your offerwall: signs of click spam](https://moonetix.com/academy/traffic-quality/bot-click-spam-earn-page)
- [Rotate keys and link salt](https://moonetix.com/academy/integrations/rotate-keys-and-link-salt)
- [Resend a failed postback](https://moonetix.com/academy/integrations/resend-failed-postback)
- [How Moonetix checks traffic](https://moonetix.com/academy/traffic-quality/how-moonetix-checks-traffic)
