<?php
/**
 * Match Excel TEAM-GP (Synthèse) ↔ techniciens MEDACAP scope KI YOGBA.
 * Usage: php scripts/match_teamgp_medacap.php
 */
declare(strict_types=1);

$bootstrap = 'C:/wamp64/www/MEDACAP/views/measure/api/bootstrap.php';
require $bootstrap;

use MongoDB\BSON\ObjectId;

function normName(?string $s): string
{
    $s = trim((string) $s);
    $s = mb_strtolower($s, 'UTF-8');
    $s = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s) ?: $s;
    $s = preg_replace('/[^a-z0-9]+/', ' ', $s) ?? '';
    return trim(preg_replace('/\s+/', ' ', $s) ?? '');
}

function tokens(string $n): array
{
    $parts = array_values(array_filter(explode(' ', $n), static fn ($p) => $p !== ''));
    sort($parts);
    return $parts;
}

function scoreNames(string $a, string $b): float
{
    if ($a === '' || $b === '') {
        return 0.0;
    }
    if ($a === $b) {
        return 1.0;
    }
    $ta = tokens($a);
    $tb = tokens($b);
    if (!$ta || !$tb) {
        return 0.0;
    }
    $inter = count(array_intersect($ta, $tb));
    $union = count(array_unique(array_merge($ta, $tb)));
    $jaccard = $union ? $inter / $union : 0.0;
    // Bonus if all tokens of the shorter name are in the longer
    $shorter = count($ta) <= count($tb) ? $ta : $tb;
    $longer = count($ta) <= count($tb) ? $tb : $ta;
    $subset = count(array_diff($shorter, $longer)) === 0;
    return $subset ? max($jaccard, 0.85) : $jaccard;
}

$root = dirname(__DIR__);
$excelPath = $root . '/frontend/src/data/toyota/_excel_techs_norm.json';
if (!is_file($excelPath)) {
    fwrite(STDERR, "Run extract_teamgp_elearning_catalog.py first\n");
    exit(1);
}
$excelTechs = json_decode(file_get_contents($excelPath), true);

$db = portalApiDb($mongoUri, $mongoDb)->selectDatabase($mongoDb);
$scopeUserId = '6915b9e0ad060000940026e9'; // KI YOGBA scope
$ctx = portalApiResolveDpsFilialeContext($db, $scopeUserId, null, null);

$medacap = [];
foreach ($ctx['technicianDocs'] as $row) {
    $doc = $row['doc'];
    $id = (string) $row['_id'];
    $display = portalApiTechnicianDisplayName($doc);
    $medacap[] = [
        'id' => $id,
        'name' => $display,
        'nameNorm' => normName($display),
        'username' => $doc['username'] ?? null,
        'agency' => $doc['agency'] ?? null,
        'level' => $doc['level'] ?? null,
    ];
}

$links = [];
$usedMedacap = [];

foreach ($excelTechs as $ex) {
    $en = $ex['nameNorm'] ?? normName($ex['name'] ?? '');
    $best = null;
    $bestScore = 0.0;
    $second = 0.0;
    foreach ($medacap as $m) {
        $sc = scoreNames($en, $m['nameNorm']);
        if ($sc > $bestScore) {
            $second = $bestScore;
            $bestScore = $sc;
            $best = $m;
        } elseif ($sc > $second) {
            $second = $sc;
        }
    }

    $status = 'unmatched';
    $confidence = 'none';
    if ($best && $bestScore >= 0.85 && ($bestScore - $second) >= 0.05) {
        $status = 'linked';
        $confidence = $bestScore >= 0.99 ? 'exact' : 'high';
    } elseif ($best && $bestScore >= 0.6) {
        $status = 'review';
        $confidence = 'ambiguous';
    }

    if ($status === 'linked' && isset($usedMedacap[$best['id']])) {
        $status = 'review';
        $confidence = 'collision';
    }
    if ($status === 'linked') {
        $usedMedacap[$best['id']] = true;
    }

    $links[] = [
        'teamGpId' => $ex['teamGpId'] ?? null,
        'excelName' => $ex['name'] ?? null,
        'niveauAnalyse' => $ex['niveauAnalyse'] ?? null,
        'onlineDone' => $ex['onlineDone'] ?? null,
        'onlineAssigned' => $ex['onlineAssigned'] ?? null,
        'medacapUserId' => $status === 'linked' ? $best['id'] : ($status === 'review' ? ($best['id'] ?? null) : null),
        'medacapName' => $best['name'] ?? null,
        'score' => round($bestScore, 3),
        'status' => $status,
        'confidence' => $confidence,
    ];
}

$out = [
    'meta' => [
        'scopeUserId' => $scopeUserId,
        'subsidiary' => $ctx['subsidiary'] ?? null,
        'excelCount' => count($excelTechs),
        'medacapCount' => count($medacap),
        'linked' => count(array_filter($links, static fn ($l) => $l['status'] === 'linked')),
        'review' => count(array_filter($links, static fn ($l) => $l['status'] === 'review')),
        'unmatched' => count(array_filter($links, static fn ($l) => $l['status'] === 'unmatched')),
    ],
    'medacapTechnicians' => $medacap,
    'links' => $links,
];

$outPath = $root . '/frontend/src/data/toyota/teamgp-medacap-links.json';
file_put_contents($outPath, json_encode($out, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

echo json_encode($out['meta'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . PHP_EOL;
foreach ($links as $l) {
    if ($l['status'] === 'unmatched') {
        continue;
    }
    echo sprintf(
        "[%s] %s ↔ %s (%.2f) online=%s/%s niveau=%s\n",
        $l['status'],
        $l['excelName'],
        $l['medacapName'],
        $l['score'],
        $l['onlineDone'] ?? '?',
        $l['onlineAssigned'] ?? '?',
        $l['niveauAnalyse'] ?? '?'
    );
}
