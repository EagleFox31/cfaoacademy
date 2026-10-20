"""Règle de lieu Cameroun."""
from campaigns.services.place_rules import resolve_place


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
