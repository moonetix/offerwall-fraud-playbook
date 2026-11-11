// A reward ledger with holds, reversals and referral clawbacks, on node:sqlite.
// Balances are derived from rows, never stored, so a reversal after cash-out
// shows up as a negative spendable balance instead of silently vanishing.

const MICROS = 1_000_000;

export function toMicros(amount) {
  const m = /^(\d{1,12})(?:\.(\d{1,6}))?$/.exec(String(amount));
  if (!m) throw new RangeError(`not a non-negative decimal: ${amount}`);
  return Number(m[1]) * MICROS + Number((m[2] || '').padEnd(6, '0'));
}

function tx(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// Status 1 creates a held row once. Status 2 cancels it, whatever state it is in,
// and cancels any referral commission built on it. A reversal for an unknown
// transaction leaves a tombstone so a late or replayed credit is never paid.
export function applyPostback(db, { tx: id, user, reward, status, offerId = null }, { now, holdSeconds }) {
  const amount = toMicros(reward);
  return tx(db, () => {
    if (Number(status) === 1) {
      const r = db.prepare(`INSERT INTO reward_ledger
          (transaction_id, user_id, offer_id, amount_micros, state, credited_at, release_at)
          VALUES (?, ?, ?, ?, 'held', ?, ?)
          ON CONFLICT (transaction_id) DO NOTHING`)
        .run(id, user, offerId, amount, now, now + holdSeconds);
      return r.changes === 1 ? 'credited' : 'duplicate';
    }
    if (Number(status) === 2) {
      const row = db.prepare('SELECT state FROM reward_ledger WHERE transaction_id = ?').get(id);
      if (!row) {
        db.prepare(`INSERT INTO reward_ledger (transaction_id, user_id, offer_id, amount_micros, state, reversed_at)
                    VALUES (?, ?, ?, 0, 'reversed', ?)`).run(id, user, offerId, now);
        return 'ignored';
      }
      if (row.state === 'reversed') return 'duplicate';
      db.prepare(`UPDATE reward_ledger SET state = 'reversed', reversed_at = ? WHERE transaction_id = ?`).run(now, id);
      db.prepare(`UPDATE referral_commissions SET state = 'reversed', reversed_at = ?
                  WHERE source_transaction_id = ? AND state = 'available'`).run(now, id);
      return row.state === 'held' ? 'reversed_while_held' : 'reversed_after_release';
    }
    return 'ignored';
  });
}

// Run every few minutes. Commissions are created here, from released earnings
// only, so a referral farm earns nothing from rewards that get reversed in the hold.
export function releaseDue(db, { now, referralRateBp = 0 }) {
  return tx(db, () => {
    const due = db.prepare(`SELECT l.transaction_id, l.amount_micros, u.referred_by
        FROM reward_ledger l LEFT JOIN users u ON u.id = l.user_id
        WHERE l.state = 'held' AND l.release_at <= ?`).all(now);
    const release = db.prepare(`UPDATE reward_ledger SET state = 'available', released_at = ?
        WHERE transaction_id = ? AND state = 'held'`);
    const commission = db.prepare(`INSERT INTO referral_commissions
        (source_transaction_id, referrer_id, amount_micros, state, created_at)
        VALUES (?, ?, ?, 'available', ?) ON CONFLICT DO NOTHING`);
    for (const row of due) {
      release.run(now, row.transaction_id);
      const amount = Math.floor((row.amount_micros * referralRateBp) / 10_000);
      if (row.referred_by && amount > 0) commission.run(row.transaction_id, row.referred_by, amount, now);
    }
    return due.length;
  });
}

export function balances(db, userId) {
  const one = (sql) => Number(db.prepare(sql).get(userId).v);
  const held = one(`SELECT COALESCE(SUM(amount_micros), 0) v FROM reward_ledger WHERE user_id = ? AND state = 'held'`);
  const available = one(`SELECT COALESCE(SUM(amount_micros), 0) v FROM reward_ledger WHERE user_id = ? AND state = 'available'`);
  const commissions = one(`SELECT COALESCE(SUM(amount_micros), 0) v FROM referral_commissions WHERE referrer_id = ? AND state = 'available'`);
  const cashedOut = one(`SELECT COALESCE(SUM(amount_micros), 0) v FROM cashouts WHERE user_id = ? AND state <> 'rejected'`);
  return { held, available, commissions, cashedOut, spendable: available + commissions - cashedOut };
}
