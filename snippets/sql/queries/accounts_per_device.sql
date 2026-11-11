-- Devices used by more than one account. One shared device is a reason to look
-- (families share phones); a device behind many accounts is a farm pattern.
SELECT device_id,
       COUNT(*)                       AS accounts,
       GROUP_CONCAT(user_id, ',')     AS user_ids
FROM user_devices
GROUP BY device_id
HAVING COUNT(*) >= :min_accounts
ORDER BY accounts DESC;
