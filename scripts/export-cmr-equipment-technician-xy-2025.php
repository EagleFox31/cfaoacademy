<?php
declare(strict_types=1);

/**
 * x/y par technicien CMR Equipment (2025 CFAO/CAFO) :
 *   y = programmé 2025 + Interne + code catalogue ∈ PIF (fichier JSON local)
 *   x = fait (présent + nom) — dans le PIF ou hors PIF
 *
 * Usage : php scripts/export-cmr-equipment-technician-xy-2025.php
 */

$sessionsPath = dirname(__DIR__) . '/catalogues/sessions2025/formations_2025_normalise.json';
$pifPath = dirname(__DIR__) . '/data/dps/cmr-equipment-planned-by-technician.json';

if (!is_file($pifPath)) {
    fwrite(STDERR, "PIF JSON introuvable : {$pifPath}\n");
    exit(1);
}

const LOVOL_CANONICAL_CODES = [
    'E07-2025'  => 'LVL01',
    'CE07-2025' => 'LVL03',
    'CE08-2025' => 'LVL04',
    'E13-2025'  => 'LVL02',
    'E21-2025'  => 'LVL05',
];

const RT_CANONICAL_CODES = [
    'E33-2025' => 'RT22',
];

/** @return list<array{technicians: list<string>, codes: list<string>}> */
function xyManualPifAdditions(): array
{
    return [
        [
            'technicians' => ['ac48nj', 'ya47so'],
            'codes' => ['LVL01', 'LVL02', 'LVL03', 'LVL04', 'LVL05'],
        ],
    ];
}

function xyBrandSlug(string $marque): string
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
        'JCB' => 'jcb',
        'BT' => 'bt',
    ];
    return $map[$upper] ?? strtolower(str_replace(' ', '-', trim($marque)));
}

function xyIsCfaoClient(?string $client): bool
{
    $value = strtoupper(trim((string) $client));
    return strpos($value, 'CFAO') !== false || strpos($value, 'CAFO') !== false;
}

function xyResolveSessionCode(array $formation): ?string
{
    $numero = (string) ($formation['numero'] ?? '');
    if (isset(LOVOL_CANONICAL_CODES[$numero])) {
        return LOVOL_CANONICAL_CODES[$numero];
    }
    if (isset(RT_CANONICAL_CODES[$numero])) {
        return RT_CANONICAL_CODES[$numero];
    }
    $ref = trim((string) ($formation['reference'] ?? ''));
    return $ref !== '' ? $ref : null;
}

/** Code aligné catalogue Academy (KL09-2025 → KL09, etc.) */
function xyCanonicalCatalogCode(?string $code): ?string
{
    if ($code === null) {
        return null;
    }
    $upper = strtoupper(trim($code));
    if ($upper === '') {
        return null;
    }
    if (preg_match('/^([A-Z]+\d+)-2025$/', $upper, $matches)) {
        return $matches[1];
    }
    return $upper;
}

function xyIsExterne(?string $typeClient): bool
{
    return strcasecmp(trim((string) $typeClient), 'Externe') === 0;
}

function xyNormalizeName(string $value): string
{
    $value = mb_strtoupper(trim($value), 'UTF-8');
    $from = ['À', 'Á', 'Â', 'Ã', 'Ä', 'È', 'É', 'Ê', 'Ë', 'Ì', 'Í', 'Î', 'Ï', 'Ò', 'Ó', 'Ô', 'Õ', 'Ö', 'Ù', 'Ú', 'Û', 'Ü', 'Ç', 'Ñ'];
    $to = ['A', 'A', 'A', 'A', 'A', 'E', 'E', 'E', 'E', 'I', 'I', 'I', 'I', 'O', 'O', 'O', 'O', 'O', 'U', 'U', 'U', 'U', 'C', 'N'];
    $value = str_replace($from, $to, $value);
    $value = preg_replace('/[^A-Z0-9 ]+/', ' ', $value) ?? $value;
    $value = preg_replace('/\s+/', ' ', $value) ?? $value;
    return trim($value);
}

function xyFirstToken(string $value): string
{
    $parts = explode(' ', xyNormalizeName($value));
    return $parts[0] ?? '';
}

/** Nom Excel ≈ nom Mongo (SOULEYMANOU / SOULEMANOU, etc.) */
function xyFamilyNameMatch(string $participantNom, string $techLastName): bool
{
    $p = xyNormalizeName($participantNom);
    $t = xyNormalizeName($techLastName);
    if ($p === '' || $t === '') {
        return false;
    }
    if ($p === $t || levenshtein($p, $t) <= 2) {
        return true;
    }
    $pTokens = array_values(array_filter(explode(' ', $p)));
    $tTokens = array_values(array_filter(explode(' ', $t)));
    return count($pTokens) >= 1
        && count(array_intersect($pTokens, $tTokens)) >= 1
        && levenshtein($p, $t) <= 3;
}

function xyTokensMatch(string $prenom, string $nom, array $tech): bool
{
    $tFn = xyNormalizeName((string) ($tech['firstName'] ?? ''));
    $tLn = xyNormalizeName((string) ($tech['lastName'] ?? ''));
    $tDisplay = xyNormalizeName((string) ($tech['name'] ?? ''));

    $tAll = array_values(array_filter(explode(' ', trim($tFn . ' ' . $tLn))));
    if ($tDisplay !== '' && $tDisplay !== trim($tFn . ' ' . $tLn)) {
        $tAll = array_values(array_unique(array_merge($tAll, array_filter(explode(' ', $tDisplay)))));
    }

    $pPreRaw = xyNormalizeName((string) $prenom);
    $pNomRaw = xyNormalizeName((string) $nom);
    if ($pNomRaw === '' || $pNomRaw === 'NULL') {
        return false;
    }
    if ($pPreRaw === 'NULL') {
        $pPreRaw = '';
    }

    $pairs = [
        [$pPreRaw, $pNomRaw],
        [$pNomRaw, $pPreRaw],
    ];

    foreach ($pairs as [$pPre, $pNom]) {
        if ($pNom === '') {
            continue;
        }

        // Excel sans prénom (ex. CE07 · SOULEYMANOU)
        if ($pPre === '') {
            if (xyFamilyNameMatch($pNom, $tLn)) {
                return true;
            }
            continue;
        }

        $pFull = trim($pPre . ' ' . $pNom);
        if ($pFull === $tDisplay || $pFull === trim($tFn . ' ' . $tLn)) {
            return true;
        }

        // Nom Excel identique au nom Mongo
        if ($pNom === $tLn && (
            $pPre === $tFn
            || xyFirstToken($pPre) === xyFirstToken($tFn)
            || levenshtein(xyFirstToken($pPre), xyFirstToken($tFn)) <= 1
        )) {
            return true;
        }

        // Token nom Excel présent dans nom Mongo + prénom proche (NGOBA / NGOBA HOUDINI · Serge / Serges)
        $pNomTokens = array_values(array_filter(explode(' ', $pNom)));
        $tLnTokens = array_values(array_filter(explode(' ', $tLn)));
        if (count(array_intersect($pNomTokens, $tLnTokens)) >= 1) {
            $pf = xyFirstToken($pPre);
            $tf = xyFirstToken($tFn);
            if ($pf !== '' && ($pf === $tf || levenshtein($pf, $tf) <= 1)) {
                return true;
            }
        }

        // Au moins 2 tokens identiques
        $pAll = array_values(array_filter(explode(' ', $pFull)));
        if (count(array_intersect($pAll, $tAll)) >= 2) {
            return true;
        }
    }

    return false;
}

function xyInCameroon(array $formation): bool
{
    return strpos(strtoupper((string) ($formation['lieu'] ?? '')), 'CAMEROUN') !== false;
}

function xyShouldExcludePlannedTraining(string $code, string $brand): bool
{
    $normalized = strtoupper(trim($code));
    if ($normalized === 'RTXX' || $normalized === 'RTXY' || $normalized === 'JCB06') {
        return true;
    }
    if (strpos(strtoupper(trim($brand)), 'RENAULT') !== false && preg_match('/^\d+$/', $code)) {
        return true;
    }
    return false;
}

/** @return array<string, true> */
function xyPifCodeSet(array $codes): array
{
    $set = [];
    foreach ($codes as $code) {
        $canonical = xyCanonicalCatalogCode((string) $code);
        if ($canonical !== null) {
            $set[$canonical] = true;
        }
    }
    return $set;
}

/** H01 au PIF ⇒ H430 à la place (pas les deux). */
function xyApplyH01H430Coupling(array &$technicians): void
{
    foreach ($technicians as &$tech) {
        if (!isset($tech['pifCodes']['H01'])) {
            continue;
        }
        unset($tech['pifCodes']['H01']);
        $tech['pifCodes']['H430'] = true;
        $tech['pifCodesList'] = array_values(array_keys($tech['pifCodes']));
        sort($tech['pifCodesList']);
    }
    unset($tech);
}

/** @return list<array<string, mixed>> */
function xyLoadTechniciansFromPifJson(string $pifPath): array
{
    $data = json_decode((string) file_get_contents($pifPath), true);
    if (!is_array($data)) {
        throw new RuntimeException('PIF JSON invalide');
    }

    $technicians = [];
    foreach ($data['technicians'] ?? [] as $row) {
        $pifCodes = xyPifCodeSet($row['pifCodes'] ?? []);
        $technicians[] = [
            'id' => (string) ($row['id'] ?? ''),
            'username' => (string) ($row['username'] ?? ''),
            'name' => (string) ($row['name'] ?? ''),
            'firstName' => trim((string) ($row['firstName'] ?? '')),
            'lastName' => trim((string) ($row['lastName'] ?? '')),
            'agency' => $row['agency'] ?? null,
            'assignedBrands' => $row['assignedBrands'] ?? [],
            'codesByBrand' => $row['codesByBrand'] ?? [],
            'pifCodes' => $pifCodes,
            'pifCodesList' => array_values(array_keys($pifCodes)),
        ];
    }

    return $technicians;
}

function xySessionRow(array $session, bool $inPif, bool $attended, bool $countsAsY): array
{
    return [
        'numero' => $session['numero'],
        'code' => $session['code'],
        'catalogCode' => $session['catalogCode'],
        'brand' => $session['brand'],
        'date' => $session['date'],
        'designation' => $session['designation'],
        'type_client' => $session['type_client'],
        'inPif' => $inPif,
        'attended' => $attended,
        'countsAsProgrammed' => $countsAsY,
    ];
}

$technicians = xyLoadTechniciansFromPifJson($pifPath);
xyApplyH01H430Coupling($technicians);

$data = json_decode((string) file_get_contents($sessionsPath), true);
if (!is_array($data)) {
    fwrite(STDERR, "JSON sessions2025 invalide\n");
    exit(1);
}

$sessions2025 = [];
foreach ($data['formations'] ?? [] as $formation) {
    if (($formation['centre'] ?? '') !== 'EQUIPMENT') {
        continue;
    }
    if (!xyInCameroon($formation)) {
        continue;
    }
    if (strtoupper(trim((string) ($formation['marque'] ?? ''))) === 'FUSO') {
        continue;
    }

    $numero = (string) ($formation['numero'] ?? '');
    $participants = array_values(array_filter(
        $data['participants'] ?? [],
        static fn (array $p): bool => ($p['formation_numero'] ?? '') === $numero
            && xyIsCfaoClient($p['client'] ?? null)
    ));
    if (!$participants) {
        continue;
    }

    $rawCode = xyResolveSessionCode($formation);
    $sessions2025[] = [
        'numero' => $numero,
        'code' => $rawCode,
        'catalogCode' => xyCanonicalCatalogCode($rawCode),
        'brand' => xyBrandSlug((string) ($formation['marque'] ?? '')),
        'date' => $formation['date_debut'] ?? null,
        'designation' => $formation['designation'] ?? null,
        'type_client' => $formation['type_client'] ?? null,
        'participants' => $participants,
    ];
}

usort($sessions2025, static fn (array $a, array $b): int => strcmp((string) $a['date'], (string) $b['date']));

$rows = [];
$totals = ['x' => 0, 'y' => 0, 'xInPif' => 0, 'xNotInPif' => 0];

foreach ($technicians as $tech) {
    $programmedSessions = [];
    $doneSessions = [];
    $doneInPif = [];
    $doneNotInPif = [];
    $excludedFromY = [];

    foreach ($sessions2025 as $session) {
        $catalogCode = $session['catalogCode'];
        $inPif = $catalogCode !== null && isset($tech['pifCodes'][$catalogCode]);
        // Le pool est déjà filtré sur participants client CFAO/CAFO — ne pas exclure via
        // formation.type_client « Externe » (libellé admin multi-pays, pas absence CFAO).
        $countsAsY = $inPif && $catalogCode !== null;

        $attended = false;
        foreach ($session['participants'] as $participant) {
            if (empty($participant['present'])) {
                continue;
            }
            if (xyTokensMatch(
                (string) ($participant['prenom'] ?? ''),
                (string) ($participant['nom'] ?? ''),
                $tech
            )) {
                $attended = true;
                break;
            }
        }

        $row = xySessionRow($session, $inPif, $attended, $countsAsY);

        if ($countsAsY) {
            $programmedSessions[] = $row;
        } elseif ($inPif || $attended) {
            $reason = $catalogCode === null ? 'code_manquant' : 'hors_pif';
            if ($inPif) {
                $reason = 'autre';
            } elseif ($catalogCode !== null) {
                $reason = 'hors_pif';
            }
            $excludedFromY[] = array_merge($row, ['excludeReason' => $reason]);
        } elseif ($catalogCode !== null) {
            $excludedFromY[] = array_merge($row, ['excludeReason' => 'hors_pif']);
        }

        if ($attended) {
            $doneSessions[] = $row;
            if ($inPif) {
                $doneInPif[] = $session['numero'];
            } else {
                $doneNotInPif[] = $session['numero'];
            }
        }
    }

    $x = count($doneSessions);
    $y = count($programmedSessions);
    $totals['x'] += $x;
    $totals['y'] += $y;
    $totals['xInPif'] += count($doneInPif);
    $totals['xNotInPif'] += count($doneNotInPif);

    $rows[] = [
        'username' => $tech['username'],
        'name' => $tech['name'],
        'firstName' => $tech['firstName'],
        'lastName' => $tech['lastName'],
        'agency' => $tech['agency'],
        'assignedBrands' => $tech['assignedBrands'],
        'pifCodes' => $tech['pifCodesList'],
        'x' => $x,
        'y' => $y,
        'ratio' => $y > 0 ? round($x / $y, 2) : null,
        'xInPif' => count($doneInPif),
        'xNotInPif' => count($doneNotInPif),
        'programmedSessions' => $programmedSessions,
        'doneSessions' => $doneSessions,
        'excludedFromProgrammed' => $excludedFromY,
        'doneInPif' => $doneInPif,
        'doneNotInPif' => $doneNotInPif,
    ];
}

usort($rows, static fn (array $a, array $b): int => strcasecmp((string) $a['firstName'], (string) $b['firstName']));

$payload = [
    'meta' => [
        'generatedAt' => date('c'),
        'subsidiary' => 'CAMEROON MOTORS INDUSTRIES',
        'department' => 'Equipment',
        'technicianCount' => count($rows),
        'definition' => [
            'y' => 'Programmé 2025 (pool CFAO/CAFO Cameroun · participants client CFAO) dont le code catalogue ∈ PIF technicien — suivi ou non',
            'x' => 'Fait 2025 (participant identifié, présent, nom ≥ 2 tokens ou nom+prénom exact) — code ∈ PIF ou hors PIF',
            'excludedFromY' => 'Code absent du PIF, ou code Excel non mappable catalogue',
        ],
        'sessions2025Pool' => count($sessions2025),
        'codeMaps' => ['lovol' => LOVOL_CANONICAL_CODES, 'renaultTrucks' => RT_CANONICAL_CODES],
    ],
    'totals' => $totals,
    'technicians' => $rows,
];

$outPath = dirname(__DIR__) . '/data/dps/cmr-equipment-technician-xy-2025.json';
file_put_contents($outPath, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n");

echo "Export OK : {$outPath}\n";
echo 'Pool sessions 2025 CFAO : ' . count($sessions2025) . PHP_EOL;
echo 'Totaux : ' . $totals['x'] . '/' . $totals['y'] . PHP_EOL;

foreach ($rows as $row) {
    if ($row['username'] === 'ac48nj') {
        echo "\n=== {$row['name']} : {$row['x']}/{$row['y']} ===\n";
        echo 'PIF: ' . implode(', ', $row['pifCodes']) . "\n";
        foreach ($row['programmedSessions'] as $s) {
            echo "  Y  {$s['numero']} {$s['catalogCode']} {$s['date']}\n";
        }
        foreach ($row['doneSessions'] as $s) {
            echo "  X  {$s['numero']} {$s['catalogCode']} {$s['date']}\n";
        }
        break;
    }
}
