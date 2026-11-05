<?php
declare(strict_types=1);

/**
 * brandPlanningSummary filiale CMR Equipment — PIF pluriannuel + ventilé 2025 (x/y par marque).
 *
 * Usage : php scripts/export-cmr-equipment-brand-planning-summary.php
 */

$xyPath = dirname(__DIR__) . '/data/dps/cmr-equipment-technician-xy-2025.json';
$plannedPath = dirname(__DIR__) . '/data/dps/cmr-equipment-planned-by-technician.json';
$outPath = dirname(__DIR__) . '/data/dps/cmr-equipment-brand-planning-summary.json';

foreach ([$xyPath => 'xy', $plannedPath => 'planned'] as $path => $label) {
    if (!is_file($path)) {
        fwrite(STDERR, "Fichier {$label} introuvable : {$path}\n");
        exit(1);
    }
}

$xy = json_decode((string) file_get_contents($xyPath), true);
$planned = json_decode((string) file_get_contents($plannedPath), true);
if (!is_array($xy) || !is_array($planned)) {
    fwrite(STDERR, "JSON invalide\n");
    exit(1);
}

const PLANNING_YEAR = '2025';

/** @var array<string, array{total: int, done: int, byYear: array<string, array{total: int, done: int}>}> */
$brandPlanningSummary = [];

/** PIF pluriannuel (Define) — somme des allocations par marque. */
foreach ($planned['technicians'] ?? [] as $tech) {
    foreach ($tech['byBrand'] ?? [] as $brandSlug => $count) {
        $count = (int) $count;
        if ($count <= 0) {
            continue;
        }
        if (!isset($brandPlanningSummary[$brandSlug])) {
            $brandPlanningSummary[$brandSlug] = [
                'total' => 0,
                'done' => 0,
                'byYear' => [],
            ];
        }
        $brandPlanningSummary[$brandSlug]['total'] += $count;
    }
}

/** 2025 programmé (y) et fait (x) — somme des lignes technicien × session par marque. */
foreach ($xy['technicians'] ?? [] as $tech) {
    foreach ($tech['programmedSessions'] ?? [] as $session) {
        $brand = (string) ($session['brand'] ?? '');
        if ($brand === '') {
            continue;
        }
        if (!isset($brandPlanningSummary[$brand])) {
            $brandPlanningSummary[$brand] = ['total' => 0, 'done' => 0, 'byYear' => []];
        }
        if (!isset($brandPlanningSummary[$brand]['byYear'][PLANNING_YEAR])) {
            $brandPlanningSummary[$brand]['byYear'][PLANNING_YEAR] = ['total' => 0, 'done' => 0];
        }
        $brandPlanningSummary[$brand]['byYear'][PLANNING_YEAR]['total']++;
    }
    foreach ($tech['doneSessions'] ?? [] as $session) {
        $brand = (string) ($session['brand'] ?? '');
        if ($brand === '') {
            continue;
        }
        if (!isset($brandPlanningSummary[$brand])) {
            $brandPlanningSummary[$brand] = ['total' => 0, 'done' => 0, 'byYear' => []];
        }
        if (!isset($brandPlanningSummary[$brand]['byYear'][PLANNING_YEAR])) {
            $brandPlanningSummary[$brand]['byYear'][PLANNING_YEAR] = ['total' => 0, 'done' => 0];
        }
        $brandPlanningSummary[$brand]['byYear'][PLANNING_YEAR]['done']++;
        $brandPlanningSummary[$brand]['done'] += 1;
    }
}

ksort($brandPlanningSummary);
foreach ($brandPlanningSummary as &$row) {
    ksort($row['byYear']);
}
unset($row);

$brandPifStats = [];
foreach ($brandPlanningSummary as $brandSlug => $row) {
    $yearRow = $row['byYear'][PLANNING_YEAR] ?? ['total' => 0, 'done' => 0];
    $brandPifStats[] = [
        'brand' => $brandSlug,
        'pifProposed' => $row['total'],
        'pifValidated' => $yearRow['done'],
        'pifProposed2025' => $yearRow['total'],
        'pifValidated2025' => $yearRow['done'],
    ];
}
usort($brandPifStats, static fn (array $a, array $b): int => ($b['pifProposed'] ?? 0) <=> ($a['pifProposed'] ?? 0)
    ?: strcmp($a['brand'], $b['brand']));

$payload = [
    'meta' => [
        'generatedAt' => date('c'),
        'subsidiary' => 'CAMEROON MOTORS INDUSTRIES',
        'department' => 'Equipment',
        'planningYear' => PLANNING_YEAR,
        'definition' => [
            'total' => 'Somme allocations PIF Define par marque (pluri)',
            'byYear' => 'Somme des y/x 2025 par marque (pool CFAO ∩ PIF technicien)',
        ],
        'totals' => [
            'pifPluri' => array_sum(array_column($brandPlanningSummary, 'total')),
            'y2025' => $xy['totals']['y'] ?? null,
            'x2025' => $xy['totals']['x'] ?? null,
        ],
    ],
    'brandPlanningSummary' => $brandPlanningSummary,
    'brandPifStats' => $brandPifStats,
];

file_put_contents($outPath, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n");

echo "Export OK : {$outPath}\n";
echo 'PIF pluri (somme marques) : ' . $payload['meta']['totals']['pifPluri'] . PHP_EOL;
echo '2025 y/x : ' . ($payload['meta']['totals']['y2025'] ?? '?') . '/' . ($payload['meta']['totals']['x2025'] ?? '?') . PHP_EOL;
