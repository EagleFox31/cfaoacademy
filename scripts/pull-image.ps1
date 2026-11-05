# Contournement quand le proxy de Docker Desktop bloque Docker Hub (TLS handshake timeout) alors que Windows y accède.
# Télécharge l'image amd64 depuis le registre, vérifie l'empreinte de chaque blob, puis la charge dans Docker.
# Usage : .\scripts\pull-image.ps1 -Repo library/python -Tag 3.12-slim -Out <dossier vide>
param([string]$Repo = "library/python", [string]$Tag = "3.12-slim", [string]$Out)
$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force $Out | Out-Null
$tok = (curl.exe -s "https://auth.docker.io/token?service=registry.docker.io&scope=repository:${Repo}:pull" | ConvertFrom-Json).token
$H = @("-H", "Authorization: Bearer $tok")
$acc = "application/vnd.oci.image.index.v1+json,application/vnd.docker.distribution.manifest.list.v2+json,application/vnd.oci.image.manifest.v1+json,application/vnd.docker.distribution.manifest.v2+json"
$idx = curl.exe -s @H -H "Accept: $acc" "https://registry-1.docker.io/v2/$Repo/manifests/$Tag" | ConvertFrom-Json
$dig = ($idx.manifests | Where-Object { $_.platform.os -eq "linux" -and $_.platform.architecture -eq "amd64" } | Select-Object -First 1).digest
$man = curl.exe -s @H -H "Accept: $acc" "https://registry-1.docker.io/v2/$Repo/manifests/$dig" | ConvertFrom-Json
function Get-Blob($d, $file) {
  curl.exe -s -L --fail @H -o (Join-Path $Out $file) "https://registry-1.docker.io/v2/$Repo/blobs/$d"
  if ($LASTEXITCODE -ne 0) { throw "blob $d" }
  $h = (Get-FileHash (Join-Path $Out $file) -Algorithm SHA256).Hash.ToLower()
  if ("sha256:$h" -ne $d) { throw "digest mismatch $d" }
}
Get-Blob $man.config.digest "config.json"
$layers = @()
$i = 0
foreach ($l in $man.layers) { $f = "layer$i.tar.gz"; Get-Blob $l.digest $f; $layers += $f; $i++ }
$name = ($Repo -replace '^library/', '') + ":" + $Tag
ConvertTo-Json -Depth 5 @(@{ Config = "config.json"; RepoTags = @($name); Layers = $layers }) |
  ForEach-Object { [IO.File]::WriteAllText((Join-Path $Out "manifest.json"), $_) }
Write-Output "OK $name ($($layers.Count) layers) depuis $dig"
$tar = "$Out.tar"
tar.exe -cf $tar -C $Out .
docker load -i $tar
