# Patron d'import tabulaire

> Patron transverse — s'applique à **tout** import de fichier Excel ou CSV de la plateforme :
> migration (`00-2`, `00-4`), recueil des besoins (§16), comptes, catalogue, sessions.
>
> Repris et durci depuis Academix (`docs/AUDIT_ACADEMIX.md` F22), le seul de ses imports qui ait
> réellement été utilisé par les filiales sans assistance.

---

## 1. Pourquoi un patron

Les fichiers viennent d'une vingtaine de filiales avec autant de conventions. Un import qui exige
un format exact n'est jamais utilisé : les gens renvoient leur classeur habituel et attendent que
ça marche. Un import qui accepte tout sans rien dire produit des données fausses que personne ne
détecte avant six mois.

Le patron tient en trois obligations : **tolérer la forme, refuser le fond douteux, dire ce qui
s'est passé.**

---

## 2. Les six règles

### Règle 1 · En-têtes par synonymes, jamais par position

Une colonne est reconnue par un **jeu de libellés acceptés**, insensible à la casse, aux accents,
aux espaces multiples et aux tirets. Jamais par son index.

```python
COLUMNS = {
    "brand": ["marque", "brand", "marque constructeur", "constructeur"],
    "code":  ["code", "code formation", "code module", "ref", "référence"],
    "title": ["intitulé", "intitule", "module", "libellé", "titre", "formation"],
    "q1":    ["t1", "trim 1", "trimestre 1", "q1", "1er trimestre"],
}
```

Une colonne obligatoire non trouvée arrête l'import **avant** toute écriture, avec la liste des
en-têtes réellement lus et des libellés attendus. Les colonnes inconnues sont ignorées et listées
au rapport — elles ne sont jamais une erreur.

### Règle 2 · Modèle vierge téléchargeable

Chaque import expose `GET /imports/{kind}/template` renvoyant un classeur pré-rempli : en-têtes
canoniques, une ligne d'exemple, et une feuille « Aide » listant les valeurs autorisées des colonnes
à énumération. Le modèle est **généré depuis la même définition de colonnes** que le parseur — il ne
peut pas diverger.

### Règle 3 · Validation ligne à ligne, rapport exhaustif

Le parseur ne s'arrête pas à la première erreur. Il valide **toutes** les lignes et produit un
rapport :

```json
{
  "import_id": "…",
  "status": "REJECTED",
  "rows_read": 261,
  "rows_valid": 259,
  "rows_rejected": 2,
  "unknown_columns": ["Observations"],
  "normalizations": [
    {"row": 148, "column": "brand", "from": "SINOTRUCK", "to": "SINOTRUK", "rule": "alias"}
  ],
  "errors": [
    {"row": 232, "column": "brand", "value": "TOYOTA HYBRID", "code": "BRAND_UNKNOWN",
     "message": "Marque inconnue « TOYOTA HYBRID ». Marques acceptées pour la famille Techniques Motors : BYD, CITROEN, FIAT, JEEP, MERCEDES, MITSUBISHI, OMODA & JAECOO, PEUGEOT, SUZUKI, TOYOTA. Laisser vide pour une formation transverse."}
  ]
}
```

Le rapport est **persistant** (`ImportLog`), consultable et téléchargeable en XLSX — la personne qui
corrige son fichier travaille dans son outil, pas dans une réponse JSON.

Les messages d'erreur nomment **la ligne, la colonne, la valeur reçue et ce qui est attendu**.
Jamais « ligne invalide ».

### Règle 4 · Tout ou rien

Un import est une **transaction unique**. `rows_rejected > 0` ⇒ aucune écriture, statut `REJECTED`.

Un import partiel laisse une base à moitié peuplée que personne ne sait rattraper — c'est le mode
d'échec le plus coûteux observé sur Academix.

Une seule exception, explicite et paramétrée : le mode `--tolerant` réservé aux imports de migration
non idempotents, qui écrit les lignes valides **et** produit un fichier de rejets réimportable tel
quel. Jamais par défaut.

### Règle 5 · Clé naturelle explicite et testée

Chaque import déclare sa clé de rapprochement, et cette clé fait l'objet d'un test unitaire dédié
sur un jeu contenant **au moins un doublon volontaire sur une clé partielle**.

| Import | Clé naturelle | Piège |
|--------|---------------|-------|
| Catalogue de campagne | `(campagne, famille, marque, code)` — **marque nullable** | `TP02` existe sur 10 marques — dédoublonner sur `code` perd 30 lignes. Et une ligne transverse a `marque = NULL`, pas une pseudo-marque « TOUTES MARQUES » |
| Comptes collaborateurs | `email` | Homonymes fréquents — ne jamais rapprocher sur nom + prénom |
| Besoins de filiale | `(soumission, famille, marque, code)` | Idem catalogue |
| Sessions | `(code_session, année)` | Le code de session est réutilisé d'un exercice à l'autre |

Quand la clé contient une colonne nullable, l'unicité passe par **deux index partiels** — un pour
`NOT NULL`, un pour `NULL` — sinon PostgreSQL laisse passer les doublons transverses.

### Règle 6 · Normalisations tracées, jamais silencieuses

Une valeur corrigée automatiquement (alias de marque, casse, tiret, espace insécable, apostrophe
typographique) apparaît dans `normalizations[]` du rapport. Le correctif est appliqué, et il est
**visible**.

Distinction à tenir :

| Cas | Traitement |
|-----|------------|
| Forme différente, sens certain (`SINOTRUCK`, ` toyota `, `Back office`) | Normalisé + tracé |
| Sens incertain (marque absente du référentiel, code vide, effectif négatif) | **Rejet** |

Une table d'alias est une **donnée**, pas du code : elle est en base, éditable par un administrateur,
et chaque alias ajouté est daté et attribué.

---

## 3. Interface commune

```python
class TabularImporter(Protocol):
    kind: str
    columns: ColumnSpec
    natural_key: tuple[str, ...]

    def template(self) -> Workbook: ...
    def parse(self, file: BinaryIO) -> ParseResult: ...   # ne touche pas la base
    def apply(self, result: ParseResult) -> ImportLog: ...  # transactionnel
```

`parse` et `apply` sont **séparés** : cela permet la prévisualisation avant écriture, qui est le
comportement attendu de tout import destructif.

### Parcours utilisateur

```
Dépôt du fichier → parse → prévisualisation (compteurs, erreurs, normalisations)
                                    │
                    ┌───────────────┴───────────────┐
              0 erreur                        ≥ 1 erreur
                    │                               │
            « Confirmer » → apply          Rapport XLSX à corriger
                    │                               │
              ImportLog + résumé         (aucune écriture en base)
```

---

## 4. Endpoints normalisés

| Méthode | Route | Effet |
|---------|-------|-------|
| `GET` | `/api/v1/{module}/imports/{kind}/template` | Modèle vierge XLSX |
| `POST` | `/api/v1/{module}/imports/{kind}/preview` | `parse` seul — aucune écriture |
| `POST` | `/api/v1/{module}/imports/{kind}` | `parse` + `apply` transactionnel |
| `GET` | `/api/v1/{module}/imports/{id}` | État et compteurs |
| `GET` | `/api/v1/{module}/imports/{id}/report.xlsx` | Rapport téléchargeable |

Tout import est soumis au PEP Cerbos comme n'importe quelle écriture — action `import` sur la
ressource cible.

---

## 5. Contrôles obligatoires

- **Taille et type** : plafond configuré par import, extension **et** signature de fichier vérifiées
- **Limite de lignes** : plafond explicite, dépassement = rejet clair et non timeout
- **Bibliothèque de lecture** : `openpyxl` en lecture seule côté Python. Ne pas utiliser `xlsx`
  (SheetJS) côté navigateur pour un fichier tiers — la version disponible sur le registre public
  porte des vulnérabilités non corrigées, et le parsing d'un fichier tiers n'a rien à faire dans le
  navigateur
- **Formules** : jamais évaluées, seules les valeurs sont lues
- **Journalisation** : chaque import écrit un `AuditEvent` (acteur, type, compteurs, périmètre)

---

## 6. Tests exigés par import

| Niveau | Cas minimum |
|--------|-------------|
| **TU** | Synonymes reconnus · colonne obligatoire manquante · **doublon sur clé partielle** · alias appliqué et tracé · valeur invalide rejetée |
| **TI** | Import nominal en base · rejet total sur une ligne fautive (vérifier qu'**aucune** écriture n'a eu lieu) · rapport téléchargeable |
| **Policy** | Un rôle non habilité reçoit 403 sur `/imports` — test négatif |
| **E2E** | Dépôt → prévisualisation → correction → confirmation, depuis l'interface |

---

## 7. Où le patron s'applique

| Story | Import | Module |
|-------|--------|--------|
| `00-2` | Comptes collaborateurs | `identity` |
| `00-4` | Catalogue et sessions | `lms`, `operations` |
| `00-5` | Rapport de validation des lots | transverse |
| `16-4` | Référentiel de campagne | `needs` |
| `16-16` | Besoins de filiale (saisie déléguée) | `needs` |
| `08-2` | Liste de stagiaires | `operations` |

---

## 8. Références

- Origine et évaluation : `docs/AUDIT_ACADEMIX.md` F22
- Spécification d'usage : `docs/SPEC_RECUEIL_BESOINS_2027.md` §8
- Stories migration : `backlog.md` §00
- Séquence de tests : `planning.md` §6
