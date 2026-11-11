// Verify a signed offerwall postback before anything else touches the request.
// Format: Moonetix (https://docs.moonetix.com/postbacks#verify). The pattern is
// the same for any HMAC-signed postback: rebuild the signed message from the
// values exactly as received, then compare in constant time.

import { createHmac, timingSafeEqual } from 'node:crypto';

export function expectedHash(key, { tx, user, reward, status }) {
  return createHmac('sha256', key).update(`${tx}:${user}:${reward}:${status}`).digest('hex');
}

export function verifyPostback(params, key) {
  const get = (name) => (params instanceof URLSearchParams ? params.get(name) : params[name]) ?? '';
  const given = Buffer.from(String(get('hash')));
  if (!key || given.length === 0) return false;
  const wanted = Buffer.from(expectedHash(key, {
    tx: get('tx'), user: get('user'), reward: get('reward'), status: get('status'),
  }));
  // timingSafeEqual throws on unequal lengths, so check length first.
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}
