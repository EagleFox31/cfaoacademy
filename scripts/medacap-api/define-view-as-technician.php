<?php
declare(strict_types=1);

/**
 * Fragment à insérer dans views/define/dashboard.php et dashboard2026.php
 * juste AVANT le bloc `if (!empty($technicianId)) { ... directeur ... }`.
 *
 * Permet au DPS / manager (session inchangée) d'ouvrir le dashboard technicien
 * via ?technicianId=...&viewAs=technician (lien portail CFAO Academy).
 */

// --- début fragment define-view-as-technician ---
$viewAs = isset($_GET['viewAs']) ? strtolower(trim((string) $_GET['viewAs'])) : '';
$viewerProfilesForTechnicianView = array_merge($directorProfiles, ['Manager']);

if (!empty($technicianId) && $viewAs === 'technician' && in_array($profile, $viewerProfilesForTechnicianView, true)) {
    try {
        $techController = new TechnicianDashboardController($academy, $technicianId);
        if (basename((string) ($_SERVER['PHP_SELF'] ?? '')) === 'dashboard2026.php') {
            $techController->viewPath = __DIR__ . '/views/technician/dashboard2026.php';
        }
        $techController->renderDashboard($filters);
    } catch (Exception $e) {
        error_log('Erreur TechnicianDashboard (viewAs): ' . $e->getMessage());
        echo "<div class='alert alert-danger'>Erreur lors du chargement du tableau de bord du technicien.</div>";
    }
    exit();
}
// --- fin fragment define-view-as-technician ---
