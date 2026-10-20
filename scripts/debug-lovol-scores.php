<?php
declare(strict_types=1);

require 'C:/wamp64/www/MEDACAP/views/measure/api/bootstrap.php';

$db = (new MongoDB\Client($mongoUri))->selectDatabase($mongoDb);
$subs = portalApiResolveSubsidiaries('Cameroun');
$filter = [
    'active' => true,
    'subsidiary' => ['$in' => $subs],
    'department' => portalApiTechnicianDepartmentFilter('Equipment'),
];
$docs = [];
foreach (['ac48nj', 'ya47so'] as $username) {
    $u = $db->users->findOne(['username' => $username, 'active' => true]);
    if (!$u) {
        echo "User {$username} not found\n";
        continue;
    }
    $arr = $u instanceof MongoDB\Model\BSONDocument ? $u->getArrayCopy() : (array) $u;
    echo "User {$username}: subsidiary=" . ($arr['subsidiary'] ?? '?') . ' dept=' . ($arr['department'] ?? '?') . "\n";
    echo '  brandJunior=' . json_encode($arr['brandJunior'] ?? [], JSON_UNESCAPED_UNICODE) . "\n";
    $docs[] = ['_id' => $u['_id'], 'doc' => $arr];
}

global $portalBridgeKey;
$insights = portalApiDpsFilialeInsights($docs, $db->allocations, $db->exams, $db->results, $portalBridgeKey);

echo "=== Evaluations with lovol in brands ===\n";
foreach ($insights['collaboratorEvaluations'] as $e) {
    if (!in_array('lovol', $e['brands'] ?? [], true)) {
        continue;
    }
    printf(
        "%s | %s | %s | score=%s\n",
        $e['collaboratorName'] ?? '?',
        $e['competencyTier'] ?? '?',
        $e['modality'] ?? '?',
        $e['score'] ?? 'null'
    );
}

echo "\n=== LOVOL brandStats ===\n";
foreach ($insights['brandStats'] as $b) {
    if (($b['brand'] ?? '') === 'lovol') {
        echo json_encode($b, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
    }
}
