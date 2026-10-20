<?php
declare(strict_types=1);

/**
 * Exporte les formations planifiées (allocations → trainings actifs)
 * par technicien Equipment Cameroun, ventilées par marque.
 *
 * Usage : php scripts/export-cmr-equipment-pif-by-technician.php
 */

$bootstrap = 'C:/wamp64/www/MEDACAP/views/measure/api/bootstrap.php';
if (!is_file($bootstrap)) {
    fwrite(STDERR, "bootstrap.php introuvable : {$bootstrap}\n");
    exit(1);
}

require $bootstrap;

use MongoDB\BSON\ObjectId;

function exportBrandSlug(string $brand): string
{
    $slug = portalApiBrandToSlug($brand);
    if (strtoupper(trim($brand)) === 'HOHAN') {
        return 'sinotruk';
    }
    return $slug;
}

/** Exclut placeholders RT, e-learning RT (codes numériques) et JCB06 (hors programme). */
function exportShouldExcludePlannedTraining(string $code, string $brand): bool
{
    $normalized = strtoupper(trim($code));
    if ($normalized === 'RTXX' || $normalized === 'RTXY' || $normalized === 'JCB06') {
        return true;
    }

    $brandUpper = strtoupper(trim($brand));
    $isRenault = strpos($brandUpper, 'RENAULT') !== false;
    if ($isRenault && preg_match('/^\d+$/', $code)) {
        return true;
    }

    return false;
}

/** @return list<array{technicians: list<string>, brand: string, codes: list<string>, countPerTechnician: int}> */
function exportManualPlannedAdditions(): array
{
    return [
        [
            'technicians' => ['ac48nj', 'ya47so'],
            'brand' => 'lovol',
            'codes' => ['LVL01', 'LVL02', 'LVL03', 'LVL04', 'LVL05'],
            'countPerTechnician' => 5,
        ],
    ];
}

/** H01 au PIF ⇒ H430 à la place (pas les deux). */
function exportApplyH01H430Coupling(array &$technicians, array &$totalsByBrand, int &$grandTotal): int
{
    $count = 0;
    foreach ($technicians as &$row) {
        $codes = $row['pifCodes'] ?? [];
        if (!in_array('H01', $codes, true)) {
            continue;
        }

        if (in_array('H430', $codes, true)) {
            $row['pifCodes'] = array_values(array_filter($codes, static fn (string $c): bool => $c !== 'H01'));
            sort($row['pifCodes']);
            foreach ($row['codesByBrand'] ?? [] as $brand => &$list) {
                $list = array_values(array_filter($list, static fn (string $c): bool => $c !== 'H01'));
                sort($list);
            }
            unset($list);
            $row['total'] = max(0, (int) ($row['total'] ?? 0) - 1);
            if (isset($row['byBrand']['sinotruk'])) {
                $row['byBrand']['sinotruk'] = max(0, (int) $row['byBrand']['sinotruk'] - 1);
                $totalsByBrand['sinotruk'] = max(0, ($totalsByBrand['sinotruk'] ?? 0) - 1);
            }
            $grandTotal = max(0, $grandTotal - 1);
            $count++;
            continue;
        }

        $row['pifCodes'] = array_values(array_unique(array_merge(
            array_values(array_filter($codes, static fn (string $c): bool => $c !== 'H01')),
            ['H430']
        ), SORT_STRING));
        sort($row['pifCodes']);
        $row['codesByBrand'] = $row['codesByBrand'] ?? [];
        $brandKey = isset($row['codesByBrand']['sinotruk']) ? 'sinotruk' : 'unknown';
        $row['codesByBrand'][$brandKey] = array_values(array_unique(array_merge(
            array_values(array_filter($row['codesByBrand'][$brandKey] ?? [], static fn (string $c): bool => $c !== 'H01')),
            ['H430']
        ), SORT_STRING));
        sort($row['codesByBrand'][$brandKey]);
        ksort($row['codesByBrand']);
        $count++;
    }
    unset($row);

    return $count;
}

function exportApplyManualAdditions(array &$technicians, array &$totalsByBrand, int &$grandTotal): array
{
    $applied = [];
    foreach (exportManualPlannedAdditions() as $rule) {
        $applied[] = $rule;
        foreach ($technicians as &$row) {
            if (!in_array($row['username'], $rule['technicians'], true)) {
                continue;
            }
            $brand = $rule['brand'];
            $count = (int) $rule['countPerTechnician'];
            $row['byBrand'][$brand] = ($row['byBrand'][$brand] ?? 0) + $count;
            $row['codesByBrand'] = $row['codesByBrand'] ?? [];
            $row['codesByBrand'][$brand] = array_values(array_unique(array_merge(
                $row['codesByBrand'][$brand] ?? [],
                $rule['codes']
            ), SORT_STRING));
            $row['pifCodes'] = array_values(array_unique(array_merge(
                $row['pifCodes'] ?? [],
                $rule['codes']
            ), SORT_STRING));
            sort($row['pifCodes']);
            ksort($row['codesByBrand']);
            $row['total'] += $count;
            if (!in_array($brand, $row['assignedBrands'], true)) {
                $row['assignedBrands'][] = $brand;
                sort($row['assignedBrands']);
            }
            ksort($row['byBrand']);
            $totalsByBrand[$brand] = ($totalsByBrand[$brand] ?? 0) + $count;
            $grandTotal += $count;
        }
        unset($row);
    }
    return $applied;
}

$client = new MongoDB\Client($mongoUri);
$db = $client->selectDatabase($mongoDb);

$techCursor = $db->users->find(
    [
        'profile' => 'Technicien',
        'active' => true,
        'department' => portalApiTechnicianDepartmentFilter('Equipment'),
        'subsidiary' => ['$in' => portalApiResolveSubsidiaries('CAMEROON MOTORS INDUSTRIES')],
    ],
    [
        'projection' => [
            'username' => 1,
            'firstName' => 1,
            'lastName' => 1,
            'agency' => 1,
            'level' => 1,
            'brandJunior' => 1,
            'brandSenior' => 1,
            'brandExpert' => 1,
        ],
        'sort' => ['lastName' => 1, 'firstName' => 1],
    ]
);

$technicians = [];
$totalsByBrand = [];
$grandTotal = 0;
$excludedTotal = 0;
$excludedByReason = [
    'rt_placeholder' => 0,
    'rt_elearning_numeric' => 0,
    'jcb06' => 0,
];

foreach ($techCursor as $techDoc) {
    $tech = $techDoc instanceof MongoDB\Model\BSONDocument ? $techDoc->getArrayCopy() : (array) $techDoc;
    $userOid = $tech['_id'] ?? null;
    if (!$userOid instanceof ObjectId) {
        continue;
    }

    $byBrand = [];
    $codesByBrand = [];
    $pifCodes = [];
    $total = 0;

    $allocCursor = $db->allocations->find([
        'user' => $userOid,
        'training' => ['$exists' => true, '$ne' => null],
    ]);

    $trainingIds = [];
    foreach ($allocCursor as $alloc) {
        $arr = $alloc instanceof MongoDB\Model\BSONDocument ? $alloc->getArrayCopy() : (array) $alloc;
        if (!empty($arr['training'])) {
            $trainingIds[(string) $arr['training']] = $arr['training'];
        }
    }

    if ($trainingIds) {
        $trainingCursor = $db->trainings->find([
            '_id' => ['$in' => array_values($trainingIds)],
            'active' => true,
        ]);
        foreach ($trainingCursor as $trainingDoc) {
            $t = $trainingDoc instanceof MongoDB\Model\BSONDocument ? $trainingDoc->getArrayCopy() : (array) $trainingDoc;
            $code = trim((string) ($t['code'] ?? ''));
            if ($code === '') {
                continue;
            }
            $brandRaw = (string) ($t['brand'] ?? '');
            if (exportShouldExcludePlannedTraining($code, $brandRaw)) {
                $excludedTotal++;
                $normalized = strtoupper(trim($code));
                if ($normalized === 'RTXX' || $normalized === 'RTXY') {
                    $excludedByReason['rt_placeholder']++;
                } elseif ($normalized === 'JCB06') {
                    $excludedByReason['jcb06']++;
                } else {
                    $excludedByReason['rt_elearning_numeric']++;
                }
                continue;
            }
            $slug = exportBrandSlug($brandRaw);
            if ($slug === '') {
                continue;
            }
            $codeUpper = strtoupper($code);
            $byBrand[$slug] = ($byBrand[$slug] ?? 0) + 1;
            $codesByBrand[$slug] = $codesByBrand[$slug] ?? [];
            if (!in_array($codeUpper, $codesByBrand[$slug], true)) {
                $codesByBrand[$slug][] = $codeUpper;
            }
            $pifCodes[$codeUpper] = true;
            $total++;
            $totalsByBrand[$slug] = ($totalsByBrand[$slug] ?? 0) + 1;
            $grandTotal++;
        }
    }

    ksort($byBrand);
    ksort($codesByBrand);
    foreach ($codesByBrand as $slug => $codes) {
        sort($codesByBrand[$slug]);
    }
    $pifCodesList = array_keys($pifCodes);
    sort($pifCodesList);

    $level = strtoupper(trim((string) ($tech['level'] ?? '')));
    $primaryTier = match ($level) {
        'EXPERT' => 'expert',
        'SENIOR' => 'senior',
        default => 'junior',
    };

    $technicians[] = [
        'id' => (string) $userOid,
        'name' => portalApiTechnicianDisplayName($tech),
        'username' => (string) ($tech['username'] ?? ''),
        'firstName' => trim((string) ($tech['firstName'] ?? '')),
        'lastName' => trim((string) ($tech['lastName'] ?? '')),
        'agency' => trim((string) ($tech['agency'] ?? '')) ?: null,
        'level' => trim((string) ($tech['level'] ?? '')) ?: null,
        'primaryTier' => $primaryTier,
        'assignedBrands' => array_values(array_unique(array_map(
            static fn (string $b) => exportBrandSlug($b),
            portalApiExtractUserBrands($tech)
        ), SORT_STRING)),
        'byBrand' => $byBrand,
        'codesByBrand' => $codesByBrand,
        'pifCodes' => $pifCodesList,
        'total' => $total,
    ];
}

ksort($totalsByBrand);

$manualAdditions = exportApplyManualAdditions($technicians, $totalsByBrand, $grandTotal);
$h01H430Coupled = exportApplyH01H430Coupling($technicians, $totalsByBrand, $grandTotal);
ksort($totalsByBrand);

$outDir = dirname(__DIR__) . '/data/dps';
if (!is_dir($outDir)) {
    mkdir($outDir, 0775, true);
}

$payload = [
    'meta' => [
        'source' => 'MEDACAP MongoDB',
        'database' => $mongoDb,
        'mongoUriSource' => $mongoUriSource,
        'subsidiary' => 'CAMEROON MOTORS INDUSTRIES',
        'department' => 'Equipment',
        'generatedAt' => date('c'),
        'technicianCount' => count($technicians),
        'definition' => 'Formations planifiées via allocations → trainings actifs. Exclut RTXX/RTXY, JCB06 (hors programme) et codes Renault purement numériques (e-learning). HOHAN → sinotruk.',
        'excluded' => [
            'total' => $excludedTotal,
            'rtPlaceholder' => $excludedByReason['rt_placeholder'],
            'rtElearningNumeric' => $excludedByReason['rt_elearning_numeric'],
            'jcb06' => $excludedByReason['jcb06'],
        ],
        'manualAdditions' => $manualAdditions,
        'pifCouplingRules' => [
            [
                'rule' => 'H01 remplacé par H430 (exclusif)',
                'techniciansUpdated' => $h01H430Coupled,
            ],
        ],
    ],
    'totals' => [
        'byBrand' => $totalsByBrand,
        'grandTotal' => $grandTotal,
    ],
    'technicians' => $technicians,
];

$outPath = $outDir . '/cmr-equipment-planned-by-technician.json';
file_put_contents($outPath, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n");

echo "Export OK : {$outPath}\n";
echo 'Techniciens : ' . count($technicians) . PHP_EOL;
echo 'Total formations planifiées : ' . $grandTotal . PHP_EOL;
echo 'Exclues (RTXX/RTXY + JCB06 + e-learning RT) : ' . $excludedTotal . PHP_EOL;
