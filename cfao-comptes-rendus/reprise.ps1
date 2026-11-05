# ==============================================================================
# Reprise d'un export formateurs (db.sqlite3 + profils.json + donnees/photos)
# dans la pile de prod (PostgreSQL). A lancer UNE fois, apres .\deploy.ps1 :
#   .\reprise.ps1 donnees-formateurs-20261009
# ==============================================================================
param (
    [Parameter(Mandatory = $true)][string]$Source,
    [string]$ComposeFile = "docker-compose.prod.yml",
    [string]$EnvFile = ".env"
)
$ErrorActionPreference = "Stop"
$Source = (Resolve-Path $Source).Path
$c = @("compose", "--env-file", $EnvFile, "-f", $ComposeFile)
$api = (& docker @c ps -q api)
if (-not $api) { throw "Le service api ne tourne pas : lancer .\deploy.ps1 d'abord." }

# 1. SQLite -> JSON (copie de travail, l'export n'est jamais modifie)
$travail = Join-Path ([IO.Path]::GetTempPath()) ("cr-reprise-" + [Guid]::NewGuid())
New-Item -ItemType Directory $travail | Out-Null
Copy-Item (Join-Path $Source "db.sqlite3") $travail
$image = (docker inspect -f '{{.Config.Image}}' $api)
docker run --rm -v "$($travail):/import" -e DEPLOYMENT_MODE=standalone -e DEBUG=True `
  -e SECRET_KEY=reprise -e DATABASE_URL=sqlite:////import/db.sqlite3 --entrypoint sh $image `
  -c "python manage.py migrate -v0 && python manage.py dumpdata --natural-foreign --natural-primary -e contenttypes -e auth.permission -o /import/reprise.json"
if ($LASTEXITCODE) { throw "Lecture de l'export en echec." }

# 2. Donnees, photos et profils dans le service
docker cp (Join-Path $travail "reprise.json") "$($api):/tmp/reprise.json"
docker cp (Join-Path $Source "donnees\photos") "$($api):/donnees/"
docker cp (Join-Path $Source "profils.json") "$($api):/donnees/profils-locaux.json"
& docker @c exec -T -u root api chown -R service:service /donnees
& docker @c exec -T api python manage.py loaddata /tmp/reprise.json
& docker @c exec -T api python manage.py shell -c "from django.apps import apps; print({m.__name__: m.objects.count() for m in apps.get_app_config('comptes_rendus').get_models()})"

Write-Host "Reprise terminee. Creer les mots de passe : docker $($c -join ' ') exec api python manage.py mot_de_passe <identifiant>" -ForegroundColor Green
