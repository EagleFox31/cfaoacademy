from outbound.services.backends import build_message
from outbound.services.layout import formation_sentence_html, shell_html


def _sample(**overrides):
    payload = dict(
        title="Pages manquantes",
        paragraphs=[
            "Bonjour,",
            "Il reste à compléter sur le compte rendu TS04-G3 : Résultats, Photos.",
        ],
        cta_url="https://academy.cfao.com/portail/compte-rendu",
        cta_label="Ouvrir le compte rendu",
        locale="fr",
        preheader="Pages manquantes sur TS04-G3",
    )
    payload.update(overrides)
    return shell_html(**payload)


def test_shell_follows_client_rules():
    html = _sample()
    assert 'lang="fr"' in html
    assert "mso-hide:all" in html
    assert "Pages manquantes sur TS04-G3" in html
    assert "max-width:600px" in html
    assert 'name="color-scheme" content="light"' in html
    assert "v:roundrect" in html
    assert "display:inline-block;padding:12px 22px" in html
    assert html.count("https://academy.cfao.com/portail/compte-rendu") == 2


def test_formation_sentence_names_the_course():
    html = formation_sentence_html(
        {
            "brand": "TOYOTA",
            "session_code": "TS04-G3",
            "level": "G3",
            "training_title": "Révision/réparation des organes châssis",
            "session_date": "19 au 23 janvier 2026",
            "country": "Togo",
            "missing_pages": "Résultats, Photos",
        },
        "fr",
    )
    assert "formation" in html
    assert '<strong style="font-weight:bold;">TOYOTA</strong>' in html
    assert '<strong style="font-weight:bold;">TS04-G3</strong>' in html
    assert "niveau" in html and '<strong style="font-weight:bold;">G3</strong>' in html
    assert "Révision/réparation des organes châssis" in html
    assert "19 au 23 janvier 2026" in html
    assert "Togo" in html
    assert " et " in html


def test_shell_lang_follows_locale():
    assert 'lang="en"' in _sample(locale="en", preheader="Missing pages")
    assert 'lang="pt"' in _sample(locale="pt-BR")


def test_quoted_printable_lines_stay_within_rfc2045():
    html = _sample()
    text = "Bonjour,\n\nIl reste à compléter : Résultats, Photos.\n"
    message = build_message(
        sender="CFAO Academy <helpdeskcm@cfao.com>",
        to=["jakaa-ext@cfao.com"],
        cc=[],
        subject="[CFAO Academy] Pages manquantes - TS04-G3",
        text=text,
        html=html,
    )
    raw = message.as_bytes().decode("ascii")
    too_long = [line for line in raw.splitlines() if len(line) > 76]
    assert too_long == []
