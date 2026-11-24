"""Jeux de données synthétiques. Le vrai classeur métier n'est jamais versionné."""
import io

import pytest
from openpyxl import Workbook

from referential.models import Brand, BrandAlias, Country, Trainer, TrainerAlias
from referential.normalize import norm_key

DATA_HEADERS = [
    "MARQUE", "TYPE", "CODE", "RÉFÉRENCE", "MODULE DE FORMATION", "PAYS HOTE", "LIEU",
    "DEBUT", "FIN", "FORMATEUR", "NBRE JOUR FORMATION", "NB HEURE PAR SESSION",
    "NB PLACE PAR SESSION", "NB HEURE DE FORMATION",
]


def workbook_bytes(rows, headers=DATA_HEADERS, sheet="Data", extra_sheets=("Calendrier-Motors",)):
    wb = Workbook()
    wb.active.title = extra_sheets[0] if extra_sheets else sheet
    for name in extra_sheets[1:]:
        wb.create_sheet(name)
    ws = wb.create_sheet(sheet) if extra_sheets else wb.active
    ws.append(headers)
    for row in rows:
        ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


@pytest.fixture
def referential(db):
    toyota = Brand.objects.create(code="toyota", label="TOYOTA", pole="MOTORS")
    omoda = Brand.objects.create(code="omoda-jaecoo", label="OMODA & JAECOO", pole="MOTORS")
    BrandAlias.objects.create(alias_norm=norm_key("OMODA & JAEECO"), brand=omoda)
    cm = Country.objects.create(code="cm", label="Cameroun", org_path=["cfao", "cm"])
    Country.objects.create(code="ci", label="Côte d'Ivoire", org_path=["cfao", "ci"])
    from referential.models import CountryAlias

    CountryAlias.objects.create(alias_norm="CFR", country=cm)
    CountryAlias.objects.create(alias_norm="RCI", country=Country.objects.get(code="ci"))
    eugene = Trainer.objects.create(full_name="Eugène EBENE", name_norm=norm_key("Eugène EBENE"),
                                    service="MOTORS")
    TrainerAlias.objects.create(alias_norm="EUGENE", trainer=eugene)
    lucien = Trainer.objects.create(full_name="Lucien GAGNE", name_norm=norm_key("Lucien GAGNE"),
                                    service="MOTORS")
    return {"toyota": toyota, "omoda": omoda, "cm": cm, "eugene": eugene, "lucien": lucien}
