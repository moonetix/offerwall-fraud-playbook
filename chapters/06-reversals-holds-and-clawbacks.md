# 6. Chargebacks, reversals, and how to absorb them

A reversal (often called a chargeback in affiliate marketing) takes back a result that was already credited. The advertiser found fraud, the user's purchase was refunded or disputed, or the offer requirements turned out not to be met. Reversals are normal. What decides whether they hurt is whether the reward has already left your system.

## How reversals arrive

Networks signal them differently, so read your network's docs and write the handler for that format. On Moonetix a reversal is a new postback with `status=2`, the same `transaction_id` as the credit, and the same positive `reward` and `payout`; the payout is deducted from your Moonetix balance ([docs.moonetix.com/credits-and-reversals](https://docs.moonetix.com/credits-and-reversals#how-we-signal)). For other networks see [affiliate-postback-macros](https://github.com/moonetix/affiliate-postback-macros#reversals-and-responses).

## Three states, not one balance

Keep every reward as its own ledger row with a state and a release date. Never add straight into a single balance column.

| State | Meaning | Can the user cash out? |
| --- | --- | --- |
| `held` | Credited by the network; your hold has not passed | No |
| `available` | Hold passed | Yes |
| `reversed` | Taken back by the network | No |

"Pending at the offerwall" is a fourth state that lives on the network's side: the result is still being checked and no postback has been sent. Show it separately so users do not confuse it with your hold.

The ledger in [ledger.mjs](../snippets/node/ledger.mjs) and the schema in [schema.sql](../snippets/sql/schema.sql) implement this:

- **Status 1** inserts a `held` row with `release_at = now + hold`. A repeat does nothing.
- **Status 2 while held** marks the row `reversed`. The user never had the money; nothing is lost.
- **Status 2 after release** marks the row `reversed`. Balances are derived from rows, so the spendable balance drops, below zero if the user already cashed out. The debt is visible instead of silently lost.
- **Referral commissions** are created on release, linked to the source transaction, and reversed with it.

```js
import { applyPostback, releaseDue, balances } from './snippets/node/ledger.mjs';

applyPostback(db, { tx, user, reward, status }, { now, holdSeconds: holdFor(user, payout) });
releaseDue(db, { now, referralRateBp: 1000 });  // run every few minutes; 10% referral rate as an example
balances(db, user);  // { held, available, commissions, cashedOut, spendable }
```

## Setting the hold

The hold should cover the window in which most of your reversals arrive, and no more. Measure it: for every reversal, record the days between credit and reversal, per offer type. After a few hundred reversals you can see where they bunch up.

Tier the hold instead of applying one length to everyone:

| Factor | Shorter hold | Longer hold |
| --- | --- | --- |
| Account history | Months of activity, clean past cash-outs | New account, first cash-out |
| Linked accounts | None | Shares a device or destination |
| Reward size | Small | Large single rewards |
| Offer type | Results that become final quickly | Purchase and subscription offers |
| Recent reversals | None | Any in the recent past; reset to the longest tier |

Use the payout in US dollars, where the postback carries it, as the size input. It is steadier than your own currency. Remember that unsigned fields are for decisions like this one, never for amounts.

## When a reversal arrives after cash-out

Decide the policy before launch and put it in your terms:

- **Negative balance:** the user's next earnings repay the debt before anything becomes spendable. This is what the derived-balance ledger gives you by default.
- **Withdrawal hold:** no cash-out while the balance is below zero.
- **Write-off:** accept the loss on small amounts and record it.

Pick one per case type, apply it consistently, and show the user the reversed offer, its date and the amount.

## Reversal rate as a signal

Track reversal rate per user (`reversal_rate_by_user.sql`), per referral tree (`referral_tree_reversal_rate.sql`), per sub ID and per country. A source whose rate climbs is the earliest outside evidence of fraud you will get. It is late, but it is reliable.

## False positives

- A single reversal on an honest account is ordinary. Advertisers make mistakes and users get refunds.
- Some offer types reverse more than others. Compare a user with users who did the same offers, not with your site average.
- Never take back more than the original transaction credited, and never twice.

## Further reading

- [Reward hold periods](https://moonetix.com/academy/monetization/reward-hold-periods)
- [What is a chargeback in affiliate marketing?](https://moonetix.com/academy/glossary/what-is-a-chargeback-affiliate)
- [What is a reversal rate?](https://moonetix.com/academy/earnings/what-is-a-reversal-rate)
- [Publisher earnings and reversals](https://moonetix.com/academy/earnings/publisher-earnings-and-reversals)
- [Life of a conversion](https://moonetix.com/academy/earnings/life-of-a-conversion)
- [Credits and reversals](https://docs.moonetix.com/credits-and-reversals)
