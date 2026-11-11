-- Accounts that cashed out within a short time of their first credit and have
-- had no credited activity since. Also typical of honest one-time users, so
-- this feeds review, never an automatic block.
SELECT c.user_id,
       MIN(l.credited_at)                          AS first_credit,
       MIN(c.requested_at)                         AS first_cashout,
       MIN(c.requested_at) - MIN(l.credited_at)    AS seconds_to_cashout
FROM cashouts c
JOIN reward_ledger l ON l.user_id = c.user_id AND l.credited_at IS NOT NULL
GROUP BY c.user_id
HAVING MIN(c.requested_at) - MIN(l.credited_at) <= :max_seconds
   AND MAX(l.credited_at) <= MIN(c.requested_at)
   AND :now - MIN(c.requested_at) >= :quiet_seconds
ORDER BY seconds_to_cashout;
