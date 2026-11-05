<?php
declare(strict_types=1);
require 'C:/wamp64/www/MEDACAP/views/measure/api/bootstrap.php';
$db = (new MongoDB\Client($mongoUri))->selectDatabase($mongoDb);
$userOid = $db->users->findOne(['username' => 'an52ng'])->_id;
$doc = $db->technicianBrandScores->findOne(['userId' => $userOid]);
echo "doc found: " . ($doc ? 'yes' : 'no') . "\n";
if ($doc) {
    $arr = $doc->getArrayCopy();
    echo "scores keys: " . implode(', ', array_keys($arr['scores'] ?? [])) . "\n";
}
$pre = portalApiLoadTechnicianBrandScoresDoc($db, $userOid);
echo "load returns: " . (is_array($pre) ? count($pre) . ' keys' : 'null') . "\n";
