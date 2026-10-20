<?php
declare(strict_types=1);

$url = 'http://localhost/medacap/views/measure/api/dps-pif.php?userId=66f55aabe9500000a3001f52&key=demo-cfao-portal';
$ctx = stream_context_create(['http' => ['timeout' => 15]]);
$raw = @file_get_contents($url, false, $ctx);
if ($raw === false) {
    fwrite(STDERR, "API unreachable\n");
    exit(1);
}

$j = json_decode($raw, true);
$s = $j['brandPlanningSummary'] ?? [];
$pluri = 0;
$y2025 = 0;
$y2026 = 0;

foreach ($s as $brand => $r) {
    $pluri += (int) ($r['total'] ?? 0);
    $y2025 += (int) ($r['byYear']['2025']['total'] ?? 0);
    $y2026 += (int) ($r['byYear']['2026']['total'] ?? 0);
    printf(
        "%s: pluri=%d, 2025=%d, 2026=%d\n",
        $brand,
        $r['total'] ?? 0,
        $r['byYear']['2025']['total'] ?? 0,
        $r['byYear']['2026']['total'] ?? 0
    );
}

echo "SUM pluri={$pluri}, SUM 2025={$y2025}, SUM 2026={$y2026}\n";
$pif = $j['brandPifStats'] ?? [];
$pifSum = array_sum(array_column($pif, 'pifProposed'));
echo "SUM pifProposed={$pifSum}\n";
