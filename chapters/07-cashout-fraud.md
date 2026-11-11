# 7. Cash-out fraud

Cash-out is where every other kind of fraud turns into a loss. Put the strongest checks here, because this is the last point at which a mistake costs nothing.

## Signals

- The payout destination is already used by another account.
- The destination changed shortly before a large cash-out, or on an old account that suddenly changed device or country.
- The account earned to the minimum and requested a cash-out within minutes of the first credit, then went quiet (`earn_and_exit.sql`).
- Network or device signals at cash-out differ from the account's history: a new country, a flagged connection, a new device.
- Cash-out requests in bursts across accounts, to similar destinations.
- First cash-out on a new account, or an amount far above the account's usual size.
- Several failed or rejected cash-out attempts with different destinations.

## Detection logic

**Hash destinations, then compare.** Store an HMAC of the normalized destination (lowercased email, trimmed wallet address) with a server-side key. You can then find shared destinations without keeping the raw value in your fraud tables. `shared_payout_destinations.sql` returns every destination used by more than one account.

**One destination per account.** Flag a destination already attached to another account and hold cash-outs from both until reviewed.

**Re-run network and device checks at request time.** A verdict from sign-up says nothing about who is cashing out today.

**Route by risk, not only by amount.** Combine signals with [risk-tier.mjs](../snippets/node/risk-tier.mjs). Send to the review queue:

- First cash-outs.
- Amounts above your manual-review threshold.
- Any request whose tier is `review`.
- Any account with a balance that went negative after a reversal.

**Match payout speed to reversibility.** Gift card codes and most crypto transfers cannot be recalled. Use longer holds or a review for those methods, shorter ones where you have recourse.

**Check the balance from the ledger at request time,** inside the same transaction that records the request. A cash-out computed from a cached balance can be submitted twice.

## Account takeover

A stolen account cashes out to a new destination. Signals: password reset or email change followed by a destination change and a cash-out, a new device and country, a login pattern unlike the owner's. Require re-authentication and a confirmation sent to the existing email for destination changes, and add a short delay before a new destination can receive money.

## Responding

- Hold, then ask. Most cases are resolved by a verification step ([chapter 8](08-kyc-lite-signals.md)) or a review.
- If you reject, say which rule applies and how to appeal. Do not reveal which signal fired.
- Never move the rules for a cash-out already requested.

## False positives

- Couples and families pay out to one shared account.
- Users change wallets or email addresses for ordinary reasons.
- Many honest users earn once and leave. Fast cash-out alone is not fraud.

## Further reading

- [Rewards site payout methods](https://moonetix.com/academy/monetization/rewards-site-payout-methods)
- [Gift card APIs for rewards apps](https://moonetix.com/academy/monetization/gift-card-apis-rewards-apps)
- [PayPal payouts for rewards sites](https://moonetix.com/academy/monetization/paypal-payouts-rewards-sites)
- [Stop multi-accounting and VPN abuse](https://moonetix.com/academy/traffic-quality/stop-multi-accounting-vpn-abuse)
