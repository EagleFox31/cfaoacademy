<?php
declare(strict_types=1);

/**
 * Ajoute LOVOL à brandJunior pour les 2 techniciens Lovol CMR Equipment.
 * Ne régénère pas les tests — les techniciens ont déjà composé ; la note Lovol
 * se déduit des results.speciality ∩ GF supportés Lovol Junior (côté API portail).
 *
 * Usage : php scripts/add-lovol-brandjunior-cmr.php
 *         php scripts/add-lovol-brandjunior-cmr.php --dry-run
 */

$bootstrap = 'C:/wamp64/www/MEDACAP/views/measure/api/bootstrap.php';

if (!is_file($bootstrap)) {
    fwrite(STDERR, "bootstrap.php introuvable : {$bootstrap}\n");
    exit(1);
}

require $bootstrap;

use MongoDB\BSON\ObjectId;

const LOVOL_BRAND = 'LOVOL';
const TARGET_USERNAMES = ['ac48nj', 'ya47so'];

$dryRun = in_array('--dry-run', $argv ?? [], true);

/** @param mixed $brands */
function lovolNormalizeBrandList($brands): array
{
    if ($brands instanceof MongoDB\Model\BSONArray) {
        $brands = $brands->getArrayCopy();
    }
    $out = [];
    foreach ((array) $brands as $brand) {
        $brand = trim((string) $brand);
        if ($brand !== '') {
            $out[] = $brand;
        }
    }
    return array_values(array_unique($out, SORT_STRING));
}

function lovolBrandListHas(array $brands, string $target): bool
{
    $needle = strtoupper(trim($target));
    foreach ($brands as $brand) {
        if (strtoupper(trim((string) $brand)) === $needle) {
            return true;
        }
    }
    return false;
}

$client = new MongoDB\Client($mongoUri);
$db = $client->selectDatabase($mongoDb);
$users = $db->users;

$report = [];

foreach (TARGET_USERNAMES as $username) {
    $doc = $users->findOne(['username' => $username, 'active' => true]);
    if (!$doc) {
        $report[] = ['username' => $username, 'status' => 'not_found'];
        continue;
    }

    $user = $doc instanceof MongoDB\Model\BSONDocument ? $doc->getArrayCopy() : (array) $doc;
    $userId = $user['_id'] ?? null;
    if (!$userId instanceof ObjectId) {
        $report[] = ['username' => $username, 'status' => 'invalid_id'];
        continue;
    }

    $before = lovolNormalizeBrandList($user['brandJunior'] ?? []);
    $after = $before;
    if (!lovolBrandListHas($after, LOVOL_BRAND)) {
        $after[] = LOVOL_BRAND;
        sort($after, SORT_STRING);
    }

    $changed = $before !== $after;
    $row = [
        'username' => $username,
        'name' => trim(($user['firstName'] ?? '') . ' ' . ($user['lastName'] ?? '')),
        'userId' => (string) $userId,
        'brandJuniorBefore' => $before,
        'brandJuniorAfter' => $after,
        'changed' => $changed,
        'dryRun' => $dryRun,
        'status' => $changed ? 'updated' : 'already_had_lovol',
    ];

    if ($changed && !$dryRun) {
        $users->updateOne(
            ['_id' => $userId],
            ['$set' => [
                'brandJunior' => $after,
                'updated' => date('d-m-Y H:i:s'),
            ]],
        );
    }

    $report[] = $row;
}

echo json_encode([
    'dryRun' => $dryRun,
    'brand' => LOVOL_BRAND,
    'note' => 'Tests non régénérés — scores existants via results.speciality',
    'technicians' => $report,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n";

foreach ($report as $row) {
    if (($row['status'] ?? '') === 'not_found') {
        fwrite(STDERR, "Utilisateur introuvable : {$row['username']}\n");
        exit(1);
    }
}
