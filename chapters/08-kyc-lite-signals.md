# 8. KYC-lite signals

Full identity verification for every user is expensive, intrusive and unnecessary. Most programs verify in layers: cheap checks for everyone, stronger ones only where money or risk is concentrated.

## Verification levels

| Level | What it proves | Cost to the user | When to use |
| --- | --- | --- | --- |
| Email confirmation | Control of a mailbox | Low | Everyone, at sign-up |
| Disposable domain block | The mailbox is not a throwaway service | None | Everyone, at sign-up |
| Bot challenge, verified on the server | A browser that passed a challenge | Low | Sign-up, login, cash-out |
| Phone confirmation | Control of a number | Medium | Before the first cash-out, or above a lifetime amount |
| Device attestation | A genuine app on a genuine device | None | App users, at sensitive actions |
| Payout account in the user's name | A real account at a regulated provider | Low | At cash-out, where the method supports it |
| ID document and selfie | A real person, once | High | Above a cash-out threshold, or when risk signals stack up |

## Detection logic

**Escalate on triggers, not on everyone.** Typical triggers:

- Lifetime cash-outs pass an amount you set.
- A single cash-out is large relative to the account's history.
- The account is in a cluster ([chapter 2](02-account-farms-and-referral-rings.md)) or reaches the `review` tier.
- The account's payout destination is shared.

**One verified identity per account.** Store a keyed hash of the verified identity attributes, not the documents, and check new verifications against it. A second account behind the same identity is a multi-account case.

**Age.** Use the strictest minimum age among the networks you work with; Moonetix requires users to be 16 or older. Ask for the date of birth at sign-up, apply the rule before anyone earns, and check it again when you verify an identity.

**Sanctions and prohibited countries.** If you pay out money, your payment providers will have rules about where you may send it. Apply them at cash-out, based on the verified country, not the IP country.

## Privacy

- A face match from a selfie is biometric data under the GDPR. Collect it only when you need it, keep the result rather than the images where you can, and set a short retention period.
- Say in your privacy policy what you collect for fraud prevention and how long you keep it.
- Never ask for more than the level the situation needs.

## False positives

- Phone verification fails for users on prepaid or virtual numbers, and for countries a provider covers poorly.
- Document checks fail for name transliterations and older documents.
- Some honest users refuse verification on principle. Offer a smaller cash-out limit instead of closing the account.

Every refusal needs a reason and a human appeal.

## Further reading

- [KYC for rewards sites](https://moonetix.com/academy/traffic-quality/kyc-for-rewards-sites)
- [Offerwall age rules](https://moonetix.com/academy/traffic-quality/offerwall-age-rules)
- [Offerwall GDPR](https://moonetix.com/academy/publisher-basics/offerwall-gdpr)
- [Offerwall privacy policy clause](https://moonetix.com/academy/publisher-basics/offerwall-privacy-policy-clause)
- [How to stop fake sign-ups on a rewards site](https://moonetix.com/academy/traffic-quality/stop-fake-signups-rewards-site)
