"""Règle de lieu Cameroun."""
from types import SimpleNamespace
from unittest.mock import patch

from campaigns.services.place_rules import resolve_place
from campaigns.services.summary import submission_summary


def test_cameroon_small_group_douala_only():
    assert resolve_place("Cameroun", 0, "FILIALE") == "CFR"
    assert resolve_place("Cameroun", 6, "FILIALE") == "CFR"
    assert resolve_place("Cameroun", 1, "CFR") == "CFR"


def test_cameroon_large_group_may_choose():
    assert resolve_place("Cameroun", 7, "CFR") == "CFR"
    assert resolve_place("Cameroun", 7, "FILIALE") == "FILIALE"
    assert resolve_place("Cameroun", 12, "FILIALE") == "FILIALE"


def test_other_countries_keep_requested_place():
    assert resolve_place("Côte d'Ivoire", 3, "CFR") == "CFR"
    assert resolve_place("Côte d'Ivoire", 3, "FILIALE") == "FILIALE"
    assert resolve_place("Gabon", 10, "CFR") == "CFR"


def test_remote_kept_except_small_cameroon_group():
    assert resolve_place("Madagascar", 1, "DISTANCE") == "DISTANCE"
    assert resolve_place("Cameroun", 7, "DISTANCE") == "DISTANCE"
    assert resolve_place("Cameroun", 6, "DISTANCE") == "CFR"


def test_summary_counts_remote_places():
    line = SimpleNamespace(
        is_empty=False, total=4, catalog_line=SimpleNamespace(family=SimpleNamespace(label="PART")),
        q1=0, q2=4, q3=0, q4=0, place_q1="CFR", place_q2="DISTANCE", place_q3="CFR", place_q4="CFR",
    )
    with patch("campaigns.services.summary.NeedLine") as need_line:
        need_line.objects.filter.return_value.select_related.return_value = [line]
        summary = submission_summary(object())
    assert summary["by_place"] == {"CFR": 0, "FILIALE": 0, "DISTANCE": 4}
