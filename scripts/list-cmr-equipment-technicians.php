<?php
declare(strict_types=1);

require 'C:/wamp64/www/MEDACAP/views/measure/api/bootstrap.php';

$db = (new MongoDB\Client($mongoUri))->selectDatabase($mongoDb);
$userId = '66f55aabe9500000a3001f52';
$ctx = portalApiResolveDpsFilialeContext($db, $userId, null, null);

echo 'totalTechnicians: ' . $ctx['totalTechnicians'] . PHP_EOL;
echo 'subsidiary: ' . $ctx['subsidiary'] . PHP_EOL;
echo 'brands: ' . count($ctx['brands']) . PHP_EOL;
echo PHP_EOL . "Techniciens (Mongo live):\n";
foreach ($ctx['technicians'] as $t) {
    printf(
        "  - %s | %s | brands: %s\n",
        $t['name'],
        $t['agency'] ?? '—',
        implode(', ', $t['brands'] ?? [])
    );
}
$demo = array_filter($ctx['technicians'], static fn ($t) => stripos($t['name'], 'DEMO') !== false);
echo PHP_EOL . 'DEMO in list: ' . (count($demo) ? 'YES' : 'NO') . PHP_EOL;
