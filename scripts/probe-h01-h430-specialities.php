<?php
declare(strict_types=1);

require_once 'C:/wamp64/www/MEDACAP/vendor/autoload.php';

try {
    $client = new MongoDB\Client('mongodb://127.0.0.1:27017');
    $db = $client->selectDatabase('academy');
    $cursor = $db->trainings->find(
        ['code' => ['$in' => ['H01', 'H430']], 'active' => true],
        ['projection' => ['code' => 1, 'speciality' => 1, 'specialities' => 1, 'level' => 1, 'brand' => 1, 'type' => 1, 'name' => 1]]
    );
    $rows = [];
    foreach ($cursor as $doc) {
        $rows[] = json_decode(json_encode($doc), true);
    }
    echo json_encode($rows, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    fwrite(STDERR, 'ERR: ' . $e->getMessage() . PHP_EOL);
    exit(1);
}
