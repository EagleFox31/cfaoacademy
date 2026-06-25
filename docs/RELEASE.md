# Releases — versionnement automatique

Le dépôt suit le **[Semantic Versioning](https://semver.org/lang/fr/)** (`MAJOR.MINOR.PATCH`).

| Fichier | Rôle |
|---------|------|
| [`VERSION`](../VERSION) | Source de vérité (racine) |
| [`CHANGELOG.md`](../CHANGELOG.md) | Notes utilisateur (Keep a Changelog) |
| `frontend/package.json` | Doit refléter `VERSION` |
| `cfao-operations/package.json` | Doit refléter `VERSION` |

## Publication d'une version

1. **Rédiger** les changements dans `CHANGELOG.md` :
   - déplacer le contenu de `[Unreleased]` vers `## [X.Y.Z] - AAAA-MM-JJ` ;
   - laisser une section `[Unreleased]` vide en tête.
2. **Aligner** les versions :
   ```bash
   # éditer VERSION, frontend/package.json, cfao-operations/package.json
   python scripts/verify_version.py
   ```
3. **Commit** sur `main` (ex. `chore: release v0.2.0`).
4. **Tagger et pousser** — la [Release GitHub](https://github.com/EagleFox31/cfaoacademy/actions/workflows/release.yml) se déclenche automatiquement :
   ```bash
   git tag -a v0.2.0 -m "v0.2.0"
   git push origin main
   git push origin v0.2.0
   ```

Le workflow **Release** :

- vérifie l'alignement `VERSION` / `package.json` / tag ;
- extrait les notes depuis `CHANGELOG.md` ;
- exécute la **CI complète** ;
- crée la **GitHub Release** avec ces notes.

## Première release (`v0.1.0`)

Après le premier push de `main` :

```bash
git tag -a v0.1.0 -m "v0.1.0 — socle plateforme + frontend"
git push origin v0.1.0
```

## Pré-releases

Tags avec suffixe (`v1.0.0-rc.1`) sont publiés en **prerelease** sur GitHub.

## Vérification locale

```bash
python scripts/verify_version.py v0.1.0
python scripts/extract_changelog.py 0.1.0
```
