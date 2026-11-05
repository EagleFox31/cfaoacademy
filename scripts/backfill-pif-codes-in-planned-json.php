<?php
declare(strict_types=1);

/**
 * Recopie pifCodes / codesByBrand depuis cmr-equipment-technician-xy-2025.json
 * vers cmr-equipment-planned-by-technician.json (sans Mongo).
 */

$plannedPath = dirname(__DIR__) . '/data/dps/cmr-equipment-planned-by-technician.json';
$xyPath = dirname(__DIR__) . '/data/dps/cmr-equipment-technician-xy-2025.json';
$catalogPath = dirname(__DIR__) . '/frontend/src/data/training-catalog.json';

$planned = json_decode((string) file_get_contents($plannedPath), true);
$xy = json_decode((string) file_get_contents($xyPath), true);
$catalog = json_decode((string) file_get_contents($catalogPath), true);

if (!is_array($planned) || !is_array($xy)) {
    fwrite(STDERR, "JSON invalide\n");
    exit(1);
}

$codeToBrand = [];
foreach ($catalog as $brandName => $levels) {
    if (!is_array($levels) || !isset($levels[0]['trainings'])) {
        continue;
    }
    $brandUpper = strtoupper(trim((string) $brandName));
    if ($brandUpper === 'SINOTRUK' || $brandUpper === 'HOHAN') {
        $slug = 'sinotruk';
    } elseif ($brandUpper === 'KING LONG') {
        $slug = 'king-long';
    } elseif ($brandUpper === 'RENAULT TRUCKS') {
        $slug = 'renault-trucks';
    } elseif ($brandUpper === 'TOYOTA FORKLIFT') {
        $slug = 'toyota-forklift';
    } elseif ($brandUpper === 'HINO') {
        $slug = 'hino';
    } elseif ($brandUpper === 'LOVOL') {
        $slug = 'lovol';
    } elseif ($brandUpper === 'JCB') {
        $slug = 'jcb';
    } elseif ($brandUpper === 'BT') {
        $slug = 'bt';
    } else {
        $slug = strtolower(str_replace(' ', '-', trim((string) $brandName)));
    }
    foreach ($levels as $level) {
        foreach ($level['trainings'] ?? [] as $training) {
            $code = strtoupper(trim((string) ($training['code'] ?? '')));
            if ($code !== '') {
                $codeToBrand[$code] = $slug;
            }
        }
    }
}
foreach (['LVL01', 'LVL02', 'LVL03', 'LVL04', 'LVL05'] as $code) {
    $codeToBrand[$code] = 'lovol';
}

$xyByUser = [];
foreach ($xy['technicians'] ?? [] as $row) {
    $xyByUser[(string) ($row['username'] ?? '')] = $row;
}

foreach ($planned['technicians'] as &$tech) {
    $row = $xyByUser[$tech['username'] ?? ''] ?? null;
    if (!$row) {
        continue;
    }
    $codes = $row['pifCodes'] ?? [];
    $tech['pifCodes'] = $codes;
    if (!empty($row['firstName'])) {
        $tech['firstName'] = $row['firstName'];
    }
    if (!empty($row['lastName'])) {
        $tech['lastName'] = $row['lastName'];
    }
    $codesByBrand = [];
    foreach ($codes as $code) {
        $brand = $codeToBrand[strtoupper($code)] ?? 'unknown';
        $codesByBrand[$brand] = $codesByBrand[$brand] ?? [];
        $codesByBrand[$brand][] = strtoupper($code);
    }
    foreach ($codesByBrand as $brand => $brandCodes) {
        sort($brandCodes);
        $codesByBrand[$brand] = array_values(array_unique($brandCodes));
    }
    ksort($codesByBrand);
    $tech['codesByBrand'] = $codesByBrand;
}
unset($tech);

$planned['meta']['pifCodesBackfill'] = [
    'source' => 'data/dps/cmr-equipment-technician-xy-2025.json',
    'at' => date('c'),
];

file_put_contents($plannedPath, json_encode($planned, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n");
echo "Backfill OK : {$plannedPath}\n";
