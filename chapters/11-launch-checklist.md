# 11. Launch checklist

Thirty checks to finish before real users reach your earn page. Each links to the chapter that explains it. Copy this file into an issue and tick it off.

## Rules and terms

- [ ] 1. Terms allow one account per person and say whether a household or device limit applies. ([2](02-account-farms-and-referral-rings.md))
- [ ] 2. Terms prohibit VPNs and proxies while earning, self-referral, and paying others to sign up. ([3](03-vpn-proxy-and-datacenter-traffic.md), [2](02-account-farms-and-referral-rings.md))
- [ ] 3. Terms say rewards can be held, and taken back when a network reverses the result. ([6](06-reversals-holds-and-clawbacks.md))
- [ ] 4. Terms state the minimum age, and the sign-up flow enforces it before anyone earns. ([8](08-kyc-lite-signals.md))
- [ ] 5. Terms describe verification at cash-out and the appeal process. ([8](08-kyc-lite-signals.md), [10](10-review-queues.md))
- [ ] 6. The privacy policy lists the fraud-prevention data you collect and how long you keep it. ([9](09-what-to-log.md))
- [ ] 7. Rewards are only for completed offers. Nothing rewards joins, invites, likes, reviews or ratings. ([1](01-threat-model.md))

## Offerwall link and postback

- [ ] 8. The offerwall link is built and signed on the server, for the signed-in user only. ([5](05-postback-forgery-and-replay.md))
- [ ] 9. The postback handler verifies the signature first, with a constant-time comparison. ([5](05-postback-forgery-and-replay.md))
- [ ] 10. Only signed fields decide amounts. ([5](05-postback-forgery-and-replay.md))
- [ ] 11. The transaction ID is a unique key in the database; a replayed credit adds nothing. ([5](05-postback-forgery-and-replay.md))
- [ ] 12. A reversal takes back only what its transaction credited, once, and a reversal for an unknown transaction blocks a later credit. ([6](06-reversals-holds-and-clawbacks.md))
- [ ] 13. The handler answers 2xx only after the commit, and 2xx for duplicates. ([5](05-postback-forgery-and-replay.md))
- [ ] 14. Secrets live in environment variables or a secret store, never in client code or Git, and are never logged. ([5](05-postback-forgery-and-replay.md))
- [ ] 15. A test credit and a test reversal both reached the handler and changed the balance up and back down.

## Ledger and holds

- [ ] 16. Every reward is its own ledger row with a state and a release date. ([6](06-reversals-holds-and-clawbacks.md))
- [ ] 17. Hold lengths are tiered by account age, size and offer type, and will be tuned from your own reversal data. ([6](06-reversals-holds-and-clawbacks.md))
- [ ] 18. Users see pending, on hold and available separately, with a release date. ([6](06-reversals-holds-and-clawbacks.md))
- [ ] 19. Referral commission is created from released earnings only and is reversed with its source. ([2](02-account-farms-and-referral-rings.md))
- [ ] 20. No bonus pays on sign-up alone. ([2](02-account-farms-and-referral-rings.md))
- [ ] 21. The policy for reversals after cash-out (negative balance, hold, write-off) is decided and written down. ([6](06-reversals-holds-and-clawbacks.md))

## Detection

- [ ] 22. Sign-up has a server-verified bot challenge, email confirmation, disposable domain blocking, and rate limits per network and device. ([8](08-kyc-lite-signals.md))
- [ ] 23. Network checks run at sign-up, wall open and cash-out, and relays are treated as shared addresses, not proxies. ([3](03-vpn-proxy-and-datacenter-traffic.md))
- [ ] 24. App builds verify Play Integrity or App Attest on the server at sensitive actions. ([4](04-emulators-and-device-farms.md))
- [ ] 25. Device IDs, sign-up networks and destination hashes are stored per account, and the linking queries run on a schedule. ([2](02-account-farms-and-referral-rings.md))

## Cash-out and review

- [ ] 26. One payout destination per account; a destination shared with another account holds both. ([7](07-cashout-fraud.md))
- [ ] 27. First cash-outs and amounts above a threshold go to review. ([7](07-cashout-fraud.md), [10](10-review-queues.md))
- [ ] 28. Destination changes require re-authentication and a confirmation to the existing email. ([7](07-cashout-fraud.md))
- [ ] 29. The review queue shows the ledger, links and history on one screen, and every decision is recorded with a note. ([10](10-review-queues.md))

## Operations

- [ ] 30. Alerts exist for rejected postback signatures, a jump in reversal rate per source, and a burst of sign-ups from one network, and someone owns them. ([12](12-incident-response.md))

## Further reading

- [Test your app before launch](https://moonetix.com/academy/integrations/test-your-app-before-launch)
- [Integration status explained](https://moonetix.com/academy/publisher-basics/integration-status-explained)
- [Testing and troubleshooting](https://docs.moonetix.com/testing)
