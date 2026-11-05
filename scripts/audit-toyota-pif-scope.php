<?php
declare(strict_types=1);

/**
 * Audit PIF Toyota — filiale du scope KI YOGBA (Cameroun).
 * Usage: php scripts/audit-toyota-pif-scope.php
 */

$bootstrap = 'C:/wamp64/www/MEDACAP/views/measure/api/bootstrap.php';
if (!is_file($bootstrap)) {
    fwrite(STDERR, "bootstrap introuvable\n");
    exit(1);
}
require $bootstrap;

use MongoDB\BSON\ObjectId;

$db = portalApiDb($mongoUri, $mongoDb)->selectDatabase($mongoDb);

/* Scope KI André YOGBA (mock_profiles) */
$scopeUserId = '6915b9e0ad060000940026e9';
$probeTechId = '6915ddfbad060000940026f7'; /* URL vue dans le navigateur */

$ctx = portalApiResolveDpsFilialeContext($db, $scopeUserId, null, null);

echo "=== SCOPE ===\n";
echo 'userId: ' . $ctx['userId'] . "\n";
echo 'subsidiary: ' . ($ctx['subsidiary'] ?? '?') . "\n";
echo 'technicians in filiale: ' . count($ctx['technicianDocs']) . "\n\n";

$toyotaTechs = [];
foreach ($ctx['technicianDocs'] as $row) {
    $doc = $row['doc'];
    $brands = array_values(array_unique(array_filter(array_merge(
        (array) ($doc['brandJunior'] ?? []),
        (array) ($doc['brandSenior'] ?? []),
        (array) ($doc['brandExpert'] ?? [])
    ))));
    $slugs = array_map(static function ($b) {
        return portalApiBrandToSlug((string) $b);
    }, $brands);
    $hasToyota = in_array('toyota', $slugs, true)
        || in_array('toyota-bt', $slugs, true)
        || in_array('toyota-forklift', $slugs, true);
    if (!$hasToyota) {
        continue;
    }
    $toyotaTechs[] = [
        'id' => (string) $row['_id'],
        'name' => portalApiTechnicianDisplayName($doc),
        'username' => $doc['username'] ?? null,
        'agency' => $doc['agency'] ?? null,
        'level' => $doc['level'] ?? null,
        'brands' => $brands,
        'slugs' => $slugs,
    ];
}

echo '=== TECHS AVEC MARQUE TOYOTA (ou BT / FORKLIFT) ===' . "\n";
echo 'count: ' . count($toyotaTechs) . "\n";
foreach (array_slice($toyotaTechs, 0, 25) as $t) {
    echo sprintf(
        "- %s | %s | %s | brands=%s\n",
        $t['name'],
        $t['username'] ?? '-',
        $t['id'],
        json_encode($t['slugs'], JSON_UNESCAPED_UNICODE)
    );
}
if (count($toyotaTechs) > 25) {
    echo '... +' . (count($toyotaTechs) - 25) . " autres\n";
}

$techOids = array_map(static function (array $row): ObjectId {
    return $row['_id'];
}, $ctx['technicianDocs']);

$pif = portalApiDpsPifPayload($db, $techOids);

echo "\n=== brandPifStats (toutes marques filiale) ===\n";
foreach ($pif['brandPifStats'] as $row) {
    $mark = ($row['brand'] === 'toyota' || strpos($row['brand'], 'toyota') === 0) ? ' <<' : '';
    echo sprintf(
        "%s: proposed=%d validated=%d%s\n",
        $row['brand'],
        $row['pifProposed'] ?? 0,
        $row['pifValidated'] ?? 0,
        $mark
    );
}

$toyotaSummary = $pif['brandPlanningSummary']['toyota'] ?? null;
echo "\n=== brandPlanningSummary.toyota ===\n";
echo $toyotaSummary
    ? json_encode($toyotaSummary, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n"
    : "(absent — aucune allocation liée à un training brand=TOYOTA)\n";

/* Compte allocations Toyota par technicien Toyota */
$toyotaOidList = [];
foreach ($toyotaTechs as $t) {
    $toyotaOidList[] = new ObjectId($t['id']);
}

$allocCursor = $db->allocations->find([
    'user' => ['$in' => $toyotaOidList ?: [new ObjectId('000000000000000000000000')]],
    'training' => ['$exists' => true, '$ne' => null],
]);

$trainingIds = [];
$allocByUser = [];
foreach ($allocCursor as $alloc) {
    $arr = $alloc instanceof MongoDB\Model\BSONDocument ? $alloc->getArrayCopy() : (array) $alloc;
    if (empty($arr['training'])) {
        continue;
    }
    $uid = (string) $arr['user'];
    $tid = (string) $arr['training'];
    $allocByUser[$uid][] = $tid;
    $trainingIds[$tid] = $arr['training'];
}

$trainingBrand = [];
if ($trainingIds) {
    foreach ($db->trainings->find(['_id' => ['$in' => array_values($trainingIds)]]) as $doc) {
        $arr = $doc instanceof MongoDB\Model\BSONDocument ? $doc->getArrayCopy() : (array) $doc;
        $trainingBrand[(string) $arr['_id']] = [
            'brand' => (string) ($arr['brand'] ?? ''),
            'slug' => portalApiBrandToSlug((string) ($arr['brand'] ?? '')),
            'code' => (string) ($arr['code'] ?? ''),
            'active' => !empty($arr['active']),
        ];
    }
}

$techsWithAnyAlloc = 0;
$techsWithToyotaAlloc = 0;
$toyotaAllocTotal = 0;
$sampleCodes = [];

foreach ($toyotaTechs as $t) {
    $ids = $allocByUser[$t['id']] ?? [];
    if (!$ids) {
        continue;
    }
    $techsWithAnyAlloc++;
    $hasToyotaAlloc = false;
    foreach ($ids as $tid) {
        $meta = $trainingBrand[$tid] ?? null;
        if (!$meta || !$meta['active']) {
            continue;
        }
        if ($meta['slug'] === 'toyota' || strpos($meta['slug'], 'toyota') === 0) {
            $hasToyotaAlloc = true;
            $toyotaAllocTotal++;
            if (count($sampleCodes) < 15) {
                $sampleCodes[] = $meta['code'] . ' (' . $meta['brand'] . ')';
            }
        }
    }
    if ($hasToyotaAlloc) {
        $techsWithToyotaAlloc++;
    }
}

echo "\n=== ALLOCATIONS (PIF) pour techs Toyota ===\n";
echo 'techs Toyota: ' . count($toyotaTechs) . "\n";
echo 'techs Toyota avec AU MOINS une allocation formation: ' . $techsWithAnyAlloc . "\n";
echo 'techs Toyota avec allocation marque Toyota*: ' . $techsWithToyotaAlloc . "\n";
echo 'nb allocations actives Toyota*: ' . $toyotaAllocTotal . "\n";
echo 'exemples codes: ' . (count($sampleCodes) ? implode(', ', $sampleCodes) : '(aucun)') . "\n";

/* Probe tech de l'URL */
echo "\n=== PROBE TECH URL {$probeTechId} ===\n";
try {
    $probeOid = new ObjectId($probeTechId);
    $probe = $db->users->findOne(['_id' => $probeOid]);
    if (!$probe) {
        echo "introuvable dans users\n";
    } else {
        $arr = $probe instanceof MongoDB\Model\BSONDocument ? $probe->getArrayCopy() : (array) $probe;
        echo 'name: ' . portalApiTechnicianDisplayName($arr) . "\n";
        echo 'username: ' . ($arr['username'] ?? '-') . "\n";
        echo 'brandJunior: ' . json_encode($arr['brandJunior'] ?? [], JSON_UNESCAPED_UNICODE) . "\n";
        echo 'brandSenior: ' . json_encode($arr['brandSenior'] ?? [], JSON_UNESCAPED_UNICODE) . "\n";
        echo 'brandExpert: ' . json_encode($arr['brandExpert'] ?? [], JSON_UNESCAPED_UNICODE) . "\n";

        $nAlloc = $db->allocations->countDocuments([
            'user' => $probeOid,
            'training' => ['$exists' => true, '$ne' => null],
        ]);
        echo "allocations formation: {$nAlloc}\n";

        $single = portalApiDpsPifPayload($db, [$probeOid]);
        echo 'planningStatus keys: ' . count($single['planningStatus']) . "\n";
        echo 'brandPifStats: ' . json_encode($single['brandPifStats'], JSON_UNESCAPED_UNICODE) . "\n";
    }
} catch (Throwable $e) {
    echo 'erreur: ' . $e->getMessage() . "\n";
}

/* Comparaison applications collection */
$appCount = $db->applications->countDocuments([]);
$valCount = $db->validations->countDocuments(['active' => true]);
$trainingToyota = $db->trainings->countDocuments([
    'active' => true,
    'brand' => ['$regex' => 'TOYOTA', '$options' => 'i'],
]);
echo "\n=== COLLECTIONS GLOBALES ===\n";
echo "applications (total): {$appCount}\n";
echo "validations active: {$valCount}\n";
echo "trainings actifs brand~TOYOTA: {$trainingToyota}\n";
