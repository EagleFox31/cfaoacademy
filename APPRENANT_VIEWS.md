# Espace Apprenant — Vues par profil (App 02)

> Base pour les maquettes de démo. Chaque profil = un dashboard distinct.  
> Données mockées via `mock_profiles.json`.

---

## 1. `learner` — Apprenant

**Bannière :** Bonjour [Prénom] · [Filiale] · [Marque(s)]

| Bloc | Contenu |
|------|---------|
| **Ma progression** | Barre globale % · modules terminés / total |
| **Mon parcours** | Liste des modules : titre, marque, statut (À faire / En cours / Terminé), % |
| **Évaluations** | Prochaines évaluations à passer · résultats passés (score, date) |
| **Mes certifications** | Liste · badge marque · date · bouton télécharger attestation |
| **Sessions à venir** | Prochaine session inscrite (date, lieu, formateur) |

---

## 2. `ki` / `pic` — Formateur suppléant *(cumule `learner`)*

Identique à `learner` **+** :

| Bloc | Contenu |
|------|---------|
| **Mes formations à animer** | CTA visible en haut : « X formation(s) à dispenser » → lien app 03 |
| **Mes apprenants** | Nombre d'apprenants assignés · marque certifiée |

---

## 3. `team_manager` — Chef d'équipe *(lecture seule)*

**Bannière :** Mon équipe · [Agence] · [Marque(s) assignées]

| Bloc | Contenu |
|------|---------|
| **Progression équipe** | Tableau : Nom · Marque · Modules terminés · % · Dernière activité |
| **Certifications** | Nb certifiés / total par marque |
| **Sessions à venir** | Sessions prévues pour l'équipe |
| **Alertes** | Apprenants sans activité depuis > 30 j |

---

## 4. `workshop_manager` — Chef d'atelier *(lecture seule)*

Identique à `team_manager` **+** périmètre élargi :

| Bloc | Contenu |
|------|---------|
| **Vue par équipe** | Onglets ou accordéon par chef d'équipe sous lui |
| **KPIs atelier** | Taux de certification global · formations en retard |

---

## 5. `branch_hr` / `branch_admin` — RH / Admin Filiale *(lecture + inscription)*

**Bannière :** Filiale [Nom] · [N] collaborateurs

| Bloc | Contenu |
|------|---------|
| **Annuaire apprenants** | Tableau searchable : Nom · Rôle · Marque · Avancement · Dernière connexion |
| **Dossier individuel** | Clic → fiche : modules, certifications, évaluations du collaborateur |
| **Inscriptions** | Bouton « Inscrire un collaborateur » à une session |
| **Exports** | Télécharger rapport formation filiale (CSV / PDF) |

---

## 6. `superadmin` — Super Admin

Accès global + :

| Bloc | Contenu |
|------|---------|
| **Vue groupe** | Tous les apprenants toutes filiales |
| **Modifications** | Réattribuer modules, réinitialiser progression, gérer certifications |
| **Logs** | Historique des actions admin |

---

## Profils mock (`mock_profiles.json`)

> Modèle **RBAC + ABAC** : `roles[]` = ce que tu peux faire · `attr` = sur quelles données.  
> Structure = principal Cerbos (cf. `architecture_complement.md`).

| id | roles | nom | orgPath | departments | brands | certLevel |
|----|-------|-----|---------|-------------|--------|-----------|
| `u1` | `[learner]` | Kouamé Assi | `groupe.afrique_ouest.cote_divoire.abidjan_plateau` | `[motors]` | `[toyota]` | — |
| `u2` | `[learner, ki]` | Brahim Tahir | `groupe.afrique_nord.maroc.casablanca` | `[motors]` | `[toyota]` | `2` |
| `u3` | `[team_manager]` | Seydou Diallo | `groupe.afrique_ouest.senegal.dakar_nord` | `[motors]` | `[renault, nissan]` | — |
| `u4` | `[workshop_manager]` | Fatou Mbaye | `groupe.afrique_ouest.senegal.dakar_nord` | `[motors]` | `[renault, nissan, toyota]` | — |
| `u5` | `[branch_hr]` | Aminata Koné | `groupe.afrique_ouest.cote_divoire` | `[]` | `[]` | — |
| `u6` | `[superadmin]` | Admin Groupe | `groupe` | `[]` | `[]` | — |

**Règles de filtrage — deux patterns distincts**

> **Self-service** : l'utilisateur voit *ses propres* données → filtre `resource.owner == principal.id` (derived role `owner` dans Cerbos). L'orgPath n'intervient pas.  
> **Supervision** : l'utilisateur voit les données *des autres* dans son périmètre → filtre `scopeNode in orgPath` (+ brands + departments).

**Pattern self-service** *(resource.owner == principal.id)*

| Profil | Filtre données propres | Filtre catalogue |
|--------|----------------------|-----------------|
| `learner` | propriété (`owner`) | brands + departments |
| `ki` casquette apprenant | propriété (`owner`) | sa marque certifiée + `motors` |

**Pattern supervision** *(orgPath + brands + departments)*

| Profil | Filtre orgPath | Filtre brands | Filtre departments |
|--------|---------------|--------------|-------------------|
| `ki` casquette instructeur | sa filiale | sa marque certifiée · niveaux < certLevel | motors |
| `team_manager` | son agence + sous-nœuds | ses marques assignées | son département |
| `workshop_manager` | son agence + sous-nœuds | toutes marques agence | son département |
| `branch_hr` / `branch_admin` | sa filiale + tous sous-nœuds | toutes | tous |
| `superadmin` | `groupe` (racine) | toutes | tous |
