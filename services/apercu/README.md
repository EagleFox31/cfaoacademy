# Service d'aperçu

Convertit une diapositive du modèle en image, pour que l'assistant de
compte rendu montre la page telle qu'elle sortira de PowerPoint plutôt
qu'une reconstitution HTML. Il produit aussi le rapport complet et garde
les photos ; les brouillons sont conservés par `cfao-operations`
(`/api/v1/ops/reports`).

Documentation complète du module (parcours, drapeaux, tests, écarts) :
[docs/MODULE_RAPPORTS_FORMATEUR.md](../../docs/MODULE_RAPPORTS_FORMATEUR.md).

## Démarrer

```
python services/apercu/api.py      # écoute sur 127.0.0.1:5175
```

Le serveur de développement relaie `/apercu` vers ce port (voir
`frontend/vite.config.js`). Si le service est arrêté, l'assistant bascule
sur le rendu HTML et le signale.

## Prérequis

- **LibreOffice** — chemin par défaut `C:\Program Files\LibreOffice\program\soffice.exe`
- **Python** — `pip install -r services/requirements.txt`
- **Modèle** — `modeles/MODELE-REFERENCES.pptx`, versionné avec le service

Variables : `CR_MODELE`, `CR_CACHE`, `CR_SOFFICE`, `CR_HOTE`, `CR_PORT`.
En conteneur : `services/Dockerfile`, service `rapports` du `docker-compose.yml`.

## Routes

| Route | Effet |
|---|---|
| `GET /apercu/sante` | le service et LibreOffice répondent-ils |
| `POST /apercu/page` | l'image PNG d'une diapositive |
| `POST /apercu/rapport` | le rapport complet, page par page, `pptx` ou `pdf` |
| `POST /apercu/document` | le rapport complet à partir des parties |
| `POST /apercu/photo` | dépôt d'une photo |
| `POST /apercu/redaction` | texte proposé par le moteur de rédaction |
| `GET /apercu/photos/<id>.jpg` | photo enregistrée |

## Pourquoi c'est rapide

Le modèle empile onze masques et 572 mises en page pour vingt-huit
diapositives — un héritage de présentations importées. LibreOffice les
analyse à chaque ouverture, d'où une conversion d'une vingtaine de
secondes quelle que soit la diapositive demandée.

`composer.py` ne garde que les parties atteignables depuis les
diapositives voulues, masques purgés de leurs mises en page inutilisées :

| | Avant | Après |
|---|---|---|
| 1 diapositive | 3 Mo / 20,5 s | 76 Ko / 1,2 s |
| 10 diapositives | 2,1 Mo / 11,4 s | 1,1 Mo / 3,1 s |

Le rendu est vérifié au pixel contre le modèle complet : identique, aux
quelques pixels d'antialiasing près.

Chaque image est mise en cache sous l'empreinte de son contenu ; tant que
les valeurs d'une diapositive ne bougent pas, elle n'est pas reconvertie.
