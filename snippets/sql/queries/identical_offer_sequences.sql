-- Accounts whose first offers were completed in exactly the same order.
-- Several accounts working through one list is a sign of one operator.
WITH firsts AS (
  SELECT user_id, offer_id, credited_at,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY credited_at, transaction_id) AS n
  FROM reward_ledger
  WHERE credited_at IS NOT NULL
),
seqs AS (
  SELECT user_id, GROUP_CONCAT(offer_id, '>') AS sequence, COUNT(*) AS len
  FROM (SELECT * FROM firsts WHERE n <= :first_n ORDER BY user_id, n)
  GROUP BY user_id
)
SELECT sequence,
       COUNT(*)                      AS accounts,
       GROUP_CONCAT(user_id, ',')    AS user_ids
FROM seqs
WHERE len = :first_n
GROUP BY sequence
HAVING COUNT(*) >= :min_accounts
ORDER BY accounts DESC;
