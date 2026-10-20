<?php
$j = json_decode(file_get_contents(__DIR__ . '/../data/dps/cmr-equipment-technician-xy-2025.json'), true);
usort($j['technicians'], fn($a, $b) => strcasecmp($a['firstName'] ?? $a['name'], $b['firstName'] ?? $b['name']));
foreach ($j['technicians'] as $t) {
    printf("%-8s  x=%2d  y=%2d  PIF=%2d  %s\n", $t['username'], $t['x'], $t['y'], count($t['pifCodes']), $t['name']);
}
