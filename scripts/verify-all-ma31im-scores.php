<?php
declare(strict_types=1);

$bootstrap = 'C:/wamp64/www/MEDACAP/views/measure/api/bootstrap.php';
require $bootstrap;

use MongoDB\BSON\ObjectId;

$client = new MongoDB\Client($mongoUri);
$db = $client->selectDatabase($mongoDb);

$userOid = new ObjectId('66694d91582300001b0059f7');
$user = $db->users->findOne(['_id' => $userOid]);

echo "=== VÉRIFICATION BASE MONGODB POUR " . ($user['firstName'] ?? '') . " " . ($user['lastName'] ?? '') . " ===\n";
echo "ID: " . (string)$user['_id'] . " | Username: " . $user['username'] . "\n\n";

// 1. Tous les documents résultats généraux (speciality vide ou non renseignée = score global du test)
echo "--- 1. SCORES GLOBAUX DES TESTS PASSÉS ---\n";
$globalResults = $db->results->find([
    'user' => $userOid,
    '$or' => [
        ['speciality' => ['$exists' => false]],
        ['speciality' => ''],
        ['speciality' => null]
    ]
]);

foreach ($globalResults as $r) {
    $row = $r instanceof MongoDB\Model\BSONDocument ? $r->getArrayCopy() : (array)$r;
    $pct = ($row['total'] ?? 0) > 0 ? round(($row['score'] * 100) / $row['total'], 1) : 0;
    echo sprintf(
        "Niveau: %-7s | Type: %-10s | TypeR: %-20s | Score: %3d / %3d (%5.1f%%) | Date: %s\n",
        $row['level'] ?? '',
        $row['type'] ?? '',
        $row['typeR'] ?? 'Technicien',
        $row['score'] ?? 0,
        $row['total'] ?? 0,
        $pct,
        $row['created'] ?? $row['date'] ?? ''
    );
}

// 2. Vérification détaillée par GF / Spécialité
echo "\n--- 2. DÉTAIL DES RÉSULTATS PAR GROUPE FONCTIONNEL (results) ---\n";
foreach (['Junior', 'Senior'] as $lvl) {
    foreach (['Factuel', 'Declaratif'] as $tp) {
        echo "\n>>> $lvl - $tp <<<\n";
        $cursor = $db->results->find([
            'user' => $userOid,
            'level' => $lvl,
            'type' => $tp,
            'speciality' => ['$exists' => true, '$nin' => ['', null]]
        ]);
        $count = 0;
        $totalScore = 0;
        $totalMax = 0;
        foreach ($cursor as $r) {
            $row = $r instanceof MongoDB\Model\BSONDocument ? $r->getArrayCopy() : (array)$r;
            $spec = $row['speciality'];
            $sc = (float)($row['score'] ?? 0);
            $tot = (float)($row['total'] ?? 0);
            $p = $tot > 0 ? round(($sc * 100) / $tot, 1) : 0;
            $typeR = $row['typeR'] ?? 'Technicien';
            echo sprintf("  - %-32s : %2d / %2d  (%5.1f%%) [typeR: %s]\n", $spec, (int)$sc, (int)$tot, $p, $typeR);
            $totalScore += $sc;
            $totalMax += $tot;
            $count++;
        }
        $avgPct = $totalMax > 0 ? round(($totalScore * 100) / $totalMax, 1) : 0;
        echo "  TOTAL CUMULÉ DES QUESTIONS : $totalScore / $totalMax ($avgPct% sur $count GF)\n";
    }
}
