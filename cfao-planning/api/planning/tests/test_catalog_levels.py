"""Niveau des modules : lu et corrigé au catalogue, dans le barème de chaque marque."""
import io
from types import SimpleNamespace

import pytest
import requests
from openpyxl import load_workbook

from planning.clients import needs as client
from planning.exports.xlsx import country_workbook
from planning.services import cost_key_cells as cells
from planning.services.cost_key_global import JOB_BY_FAMILY, consolidate_sheet

BASE = "http://needs.test"


class _Response:
    def __init__(self, payload, status_code=200):
        self.status_code, self._payload = status_code, payload

    def json(self):
        return self._payload


class _Resolver:
    ALIASES = {"TOYOTA": "toyota", "CITROEN": "stellantis", "PEUGEOT": "stellantis"}

    def brand(self, label):
        code = self.ALIASES.get(label)
        return SimpleNamespace(obj=SimpleNamespace(code=code)) if code else None


def _line(id_, brand, code, label, tier, sort_order):
    return {"id": id_, "brand": brand, "code": code, "level_label": label, "tier": tier, "sort_order": sort_order}


@pytest.fixture
def catalog(monkeypatch, settings):
    settings.NEEDS_API_URL, settings.NEEDS_ANALYTICS_KEY = BASE, "key"
    monkeypatch.setattr(client, "Resolver", _Resolver)

    def serve(*lines):
        payload = {"year": 2027, "catalog_available": True, "lines": list(lines)}
        return client._parse_catalog_levels(payload)

    return serve


def test_chaque_marque_garde_son_bareme_et_son_ordre(catalog):
    levels = catalog(
        _line("1", "TOYOTA", "TS01-G4", "G4", "JUNIOR", 10),
        _line("2", "TOYOTA", "TS02-G3", "G3", "SENIOR", 30),
        _line("3", "TOYOTA", "TS03", "Senior", "SENIOR", 40),
        _line("4", "TOYOTA", "TS04-G1", "G1", "EXPERT", 50),
        _line("5", "TOYOTA", "TS05", "", None, 60),
        _line("6", "CITROEN", "SS01", "BASIC", "JUNIOR", 10),
    )
    toyota = levels.module("toyota", "TS01-G4")
    assert toyota.scale == ("G4", "G3", "Senior", "G1")
    assert (toyota.label, toyota.tier, toyota.order) == ("G4", "JUNIOR", 0)
    assert levels.module("toyota", "TS04-G1").order == 3
    assert levels.module("toyota", "TS05").order == 4  # sans niveau : après le barème
    assert levels.module("stellantis", "SS01").scale == ("BASIC",)


def test_un_module_multi_marques_est_corrige_d_un_seul_tenant(catalog):
    levels = catalog(_line("c", "CITROEN", "SS01", "BASIC", "JUNIOR", 10),
                     _line("p", "PEUGEOT", "SS01", "BASIC", "JUNIOR", 10))
    assert levels.module("stellantis", "SS01").line_ids == ("c", "p")


def test_la_famille_du_catalogue_donne_le_metier(catalog):
    levels = catalog({**_line("1", "TOYOTA", "TP03", "", "", 1), "family": "process-parts-motors"})
    assert levels.module("toyota", "TP03").family == "process-parts-motors"
    assert JOB_BY_FAMILY[levels.module("toyota", "TP03").family] == "PARTS"


def test_un_catalogue_sans_famille_reste_lisible(catalog):
    assert catalog(_line("1", "TOYOTA", "TS01", "G4", "JUNIOR", 1)).module("toyota", "TS01").family == ""


def test_marque_inconnue_ignoree(catalog):
    assert catalog(_line("1", "INCONNUE", "X1", "A", "JUNIOR", 1)).modules == {}


def test_catalogue_injoignable(monkeypatch, settings, db):
    settings.NEEDS_API_URL, settings.NEEDS_ANALYTICS_KEY = BASE, "key"

    def down(*a, **k):
        raise requests.ConnectionError("down")

    monkeypatch.setattr(client.requests, "get", down)
    client.reset_refresh_clock()
    assert client.fetch_catalog_levels(2027).available is False


@pytest.mark.parametrize("status,payload,raised", [
    (409, {"current": "G3"}, client.CatalogLevelConflict),
    (400, {"detail": "label_not_in_scale"}, client.CatalogLevelRejected),
    (503, {}, client.CatalogUnavailable),
])
def test_refus_du_catalogue(monkeypatch, settings, status, payload, raised):
    settings.NEEDS_API_URL, settings.NEEDS_CATALOG_WRITE_KEY = BASE, "write"
    monkeypatch.setattr(client.requests, "post", lambda *a, **k: _Response(payload, status))
    with pytest.raises(raised):
        client.update_catalog_level(("a",), "G4", "G3")


def test_sans_cle_d_ecriture_aucun_appel(settings):
    settings.NEEDS_API_URL, settings.NEEDS_CATALOG_WRITE_KEY = BASE, ""
    with pytest.raises(client.CatalogUnavailable):
        client.update_catalog_level(("a",), "G4", "G3")


# ── saisie ──────────────────────────────────────────────────────────────────

KEY = SimpleNamespace(year=2027)
ROW = SimpleNamespace(pk="s1", brand_id=1, brand=SimpleNamespace(code="toyota"), code_norm="TS01-G4")
MODULE = client.ModuleLevel(label="G4", tier="JUNIOR", order=0, line_ids=("l1",), scale=("G4", "G3"))


@pytest.fixture
def journal(monkeypatch):
    entries = []
    monkeypatch.setattr(cells, "latest_edit", lambda *a: None)
    monkeypatch.setattr(cells, "fetch_catalog_levels",
                        lambda year: client.CatalogLevels(True, {("toyota", "TS01-G4"): MODULE}))
    monkeypatch.setattr(cells.PlannedCellEdit.objects, "create",
                        lambda **kw: entries.append(kw) or SimpleNamespace(created_at="now"))
    return entries


def _write(monkeypatch, outcome):
    def update(line_ids, expected, value):
        if isinstance(outcome, Exception):
            raise outcome
        return outcome

    monkeypatch.setattr(cells, "update_catalog_level", update)
    return cells._edit_level(KEY, ROW, "G4", "G3", "u1", "Coordinateur")


def test_niveau_ecrit_et_journalise(monkeypatch, journal):
    result = _write(monkeypatch, {"changed": True, "level_label": "G3", "tier": "SENIOR"})
    assert (result.changed, result.value) == (True, "G3")
    assert [(e["field"], e["old_value"], e["new_value"]) for e in journal] == [("level", "G4", "G3")]


def test_niveau_inchange_rien_au_journal(monkeypatch, journal):
    assert _write(monkeypatch, {"changed": False, "level_label": "G3", "tier": "SENIOR"}).changed is False
    assert journal == []


def test_conflit_rend_la_valeur_en_base(monkeypatch, journal):
    with pytest.raises(cells.CellConflict) as exc:
        _write(monkeypatch, client.CatalogLevelConflict("G1"))
    assert exc.value.details["current"] == "G1"
    assert journal == []


@pytest.mark.parametrize("raised,code", [
    (client.CatalogLevelRejected(), "LEVEL_NOT_IN_SCALE"),
    (client.CatalogUnavailable(), "CATALOG_UNAVAILABLE"),
])
def test_refus_traduit_en_erreur_de_saisie(monkeypatch, journal, raised, code):
    with pytest.raises(cells.CellInvalid) as exc:
        _write(monkeypatch, raised)
    assert exc.value.code == code


def test_module_hors_catalogue_non_modifiable(monkeypatch, journal):
    other = SimpleNamespace(pk="s2", brand_id=1, brand=ROW.brand, code_norm="ABSENT")
    with pytest.raises(cells.CellInvalid) as exc:
        cells._edit_level(KEY, other, "", "G3", "u1", "Coordinateur")
    assert exc.value.code == "LEVEL_NOT_IN_CATALOG"


# ── restitution ─────────────────────────────────────────────────────────────

def test_la_fiche_tous_poles_garde_les_niveaux_contigus():
    line = lambda code, order: {"brand": "TOYOTA", "level_order": order, "code": code, "start_date": None}
    keys = ("seats", "share", "key_cost", "trainee_lodging", "trainer_lodging", "total", "needs", "coverage",
            "in_subsidiary", "at_academy", "postponed")
    base = {"year": 2027, "mode": "PLANNED", "status": "DRAFT"}
    sheets = [{**base, "sessions": [line("A9", 0), line("B1", 999)]},
              {**base, "sessions": [line("A1", 2), line("A5", 1)]}]
    row = {"country": "cog", "label": "Congo", "enrolled": 1, **{k: 0 for k in keys}}
    assert [s["code"] for s in consolidate_sheet(sheets, row)["sessions"]] == ["A9", "A5", "A1", "B1"]


def test_l_export_du_devis_garde_le_libelle_du_bareme():
    footer = {"share": 0.5, "key_cost": 1, "trainee_lodging": 2, "trainer_lodging": 3, "total": 6,
              "in_subsidiary": 0, "at_academy": 12, "postponed": 0}
    session = {"brand": "TOYOTA", "level": "BASIC", "code": "TS01-G4", "title": "Moteur", "start_date": None,
               "end_date": None, "trainers": "", "location": "Douala", "seats": 6, "seat_status": "at_academy"}
    sheet = {"label": "Congo", "year": 2027, "pole": "MOTORS", "mode": "PLANNED", "status": "DRAFT",
             "sessions": [session, {**session, "level": None}], "footer": footer}
    ws = load_workbook(io.BytesIO(country_workbook(sheet))).active
    assert [ws.cell(row=2, column=c).value for c in (1, 2, 3, 9)] == ["Marque", "Niveau", "Code", "Places"]
    assert ws.cell(row=3, column=2).value == "BASIC"
    assert ws.cell(row=4, column=2).value in (None, "")
    assert ws.cell(row=5, column=9).value == "=SUM(I3:I4)"
    # Le récapitulatif sous le tableau : libellé centré sur deux colonnes, le montant à côté.
    labels = {ws.cell(row=r, column=7).value: r for r in range(7, 15)}
    assert list(labels) == ["En filiale", "À l'Academy", "Reportées", "Part", "Coût de formation des stagiaires",
                            "Frais d'accommodation des stagiaires", "Frais d'accommodation formateurs", "Total à payer"]
    assert {f"G{r}:H{r}" for r in labels.values()} <= {str(m) for m in ws.merged_cells.ranges}
    assert all(ws.cell(row=r, column=7).alignment.horizontal == "center" for r in labels.values())
    assert ws.cell(row=labels["Total à payer"], column=9).value == 6
