<?php
declare(strict_types=1);

/**
 * Formations 2025 Equipment au Cameroun avec client CFAO (incl. typo CAFO).
 * Codes Lovol normalisés LVL01–LVL05.
 *
 * Usage : php scripts/export-cmr-equipment-sessions2025-cfao.php
 */

$sessionsPath = dirname(__DIR__) . '/catalogues/sessions2025/formations_2025_normalise.json';

/** @var array<string, string> numero → code catalogue PIF */
const LOVOL_CANONICAL_CODES = [
    'E07-2025'  => 'LVL01',
    'CE07-2025' => 'LVL03',
    'CE08-2025' => 'LVL04',
    'E13-2025'  => 'LVL02',
    'E21-2025'  => 'LVL05',
];

function cfaoBrandSlug(string $marque): string
{
    $upper = strtoupper(trim($marque));
    if ($upper === 'HOHAN') {
        return 'sinotruk';
    }
    $map = [
        'RENAULT TRUCKS' => 'renault-trucks',
        'TOYOTA FORKLIFT' => 'toyota-forklift',
        'KING LONG' => 'king-long',
        'HINO' => 'hino',
        'LOVOL' => 'lovol',
        'FUSO' => 'fuso',
    ];
    return $map[$upper] ?? strtolower(str_replace(' ', '-', trim($marque)));
}

function cfaoIsCfaoClient(?string $client): bool
{
    $value = strtoupper(trim((string) $client));
    return strpos($value, 'CFAO') !== false || strpos($value, 'CAFO') !== false;
}

function cfaoResolveCode(array $formation): ?string
{
    $numero = (string) ($formation['numero'] ?? '');
    if (isset(LOVOL_CANONICAL_CODES[$numero])) {
        return LOVOL_CANONICAL_CODES[$numero];
    }
    $ref = trim((string) ($formation['reference'] ?? ''));
    return $ref !== '' ? $ref : null;
}

function cfaoInCameroon(array $formation): bool
{
    return strpos(strtoupper((string) ($formation['lieu'] ?? '')), 'CAMEROUN') !== false;
}

$data = json_decode((string) file_get_contents($sessionsPath), true);
if (!is_array($data)) {
    fwrite(STDERR, "JSON invalide\n");
    exit(1);
}

$formationsByNum = [];
foreach ($data['formations'] ?? [] as $formation) {
    $formationsByNum[(string) ($formation['numero'] ?? '')] = $formation;
}

$sessions = [];

foreach ($data['formations'] ?? [] as $formation) {
    if (($formation['centre'] ?? '') !== 'EQUIPMENT') {
        continue;
    }
    if (!cfaoInCameroon($formation)) {
        continue;
    }

    $numero = (string) ($formation['numero'] ?? '');
    $participants = array_values(array_filter(
        $data['participants'] ?? [],
        static fn (array $p): bool => ($p['formation_numero'] ?? '') === $numero
            && cfaoIsCfaoClient($p['client'] ?? null)
    ));

    if (!$participants) {
        continue;
    }

    $brandSlug = cfaoBrandSlug((string) ($formation['marque'] ?? ''));
    $excelCode = trim((string) ($formation['reference'] ?? '')) ?: null;

    $sessions[] = [
        'numero' => $numero,
        'code' => cfaoResolveCode($formation),
        'excelCode' => $excelCode,
        'date' => $formation['date_debut'] ?? null,
        'marque' => $formation['marque'] ?? null,
        'brand' => $brandSlug,
        'designation' => $formation['designation'] ?? null,
        'type_client' => $formation['type_client'] ?? null,
        'cfaoClients' => array_values(array_unique(array_map(
            static fn (array $p): string => trim((string) ($p['client'] ?? '')),
            $participants
        ))),
        'cfaoParticipantCount' => count($participants),
    ];
}

usort($sessions, static function (array $a, array $b): int {
    return strcmp((string) ($a['date'] ?? ''), (string) ($b['date'] ?? ''));
});

$formationsByBrand = [];
$byBrand = [];

foreach ($sessions as $row) {
    $brand = $row['brand'];
    $formationsByBrand[$brand] = $formationsByBrand[$brand] ?? [];
    $formationsByBrand[$brand][] = [
        'numero' => $row['numero'],
        'code' => $row['code'],
        'excelCode' => $row['excelCode'],
        'date' => $row['date'],
        'designation' => $row['designation'],
        'type_client' => $row['type_client'],
    ];
    $byBrand[$brand] = ($byBrand[$brand] ?? 0) + 1;
}

foreach ($formationsByBrand as $brand => $rows) {
    usort($rows, static fn (array $a, array $b): int => strcmp((string) $a['date'], (string) $b['date']));
    $formationsByBrand[$brand] = $rows;
}
ksort($formationsByBrand);
ksort($byBrand);

$withoutFuso = array_filter($sessions, static fn (array $r): bool => $r['brand'] !== 'fuso');

$payload = [
    'meta' => [
        'source' => 'catalogues/sessions2025/formations_2025_normalise.json',
        'year' => 2025,
        'filter' => 'Equipment · Cameroun · ≥1 participant client CFAO (incl. typo CAFO)',
        'lovolCodeMap' => LOVOL_CANONICAL_CODES,
        'generatedAt' => date('c'),
    ],
    'totals' => [
        'sessions' => count($sessions),
        'sessionsExcludingFuso' => count($withoutFuso),
        'byBrand' => $byBrand,
    ],
    'formationsByBrand' => $formationsByBrand,
    'sessions' => $sessions,
];

$outPath = dirname(__DIR__) . '/data/dps/cmr-equipment-sessions2025-cfao-by-brand.json';
file_put_contents($outPath, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n");

echo "Export OK : {$outPath}\n";
echo 'Sessions CFAO : ' . count($sessions) . ' (sans Fuso : ' . count($withoutFuso) . ")\n";
foreach ($byBrand as $brand => $count) {
    echo "  {$brand} : {$count}\n";
}
