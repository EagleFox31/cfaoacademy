<?php
declare(strict_types=1);

/**
 * GF supportés LOVOL Junior + notes par technicien (results.speciality).
 *
 * Usage : php scripts/export-lovol-junior-gf-scores.php
 */

$bootstrap = 'C:/wamp64/www/MEDACAP/views/measure/api/bootstrap.php';

if (!is_file($bootstrap)) {
    fwrite(STDERR, "bootstrap.php introuvable\n");
    exit(1);
}

require $bootstrap;

use MongoDB\BSON\ObjectId;

const LOVOL_BRAND = 'LOVOL';
const LEVEL = 'Junior';
const TARGET_USERNAMES = ['ac48nj', 'ya47so'];

/** @param mixed $value */
function lovolGfToArray($value): array
{
    if ($value instanceof MongoDB\Model\BSONArray) {
        $value = $value->getArrayCopy();
    }
    if (!is_array($value)) {
        return [];
    }
    return array_values(array_filter(array_map(
        static fn ($v) => trim((string) $v),
        $value
    ), static fn ($v) => $v !== ''));
}

function lovolPercentScore(?array $result): ?int
{
    if (!$result || !isset($result['score'], $result['total'])) {
        return null;
    }
    $total = (int) $result['total'];
    if ($total <= 0) {
        return null;
    }
    return (int) ceil(((float) $result['score'] * 100) / $total);
}

function lovolNormalizeSpeciality(string $value): string
{
    return trim(preg_replace('/\s+/', ' ', $value) ?? $value);
}

function lovolStartsWith(string $haystack, string $needle): bool
{
    if ($needle === '') {
        return true;
    }
    return strncmp($haystack, $needle, strlen($needle)) === 0;
}

function lovolSpecialityMatches(string $resultSpec, string $supportedSpec): bool
{
    $a = mb_strtoupper(lovolNormalizeSpeciality($resultSpec), 'UTF-8');
    $b = mb_strtoupper(lovolNormalizeSpeciality($supportedSpec), 'UTF-8');
    return $a === $b || lovolStartsWith($a, $b) || lovolStartsWith($b, $a);
}

function lovolLoadSupportedGroups(MongoDB\Database $db, string $brand, string $level): array
{
    $doc = $db->nonSupportedGroupsByBrandLevel->findOne(['brand' => $brand]);
    if ($doc) {
        $arr = $doc instanceof MongoDB\Model\BSONDocument ? $doc->getArrayCopy() : (array) $doc;
        foreach ($arr['levels'] ?? [] as $lvl) {
            $lvlArr = $lvl instanceof MongoDB\Model\BSONDocument ? $lvl->getArrayCopy() : (array) $lvl;
            if (($lvlArr['level'] ?? '') !== $level) {
                continue;
            }
            $supported = lovolGfToArray($lvlArr['supportedGroups'] ?? []);
            if ($supported) {
                return $supported;
            }
            $groups = lovolGfToArray($lvlArr['groups'] ?? []);
            if ($groups) {
                return $groups;
            }
        }
    }

    $ref = $db->nonSupportedGroupsByBrandLevel->findOne(['supportedGroups' => ['$exists' => true]]);
    $refArr = $ref ? ($ref instanceof MongoDB\Model\BSONDocument ? $ref->getArrayCopy() : (array) $ref) : [];
    $allJunior = lovolGfToArray($refArr['supportedGroups'] ?? []);

    $configPath = 'C:/wamp64/www/MEDACAP/views/define/configGF.php';
    if (is_file($configPath)) {
        /** @var array<string, mixed> $cfg */
        $cfg = require $configPath;
        $excluded = lovolGfToArray($cfg['nonSupportedGroupsByBrand'][$brand] ?? []);
        if ($allJunior && $excluded) {
            return array_values(array_filter(
                $allJunior,
                static fn (string $gf) => !in_array($gf, $excluded, true)
            ));
        }
    }

    return $allJunior;
}

function lovolLatestResultBySpeciality(
    MongoDB\Collection $results,
    ObjectId $userOid,
    string $speciality,
    string $type
): ?array {
    $typeR = $type === 'Declaratif' ? 'Technicien - Manager' : 'Technicien';
    $cursor = $results->find(
        [
            'user' => $userOid,
            'level' => LEVEL,
            'type' => $type,
            'speciality' => ['$exists' => true],
        ],
        ['sort' => ['_id' => -1]],
    );

    $best = null;
    foreach ($cursor as $doc) {
        $row = $doc instanceof MongoDB\Model\BSONDocument ? $doc->getArrayCopy() : (array) $doc;
        $spec = (string) ($row['speciality'] ?? '');
        if ($spec === '' || !lovolSpecialityMatches($spec, $speciality)) {
            continue;
        }
        if (isset($row['typeR']) && (string) $row['typeR'] !== $typeR) {
            continue;
        }
        $best = $row;
        break;
    }

    return $best;
}

$client = new MongoDB\Client($mongoUri);
$db = $client->selectDatabase($mongoDb);

$supportedGroups = lovolLoadSupportedGroups($db, LOVOL_BRAND, LEVEL);
sort($supportedGroups, SORT_STRING);

$technicians = [];

foreach (TARGET_USERNAMES as $username) {
    $userDoc = $db->users->findOne(['username' => $username, 'active' => true]);
    if (!$userDoc) {
        $technicians[] = ['username' => $username, 'status' => 'not_found'];
        continue;
    }

    $user = $userDoc instanceof MongoDB\Model\BSONDocument ? $userDoc->getArrayCopy() : (array) $userDoc;
    $userOid = $user['_id'];
    if (!$userOid instanceof ObjectId) {
        continue;
    }

    $byGf = [];
    $scoresForAvg = [];

    foreach ($supportedGroups as $gf) {
        $factuel = lovolLatestResultBySpeciality($db->results, $userOid, $gf, 'Factuel');
        $declaratif = lovolLatestResultBySpeciality($db->results, $userOid, $gf, 'Declaratif');
        $factuelPct = lovolPercentScore($factuel);
        $declaratifPct = lovolPercentScore($declaratif);

        $parts = array_filter([$factuelPct, $declaratifPct], static fn ($v) => $v !== null);
        $gfAvg = $parts ? (int) round(array_sum($parts) / count($parts)) : null;

        if ($gfAvg !== null) {
            $scoresForAvg[] = $gfAvg;
        }

        $byGf[] = [
            'gf' => $gf,
            'factuel' => $factuelPct,
            'declaratif' => $declaratifPct,
            'average' => $gfAvg,
        ];
    }

    $technicians[] = [
        'username' => $username,
        'name' => trim(($user['firstName'] ?? '') . ' ' . ($user['lastName'] ?? '')),
        'brandJunior' => lovolGfToArray($user['brandJunior'] ?? []),
        'gfCount' => count($supportedGroups),
        'gfWithScore' => count($scoresForAvg),
        'averageOnSupportedGf' => $scoresForAvg
            ? (int) round(array_sum($scoresForAvg) / count($scoresForAvg))
            : null,
        'scoresByGf' => $byGf,
    ];
}

$payload = [
    'brand' => LOVOL_BRAND,
    'level' => LEVEL,
    'supportedGroups' => $supportedGroups,
    'supportedGroupCount' => count($supportedGroups),
    'technicians' => $technicians,
    'generatedAt' => date('c'),
];

echo json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n";
