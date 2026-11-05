# Portail DPS — fiabilité des données & roadmap

Notes de cadrage suite à la revue UX portail DPS (Jacques ROBIN / filiale MEDACAP).

## Livré (court terme)

| Élément | Implémentation |
|--------|----------------|
| Fraîcheur des données | `PortalSectionHead` — « Mis à jour il y a X min » aligné à droite sur la ligne de l’eyebrow (sections PIF, Résultats, Activité) |
| Méthode de calcul | Lien « Méthode » → popover explicatif par section (`dps_method_pif`, `dps_method_results`, `dps_method_activity`) |
| Skeleton chargement | `PortalSectionSkeleton` pendant la synchro périmètre MEDACAP (`useDpsFilialeScope` → `scopeLoading`) |
| Notifications navbar | `PortalNotificationsBell` — cloche + badge, dropdown alertes filiale (`lms.alerts`) |
| Activité collaborateurs | `DpsActivitySection` — journal des dernières actions (`lms.recentLogs`), ancre `#activite` |
| Périmètre filiale | Déjà couvert (hero, menu utilisateur, sticky bar) — pas de doublon |

Fichiers clés : `PortalSectionHead.jsx`, `PortalNotificationsBell.jsx`, `useDpsFilialeScope.js`, `DpsDashboard.jsx`.

---

## Moyen terme

- **Export PDF / rapport filiale** — synthèse PIF + scores + alertes pour comité mensuel
- **Micro-feedback portail** — thumbs up/down discret après consultation d’une section (NPS sectionnel)
- **Satisfaction tickets assistance** — notation à la clôture d’un ticket atelier (CSAT)
- **Carrousel actualités Academy** — bandeau ou encart dans le hero DPS (lien vers `/#actualites`)
- **Notifications actionnables** — marquer comme lu, lien direct vers agence / technicien dans MEDACAP
- **Rafraîchissement auto** — polling léger ou WebSocket pour `lastUpdatedAt` sans rechargement page
- **Filtres activité** — par marque, agence, type d’événement sur le journal collaborateurs
- **Comparatif période** — évolution scores / PIF vs trimestre précédent

---

## RETEX / points d’attention

- **Périmètre vs mock** : tant que MEDACAP n’est pas joignable, le mock u10 reste affiché ; le skeleton ne s’affiche que si l’API est activée et en cours de fetch.
- **Horodatage relatif** : basé sur `lastUpdatedAt` au retour API ; en démo pure mock, affiche « À l’instant » après chargement.
- **Alertes** : données mock pour l’instant ; en prod, aligner sur règles métier (inactivité > 30 j, PIF < seuil, etc.).
- **Activité** : journal statique mock ; prévoir format API unifié (`{ at, actor, action, context }`) pour i18n et tri.
- **Cloche navbar** : visible uniquement quand `notifications` est passé au `Nav` (dashboard DPS) ; autres personas sans cloche pour l’instant.
- **Méthode** : textes pédagogiques courts ; lien vers doc CFAO / MEDACAP si besoin de détail réglementaire.

---

## Non prévu (hors scope actuel)

- Refonte visuelle globale du portail
- Gestion des droits notifications multi-filiales (DOP / groupe)
- Intégration email / push mobile
