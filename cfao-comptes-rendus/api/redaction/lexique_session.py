# -*- coding: utf-8 -*-
"""Vocabulaire des remarques de session : progression, acquisition, bilan.

Les tournures suivent le style des comptes rendus CFAO — « Nous pouvons
constater que... », « Sept participants sur sept ont réussi... » — sans en
recopier une seule : une phrase source parle d'une session precise.

Chaque modele est une petite grammaire :

    [a|b|c]     un choix entre variantes, tire au hasard ; une option
                vide est permise : [|tres ] ;
    {champ}     une donnee de la session, jamais inventee.

Un modele de trois ou quatre choix donne deja des dizaines de phrases ;
la remarque en assemble trois ou quatre, dans un ordre lui-meme tire.
Deux generations successives ont ainsi tres peu de chances de se
ressembler, alors que chaque chiffre reste celui de la session.

Les registres suivent les chiffres ; aucun qualificatif n'est choisi
contre la valeur qu'il qualifie.
"""

from regles import SEUIL_DEFAUT as SEUIL  # noqa: E402

# ── Designations, pour ne pas repeter « participants » ─────────────────
GROUPE = "[le groupe|la promotion|l’ensemble des participants|l’ensemble du groupe]"
PARTICIPANTS = "[participants|stagiaires|techniciens|apprenants]"
SESSION = "[cette formation|cette session|la formation|la session]"
CONSTATER = ("[Nous pouvons constater que|Nous constatons que|On observe que|"
             "Il ressort que|On note que|Les résultats montrent que]")

# ── Progression ─────────────────────────────────────────────────────────
# Niveau moyen au test d'entree.
NIVEAU_ENTREE = [(75, "eleve"), (55, "moyen"), (35, "modeste"), (0, "faible")]
# Progression relative : (sortie - entree) / entree, en %.
PALIERS_PROGRESSION = [(70, "exceptionnelle"), (35, "forte"), (15, "nette"),
                       (5, "mesuree"), (0, "stable"), (-1000, "recul")]

ENTREE = {
    "eleve": [
        "{Groupe} [abordait|a abordé] {session} avec un niveau théorique déjà "
        "[solide|confortable|élevé|bien installé] ({entree} % [en moyenne |]au test d’entrée).",
        "Dès le test d’entrée, {groupe} [affichait|présentait] [de bonnes bases|des bases solides|"
        "un niveau appréciable] : {entree} % [de moyenne|en moyenne].",
        "Le niveau de départ était [déjà |]élevé, avec une moyenne de {entree} % au test d’entrée.",
    ],
    "moyen": [
        "{Groupe} [est arrivé|arrivait] avec un niveau théorique [passable|intermédiaire|"
        "moyen|perfectible] ({entree} % [en moyenne |]au test d’entrée).",
        "Le test d’entrée [situait|plaçait] {groupe} à {entree} % [de moyenne|en moyenne], "
        "[un niveau de départ correct mais perfectible|des bases réelles mais incomplètes|"
        "un socle à consolider].",
        "Au démarrage, [les connaissances théoriques restaient inégales|les acquis théoriques "
        "restaient partiels|les connaissances théoriques étaient à consolider] : {entree} % "
        "au test d’entrée.",
    ],
    "modeste": [
        "{Groupe} [abordait|a abordé] {session} avec un niveau théorique [modeste|"
        "en deçà des attentes|encore fragile] ({entree} % [en moyenne |]au test d’entrée).",
        "Le test d’entrée [révélait|faisait apparaître|mettait en évidence] des bases "
        "[fragiles|incomplètes|encore limitées], avec une moyenne de {entree} %.",
        "[Au démarrage|En début de formation|À l’arrivée], le niveau théorique restait "
        "[modeste|limité|insuffisant] : {entree} % au test d’entrée.",
    ],
    "faible": [
        "{Groupe} [partait|est parti] d’un niveau théorique [faible|très en retrait|"
        "nettement insuffisant] ({entree} % [en moyenne |]au test d’entrée).",
        "Le test d’entrée [révélait|mettait en évidence] des lacunes [importantes|marquées|"
        "profondes] : {entree} % [de moyenne|en moyenne].",
    ],
}

EVOLUTION = {
    "hausse": [
        "La moyenne [théorique |]passe de {entree} % à {sortie} % [au test de sortie|"
        "à l’issue de la formation|en fin de session], soit une progression de {progression} %.",
        "{Constater} [le groupe a|les participants ont|les stagiaires ont] progressé de "
        "{progression} % entre le test d’entrée et le test de sortie.",
        "Entre le test d’entrée ({entree} %) et le test de sortie ({sortie} %), la progression "
        "[s’établit à|atteint|ressort à] {progression} %.",
        "Le test de sortie [porte|établit] la moyenne à {sortie} %, soit {progression} % de "
        "progression [par rapport au|depuis le|au regard du] test d’entrée.",
        "[Au terme de|À l’issue de|En fin de] {session}, la moyenne atteint {sortie} % "
        "contre {entree} % au départ : [une progression de|un gain relatif de] {progression} %.",
    ],
    "stable": [
        "La moyenne reste [pratiquement |]stable entre le test d’entrée ({entree} %) et le "
        "test de sortie ({sortie} %), soit une progression de {progression} %.",
        "{Constater} [les résultats théoriques|les scores théoriques] [évoluent peu|restent "
        "stables] : {entree} % à l’entrée, {sortie} % à la sortie.",
    ],
    "recul": [
        "La moyenne passe de {entree} % au test d’entrée à {sortie} % au test de sortie, "
        "[en léger recul|en retrait].",
        "Le test de sortie ({sortie} %) [se situe|reste] en dessous du test d’entrée "
        "({entree} %).",
    ],
}

# La lecture du chiffre : elle croise le niveau de depart et la progression.
LECTURE = {
    ("eleve", "stable"): [
        "Partant d’un niveau déjà élevé, la marge de progression restait [naturellement |]"
        "[réduite|limitée|étroite].",
        "Le niveau de départ laissait [peu de|une faible] marge de progression sur le test théorique.",
    ],
    ("eleve", "mesuree"): [
        "[Ce gain mesuré s’explique|Cette progression mesurée s’explique] par un niveau de départ "
        "déjà [élevé|solide] : la marge restait [étroite|limitée].",
        "Avec des bases déjà solides, cette progression [consolide|confirme] [les acquis|"
        "le niveau] plus qu’elle ne le transforme.",
    ],
    "recul": [
        "Ce recul [invite à|appelle à] [revoir|réexaminer] [le calibrage du test de sortie|"
        "la charge du programme|le temps consacré aux révisions] avant la prochaine session.",
        "[Ce résultat mérite une analyse|Cette baisse mérite une analyse|Ce résultat demande "
        "à être analysé] avec le groupe "
        "[avant toute conclusion|pour en comprendre l’origine].",
    ],
    "stable": [
        "[Les acquis théoriques se maintiennent|Le niveau théorique se maintient], sans "
        "[réel|véritable] saut de niveau.",
    ],
    "mesuree": [
        "[Cette évolution|Cette progression], [modeste|mesurée] [mais réelle|mais régulière], "
        "[montre que les notions clés ont été revues|traduit une consolidation des acquis].",
        "Le gain reste [contenu|mesuré], [ce qui plaide pour|ce qui invite à] [un temps de "
        "révision supplémentaire|un renforcement des notions théoriques] [lors des prochaines sessions|"
        "en amont de la formation].",
    ],
    "nette": [
        "[Cette progression|Cette évolution] [traduit une|reflète une|témoigne d’une] [bonne|réelle|"
        "nette] assimilation des contenus [abordés|dispensés|transmis].",
        "[Ce résultat|Cette évolution] [confirme|souligne] [l’efficacité|la pertinence] "
        "[des apports théoriques|du contenu pédagogique] et l’implication "
        "[du groupe|des participants].",
    ],
    "forte": [
        "[Cette nette progression|Cette progression marquée|Ce saut de niveau] [témoigne d’un|"
        "traduit un|reflète un] [réel|véritable|fort] investissement [du groupe|des participants] "
        "[tout au long de|durant] {session}.",
        "[La montée en compétence est nette|Le gain est net|La progression est marquée|"
        "Le gain est significatif] : "
        "[les notions clés sont désormais maîtrisées|les apports théoriques ont été bien assimilés].",
    ],
    "exceptionnelle": [
        "[Une telle progression|Un tel écart] [s’explique en partie|tient en partie] par un "
        "niveau de départ [modeste|bas], mais [témoigne aussi|traduit aussi] d’un "
        "[engagement remarquable|investissement réel] [du groupe|des participants].",
        "[La progression est remarquable|Le saut de niveau est remarquable] : "
        "[le groupe a comblé l’essentiel de ses lacunes de départ|les participants ont comblé "
        "une large part de leurs lacunes initiales|le groupe a rattrapé l’essentiel de son "
        "retard initial].",
    ],
}

MEILLEURE_PROGRESSION = [
    "La plus forte progression revient à {top_nom} (+{top_prog} %).",
    "{Top_nom} [signe|réalise] la [plus forte|plus nette] progression [du groupe|de la session] "
    "(+{top_prog} %).",
    "[À noter,|On retiendra] la progression de {top_nom} : +{top_prog} %.",
]

REGRESSIONS = [
    "{N_recul_mot} <participant voit|participants voient:n_recul> toutefois <son|leur:n_recul> "
    "score reculer [à la sortie|entre les deux tests].",
    "À l’inverse, {n_recul_mot} <participant ne progresse|participants ne progressent:n_recul> "
    "pas sur la partie théorique.",
]

# ── Acquisition ─────────────────────────────────────────────────────────
# Le registre d'un taux : `regles.palier_au_seuil`, accorde au seuil choisi.
QUALIFICATIF = {
    "excellent": ["[excellent|remarquable|exemplaire]",
                  "[très solide|de premier ordre]"],
    "bon": ["[solide|appréciable]", "[convaincant|satisfaisant]"],
    "correct": ["[correct|satisfaisant|conforme aux attentes]", "[suffisant|honorable]"],
    "limite": ["[juste en deçà des attentes|perfectible|encore fragile]",
               "[en retrait|en dessous des attentes]"],
    "faible": ["[insuffisant|nettement en retrait]", "[en deçà du niveau requis|fragile]"],
}

REUSSITE = {
    "tous": [
        "[{Effectif_mot} participants sur {effectif_mot}|L’ensemble des {effectif_mot} "
        "participants|Tous les participants] ont [réussi|validé] {session}.",
        "Tous les {participants} [ont atteint|dépassent] le seuil de "
        "validation de {seuil} %.",
        "{Session_maj} est validée par [la totalité|l’ensemble] [du groupe|des participants] "
        "({effectif_mot} sur {effectif_mot}).",
    ],
    "partiel": [
        "{Reussis_mot} <participant|participants:reussis> sur {effectif_mot} <a|ont:reussis> "
        "[réussi|validé] {session}.",
        "{Reussis_mot} <participant|participants:reussis> sur {effectif_mot} "
        "<atteint|atteignent:reussis> le seuil de validation de {seuil} %.",
        "Sur {effectif_mot} {participants}, <un seul a|{reussis_mot} ont:reussis> [validé|réussi] "
        "{session}.",
    ],
    "aucun": [
        "Aucun participant n’atteint le seuil de validation de {seuil} % [à l’issue de|au terme de] "
        "{session}.",
        "Le seuil de validation de {seuil} % n’est atteint par aucun des {effectif_mot} "
        "{participants}.",
    ],
}

TAUX = [
    "[Le pourcentage|Le taux] d’acquisition [des compétences|de compétence] ressort à "
    "{taux} %, [un résultat|un niveau] {qualificatif}.",
    "Le taux d’acquisition [global |]des compétences [s’établit à|atteint|s’élève à] {taux} %, "
    "[un résultat|un niveau] {qualificatif}.",
    "[Le groupe|La promotion] [affiche|obtient] un taux d’acquisition [global |]de {taux} %, "
    "[ce qui constitue un résultat|soit un niveau] {qualificatif}.",
    "Avec une moyenne de {taux} %, le niveau d’acquisition [est|s’avère] {qualificatif}.",
]

EQUILIBRE = {
    "pratique": [
        "La pratique ({pratique} %) [tire|porte|soutient] le résultat, la théorie restant "
        "[en retrait|un cran en dessous] ({theorie} %).",
        "[Les travaux pratiques|Les ateliers] [ont été|se sont révélés] [mieux réussis|plus "
        "aboutis] que la théorie : {pratique} % contre {theorie} %.",
    ],
    "theorie": [
        "La théorie ({theorie} %) [devance|précède] la pratique ({pratique} %), "
        "[qui reste à consolider en atelier|dont la maîtrise demande encore du temps en atelier].",
        "[Les connaissances théoriques sont mieux installées|La théorie est mieux maîtrisée] "
        "que les gestes pratiques : {theorie} % contre {pratique} %.",
    ],
    "equilibre": [
        "Théorie ({theorie} %) et pratique ({pratique} %) [progressent de concert|se situent "
        "à un niveau proche], [signe d’un apprentissage équilibré|ce qui traduit "
        "une assimilation homogène].",
        "[Le résultat est équilibré|L’acquisition est homogène] entre la théorie ({theorie} %) "
        "et la pratique ({pratique} %).",
    ],
}

RETRAIT_NOMME = [
    "{Noms_retrait} <reste|restent:n_noms> sous le seuil de {seuil} % ; un accompagnement "
    "[ciblé|individualisé] est recommandé.",
    "À ce stade, {noms_retrait} <n’atteint|n’atteignent:n_noms> pas encore le seuil requis.",
    "{Noms_retrait} <devra|devront:n_noms> [consolider|renforcer] <ses|leurs:n_noms> "
    "acquis pour atteindre le seuil de {seuil} %.",
]

CONCLUSION_ACQUISITION = {
    "excellent": [
        "Les objectifs pédagogiques sont [pleinement|largement] atteints.",
        "[Ces résultats confirment|Ce niveau confirme] [la maîtrise|une maîtrise solide] des "
        "[compétences visées|procédures abordées].",
    ],
    "bon": [
        "[Les objectifs pédagogiques sont atteints|Les objectifs fixés sont atteints] "
        "[pour l’essentiel|dans leur ensemble].",
        "[Ces résultats témoignent|Ce niveau témoigne] d’une [bonne|réelle] assimilation "
        "des savoirs et savoir-faire [transmis|dispensés].",
    ],
    "correct": [
        "Les acquis sont [en place|réels] mais [demandent à|méritent d’]être consolidés "
        "[en situation de travail|en atelier].",
        "[Le niveau requis est atteint|Le seuil est franchi], [avec une marge encore réduite|"
        "sans grande marge]."
    ],
    "limite": [
        "[Un renforcement|Une consolidation] [des notions clés|des acquis] [s’impose|est à "
        "prévoir] [avant la mise en pratique autonome|pour sécuriser la mise en pratique].",
        "[Le niveau reste juste|Les acquis restent fragiles] : [un suivi|un accompagnement] "
        "[est recommandé|s’impose] [dans les semaines qui suivent|au retour en atelier].",
    ],
    "faible": [
        "[Une remise à niveau|Un parcours de remédiation] [s’impose|est nécessaire] "
        "[avant toute nouvelle session|pour les participants concernés].",
        "[Les prérequis|Les bases] [devront être|sont à] [consolidés|renforcés] "
        "[en amont d’une prochaine session|via les modules e-learning].",
    ],
}

# ── Bilan ───────────────────────────────────────────────────────────────
PALIERS_GROUPE = [(90, "tres_bon"), (70, "bon"), (50, "contraste"), (0, "faible")]

CONTEXTE = [
    "La formation {intitule} s’est tenue {periode}{lieu}, avec {effectif_mot} "
    "<participant|participants:effectif>.",
    "{Effectif_mot} <participant a|participants ont:effectif> suivi la formation {intitule} "
    "{periode}{lieu}.",
    "{Periode}, {lieu_sujet} [a accueilli|a réuni] {effectif_mot} "
    "<participant|participants:effectif> pour la formation {intitule}.",
    "La session {intitule} a [réuni|rassemblé] {effectif_mot} <participant|participants:effectif> "
    "{periode}{lieu}.",
]

SATISFACTION = [
    "[Les participants|Les stagiaires] [ont évalué|ont jugé] la qualité de la formation à "
    "{sat_formation} %[ et celle de l’accueil à {sat_accueil} %|].",
    "La satisfaction [exprimée|recueillie] s’établit à {sat_formation} % pour la formation"
    "[ et à {sat_accueil} % pour l’accueil|].",
    "[Côté satisfaction|Du point de vue des participants], la formation recueille "
    "{sat_formation} %[, l’accueil {sat_accueil} %|].",
]

CLIMAT = {
    "tres_bon": [
        "[Le groupe s’est montré engagé|Les participants se sont montrés impliqués|Le groupe "
        "s’est montré assidu] [du premier au dernier jour|tout au long de la session].",
        "La session s’est déroulée dans un climat de travail [soutenu|studieux|constructif].",
    ],
    "bon": [
        "[La participation est restée|L’implication est restée] [soutenue|régulière] "
        "[sur l’ensemble des journées|tout au long de la semaine].",
        "Les échanges ont été [nourris|réguliers|constructifs] [tout au long de la session|"
        "au fil des journées].",
    ],
    "contraste": [
        "[Les niveaux d’entrée se sont révélés hétérogènes|Le groupe présentait des profils "
        "inégalement préparés|Le groupe présentait des profils hétérogènes].",
        "[Des écarts de niveau|Des profils hétérogènes] ont marqué le déroulement de la session.",
    ],
    "faible": [
        "Le groupe abordait la session avec des prérequis [incomplets|inégaux].",
        "Les conditions d’entrée en formation [étaient|se sont révélées] [inégales|difficiles].",
    ],
}

POINTS_FORTS = [
    "[Parmi les points forts relevés au fil des journées|Points forts relevés pendant la "
    "session|Les journées ont notamment fait ressortir] : {forts}.",
]

RESULTATS = [
    "La moyenne théorique passe de {entree} % à {sortie} %, soit une progression de "
    "{progression} %.",
    "Entre le test d’entrée et le test de sortie, la moyenne [évolue|progresse] de {entree} % "
    "à {sortie} % ({progression} % de progression).",
    "[Les évaluations|Les tests] situent le groupe à {entree} % à l’entrée et {sortie} % à la "
    "sortie, [soit|pour] une progression de {progression} %.",
]

RESULTATS_TAUX = [
    "Le taux d’acquisition des compétences [s’établit à|atteint] {taux} % (théorie "
    "{theorie} %, pratique {pratique} %).",
    "[Avec|Pour] un taux d’acquisition de {taux} %, [la théorie|le volet théorique] "
    "({theorie} %) et [la pratique|le volet pratique] ({pratique} %) [se complètent|"
    "se répondent].",
    "L’acquisition [globale |]des compétences ressort à {taux} %, dont {theorie} % en théorie "
    "et {pratique} % en pratique.",
]

THEMATIQUES = [
    "[Les travaux ont porté|Les séances ont porté], [entre autres|notamment], sur : "
    "{thematiques}.",
    "[Le programme a couvert|Les séances ont couvert], [entre autres|notamment] : {thematiques}.",
    "[Parmi les thèmes abordés|Au programme] : {thematiques}.",
]

VIGILANCE = {
    "aucun": [
        "[L’ensemble des participants|Tout le groupe] atteint le seuil de validation de {seuil} %.",
        "Aucun participant ne reste en deçà du seuil de {seuil} %.",
        "Le seuil de validation est atteint par la totalité du groupe.",
    ],
    "quelques_uns": [
        "{N_retrait_mot} <participant|participants:n_retrait> sur {effectif_mot} "
        "<reste|restent:n_retrait> sous le seuil de {seuil} %[ : {noms_retrait}|].",
        "Le niveau final reste sous le seuil pour {n_retrait_mot} "
        "<participant|participants:n_retrait> sur {effectif_mot}[ ({noms_retrait})|].",
    ],
    "majorite": [
        "La majorité du groupe reste sous le seuil de validation ({n_retrait} "
        "<participant|participants:n_retrait> sur {effectif}), ce qui interroge les prérequis "
        "d’entrée.",
        "{N_retrait_mot} <participant|participants:n_retrait> sur {effectif_mot} "
        "<n’atteint|n’atteignent:n_retrait> pas le niveau requis.",
    ],
}

AMELIORATIONS = [
    "[Points d’amélioration relevés|À améliorer, selon les observations des journées|"
    "Les journées ont aussi mis en évidence] : {ameliorations}.",
]

SUITES = {
    "remediation": [
        "[Un accompagnement ciblé|Un suivi individualisé] est à [engager|prévoir] pour les "
        "participants n’ayant pas validé.",
        "Les participants en retrait [gagneront à|devront] [achever|reprendre] leur parcours "
        "e-learning avant toute nouvelle session.",
        "[Une remise à niveau est recommandée|Un temps de remédiation est recommandé] pour les "
        "participants sous le seuil.",
    ],
    "consolidation": [
        "La mise en pratique en atelier [consolidera|ancrera] ces acquis.",
        "Un suivi de proximité en atelier est recommandé dans les semaines qui suivent.",
        "Le transfert en situation réelle [reste|demeure] la meilleure consolidation de ces acquis.",
        "[Il est recommandé de|Il convient de] [mobiliser rapidement|mettre rapidement en "
        "pratique] ces compétences au sein des ateliers.",
    ],
    "certification": [
        "[Les participants validés|Les mieux classés] peuvent être [orientés|présentés] vers "
        "le niveau de certification suivant.",
    ],
}

# ── Bilan en un paragraphe ──────────────────────────────────────────────
# Le modele des comptes rendus : contexte, resultats, nuance, suites, dans
# un seul paragraphe que des liaisons enchainent.
PRATIQUE_EN_RETRAIT = [
    "[Toutefois|Cependant], le score pratique, en retrait à {pratique} %, [met en évidence|"
    "souligne] la nécessité de consolider la maîtrise opérationnelle.",
    "[Toutefois|Cependant], la pratique ({pratique} %) reste en deçà de la théorie "
    "({theorie} %) : la maîtrise opérationnelle demande encore à être consolidée.",
]

SUITE_PRATIQUE = [
    "Il est donc recommandé de [multiplier|renforcer] les travaux pratiques en atelier, "
    "[sous le suivi du Key Instructor|avec un suivi de proximité], afin que chacun "
    "[gagne en aisance|s’exerce sur des cas réels].",
]

LIAISON = {
    "retrait": ["Toutefois, ", "Cependant, ", "En revanche, "],
    "retrait_suite": ["Par ailleurs, ", "En outre, ", "De plus, "],
    "reussite": ["Au final, ", "En fin de session, ", ""],
    "suites": ["Aussi, ", "Dès lors, ", "En conséquence, ", ""],
}

NOMBRES = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit",
           "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
           "dix-sept", "dix-huit", "dix-neuf", "vingt"]


def en_mots(n):
    """Un effectif en lettres jusqu'a vingt, comme dans les comptes rendus."""
    return NOMBRES[n] if 0 <= n < len(NOMBRES) else str(n)


def palier(valeur, paliers):
    for borne, nom in paliers:
        if valeur >= borne:
            return nom
    return paliers[-1][1]
