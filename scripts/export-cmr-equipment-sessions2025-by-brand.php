<?php
declare(strict_types=1);

/**
 * Formations Equipment programmées au Cameroun en 2025 (sessions2025)
 * par marque — proposées / planifiées, sans exiger la participation filiale.
 *
 * Usage : php scripts/export-cmr-equipment-sessions2025-by-brand.php
 */

$bootstrap = 'C:/wamp64/www/MEDACAP/views/measure/api/bootstrap.php';
$sessionsPath = dirname(__DIR__) . '/catalogues/sessions2025/formations_2025_normalise.json';
$pifPath = dirname(__DIR__) . '/data/dps/cmr-equipment-planned-by-technician.json';

if (!is_file($bootstrap)) {
    fwrite(STDERR, "bootstrap.php introuvable\n");
    exit(1);
}
if (!is_file($sessionsPath)) {
    fwrite(STDERR, "sessions2025 introuvable\n");
    exit(1);
}

require $bootstrap;

function sessionsBrandSlug(string $marque): string
{
    $upper = strtoupper(trim($marque));
    if ($upper === 'HOHAN') {
        return 'sinotruk';
    }
    return portalApiBrandToSlug($marque);
}

function sessionsNormalizeName(string $value): string
{
    $value = mb_strtoupper(trim($value), 'UTF-8');
    $from = ['À', 'Á', 'Â', 'Ã', 'Ä', 'È', 'É', 'Ê', 'Ë', 'Ì', 'Í', 'Î', 'Ï', 'Ò', 'Ó', 'Ô', 'Õ', 'Ö', 'Ù', 'Ú', 'Û', 'Ü', 'Ç', 'Ñ'];
    $to = ['A', 'A', 'A', 'A', 'A', 'E', 'E', 'E', 'E', 'I', 'I', 'I', 'I', 'O', 'O', 'O', 'O', 'O', 'U', 'U', 'U', 'U', 'C', 'N'];
    $value = str_replace($from, $to, $value);
    $value = preg_replace('/[^A-Z0-9 ]+/', ' ', $value) ?? $value;
    $value = preg_replace('/\s+/', ' ', $value) ?? $value;
    return trim($value);
}

function sessionsFirstToken(string $value): string
{
    $parts = explode(' ', sessionsNormalizeName($value));
    return $parts[0] ?? '';
}

function sessionsTokensMatch(string $prenom, string $nom, array $tech): bool
{
    $pairs = [
        [sessionsNormalizeName($prenom), sessionsNormalizeName($nom)],
        [sessionsNormalizeName($nom), sessionsNormalizeName($prenom)],
    ];

    $tFn = sessionsNormalizeName((string) ($tech['firstName'] ?? ''));
    $tLn = sessionsNormalizeName((string) ($tech['lastName'] ?? ''));
    $tDisplay = sessionsNormalizeName((string) ($tech['name'] ?? ''));

    foreach ($pairs as [$pPre, $pNom]) {
        if ($pNom === '' || $pPre === '' || $pNom === 'NULL' || $pPre === 'NULL') {
            continue;
        }

        $pFull = trim($pPre . ' ' . $pNom);
        if ($pFull === $tDisplay || $pFull === trim($tFn . ' ' . $tLn)) {
            return true;
        }

        if ($pNom === $tLn && (
            $pPre === $tFn
            || sessionsFirstToken($pPre) === sessionsFirstToken($tFn)
            || strpos($tFn, $pPre) === 0
            || strpos($pPre, sessionsFirstToken($tFn)) === 0
            || levenshtein($pPre, sessionsFirstToken($tFn)) <= 1
        )) {
            return true;
        }

        $pTokens = array_values(array_filter(explode(' ', $pNom)));
        $tTokens = array_values(array_filter(explode(' ', $tLn)));
        $fnMatch = sessionsFirstToken($pPre) === sessionsFirstToken($tFn)
            || strpos($tFn, sessionsFirstToken($pPre)) !== false
            || strpos($pPre, sessionsFirstToken($tFn)) === 0;

        if ($fnMatch && count(array_intersect($pTokens, $tTokens)) > 0) {
            return true;
        }

        $pAll = array_values(array_filter(explode(' ', $pFull)));
        $tAll = array_values(array_filter(explode(' ', trim($tFn . ' ' . $tLn))));
        $overlap = array_intersect($pAll, $tAll);
        if (count($overlap) >= 2) {
            return true;
        }
        if (count($overlap) >= 1 && ($fnMatch || $pNom === $tLn || $pPre === $tFn)) {
            return true;
        }
    }

    return false;
}

function sessionsInCameroon(array $formation): bool
{
    $lieu = strtoupper(trim((string) ($formation['lieu'] ?? '')));
    return strpos($lieu, 'CAMEROUN') !== false;
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
            'brandJunior' => 1,
            'brandSenior' => 1,
            'brandExpert' => 1,
        ],
        'sort' => ['lastName' => 1, 'firstName' => 1],
    ]
);

$technicians = [];
$brandsInScope = [];

foreach ($techCursor as $techDoc) {
    $tech = $techDoc instanceof MongoDB\Model\BSONDocument ? $techDoc->getArrayCopy() : (array) $techDoc;
    $firstName = trim((string) ($tech['firstName'] ?? ''));
    $lastName = trim((string) ($tech['lastName'] ?? ''));
    $username = (string) ($tech['username'] ?? '');
    $assignedBrands = array_values(array_unique(array_map(
        static fn (string $b) => sessionsBrandSlug($b),
        portalApiExtractUserBrands($tech)
    ), SORT_STRING));

    foreach ($assignedBrands as $slug) {
        $brandsInScope[$slug] = true;
    }

    $row = [
        'id' => (string) ($tech['_id'] ?? ''),
        'username' => $username,
        'name' => portalApiTechnicianDisplayName($tech),
        'firstName' => $firstName,
        'lastName' => $lastName,
        'agency' => trim((string) ($tech['agency'] ?? '')) ?: null,
        'assignedBrands' => $assignedBrands,
    ];
    $technicians[] = $row;
}

ksort($brandsInScope);

if (is_file($pifPath)) {
    $pifData = json_decode((string) file_get_contents($pifPath), true);
    if (is_array($pifData)) {
        foreach ($pifData['meta']['manualAdditions'] ?? [] as $rule) {
            $brand = (string) ($rule['brand'] ?? '');
            if ($brand !== '') {
                $brandsInScope[$brand] = true;
            }
        }
        foreach (array_keys($pifData['totals']['byBrand'] ?? []) as $brand) {
            if (($pifData['totals']['byBrand'][$brand] ?? 0) > 0) {
                $brandsInScope[(string) $brand] = true;
            }
        }
    }
    ksort($brandsInScope);
}

$data = json_decode((string) file_get_contents($sessionsPath), true);
if (!is_array($data)) {
    fwrite(STDERR, "JSON sessions2025 invalide\n");
    exit(1);
}

$formationsByNum = [];
foreach ($data['formations'] ?? [] as $formation) {
    $formationsByNum[(string) ($formation['numero'] ?? '')] = $formation;
}

$byBrand = [];
$participationsByBrand = [];
$formationsByBrand = [];
$sessionsDetail = [];
$totalSessions = 0;
$totalParticipations = 0;

foreach ($data['formations'] ?? [] as $formation) {
    if (($formation['centre'] ?? '') !== 'EQUIPMENT') {
        continue;
    }
    if (!sessionsInCameroon($formation)) {
        continue;
    }

    $marqueRaw = (string) ($formation['marque'] ?? '');
    if (strtoupper(trim($marqueRaw)) === 'FUSO') {
        continue;
    }

    $brandSlug = sessionsBrandSlug($marqueRaw);
    if ($brandSlug === '' || !isset($brandsInScope[$brandSlug])) {
        continue;
    }

    $numero = (string) ($formation['numero'] ?? '');
    $participants = array_filter(
        $data['participants'] ?? [],
        static fn (array $p): bool => ($p['formation_numero'] ?? '') === $numero
    );

    $matchedTechs = [];
    foreach ($participants as $participant) {
        foreach ($technicians as $tech) {
            if (sessionsTokensMatch(
                (string) ($participant['prenom'] ?? ''),
                (string) ($participant['nom'] ?? ''),
                $tech
            )) {
                $matchedTechs[$tech['username']] = $tech['name'];
            }
        }
    }

    $totalSessions++;
    if ($matchedTechs) {
        $participationsByBrand[$brandSlug] = ($participationsByBrand[$brandSlug] ?? 0) + count($matchedTechs);
        $totalParticipations += count($matchedTechs);
    }
    $byBrand[$brandSlug] = ($byBrand[$brandSlug] ?? 0) + 1;

    $code = trim((string) ($formation['reference'] ?? ''));
    $formationRow = [
        'code' => $code !== '' ? $code : null,
        'date' => $formation['date_debut'] ?? null,
        'numero' => $numero,
        'designation' => $formation['designation'] ?? null,
        'type_client' => $formation['type_client'] ?? null,
        'techniciansMatched' => array_map(
            static fn (string $username): array => ['username' => $username, 'name' => $matchedTechs[$username]],
            array_keys($matchedTechs)
        ),
    ];
    $formationsByBrand[$brandSlug] = $formationsByBrand[$brandSlug] ?? [];
    $formationsByBrand[$brandSlug][] = $formationRow;

    $sessionsDetail[] = [
        'numero' => $numero,
        'code' => $formationRow['code'],
        'reference' => $formation['reference'] ?? null,
        'marque' => $marqueRaw,
        'brand' => $brandSlug,
        'date_debut' => $formation['date_debut'] ?? null,
        'type_client' => $formation['type_client'] ?? null,
        'techniciansMatched' => $formationRow['techniciansMatched'],
        'participantCountMatched' => count($matchedTechs),
    ];
}

ksort($byBrand);
ksort($participationsByBrand);

foreach ($formationsByBrand as $brandSlug => $rows) {
    usort($rows, static function (array $a, array $b): int {
        return strcmp((string) ($a['date'] ?? ''), (string) ($b['date'] ?? ''));
    });
    $formationsByBrand[$brandSlug] = $rows;
}
ksort($formationsByBrand);

foreach (array_keys($brandsInScope) as $brandSlug) {
    if (!isset($byBrand[$brandSlug])) {
        $byBrand[$brandSlug] = 0;
    }
    if (!isset($participationsByBrand[$brandSlug])) {
        $participationsByBrand[$brandSlug] = 0;
    }
    if (!isset($formationsByBrand[$brandSlug])) {
        $formationsByBrand[$brandSlug] = [];
    }
}
ksort($byBrand);
ksort($participationsByBrand);

$outDir = dirname(__DIR__) . '/data/dps';
if (!is_dir($outDir)) {
    mkdir($outDir, 0775, true);
}

$payload = [
    'meta' => [
        'source' => 'catalogues/sessions2025/formations_2025_normalise.json + MEDACAP techniciens',
        'year' => 2025,
        'subsidiary' => 'CAMEROON MOTORS INDUSTRIES',
        'department' => 'Equipment',
        'generatedAt' => date('c'),
        'definition' => 'Sessions Equipment programmées au Cameroun en 2025 (sessions2025) — proposées/planifiées par marque PIF filiale, indépendamment de la participation effective. HOHAN → sinotruk. Fuso exclu. techniciansMatched = croisement optionnel pour le x futur.',
        'technicianCount' => count($technicians),
        'brandsInScope' => array_keys($brandsInScope),
    ],
    'totals' => [
        'sessions' => $totalSessions,
        'participations' => $totalParticipations,
        'byBrand' => $byBrand,
        'participationsByBrand' => $participationsByBrand,
    ],
    'formationsByBrand' => $formationsByBrand,
    'sessions' => $sessionsDetail,
    'technicians' => $technicians,
];

$outPath = $outDir . '/cmr-equipment-sessions2025-by-brand.json';
file_put_contents($outPath, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n");

echo "Export OK : {$outPath}\n";
echo 'Sessions programmées : ' . $totalSessions . PHP_EOL;
echo 'Participations techniciens filiale (optionnel) : ' . $totalParticipations . PHP_EOL;
echo "Par marque (sessions) :\n";
foreach ($byBrand as $brand => $count) {
    echo "  {$brand} : {$count}\n";
}
