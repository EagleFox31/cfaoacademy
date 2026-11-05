<?php
declare(strict_types=1);

require 'C:/wamp64/www/MEDACAP/views/measure/api/bootstrap.php';

$db = (new MongoDB\Client($mongoUri))->selectDatabase($mongoDb);
$userId = '66f55aabe9500000a3001f52'; // Jacques ROBIN - DPS Cameroun
$ctx = portalApiResolveDpsFilialeContext($db, $userId, null, null);

echo "========================================================\n";
echo "Enregistrement des valeurs définitives en BD par marques\n";
echo "Filiale : " . $ctx['subsidiary'] . "\n";
echo "Techniciens : " . count($ctx['technicianDocs']) . "\n";
echo "Marques : " . count($ctx['brands']) . " (" . implode(', ', array_map(fn($b) => $b['slug'], $ctx['brands'])) . ")\n";
echo "========================================================\n\n";

$supportedCache = portalApiLoadSupportedGroupsCache($db);
$levels = ['Junior', 'Senior', 'Expert'];
$allBrandSlugs = array_map(fn($b) => $b['slug'], $ctx['brands']);

// 1. Calcul et écriture dans `technicianBrandScores` pour chaque technicien
echo "1. Mise à jour de 'technicianBrandScores'...\n";
$techSaved = 0;

foreach ($ctx['technicianDocs'] as $tech) {
    $userOid = $tech['_id'];
    $userDoc = $tech['doc'];
    $techName = portalApiTechnicianDisplayName($userDoc);

    $scoresByLevel = [
        'Junior' => [],
        'Senior' => [],
        'Expert' => [],
    ];

    foreach ($levels as $level) {
        $tier = portalApiTierFromLevel($level);
        $userBrands = portalApiBrandsForTier($userDoc, $tier);
        if (!$userBrands) {
            // Si pas de marque explicite pour ce palier, prendre les marques de la filiale
            $userBrands = array_map(fn($b) => $b['name'], $ctx['brands']);
        }

        $gfIndex = portalApiBuildUserGfResultIndex($db->results, $userOid, $level);

        foreach ($userBrands as $brandMongo) {
            $supported = portalApiSupportedGroupsForBrandLevel($supportedCache, $brandMongo, $level);
            if (!$supported) {
                continue;
            }

            $bd = portalApiBrandGfTierBreakdown($gfIndex, $supported);
            
            $theory = $bd['theory'] !== null ? (float) $bd['theory'] : null;
            $practical = $bd['practical'] !== null ? (float) $bd['practical'] : null;
            // Règle d'or CFAO MEDACAP : la note retenue par technicien est le MINIMUM entre Théorie et Pratique
            $minScore = ($theory !== null && $practical !== null) ? (float) min($theory, $practical) : null;

            // Format standard technicianBrandScores
            $scoresByLevel[$level][$brandMongo] = [
                'averageFactuel' => $theory,
                'averageDeclaratif' => $practical,
                'averageTotal' => $minScore,
                'gfEvaluated' => $bd['gfEvaluated'] ?? 0,
                'gfTotal' => $bd['gfTotal'] ?? count($supported),
                'inProgress' => (bool) ($bd['inProgress'] ?? false),
            ];
        }
    }

    $db->technicianBrandScores->updateOne(
        ['userId' => $userOid],
        [
            '$set' => [
                'userId' => $userOid,
                'username' => $userDoc['username'] ?? '',
                'name' => $techName,
                'subsidiary' => $ctx['subsidiary'],
                'department' => $userDoc['department'] ?? 'Equipment',
                'updatedAt' => new MongoDB\BSON\UTCDateTime(),
                'scores' => $scoresByLevel,
            ]
        ],
        ['upsert' => true]
    );

    $techSaved++;
}

echo "✓ {$techSaved}/" . count($ctx['technicianDocs']) . " techniciens enregistrés dans 'technicianBrandScores'.\n\n";

// 2. Calcul et écriture dans `portalDpsInsights`
echo "2. Calcul des insights consolidés filiale...\n";
$start = microtime(true);

$insights = portalApiDpsFilialeInsights(
    $ctx['technicianDocs'],
    $db,
    $db->allocations,
    $db->exams,
    $db->results,
    $portalBridgeKey
);

$duration = round(microtime(true) - $start, 2);
echo "✓ Insights calculés en {$duration}s.\n";
echo "  - Brand stats : " . count($insights['brandStats']) . "\n";
echo "  - Collaborator evaluations : " . count($insights['collaboratorEvaluations']) . "\n";
echo "  - Recent logs : " . count($insights['recentLogs']) . "\n\n";

echo "3. Enregistrement définitif dans 'portalDpsInsights'...\n";
$nowIso = gmdate('c');

$db->portalDpsInsights->updateOne(
    [
        'subsidiary' => $ctx['subsidiary'],
        'department' => 'Equipment',
    ],
    [
        '$set' => [
            'subsidiary' => $ctx['subsidiary'],
            'department' => 'Equipment',
            'computedAt' => $nowIso,
            'computedBy' => 'definitive-db-sync',
            'brandStats' => $insights['brandStats'],
            'collaboratorEvaluations' => $insights['collaboratorEvaluations'],
            'recentLogs' => $insights['recentLogs'],
        ]
    ],
    ['upsert' => true]
);

// Pour compatibilité si le filtre cherche 'Cameroun'
$db->portalDpsInsights->updateOne(
    [
        'subsidiary' => 'Cameroun',
        'department' => 'Equipment',
    ],
    [
        '$set' => [
            'subsidiary' => 'Cameroun',
            'department' => 'Equipment',
            'computedAt' => $nowIso,
            'computedBy' => 'definitive-db-sync',
            'brandStats' => $insights['brandStats'],
            'collaboratorEvaluations' => $insights['collaboratorEvaluations'],
            'recentLogs' => $insights['recentLogs'],
        ]
    ],
    ['upsert' => true]
);

echo "✓ 'portalDpsInsights' mis à jour avec succès en MongoDB !\n";
echo "========================================================\n";
