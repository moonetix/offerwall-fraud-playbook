<?php
// php test/php/postback_test.php
declare(strict_types=1);

require __DIR__ . '/../../snippets/php/postback.php';

$root = dirname(__DIR__, 2);
$fx = json_decode(file_get_contents("$root/test/fixtures/postbacks.json"), true);
$cases = array_column($fx['cases'], 'query', 'name');
$failed = 0;
$check = function (bool $ok, string $name) use (&$failed): void {
    echo ($ok ? 'ok    ' : 'FAIL  ') . $name . PHP_EOL;
    $failed += $ok ? 0 : 1;
};

$db = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$db->exec(file_get_contents("$root/snippets/sql/schema.sql"));
$send = function (string $name, int $now = 1000) use ($db, $cases, $fx): array {
    parse_str($cases[$name], $q);
    return postback_handle($db, $q, $cases[$name], '203.0.113.9', $fx['key'], $now, 7 * 86400);
};
$state = fn (string $tx) => $db->query("SELECT state FROM reward_ledger WHERE transaction_id = " . $db->quote($tx))->fetchColumn();

foreach ($fx['cases'] as $c) {
    parse_str($c['query'], $q);
    $check(postback_hash_ok($q, $fx['key']) === $c['valid'], 'signature: ' . $c['name']);
}

$check($send('credit') === [200, 'credited'], 'credit is stored as held');
$check($send('credit') === [200, 'duplicate'], 'retry of the same credit is answered 200 and skipped');
$check($send('reversal of the credit', 2000) === [200, 'reversed'], 'reversal cancels the held reward');
$check($send('credit', 3000) === [200, 'duplicate'], 'replayed credit after a reversal pays nothing');
$check($state('tx_2001') === 'reversed', 'ledger row ends reversed');
$check($send('reversal without a credit') === [200, 'ignored'], 'reversal for an unknown transaction is ignored');
$check($state('tx_2005') === 'reversed', 'and leaves a tombstone');
$check($send('signed with a different key') === [403, 'rejected'], 'wrong key is rejected');
$check($send('reward changed after signing') === [403, 'rejected'], 'tampered reward is rejected');
$check($state('tx_2002') === false, 'rejected requests change nothing');
$check($send('decimal reward') === [200, 'credited'], 'decimal reward');
$micros = (int)$db->query("SELECT amount_micros FROM reward_ledger WHERE transaction_id = 'tx_2004'")->fetchColumn();
$check($micros === 75500000, 'decimal reward stored exactly');
$logged = (int)$db->query('SELECT COUNT(*) FROM postback_log')->fetchColumn();
$rejected = (int)$db->query('SELECT COUNT(*) FROM postback_log WHERE signature_ok = 0')->fetchColumn();
$check($logged === 8 && $rejected === 2, 'every request is logged, rejected ones included');

echo ($failed === 0 ? 'all passed' : "$failed failed") . PHP_EOL;
exit($failed === 0 ? 0 : 1);
