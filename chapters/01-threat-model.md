# 1. Threat model

A rewards program converts user activity into money. Every control in this playbook exists because that conversion can be triggered by someone who did not do the work, or did it many times under different names. Before choosing controls, write down what you are protecting, who attacks it, and where value leaves your system.

## What you are protecting

| Asset | How it is lost |
| --- | --- |
| Reward balances | Credits from forged or replayed postbacks, or from offers that are later reversed |
| Cash-outs | Money sent to accounts that never earned it, or earned it under rules they broke |
| Bonus budget | Sign-up, referral and streak bonuses collected by accounts created for that purpose |
| Partner trust | Every reversal raises your reversal rate. Offer partners judge your traffic by it |
| Honest users | Overreaching controls that block, hold or ban people who did nothing wrong |

The last row is not decoration. A program that stops fraud by punishing real users loses them, and real users are the only ones who generate revenue that stays.

## Who attacks a rewards program

Describe adversaries by capability, not by motive. The same person can move between levels.

| Level | Capability | Typical goal |
| --- | --- | --- |
| Opportunist | One person, a few accounts, a consumer VPN | Repeat a sign-up bonus, reach offers meant for another country |
| Organized individual | Many accounts, rented proxies, scripts | Farm referrals and bonuses at volume |
| Operator | Device racks or emulators, paid workers, account trading | Treat your program as a revenue stream |
| Technical attacker | Reads your client code and network traffic | Forge or replay reward calls, abuse an unprotected endpoint |
| Insider or partner | Access to your admin, database or support tools | Credit accounts directly, approve their own cash-outs |

## Where value enters and leaves

```text
sign-up --> wall open --> offer started --> postback (credit) --> hold --> available --> cash-out
   |            |                                 |                  |                      |
 bonuses     network and                  signature, idempotency   reversal            payout destination,
 referrals   device checks                                         (status 2)          review, KYC
```

Two points carry most of the risk:

1. **The postback endpoint**, where money is created. It must accept only genuine, unseen events. See [chapter 5](05-postback-forgery-and-replay.md).
2. **Cash-out**, where money leaves. Most other controls exist to buy time before this point. See [chapter 7](07-cashout-fraud.md).

Everything between them is detection and delay.

## The timing problem

Advertisers confirm some results quickly and find problems later. A credited result can be reversed days or weeks after it was paid, for example after the advertiser finds fraud or the user's purchase is refunded. Card networks usually allow cardholders to dispute a payment within 120 days ([Stripe, how disputes work](https://docs.stripe.com/disputes/how-disputes-work), checked November 2026), and purchase offers inherit that window.

On Moonetix a reversal arrives as a status 2 postback with the same `transaction_id` as the credit it cancels ([docs.moonetix.com/credits-and-reversals](https://docs.moonetix.com/credits-and-reversals#how-we-signal)). Other networks signal it differently; [affiliate-postback-macros](https://github.com/moonetix/affiliate-postback-macros) lists how.

If you pay out before reversals can arrive, every reversal is a direct loss. That single fact explains why holds ([chapter 6](06-reversals-holds-and-clawbacks.md)) matter more than any detection rule.

## Principles

1. **Layer controls.** No single check stops a determined operator. Network, device, account-link, behavior and payout signals each catch a different slice.
2. **Act where money moves.** Put the strongest checks at cash-out, the next strongest at bonuses and the postback endpoint.
3. **Prefer soft actions.** Limit, hold or review before you deny. A false positive should cost an honest user a wait, not their account.
4. **Decide on combinations.** One weak signal is a reason to look. Several independent signals are a reason to act.
5. **Make fraud unprofitable rather than impossible.** If nothing can be withdrawn until reversal risk has passed, most farms stop paying for themselves.
6. **Write rules before you enforce them.** Your terms must say what you prohibit and that you may hold or take back rewards. Enforcement without a published rule is a dispute you will lose.
7. **Keep evidence.** A decision you cannot explain later is a decision you cannot defend or learn from. See [chapter 9](09-what-to-log.md).

## What this playbook does not cover

It does not describe how to get around any check, and it does not name commercial detection vendors. It describes attacker behavior only as far as needed to recognize it in your own data.

## Further reading

- [Traffic quality rules](https://moonetix.com/academy/traffic-quality/traffic-quality-rules)
- [What is invalid traffic?](https://moonetix.com/academy/glossary/what-is-invalid-traffic)
- [Ad fraud and bot traffic](https://moonetix.com/academy/strategy/ad-fraud-and-bot-traffic)
- [OWASP Automated Threats to Web Applications](https://owasp.org/www-project-automated-threats-to-web-applications/)
