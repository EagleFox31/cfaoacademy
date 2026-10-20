# CFAO Academy — Cartographie d'hébergement

*Document de cadrage à destination de l'hébergeur · Octobre 2026*

---

## 1. Objet

Ce document décrit l'architecture technique de la plateforme CFAO Academy à un niveau suffisant pour permettre à l'hébergeur de dimensionner correctement son offre. Il reste volontairement au niveau infrastructure.

## 2. Nature de la plateforme

CFAO Academy est une application **conteneurisée et multi-services**. Elle regroupe plusieurs briques logicielles indépendantes qui coopèrent via un réseau privé, chacune empaquetée dans son propre conteneur Docker.

Les briques se répartissent en quatre grandes familles :

- **Interfaces web et API métier** — les services qui exposent les fonctionnalités de la plateforme aux utilisateurs
- **Travailleurs de fond** — les processus asynchrones chargés des envois d'e-mails, des agrégations et des tâches planifiées
- **Services transverses** — authentification unique, moteur d'autorisation, reverse proxy
- **Stockage persistant** — plusieurs bases relationnelles et une base documentaire

Chaque brique est packagée indépendamment, versionnée indépendamment, et peut être mise à jour ou redémarrée sans toucher aux autres.

## 3. Diagramme général

```
                       ┌───────────────────────────────┐
                       │  Utilisateurs (navigateur)    │
                       └───────────────┬───────────────┘
                                       │ HTTPS
                       ┌───────────────┴───────────────┐
                       │   Point d'entrée public       │
                       │   (reverse proxy + WAF)       │
                       └───────────────┬───────────────┘
                                       │
             ┌─────────────────────────┼─────────────────────────┐
             │                         │                         │
   ┌─────────┴─────────┐    ┌──────────┴──────────┐    ┌─────────┴─────────┐
   │  API & interfaces │    │  Services transverses│    │  Travailleurs de  │
   │       web         │    │  (identité, droits)  │    │       fond        │
   └─────────┬─────────┘    └──────────┬──────────┘    └─────────┬─────────┘
             │                         │                         │
             └─────────────────────────┼─────────────────────────┘
                                       │
                       ┌───────────────┴───────────────┐
                       │   Stockage persistant         │
                       │   (bases SQL + documentaire)  │
                       └───────────────────────────────┘
```

Seuls le reverse proxy et le serveur d'identité sont exposés sur Internet. Tout le reste transite exclusivement par le réseau privé.

## 4. Dimensionnement attendu

### 4.1 Empreinte globale

L'application est **modeste en ressources**, mais composée de **plusieurs briques distinctes** qui doivent toutes tourner en parallèle. L'empreinte totale attendue en production au démarrage se situe dans la plage suivante :

| Ressource    | Fourchette estimée          |
|--------------|-----------------------------|
| CPU cumulé   | 8 à 12 vCPU                 |
| Mémoire      | 6 à 10 Go                   |
| Conteneurs   | Plusieurs (ordre : > 10)    |

Ces valeurs seront précisées après tests de charge en fonction de la volumétrie réelle d'utilisateurs.

### 4.2 Volumétrie de stockage

| Donnée                                             | Volume initial estimé | Croissance             |
|----------------------------------------------------|-----------------------|------------------------|
| Bases relationnelles (cumulées)                    | ~100 Go               | Progressive            |
| Base documentaire                                  | ~50 Go                | Progressive            |
| Stockage de fichiers (fiches formation, documents) | ~300 Go évolutif      | Significative sur 3 ans|

## 5. Exigence structurante

**Le périmètre fonctionnel de la plateforme est amené à évoluer.** De nouvelles briques logicielles seront ajoutées au fil des mises en production — nouveaux modules métier, services d'intégration, outils d'exploitation. L'hébergement retenu doit donc permettre :

- D'exécuter un **nombre variable de conteneurs**, sans plafond rigide prévu à la souscription
- D'**ajouter de nouveaux services** sans renégociation contractuelle ni nouvel abonnement
- Une **facturation à l'usage par conteneur** (CPU et mémoire consommés), plutôt qu'un forfait fixe par plan d'exécution
- Une **montée en charge indépendante** de chaque brique (chacune peut avoir plus d'instances si nécessaire)

C'est ce point qui conditionne le choix de la plateforme d'hébergement : une offre fondée sur un plan d'exécution dimensionné pour deux ou trois applications ne couvrira pas notre besoin.

## 6. Services Azure jugés adaptés

| Besoin                          | Service Azure pressenti                       |
|---------------------------------|-----------------------------------------------|
| Exécution des conteneurs        | **Azure Container Apps**                      |
| Entrepôt d'images privé         | Azure Container Registry                      |
| Bases relationnelles            | Azure Database for PostgreSQL Flexible Server |
| Base documentaire               | Azure Cosmos DB (API MongoDB) ou équivalent   |
| Stockage de fichiers            | Azure Blob Storage                            |
| Exposition publique sécurisée   | Azure Front Door + WAF *(conservable)*        |
| Gestion des secrets et clés     | Azure Key Vault *(conservable)*               |

Le choix d'**Azure Container Apps** est privilégié face à App Service Plan parce qu'il correspond nativement à notre modèle multi-services, qu'il facture à l'usage, et qu'il permet d'ajouter de nouvelles briques sans refonte de l'abonnement.

## 7. Points à préciser dans la proposition révisée

1. Compatibilité d'Azure Container Apps avec le déploiement de nos images, et procédure d'intégration à notre pipeline de livraison
2. Modèle tarifaire associé — socle + part variable — adapté à un nombre de conteneurs évolutif
3. Modalités de sauvegarde et de restauration des bases
4. Possibilité d'un environnement de pré-production équivalent, à l'identique

---

*Document établi par l'équipe technique CFAO Academy — Octobre 2026. Ne contient aucune information métier confidentielle ; peut être partagé avec les prestataires d'hébergement consultés.*
