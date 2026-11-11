-- Share of each user's credited rewards that were later reversed.
-- Tombstones (reversals of transactions never credited) are excluded.
SELECT user_id,
       COUNT(*)                                             AS credited,
       SUM(state = 'reversed')                              AS reversed,
       ROUND(1.0 * SUM(state = 'reversed') / COUNT(*), 3)   AS reversal_rate
FROM reward_ledger
WHERE credited_at IS NOT NULL
GROUP BY user_id
HAVING COUNT(*) >= :min_credits
ORDER BY reversal_rate DESC, credited DESC;
