<?php
declare(strict_types=1);

/**
 * Règle PIF : H01 remplacé par H430 (jamais les deux).
 *
 * Usage : php scripts/apply-h01-h430-pif-replace.php
 */

$plannedPath = dirname(__DIR__) . '/data/dps/cmr-equipment-planned-by-technician.json';

$data = json_decode((string) file_get_contents($plannedPath), true);
if (!is_array($data)) {
    fwrite(STDERR, "JSON PIF invalide\n");
    exit(1);
}

function pifRemoveCode(array &$tech, string $code): bool
{
    $codes = $tech['pifCodes'] ?? [];
    $idx = array_search($code, $codes, true);
    if ($idx === false) {
        return false;
    }
    array_splice($tech['pifCodes'], $idx, 1);
    sort($tech['pifCodes']);

    foreach ($tech['codesByBrand'] ?? [] as $brand => &$list) {
        $list = array_values(array_filter($list, static fn (string $c): bool => $c !== $code));
        sort($list);
    }
    unset($list);

    return true;
}

function pifAddCode(array &$tech, string $code): void
{
    $tech['pifCodes'] = array_values(array_unique(array_merge($tech['pifCodes'] ?? [], [$code]), SORT_STRING));
    sort($tech['pifCodes']);

    $tech['codesByBrand'] = $tech['codesByBrand'] ?? [];
    $brandKey = isset($tech['codesByBrand']['sinotruk']) ? 'sinotruk' : 'unknown';
    $tech['codesByBrand'][$brandKey] = array_values(array_unique(array_merge(
        $tech['codesByBrand'][$brandKey] ?? [],
        [$code]
    ), SORT_STRING));
    sort($tech['codesByBrand'][$brandKey]);
    ksort($tech['codesByBrand']);
}

$bothRemoved = 0;
$replacedOnly = 0;

foreach ($data['technicians'] as &$tech) {
    $codes = $tech['pifCodes'] ?? [];
    $hasH01 = in_array('H01', $codes, true);
    $hasH430 = in_array('H430', $codes, true);

    if (!$hasH01) {
        continue;
    }

    if ($hasH430) {
        pifRemoveCode($tech, 'H01');
        $tech['total'] = max(0, (int) ($tech['total'] ?? 0) - 1);
        if (isset($tech['byBrand']['sinotruk'])) {
            $tech['byBrand']['sinotruk'] = max(0, (int) $tech['byBrand']['sinotruk'] - 1);
        }
        $bothRemoved++;
        continue;
    }

    pifRemoveCode($tech, 'H01');
    pifAddCode($tech, 'H430');
    $replacedOnly++;
}
unset($tech);

$grandTotal = 0;
$totalsByBrand = [];
foreach ($data['technicians'] as $tech) {
    $grandTotal += (int) ($tech['total'] ?? 0);
    foreach ($tech['byBrand'] ?? [] as $brand => $count) {
        $totalsByBrand[$brand] = ($totalsByBrand[$brand] ?? 0) + (int) $count;
    }
}
ksort($totalsByBrand);

$data['totals']['byBrand'] = $totalsByBrand;
$data['totals']['grandTotal'] = $grandTotal;

$data['meta']['pifCouplingRules'] = array_values(array_filter(
    $data['meta']['pifCouplingRules'] ?? [],
    static fn (array $r): bool => ($r['rule'] ?? '') !== 'H01 => H430'
));
$data['meta']['pifCouplingRules'][] = [
    'rule' => 'H01 remplacé par H430 (exclusif)',
    'appliedAt' => gmdate('c'),
    'bothDeduped' => $bothRemoved,
    'h01ToH430Only' => $replacedOnly,
];

file_put_contents(
    $plannedPath,
    json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n"
);

echo "H01 retiré (doublon avec H430) : {$bothRemoved}\n";
echo "H01 → H430 (remplacement) : {$replacedOnly}\n";
echo "grandTotal PIF : {$grandTotal}\n";
