<?php
declare(strict_types=1);

$bootstrap = 'C:/wamp64/www/MEDACAP/views/measure/api/bootstrap.php';
require $bootstrap;

use MongoDB\BSON\ObjectId;

$client = new MongoDB\Client($mongoUri);
$db = $client->selectDatabase($mongoDb);

$user = $db->users->findOne(['username' => 'ma31im']);
$userOid = $user['_id'];

function gfList($doc, string $brand, string $level): array {
    $levels = $doc['levels'] ?? [];
    foreach ($levels as $l) {
        if (($l['level'] ?? '') === $level) {
            $arr = $l['supportedGroups'] ?? $l['groups'] ?? [];
            if ($arr instanceof MongoDB\Model\BSONArray) $arr = $arr->getArrayCopy();
            return array_values(array_filter(array_map('trim', (array)$arr)));
        }
    }
    return [];
}

$sinoDoc = $db->nonSupportedGroupsByBrandLevel->findOne(['brand' => 'SINOTRUK']);
$rtDoc = $db->nonSupportedGroupsByBrandLevel->findOne(['brand' => 'RENAULT TRUCK']);

// Get all non-empty speciality results for user
$resultsCursor = $db->results->find([
    'user' => $userOid,
    'speciality' => ['$exists' => true, '$ne' => '']
]);

$userGfScores = [];
foreach ($resultsCursor as $r) {
    $spec = trim((string)$r['speciality']);
    if ($spec === '') continue;
    $lvl = (string)$r['level'];
    $type = (string)$r['type'];
    $score = (float)$r['score'];
    $total = (float)$r['total'];
    $pct = $total > 0 ? round(($score * 100) / $total, 1) : 0;
    
    // Store latest result by speciality
    $userGfScores[$lvl][$type][$spec] = [
        'score' => $score,
        'total' => $total,
        'pct' => $pct
    ];
}

echo json_encode([
    'technician' => [
        'name' => $user['firstName'] . ' ' . $user['lastName'],
        'username' => $user['username'],
        'subsidiary' => $user['subsidiary'],
        'level' => $user['level'],
    ],
    'analysis' => array_map(function($palier) use ($sinoDoc, $rtDoc, $userGfScores) {
        $sinoGfs = gfList($sinoDoc, 'SINOTRUK', $palier);
        $rtGfs = gfList($rtDoc, 'RENAULT TRUCK', $palier);
        
        $types = ['Factuel', 'Declaratif'];
        $typeReports = [];
        
        foreach ($types as $type) {
            $userScores = $userGfScores[$palier][$type] ?? [];
            $gfDetails = [];
            $scoresFound = [];
            
            foreach ($sinoGfs as $gf) {
                // Find matching user speciality
                $matchedSpec = null;
                $scoreInfo = null;
                foreach ($userScores as $uSpec => $info) {
                    if (strcasecmp($uSpec, $gf) === 0) {
                        $matchedSpec = $uSpec;
                        $scoreInfo = $info;
                        break;
                    }
                }
                // Partial match fallback
                if (!$scoreInfo) {
                    foreach ($userScores as $uSpec => $info) {
                        if (stripos($uSpec, $gf) !== false || stripos($gf, $uSpec) !== false) {
                            $matchedSpec = $uSpec;
                            $scoreInfo = $info;
                            break;
                        }
                    }
                }
                
                if ($scoreInfo) {
                    $scoresFound[] = $scoreInfo['pct'];
                    $gfDetails[$gf] = [
                        'status' => 'evalue',
                        'score_obtenu' => $scoreInfo['score'],
                        'total_points' => $scoreInfo['total'],
                        'pourcentage' => $scoreInfo['pct']
                    ];
                } else {
                    $gfDetails[$gf] = [
                        'status' => 'non_evalue_ou_specifique_sinotruk',
                        'score_obtenu' => null,
                        'total_points' => null,
                        'pourcentage' => null
                    ];
                }
            }
            
            $nbCouverts = count($scoresFound);
            $totalGfSino = count($sinoGfs);
            $moyenneCouvert = $nbCouverts > 0 ? round(array_sum($scoresFound) / $nbCouverts, 1) : 0;
            $moyenneSurTotalSino = $totalGfSino > 0 ? round(array_sum($scoresFound) / $totalGfSino, 1) : 0;
            
            $typeReports[$type] = [
                'total_gf_sinotruk' => $totalGfSino,
                'gf_couverts' => $nbCouverts,
                'note_sur_gf_communs' => $moyenneCouvert,
                'note_ponderee_tous_gf' => $moyenneSurTotalSino,
                'details' => $gfDetails
            ];
        }
        
        return [
            'palier' => $palier,
            'gf_sinotruk_total' => count($sinoGfs),
            'gf_renault_trucks_total' => count($rtGfs),
            'modalites' => $typeReports
        ];
    }, ['Junior', 'Senior'])
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . PHP_EOL;
