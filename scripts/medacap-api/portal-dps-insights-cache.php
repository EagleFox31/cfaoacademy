<?php
declare(strict_types=1);

/**
 * Cache Mongo `portalDpsInsights` — à inclure depuis bootstrap.php :
 *   require_once __DIR__ . '/portal-dps-insights-cache.php';
 *
 * Collection : 1 document par filiale × département Equipment.
 */

const PORTAL_DPS_INSIGHTS_COLLECTION = 'portalDpsInsights';

/** @return array<string, mixed>|null */
function portalApiReadPortalDpsInsights(MongoDB\Database $db, string $subsidiary, string $department): ?array
{
    $doc = $db->{PORTAL_DPS_INSIGHTS_COLLECTION}->findOne([
        'subsidiary' => $subsidiary,
        'department' => $department,
    ]);

    if (!$doc) {
        return null;
    }

    $row = $doc instanceof MongoDB\Model\BSONDocument ? $doc->getArrayCopy() : (array) $doc;
    if (empty($row['computedAt'])) {
        return null;
    }

    return [
        'brandStats' => $row['brandStats'] ?? [],
        'collaboratorEvaluations' => $row['collaboratorEvaluations'] ?? [],
        'recentLogs' => $row['recentLogs'] ?? [],
        'computedAt' => $row['computedAt'],
        'computedBy' => $row['computedBy'] ?? 'cache',
        'source' => 'portalDpsInsights',
    ];
}

/** @param array<string, mixed> $insights */
function portalApiWritePortalDpsInsights(
    MongoDB\Database $db,
    string $subsidiary,
    string $department,
    array $insights,
    string $computedBy = 'manual'
): void {
    $now = gmdate('c');

    $db->{PORTAL_DPS_INSIGHTS_COLLECTION}->updateOne(
        [
            'subsidiary' => $subsidiary,
            'department' => $department,
        ],
        [
            '$set' => [
                'subsidiary' => $subsidiary,
                'department' => $department,
                'computedAt' => $now,
                'computedBy' => $computedBy,
                'brandStats' => $insights['brandStats'] ?? [],
                'collaboratorEvaluations' => $insights['collaboratorEvaluations'] ?? [],
                'recentLogs' => $insights['recentLogs'] ?? [],
            ],
        ],
        ['upsert' => true]
    );
}

/**
 * Recalcule et persiste les insights filiale (même logique que l’agrégation live).
 *
 * @return array{technicians: int, brandStats: int, evaluations: int, computedAt: string}
 */
function portalApiRefreshPortalDpsInsights(
    MongoDB\Database $db,
    string $subsidiaryLabel,
    string $departmentLabel,
    string $computedBy = 'manual'
): array {
    global $portalBridgeKey;

    $subsidiaries = portalApiResolveSubsidiaries($subsidiaryLabel);
    $department = portalApiTechnicianDepartmentFilter($departmentLabel);

    $filter = [
        'active' => true,
        'subsidiary' => ['$in' => $subsidiaries],
        'department' => $department,
    ];

    if (function_exists('portalApiTechnicianProfileFilter')) {
        $filter = array_merge($filter, portalApiTechnicianProfileFilter());
    }

    $docs = [];
    foreach ($db->users->find($filter) as $userDoc) {
        $arr = $userDoc instanceof MongoDB\Model\BSONDocument
            ? $userDoc->getArrayCopy()
            : (array) $userDoc;
        $docs[] = [
            '_id' => $userDoc['_id'],
            'doc' => $arr,
        ];
    }

    $insights = portalApiDpsFilialeInsights(
        $docs,
        $db,
        $db->allocations,
        $db->exams,
        $db->results,
        $portalBridgeKey
    );

    portalApiWritePortalDpsInsights(
        $db,
        $subsidiaryLabel,
        $departmentLabel,
        $insights,
        $computedBy
    );

    return [
        'technicians' => count($docs),
        'brandStats' => count($insights['brandStats'] ?? []),
        'evaluations' => count($insights['collaboratorEvaluations'] ?? []),
        'computedAt' => gmdate('c'),
    ];
}
