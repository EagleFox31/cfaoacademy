"""Catalogue des rôles système (aligné sur le realm Keycloak / PLATFORM_ROLES.md).

Ressource globale (pas de périmètre org) — consultable par superadmin / admin groupe.
"""
ROLE_CATALOG = [
    {"code": "learner", "description": "Apprenant"},
    {"code": "ki", "description": "Key Instructor"},
    {"code": "pic", "description": "Partner Instructor Manager"},
    {"code": "team_manager", "description": "Manager chef d'équipe"},
    {"code": "workshop_manager", "description": "Manager chef d'atelier"},
    {"code": "dps", "description": "Directeur Pièces & Services"},
    {"code": "dop", "description": "Directeur des Opérations"},
    {"code": "branch_director", "description": "Directeur Filiale"},
    {"code": "regional_director", "description": "Directeur Régional"},
    {"code": "group_director", "description": "Directeur Groupe"},
    {"code": "trainer", "description": "Formateur certifié constructeur"},
    {"code": "center_assistant", "description": "Assistante du centre"},
    {"code": "training_coordinator", "description": "Coordinateur formation"},
    {"code": "center_director", "description": "Directeur du centre de formation"},
    {"code": "content_editor", "description": "Éditeur de contenu (Wagtail)"},
    {"code": "branch_admin", "description": "Admin Filiale"},
    {"code": "branch_hr", "description": "RH Filiale"},
    {"code": "group_admin", "description": "Admin Groupe (MOA pilotage)"},
    {"code": "group_hr", "description": "RH Groupe"},
    {"code": "superadmin", "description": "Super Admin"},
    {"code": "build_team", "description": "Équipe build (app 15)"},
    {"code": "candidate", "description": "Candidat"},
    {"code": "b2b_partner", "description": "Partenaire B2B"},
]
