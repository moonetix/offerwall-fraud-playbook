-- Reversal rate of each referrer's direct referrals, next to the site-wide rate.
-- A tree far above the site rate is reviewed as one case.
WITH site AS (
  SELECT 1.0 * SUM(state = 'reversed') / COUNT(*) AS rate
  FROM reward_ledger WHERE credited_at IS NOT NULL
)
SELECT u.referred_by                                          AS referrer_id,
       COUNT(DISTINCT u.id)                                   AS referred_accounts,
       COUNT(*)                                               AS credited,
       ROUND(1.0 * SUM(l.state = 'reversed') / COUNT(*), 3)   AS tree_rate,
       ROUND((SELECT rate FROM site), 3)                      AS site_rate
FROM users u
JOIN reward_ledger l ON l.user_id = u.id AND l.credited_at IS NOT NULL
WHERE u.referred_by IS NOT NULL
GROUP BY u.referred_by
HAVING COUNT(*) >= :min_credits
ORDER BY tree_rate DESC;
