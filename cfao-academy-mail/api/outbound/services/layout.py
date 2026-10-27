"""Coque HTML pour un mail transactionnel lu par Outlook et les autres clients.

Outlook ignore background et padding sur un <a>. Le bouton Outlook est une
forme VML ; les autres clients ont un lien dont le padding est la zone cliquable.
La carte est fluide (100 %, plafond 600 px). Le mode clair est déclaré pour
que les clients n'inversent pas le fond blanc et le bouton rouge.
"""

from __future__ import annotations

from html import escape

BRAND = "#c8102e"
INK = "#0e1126"
MUTED = "#5c6370"
PAGE = "#f4f5f7"

_PREHEADER_PAD = ("&#847;&zwnj;&nbsp;" * 24)


def _lang(locale: str) -> str:
    code = (locale or "fr").replace("_", "-").split("-", 1)[0].lower()
    if len(code) == 2 and code.isalpha():
        return code
    return "fr"


def _b(value: str) -> str:
    return f'<strong style="font-weight:bold;">{escape(value)}</strong>'


def _bold_list(value: str, locale: str = "fr") -> str:
    items = [part.strip() for part in (value or "").split(",") if part.strip()]
    bolded = [_b(part) for part in items]
    if not bolded:
        return ""
    if len(bolded) == 1:
        return bolded[0]
    conj = "and" if locale.startswith("en") else "et"
    return ", ".join(bolded[:-1]) + f" {conj} " + bolded[-1]


def _formation_fields(context: dict) -> dict | None:
    fields = {
        "brand": (context.get("brand") or "").strip(),
        "code": (context.get("session_code") or "").strip(),
        "level": (context.get("level") or "").strip(),
        "title": (context.get("training_title") or "").strip(),
        "date": (context.get("session_date") or "").strip(),
        "country": (context.get("country") or "").strip(),
    }
    if not all(fields.values()):
        return None
    fields["missing"] = (context.get("missing_pages") or "").strip()
    return fields


def formation_sentence_text(context: dict, locale: str = "fr") -> str:
    fields = _formation_fields(context)
    if fields is None:
        return ""
    if locale.startswith("en"):
        lead = f"Still to complete {fields['missing']} on the training report for the " if fields["missing"] else "Training report for the "
        return (
            f"{lead}course {fields['brand']} {fields['code']}, level {fields['level']}, "
            f"{fields['title']}, on {fields['date']}, in {fields['country']}."
        )
    lead = (
        f"Il reste à compléter {fields['missing']} sur le compte rendu de la "
        if fields["missing"]
        else "Compte rendu de la "
    )
    return (
        f"{lead}formation {fields['brand']} {fields['code']}, niveau {fields['level']}, "
        f"{fields['title']}, du {fields['date']}, au {fields['country']}."
    )


def formation_sentence_html(context: dict, locale: str = "fr") -> str:
    fields = _formation_fields(context)
    if fields is None:
        return ""
    if locale.startswith("en"):
        missing = _bold_list(fields["missing"], locale)
        lead = f"Still to complete {missing} on the training report for the " if missing else "Training report for the "
        return (
            f"{lead}course {_b(fields['brand'])} {_b(fields['code'])}, level {_b(fields['level'])}, "
            f"{_b(fields['title'])}, on {_b(fields['date'])}, in {_b(fields['country'])}."
        )
    missing = _bold_list(fields["missing"], locale)
    lead = (
        f"Il reste à compléter {missing} sur le compte rendu de la "
        if missing
        else "Compte rendu de la "
    )
    return (
        f"{lead}formation {_b(fields['brand'])} {_b(fields['code'])}, niveau {_b(fields['level'])}, "
        f"{_b(fields['title'])}, du {_b(fields['date'])}, au {_b(fields['country'])}."
    )


def _button_width(label: str) -> int:
    # Arial 15 px gras, environ 9 px par caractère, plus le padding horizontal.
    return max(160, min(520, 9 * len(label) + 48))


def button_html(url: str, label: str) -> str:
    href = escape(url, quote=True)
    text = escape(label)
    width = _button_width(label)
    return (
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="mail-button">\n'
        "<tr>\n"
        f'<td align="center" bgcolor="{BRAND}" class="mail-button" '
        f'style="background-color:{BRAND};">\n'
        "<!--[if mso]>\n"
        '<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" '
        'xmlns:w="urn:schemas-microsoft-com:office:word" '
        f'href="{href}" style="height:44px;v-text-anchor:middle;width:{width}px;" '
        f'arcsize="6%" stroke="f" fillcolor="{BRAND}">\n'
        "<w:anchorlock/>\n"
        '<center style="color:#ffffff;font-family:Arial,sans-serif;'
        f'font-size:15px;font-weight:bold;">{text}</center>\n'
        "</v:roundrect>\n"
        "<![endif]-->\n"
        "<!--[if !mso]><!-->\n"
        f'<a href="{href}" class="mail-button" '
        'style="display:inline-block;padding:12px 22px;'
        "font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;"
        f"line-height:20px;color:#ffffff;text-decoration:none;background-color:{BRAND};"
        f'border:1px solid {BRAND};">\n'
        f'<font color="#ffffff" face="Arial">{text}</font>\n'
        "</a>\n"
        "<!--<![endif]-->\n"
        "</td>\n"
        "</tr>\n"
        "</table>\n"
    )


def shell_html(
    *,
    title: str,
    paragraphs: list[str] | None = None,
    html_paragraphs: list[str] | None = None,
    cta_url: str = "",
    cta_label: str = "",
    footer: str = "CFAO Academy - message automatique",
    locale: str = "fr",
    preheader: str = "",
    kicker: str = "CFAO ACADEMY",
) -> str:
    lang = _lang(locale)
    paragraphs = paragraphs or []
    preview = preheader.strip() or next((p.strip() for p in paragraphs if p.strip()), title)
    blocks = []
    sources = html_paragraphs if html_paragraphs is not None else [escape(p) for p in paragraphs]
    for paragraph in sources:
        if not str(paragraph).strip():
            continue
        blocks.append(
            '<tr><td class="mail-text" style="padding:12px 32px 0;font-family:Arial,Helvetica,sans-serif;'
            f'font-size:16px;line-height:24px;color:{INK};">\n'
            f"{paragraph}\n"
            "</td></tr>\n"
        )
    if cta_url and cta_label:
        blocks.append(
            '<tr><td style="padding:24px 32px 8px;">\n'
            f"{button_html(cta_url, cta_label)}"
            "</td></tr>\n"
        )
    safe_title = escape(title)
    safe_footer = escape(footer)
    safe_preview = escape(preview)
    body = "".join(blocks)
    return (
        "<!DOCTYPE html>\n"
        f'<html lang="{lang}" xmlns:v="urn:schemas-microsoft-com:vml" '
        'xmlns:o="urn:schemas-microsoft-com:office:office">\n'
        "<head>\n"
        '<meta http-equiv="Content-Type" content="text/html; charset=utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
        '<meta name="color-scheme" content="light">\n'
        '<meta name="supported-color-schemes" content="light">\n'
        "<!--[if mso]>\n"
        "<xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch>"
        "</o:OfficeDocumentSettings></xml>\n"
        "<![endif]-->\n"
        "<style>\n"
        ":root { color-scheme: light; supported-color-schemes: light; }\n"
        "@media (prefers-color-scheme: dark) {\n"
        f"  .mail-page {{ background-color: {PAGE} !important; }}\n"
        "  .mail-card { background-color: #ffffff !important; }\n"
        f"  .mail-card .mail-text {{ color: {INK} !important; }}\n"
        f"  .mail-kicker {{ color: {BRAND} !important; }}\n"
        f"  .mail-muted {{ color: {MUTED} !important; }}\n"
        f"  .mail-button, .mail-button a {{ background-color: {BRAND} !important; }}\n"
        "  .mail-button a, .mail-button font { color: #ffffff !important; }\n"
        "}\n"
        "[data-ogsc] .mail-card { background-color: #ffffff !important; }\n"
        f"[data-ogsc] .mail-button {{ background-color: {BRAND} !important; }}\n"
        "[data-ogsc] .mail-button font { color: #ffffff !important; }\n"
        "</style>\n"
        "</head>\n"
        f'<body class="mail-page" style="margin:0;padding:0;background-color:{PAGE};">\n'
        f'<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;'
        f'opacity:0;overflow:hidden;mso-hide:all;">{safe_preview}{_PREHEADER_PAD}</div>\n'
        f'<table role="presentation" class="mail-page" width="100%" cellpadding="0" cellspacing="0" '
        f'border="0" bgcolor="{PAGE}" style="background-color:{PAGE};">\n'
        '<tr><td align="center" style="padding:24px 12px;">\n'
        "<!--[if mso]>\n"
        '<table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0">'
        "<tr><td>\n"
        "<![endif]-->\n"
        '<table role="presentation" class="mail-card" width="100%" cellpadding="0" cellspacing="0" '
        'border="0" bgcolor="#ffffff" style="max-width:600px;width:100%;background-color:#ffffff;">\n'
        '<tr><td class="mail-kicker" style="padding:28px 32px 0;font-family:Arial,Helvetica,sans-serif;'
        f'font-size:12px;line-height:18px;font-weight:bold;color:{BRAND};">\n'
        f"{escape(kicker)}\n"
        "</td></tr>\n"
        '<tr><td class="mail-text" style="padding:8px 32px 4px;font-family:Arial,Helvetica,sans-serif;'
        f'font-size:22px;line-height:28px;font-weight:bold;color:{INK};">\n'
        f"{safe_title}\n"
        "</td></tr>\n"
        f"{body}"
        '<tr><td class="mail-muted" style="padding:16px 32px 28px;font-family:Arial,Helvetica,sans-serif;'
        f'font-size:13px;line-height:20px;color:{MUTED};">\n'
        f"{safe_footer}\n"
        "</td></tr>\n"
        "</table>\n"
        "<!--[if mso]></td></tr></table><![endif]-->\n"
        "</td></tr>\n"
        "</table>\n"
        "</body>\n"
        "</html>\n"
    )


def paragraphs_from_text(text: str, url: str = "") -> list[str]:
    """Retire l'URL nue : elle devient le bouton, pas une ligne de texte."""
    paragraphs = []
    for block in (text or "").replace("\r\n", "\n").split("\n\n"):
        lines = [
            line.strip()
            for line in block.split("\n")
            if line.strip() and line.strip() != url.strip()
        ]
        if lines:
            paragraphs.append(" ".join(lines))
    return paragraphs
