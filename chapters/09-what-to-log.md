# 9. What to log

Fraud review is reconstruction. If the record of what happened does not exist, a reviewer guesses, and guesses are wrong in both directions. Log the minimum that lets you rebuild a case, keep it for a defined period, and protect it like the personal data it is.

## Events

| Event | Fields | Why |
| --- | --- | --- |
| Sign-up | user ID, time, IP, network (/24 or /48), country, device ID, user agent, referrer, bot challenge result | Bursts, clusters, referral links |
| Login and session | user ID, time, IP, device ID, outcome | Takeover, shared devices |
| Offerwall open | user ID, time, IP, network flags, device verdict, sub IDs you passed | Who reached offers from where |
| Postback received | raw query string or body, headers, source IP, signature result, outcome, HTTP status you answered | Disputes with networks, forgery attempts, your own bugs |
| Ledger change | transaction ID, user ID, old and new state, amount, time | Every balance is explainable |
| Payout destination added or changed | user ID, method, keyed hash of destination, time, IP, device | Shared destinations, takeover |
| Cash-out request and decision | amount, method, destination hash, risk tier and reasons, reviewer, decision, note | Appeals, consistency |
| Risk flag | user ID, signal name, source, verdict, time | Why an account was limited |
| Admin action | admin ID, target, action, before and after, time | Insider risk |

[schema.sql](../snippets/sql/schema.sql) has `postback_log`, `risk_events` and `review_queue` tables for these, and [postback.php](../snippets/php/postback.php) logs every postback, including rejected ones, in the same request.

## Rules

- **Log the raw postback.** Not a parsed version. The raw query string is what the network will compare with when you dispute a reversal, and it is the only way to find an encoding bug.
- **Never log secrets.** Strip the postback key, API keys and session tokens before writing.
- **Hash what you only need to compare.** Payout destinations and identity attributes can be stored as keyed hashes (HMAC with a server-side key). You can still find matches; a leaked table does not expose addresses.
- **Store the network as well as the address.** It groups bursts and lets you shorten retention for full addresses.
- **Use one clock.** Store Unix time or UTC everywhere. Mixed time zones make sequences unreadable.
- **Record verdicts with their source and time.** "Flagged as proxy" means little without "by which list, on which day".
- **Make logs append-only for reviewers.** Corrections are new rows, not edits.

## Retention

Set a retention period per table and write it in your privacy policy. One workable split: raw IPs and device details for a few months, case decisions and ledger rows for as long as you need them for accounting and disputes. Delete or aggregate on schedule, not by hand.

## Privacy

IP addresses and device identifiers are personal data in many jurisdictions. Fraud prevention is a recognized purpose, but it still needs a lawful basis, a privacy notice, a narrow purpose and a retention limit. Collect what a reviewer actually uses. If a field has not been used in a review for a year, stop collecting it.

## Further reading

- [What is device fingerprinting?](https://moonetix.com/academy/glossary/what-is-device-fingerprinting)
- [Report time zones](https://moonetix.com/academy/publisher-basics/report-time-zones)
- [Read your dashboard and reports](https://moonetix.com/academy/earnings/read-dashboard-and-reports)
- [Offerwall GDPR](https://moonetix.com/academy/publisher-basics/offerwall-gdpr)
