# Script de synchronisation de la base MEDACAP depuis le serveur distant (10.68.0.7)
# vers le conteneur Docker local (volume cfaoacademy_mongodb-data) et le dossier infra/mongo-dump/

param(
    [string]$RemoteHost = "10.68.0.7:27017",
    [string]$Database = "academy",
    [string]$ContainerName = "cfaoacademy-mongodb-1",
    [switch]$UpdateRepoDump = $true
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  SYNCHRONISATION MEDACAP : $RemoteHost -> Docker Local   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Vérification de la connectivité réseau
Write-Host "`n[1/4] Test de connectivité vers $RemoteHost..." -ForegroundColor Yellow
$pingTest = docker exec $ContainerName mongosh --host $RemoteHost --eval "db.adminCommand('ping').ok" --quiet 2>$null
if ($pingTest -notmatch "1") {
    Write-Host "ERREUR : Impossible de joindre MongoDB sur $RemoteHost depuis le conteneur Docker." -ForegroundColor Red
    Write-Host "Veuillez vérifier que vous êtes bien connecté au réseau CFAO / VPN d'entreprise." -ForegroundColor Red
    exit 1
}
Write-Host "  OK : Connexion établie avec le serveur $RemoteHost." -ForegroundColor Green

# 2. Sauvegarde de sécurité locale temporaire
Write-Host "`n[2/4] Création d'un snapshot de sécurité de la base locale..." -ForegroundColor Yellow
docker exec $ContainerName mongodump --db $Database --archive=/tmp/backup_pre_sync.archive --quiet
Write-Host "  OK : Sauvegarde pré-sync créée dans /tmp/backup_pre_sync.archive." -ForegroundColor Green

# 3. Synchronisation directe depuis le serveur distant vers le conteneur local
Write-Host "`n[3/4] Synchronisation des données depuis $RemoteHost vers le volume Docker..." -ForegroundColor Yellow
docker exec $ContainerName sh -c "mongodump --host $RemoteHost --db $Database --archive | mongorestore --archive --drop"
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR lors de la synchronisation. Restauration du backup précédent..." -ForegroundColor Red
    docker exec $ContainerName mongorestore --archive=/tmp/backup_pre_sync.archive --drop
    exit 1
}
Write-Host "  OK : Base locale mise à jour avec succès dans le volume Docker !" -ForegroundColor Green

# 3b. Synchronisation vers le service MongoDB Windows local (WAMP) si présent
$hostPing = docker exec $ContainerName mongosh --host host.docker.internal:27017 --eval "db.adminCommand('ping').ok" --quiet 2>$null
if ($hostPing -match "1") {
    Write-Host "`n[3b/5] Synchronisation vers le service MongoDB local Windows (WAMP)..." -ForegroundColor Yellow
    docker exec $ContainerName sh -c "mongodump --db $Database --archive | mongorestore --host host.docker.internal:27017 --archive --drop --quiet"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  OK : Service MongoDB Windows (WAMP) synchronisé avec succès !" -ForegroundColor Green
    } else {
        Write-Host "  AVERTISSEMENT : Échec de synchronisation vers le service Windows." -ForegroundColor Yellow
    }
}

# 4. Mise à jour facultative du dossier de dump Git infra/mongo-dump/
if ($UpdateRepoDump) {
    Write-Host "`n[4/4] Mise à jour des fichiers BSON dans infra/mongo-dump/academy..." -ForegroundColor Yellow
    docker exec $ContainerName rm -rf /tmp/repo_dump
    docker exec $ContainerName mongodump --db $Database --out /tmp/repo_dump --quiet
    $targetDir = "$PSScriptRoot\..\infra\mongo-dump\academy"
    if (Test-Path $targetDir) {
        Remove-Item -Recurse -Force $targetDir
    }
    docker cp "$($ContainerName):/tmp/repo_dump/$Database" "$targetDir"
    docker exec $ContainerName rm -rf /tmp/repo_dump
    Write-Host "  OK : infra/mongo-dump/academy synchronisé avec les nouveaux BSON." -ForegroundColor Green
}

# 5. Rapport de statut
Write-Host "`nStatistiques de la base locale 'academy' après synchronisation :" -ForegroundColor Cyan
$stats = docker exec $ContainerName mongosh $Database --eval "
  print(' - Questions : ' + db.questions.countDocuments());
  print(' - Quizzes   : ' + db.quizzes.countDocuments());
  print(' - Tests     : ' + db.tests.countDocuments());
  print(' - Results   : ' + db.results.countDocuments());
  print(' - Users     : ' + db.users.countDocuments());
" --quiet
Write-Host $stats -ForegroundColor White
Write-Host "`nSynchronisation terminée avec succès !" -ForegroundColor Green
