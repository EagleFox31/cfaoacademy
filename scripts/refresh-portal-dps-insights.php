<?php
declare(strict_types=1);

/**
 * Recalcule manuellement le cache Mongo portalDpsInsights (sans cron).
 *
 * Usage :
 *   php scripts/refresh-portal-dps-insights.php
 *   php scripts/refresh-portal-dps-insights.php --subsidiary=Cameroun --department=Equipment
 *   php scripts/refresh-portal-dps-insights.php --all-equipment
 *
 * Déploiement MEDACAP : copier portal-dps-insights-cache.php dans views/measure/api/
 * et inclure depuis bootstrap.php.
 */

$bootstrap = 'C:/wamp64/www/MEDACAP/views/measure/api/bootstrap.php';
if (!is_file($bootstrap)) {
    $bootstrap = dirname(__DIR__) . '/medacap-api/bootstrap.php';
}
if (!is_file($bootstrap)) {
    fwrite(STDERR, "bootstrap.php introuvable — ajuster le chemin en tête de script\n");
    exit(1);
}

require $bootstrap;

$cacheLib = __DIR__ . '/medacap-api/portal-dps-insights-cache.php';
if (!is_file($cacheLib)) {
    fwrite(STDERR, "portal-dps-insights-cache.php introuvable\n");
    exit(1);
}
require_once $cacheLib;

/** @return array<string, string> */
function refreshParseArgs(array $argv): array
{
    $out = [
        'subsidiary' => 'Cameroun',
        'department' => 'Equipment',
        'all-equipment' => '0',
        'by' => 'cli-manual',
    ];

    foreach (array_slice($argv, 1) as $arg) {
        if ($arg === '--all-equipment') {
            $out['all-equipment'] = '1';
            continue;
        }
        if (strpos($arg, '--subsidiary=') === 0) {
            $out['subsidiary'] = substr($arg, strlen('--subsidiary='));
            continue;
        }
        if (strpos($arg, '--department=') === 0) {
            $out['department'] = substr($arg, strlen('--department='));
            continue;
        }
        if (strpos($arg, '--by=') === 0) {
            $out['by'] = substr($arg, strlen('--by='));
        }
    }

    return $out;
}

/** @return list<array{subsidiary: string, department: string}> */
function refreshListEquipmentScopes(MongoDB\Database $db): array
{
    $pipeline = [
        ['$match' => ['active' => true]],
        ['$group' => [
            '_id' => [
                'subsidiary' => '$subsidiary',
                'department' => '$department',
            ],
        ]],
        ['$sort' => ['_id.subsidiary' => 1]],
    ];

    $scopes = [];
    foreach ($db->users->aggregate($pipeline) as $row) {
        $id = $row['_id'] ?? [];
        $subsidiary = trim((string) ($id['subsidiary'] ?? ''));
        $department = trim((string) ($id['department'] ?? ''));
        if ($subsidiary === '' || $department === '') {
            continue;
        }
        if (function_exists('portalApiTechnicianDepartmentFilter')
            && $department !== portalApiTechnicianDepartmentFilter('Equipment')
            && stripos($department, 'equipment') === false) {
            continue;
        }
        $scopes[] = ['subsidiary' => $subsidiary, 'department' => $department];
    }

    return $scopes;
}

$args = refreshParseArgs($argv);
$db = (new MongoDB\Client($mongoUri))->selectDatabase($mongoDb);

$jobs = [];
if ($args['all-equipment'] === '1') {
    $jobs = refreshListEquipmentScopes($db);
    if (!$jobs) {
        $jobs = [
            ['subsidiary' => $args['subsidiary'], 'department' => $args['department']],
        ];
    }
} else {
    $jobs = [
        ['subsidiary' => $args['subsidiary'], 'department' => $args['department']],
    ];
}

$started = microtime(true);
$ok = 0;

foreach ($jobs as $job) {
    $t0 = microtime(true);
    echo "→ {$job['subsidiary']} / {$job['department']} … ";

    try {
        $summary = portalApiRefreshPortalDpsInsights(
            $db,
            $job['subsidiary'],
            $job['department'],
            $args['by']
        );
        $elapsed = round(microtime(true) - $t0, 1);
        echo "OK ({$elapsed}s) — {$summary['technicians']} tech., "
            . "{$summary['brandStats']} marques, {$summary['evaluations']} eval.\n";
        $ok++;
    } catch (Throwable $e) {
        echo "ERREUR — {$e->getMessage()}\n";
    }
}

$total = round(microtime(true) - $started, 1);
echo "\nTerminé : {$ok}/" . count($jobs) . " cache(s) mis à jour en {$total}s\n";
echo "Collection : " . PORTAL_DPS_INSIGHTS_COLLECTION . "\n";

exit($ok === count($jobs) ? 0 : 2);
