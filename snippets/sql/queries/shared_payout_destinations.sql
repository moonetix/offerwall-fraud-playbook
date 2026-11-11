-- Payout destinations used by more than one account. Often the strongest link
-- between accounts, because the money has to land somewhere.
SELECT method,
       destination_hash,
       COUNT(DISTINCT user_id)              AS accounts,
       GROUP_CONCAT(DISTINCT user_id)       AS user_ids
FROM payout_destinations
GROUP BY method, destination_hash
HAVING COUNT(DISTINCT user_id) > 1
ORDER BY accounts DESC;
