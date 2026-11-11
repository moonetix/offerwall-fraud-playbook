<?php
// Offerwall postback endpoint with a hold ledger. PDO with SQLite or PostgreSQL
// syntax; on MySQL use INSERT IGNORE instead of ON CONFLICT DO NOTHING.
// Order matters: log, verify the signature, then change money in one
// transaction, and answer 2xx only after the commit.

declare(strict_types=1);

function postback_hash_ok(array $q, string $key): bool
{
    $given = (string)($q['hash'] ?? '');
    if ($key === '' || $given === '') {
        return false;
    }
    $message = ($q['tx'] ?? '') . ':' . ($q['user'] ?? '') . ':' . ($q['reward'] ?? '') . ':' . ($q['status'] ?? '');
    return hash_equals(hash_hmac('sha256', $message, $key), $given);
}

function postback_micros(string $amount): ?int
{
    if (!preg_match('/^(\d{1,12})(?:\.(\d{1,6}))?$/', $amount, $m)) {
        return null;
    }
    return (int)$m[1] * 1000000 + (int)str_pad($m[2] ?? '', 6, '0');
}

/** Returns [http status, outcome]. */
function postback_handle(PDO $db, array $q, string $rawQuery, ?string $remoteIp, string $key, int $now, int $holdSeconds): array
{
    $ok = postback_hash_ok($q, $key);
    [$code, $outcome] = $ok ? postback_apply($db, $q, $now, $holdSeconds) : [403, 'rejected'];
    $db->prepare('INSERT INTO postback_log (received_at, remote_ip, query, signature_ok, outcome, http_status) VALUES (?, ?, ?, ?, ?, ?)')
        ->execute([$now, $remoteIp, $rawQuery, $ok ? 1 : 0, $outcome, $code]);
    return [$code, $outcome];
}

function postback_apply(PDO $db, array $q, int $now, int $holdSeconds): array
{
    $tx = (string)$q['tx'];
    $user = (string)$q['user'];
    $status = (string)$q['status'];
    $amount = postback_micros((string)$q['reward']);
    if ($tx === '' || $user === '' || $amount === null || !in_array($status, ['1', '2'], true)) {
        return [400, 'ignored'];
    }
    $offer = isset($q['offer_id']) ? (string)$q['offer_id'] : null;

    $db->beginTransaction();
    try {
        if ($status === '1') {
            $ins = $db->prepare("INSERT INTO reward_ledger (transaction_id, user_id, offer_id, amount_micros, state, credited_at, release_at)
                                 VALUES (?, ?, ?, ?, 'held', ?, ?) ON CONFLICT (transaction_id) DO NOTHING");
            $ins->execute([$tx, $user, $offer, $amount, $now, $now + $holdSeconds]);
            $outcome = $ins->rowCount() === 1 ? 'credited' : 'duplicate';
        } else {
            $sel = $db->prepare('SELECT state FROM reward_ledger WHERE transaction_id = ?');
            $sel->execute([$tx]);
            $state = $sel->fetchColumn();
            if ($state === false) {
                $db->prepare("INSERT INTO reward_ledger (transaction_id, user_id, offer_id, amount_micros, state, reversed_at)
                              VALUES (?, ?, ?, 0, 'reversed', ?)")->execute([$tx, $user, $offer, $now]);
                $outcome = 'ignored';
            } elseif ($state === 'reversed') {
                $outcome = 'duplicate';
            } else {
                $db->prepare("UPDATE reward_ledger SET state = 'reversed', reversed_at = ? WHERE transaction_id = ?")->execute([$now, $tx]);
                $db->prepare("UPDATE referral_commissions SET state = 'reversed', reversed_at = ? WHERE source_transaction_id = ? AND state = 'available'")
                    ->execute([$now, $tx]);
                $outcome = 'reversed';
            }
        }
        $db->commit();
    } catch (Throwable $e) {
        $db->rollBack();
        return [500, 'error'];
    }
    // 200 for duplicates and ignored events too: it stops retries.
    return [200, $outcome];
}

if (PHP_SAPI !== 'cli' && realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    $db = new PDO((string)getenv('DATABASE_DSN'), getenv('DATABASE_USER') ?: null, getenv('DATABASE_PASSWORD') ?: null,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    [$code] = postback_handle($db, $_GET, (string)($_SERVER['QUERY_STRING'] ?? ''), $_SERVER['REMOTE_ADDR'] ?? null,
        (string)getenv('MOONETIX_POSTBACK_KEY'), time(), (int)(getenv('HOLD_SECONDS') ?: 7 * 86400));
    http_response_code($code);
}
