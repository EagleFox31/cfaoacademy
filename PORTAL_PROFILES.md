# Portail CFAO Academy — Roadmap par profil

> Complète `APPRENANT_VIEWS.md` avec les ajouts recommandés (parité spec, MVP, différenciation).  
> Référence implémentation démo : dashboard `learner` (u1).

---

## Transversal (tous les profils)

| Élément | Description |
|---------|-------------|
| Shell portail dédié | Nav simplifiée : Tableau de bord, Catalogue, Planning, Certifications, Équipe (si manager) |
| Bandeau notifications | Éval à passer, cert expire J-30, session J-7, alerte manager |
| Recherche globale | Code formation, titre, niveau cert |
| Fil d'Ariane / ancres | Navigation rapide entre sections du dashboard |

---

## 1. `learner` — Apprenant

### Déjà en place
Bilan KPI, modules, évaluations, plan de formation multi-annuel, planning annuel, certifications, modales détail.

### Implémenté (démo u1)
- **Hero** : objectif certification (niveau cible, actuel, prérequis) sans augmenter la hauteur — bandeau dans l'espace libre du hero
- **Prochaine action** : CTA prioritaire (reprendre module, passer éval, confirmer session)
- **À découvrir** : formations recommandées avec lien fiche catalogue
- **Plan de formation** : bouton « Voir plus » → sous-sections Présentiel, Distanciel, E-learning, Mentoring ; statuts À faire / Programmé (année) / Fait
- **Planning annuel** : statuts À inscrire / Inscrit / En cours (semaine en cours) / Fait
- **PIF (carte marque)** : agrégation par année avec Partiel / Non fait — voir `docs/PORTAL_COLORIMETRY.md`

### À compléter (spec)
| Bloc | Action |
|------|--------|
| Sessions à venir | Prochaine session mise en avant dans Prochaine action |
| Attestations | Téléchargement PDF réel |

### MVP suivant
| Bloc | Contenu |
|------|---------|
| Player formation | Lancer / reprendre un module e-learning |
| Moteur certification | Prérequis manquants détaillés, date limite recertif |
| Alertes perso | Bandeau cert expire, éval non passée |
| Lien catalogue | `/formations` + fiches PNG `/formations/fiche/:code` |

### Plus tard
Transcript audit, crossover marques, microlearning mobile, gamification légère.

---

## 2. `ki` / `pic` — Formateur suppléant

### À compléter (spec)
- Bandeau CTA « X formations à dispenser » → App 03
- Réutiliser `LearnerDashboard` pour la casquette apprenant

### MVP
| Bloc | Contenu |
|------|---------|
| Prochaine animation | Date, lieu, inscrits, feuille de présence |
| Mes apprenants | Drill-down lecture seule |
| Ressources session | Supports PDF, fiche technique |
| Habilitation KI | Modules instructeur à terminer |

### Plus tard
Saisie présences, calendrier disponibilités.

---

## 3. `team_manager` — Chef d'équipe *(lecture seule)*

### À compléter
- Sessions équipe (4–6 semaines)
- Bloc alertes > 30 j inactivité

### MVP
- Fiche collaborateur (lecture seule)
- Filtres tableau (marque, statut)
- Export PDF équipe

---

## 4. `workshop_manager` — Chef d'atelier

### À compléter
- KPIs atelier (`certificationRate`, `overdue`, `activeSessions`) — données mock u4
- Sessions + alertes agrégées

### MVP
- Vue par équipe avec sous-total KPI
- Heatmap marques

---

## 5. `branch_hr` / `branch_admin`

### À compléter (priorité)
- Dossier individuel (clic annuaire)
- Modal inscription session
- Export CSV / PDF fonctionnel

### MVP
- Filtres annuaire (rôle, marque, alertes)
- Vérification prérequis à l'inscription

---

## 6. `superadmin`

### À compléter
- Annuaire groupe (toutes filiales)
- Actions admin (réattribuer module, réinitialiser progression, cert)
- Logs filtrables

---

## Phases

```
Phase 1 — Démo apprenant (en cours)
├── Hero objectif cert + Prochaine action
├── Plan expandable (modalités)
├── Planning (statuts annuels)
└── À découvrir

Phase 2 — Autres profils + parité spec
├── KI : bandeau App 03 + réutilisation learner
├── Team / Workshop : alertes + sessions
├── RH : dossier + inscription + export
└── Admin : annuaire groupe + actions

Phase 3 — LMS opérationnel
├── Player + QCM
├── Notifications
└── Attestations PDF
```

---

## Ordre de développement

1. Composants partagés : `CertificationGoal`, `CollaboratorSheet`, `SessionEnrollModal`
2. Learner (base KI)
3. RH (seule écriture supervision)
4. Team / Workshop
5. Superadmin
