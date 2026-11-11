# 2. Account farms and referral rings

One person running many accounts collects every per-account incentive many times: sign-up bonuses, streaks, referral commission, and offers that pay once per user. A referral program adds a multiplier, because it pays one account for the activity of others that may be the same person.

## Signals

| Signal | What it suggests | Strength |
| --- | --- | --- |
| Several accounts cash out to one payout destination | One beneficiary | Strong |
| Several accounts on one device ID | One operator, or a shared family device | Strong on mobile, weaker on web |
| Same offers completed in the same order across accounts | One person working through a list | Strong when many accounts match |
| Sign-up bursts from one network | Batch creation | Medium |
| Referred accounts that stop right after the referral milestone | Accounts created to trigger commission | Medium |
| Referral tree with a reversal rate far above the site rate | Advertisers rejecting the tree's results | Strong, but late |
| Referrer and referred share device, network and destination | Self-referral | Strong |
| Accounts that refer each other in a loop | Referral ring | Strong |

## Detection logic

**Compare accounts with each other, not one at a time.** Store, for every account, the device IDs your app creates, the sign-up network, and a keyed hash of every payout destination. Then look for values shared across accounts. [snippets/sql/queries](../snippets/sql/queries/) has the queries:

- `accounts_per_device.sql`
- `shared_payout_destinations.sql`
- `signup_bursts.sql`
- `identical_offer_sequences.sql`
- `referral_tree_reversal_rate.sql`

**Link accounts into clusters and review the cluster.** [link-accounts.mjs](../snippets/node/link-accounts.mjs) weights each kind of shared value and unions accounts whose combined evidence passes a threshold. It skips values shared by very many accounts, because a carrier NAT address or a campus network links strangers.

```js
import { linkAccounts } from './snippets/node/link-accounts.mjs';

const clusters = linkAccounts(accounts, {
  weights: { payout: 3, device: 2, network: 1 }, // example weights
  linkAt: 3,      // a shared network alone never links two accounts
  maxShare: 20,   // ignore values shared by more than 20 accounts
});
// [{ members: ['a', 'b'], sharedKinds: ['network', 'payout'] }]
```

**Pay referrals from released earnings only.** This one design rule removes most of the profit from referral fraud. Create the referrer's commission when the referred user's reward leaves the hold, not when it is credited, and store the source transaction ID on the commission. When that transaction is reversed, the commission goes with it. [ledger.mjs](../snippets/node/ledger.mjs) does exactly this in `releaseDue` and `applyPostback`; the test in [snippets.test.mjs](../test/snippets.test.mjs) shows a commission disappearing with its source.

**Cap what a new referrer can earn.** A ceiling on referral earnings until the referrer has their own clean history limits the damage from anything that slips through. Pick the number from your own data.

**Remove bonuses that pay on sign-up.** A bonus paid when an account is created is the easiest money a farm can collect. Tie any one-time bonus to a released reward.

## Responding

1. Freeze, do not ban. Hold pending cash-outs and commissions across the cluster.
2. List the links between accounts and the kinds of evidence.
3. Compare behavior and outcomes: offer sequences, timing, reversals.
4. Decide per account. A real person invited by a cheating referrer keeps their own rewards.
5. Record the signals and the decision ([chapter 10](10-review-queues.md)).

## False positives

- **Families and roommates** share devices, Wi-Fi and sometimes a payment account. Check whether the accounts behave like different people.
- **Carrier-grade NAT** puts many unrelated mobile users behind one address. RFC 6598 reserves 100.64.0.0/10 as shared address space for this ([RFC 6598](https://www.rfc-editor.org/rfc/rfc6598)), and public addresses are shared the same way.
- **A creator posts a link** and a hundred real viewers sign up within an hour. A burst from many networks is a campaign; a burst from one network is the pattern to look at.
- **Popular phones** produce identical browser fingerprints. On the web, a fingerprint match is a reason to look, not a link.
- **Identical sequences of the top offers** happen naturally when everyone sees the same three offers first. Compare longer sequences and include timing.

## Further reading

- [How to prevent referral fraud on a rewards site](https://moonetix.com/academy/traffic-quality/prevent-referral-fraud)
- [Stop multi-accounting and VPN abuse](https://moonetix.com/academy/traffic-quality/stop-multi-accounting-vpn-abuse)
- [How to stop fake sign-ups on a rewards site](https://moonetix.com/academy/traffic-quality/stop-fake-signups-rewards-site)
- [Referral program design](https://moonetix.com/academy/strategy/referral-program-design)
- [What is device fingerprinting?](https://moonetix.com/academy/glossary/what-is-device-fingerprinting)
