# 5. Postback forgery and replay

The postback endpoint is where money is created. It is a public URL. Anyone who learns it can call it, and a request arriving proves nothing on its own.

## Threats

| Threat | What it looks like | Defense |
| --- | --- | --- |
| Forgery | A request with `status=1` and a reward, never sent by the network | Verify the signature |
| Tampering | A genuine request with the user or amount changed | The signature covers those fields |
| Replay | A genuine request sent again, by a retry or on purpose | Process each transaction ID once, enforced by the database |
| Race | Two copies arriving at the same moment | Unique key plus a transaction, not a check in code |
| Status flip | A reversal changed into a credit | Status is a signed field |
| Leaked secret | The key in an app bundle, a repository or a log | Server-side storage, rotation |
| Client-supplied user ID | The wall link built in the browser with any user ID | Build and sign the link on the server |

## Detection logic

**1. Verify the signature before anything else.** Recompute it from the values exactly as received and compare in constant time. For Moonetix, the hash is HMAC-SHA256, lowercase hex, of `transaction_id:user_id:reward:status` with your postback secret key ([docs.moonetix.com/postbacks](https://docs.moonetix.com/postbacks#verify)).

```js
// snippets/node/verify-postback.mjs
export function verifyPostback(params, key) {
  const get = (name) => (params instanceof URLSearchParams ? params.get(name) : params[name]) ?? '';
  const given = Buffer.from(String(get('hash')));
  if (!key || given.length === 0) return false;
  const wanted = Buffer.from(expectedHash(key, {
    tx: get('tx'), user: get('user'), reward: get('reward'), status: get('status'),
  }));
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}
```

The PHP equivalent is `hash_equals(hash_hmac('sha256', $message, $key), $given)` in [postback.php](../snippets/php/postback.php). Both are tested against postbacks signed by the Moonetix postback code, plus tampered copies ([test/fixtures/postbacks.json](../test/fixtures/postbacks.json)).

Other networks sign different inputs: the whole URL, the body, sorted parameters, or a plain hash with the secret appended. [affiliate-postback-macros](https://github.com/moonetix/affiliate-postback-macros#part-b-offerwall-publisher-postbacks) lists the scheme for each.

**2. Know which fields are signed.** Only signed fields may decide money. In the Moonetix scheme `payout`, `offer_id` and the sub IDs are not signed, and the fixture "unsigned payout changed" verifies on purpose: it is still a valid postback, so never credit from those fields.

**3. Make replays harmless in the database.** The transaction ID is the primary key of the ledger. A credit is an `INSERT ... ON CONFLICT DO NOTHING`; only an insert that actually happened adds value.

```sql
INSERT INTO reward_ledger (transaction_id, user_id, offer_id, amount_micros, state, credited_at, release_at)
VALUES (?, ?, ?, ?, 'held', ?, ?)
ON CONFLICT (transaction_id) DO NOTHING;
```

A reversal for a transaction you never saw leaves a tombstone row, so a late or replayed credit for it is never paid. The tests replay a credit after its reversal and check that nothing is added.

**4. Answer correctly.** Return 2xx only after the change is committed. Return 2xx for duplicates and ignored events too, so the sender stops retrying. Return 403 for a bad signature and 5xx when storage fails, so a genuine event is retried.

**5. Keep the user ID honest at the other end.** Build the offerwall link on the server for the signed-in user and sign it there. Moonetix links carry an HMAC-SHA256 of the user ID made with the link hash salt, which is a different secret from the postback key ([docs.moonetix.com/offerwall-link](https://docs.moonetix.com/offerwall-link)).

**6. Treat source IP allowlists as a second layer.** Several networks publish the addresses their postbacks come from. Allow them at the firewall if you like, but keep verifying the signature.

## Monitoring

- Alert on any rejected signature. Genuine traffic almost never fails; a burst of failures means someone is probing or a key changed.
- Alert when the share of duplicates jumps, which usually means your endpoint is answering too slowly or with errors.
- Log the raw query string of every call, accepted or not ([chapter 9](09-what-to-log.md)).

## Key handling

- Keep the postback key in an environment variable or secret store, never in client code or Git.
- Rotate it after any suspected leak and after staff with access leave. Plan the rotation so old and new keys overlap only as long as the network needs.
- Never log the key, and never log a full request that includes it as a parameter.

## False positives

There are few here, and they are all your own bugs:

- Re-encoding parameters before hashing. Hash exactly what arrived; `150` and `150.00` differ.
- Framework middleware that rewrites the query string, or a redirect from `http` to `https` that the sender does not follow.
- Using the link salt instead of the postback key.

## Further reading

- [Postback security](https://moonetix.com/academy/traffic-quality/postback-security)
- [Prevent duplicate reward credits](https://moonetix.com/academy/integrations/prevent-duplicate-reward-credits)
- [Postback IP allowlist](https://moonetix.com/academy/integrations/postback-ip-allowlist)
- [Rotate keys and link salt](https://moonetix.com/academy/integrations/rotate-keys-and-link-salt)
- [What is HMAC?](https://moonetix.com/academy/glossary/what-is-hmac)
- [RFC 2104, HMAC](https://www.rfc-editor.org/rfc/rfc2104.html)
