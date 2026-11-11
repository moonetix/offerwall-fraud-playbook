# 10. Review queues

Automated rules decide the clear cases. Everything in between goes to a person. A review queue makes that work consistent, fast and auditable.

## What enters the queue

| Subject | Trigger |
| --- | --- |
| Cash-out | First cash-out, amount above your review threshold, risk tier `review`, negative balance after a reversal |
| User | Several independent risk signals, repeated network flags at cash-out, high personal reversal rate |
| Cluster | Accounts linked by shared destination or device ([chapter 2](02-account-farms-and-referral-rings.md)) |

[schema.sql](../snippets/sql/schema.sql) defines `review_queue` with a partial unique index, so a subject can have only one open case at a time and repeated triggers do not flood the queue:

```sql
CREATE UNIQUE INDEX review_queue_open ON review_queue (subject_type, subject_id) WHERE state = 'open';
```

## Prioritize by exposure

Sort by money at risk and by age, not by arrival time. A pending cash-out is more urgent than a cluster with nothing to withdraw. Set a target time per priority and measure it; users waiting on a cash-out are your most likely support tickets.

## What a reviewer sees

One screen per case, with:

- The reasons that opened the case, by name.
- The account's ledger: credits, holds, reversals, cash-outs.
- Linked accounts and what links them.
- Network and device history at sign-up, wall opens and cash-outs.
- Previous cases and their decisions.

If the reviewer has to run queries to decide, the screen is missing something.

## Decisions

Use a short, fixed list so outcomes can be counted:

| Decision | Effect |
| --- | --- |
| `release` | Cash-out proceeds; account continues normally |
| `hold` | Funds stay held for a set period, then re-review |
| `verify` | User is asked for a verification step ([chapter 8](08-kyc-lite-signals.md)) |
| `reject` | Cash-out rejected under a named rule; rewards from rule-breaking activity removed |
| `close` | Account closed under a named rule |

Every decision records the reviewer, the time and a one-line note. The note is for the next reviewer and for the appeal.

## Cluster cases

Review a cluster as one case, then decide per account. A real person invited by a cheating referrer keeps what they earned. Freezing cash-outs across the cluster while the case is open stops money leaving through the account you have not looked at yet.

## Appeals

Every rejection and closure gets an appeal path to a different person. Track the overturn rate per rule. A rule that is overturned often is a bad rule, and fixing it is cheaper than reviewing its output forever.

## Feedback into the rules

The queue is your labeled data. Each month, compare signals with decisions: which signals appear in cases that were released, and which in cases that were rejected. Lower the weight of signals that mostly fire on honest users, and raise the ones that rarely do. The weights in [risk-tier.mjs](../snippets/node/risk-tier.mjs) are a starting point, not a benchmark.

## Separation of duties

The person who approves a cash-out should not be able to change that account's balance, and no one should approve their own cases or those of accounts they are linked to. Log every admin action ([chapter 9](09-what-to-log.md)).

## Further reading

- [Missing reward tickets](https://moonetix.com/academy/publisher-basics/missing-reward-tickets)
- [Rewards site terms of service](https://moonetix.com/academy/monetization/rewards-site-terms-of-service)
- [How to prevent referral fraud](https://moonetix.com/academy/traffic-quality/prevent-referral-fraud)
