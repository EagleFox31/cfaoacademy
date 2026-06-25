## Description

<!-- Contexte métier en 2–3 phrases. Lien story / ticket si applicable. -->

**Story / ticket :** `NN-x` (ex. `02-3`)

## Type de changement

- [ ] Feature
- [ ] Correctif
- [ ] Refactoring (sans changement fonctionnel)
- [ ] Documentation
- [ ] Infra / CI
- [ ] Sécurité (Cerbos, auth, secrets…)

## Avancement (reprise rapport MOA)

<!-- Phrase(s) compréhensibles par un non-technique — cf. CONTRIBUTING.md -->

```
Avancement: …
```

## Checklist

- [ ] J'ai lu [CONTRIBUTING.md](../CONTRIBUTING.md) (format commit `NN-x:` + `Avancement:` si significatif)
- [ ] La CI passe en local ou j'ai lancé `make test` / les jobs concernés
- [ ] Pas de secret, token ou mot de passe dans le diff
- [ ] Cerbos : policies + tests mis à jour si changement d'autorisation
- [ ] Captures / démo ajoutées si changement UI visible
- [ ] [CHANGELOG.md](../CHANGELOG.md) mis à jour si release ou changement notable

## Tests effectués

<!-- Commandes + résultat : pytest, npm run build, compile Cerbos… -->

## Notes reviewers

<!-- Points d'attention, dette technique, follow-up -->
