-- Sign-ups per network per hour. Real referrals trickle in; batches from one
-- network inside an hour deserve a look. Exclude networks you know are shared
-- (carrier NAT, Private Relay) before acting on this.
SELECT signup_network,
       created_at / 3600 * 3600  AS hour_start,
       COUNT(*)                  AS signups,
       GROUP_CONCAT(id, ',')     AS user_ids
FROM users
WHERE created_at >= :since AND signup_network IS NOT NULL
GROUP BY signup_network, created_at / 3600
HAVING COUNT(*) >= :min_signups
ORDER BY signups DESC;
