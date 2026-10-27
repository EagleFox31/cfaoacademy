import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="EmailTemplate",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("key", models.CharField(max_length=96)),
                ("version", models.PositiveIntegerField(default=1)),
                ("locale", models.CharField(default="fr", max_length=8)),
                ("subject", models.CharField(max_length=255)),
                ("body_text", models.TextField()),
                ("body_html", models.TextField(blank=True)),
                ("placeholders", models.JSONField(default=list)),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={
                "ordering": ["key", "locale", "-version"],
            },
        ),
        migrations.CreateModel(
            name="OutboundMessage",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("kind", models.CharField(max_length=96)),
                ("status", models.CharField(
                    choices=[
                        ("PENDING_REVIEW", "À relire"),
                        ("APPROVED", "Approuvé"),
                        ("SENT", "Envoyé"),
                        ("FAILED", "Échec"),
                        ("REJECTED", "Rejeté"),
                    ],
                    default="PENDING_REVIEW",
                    max_length=20,
                )),
                ("source_app", models.CharField(blank=True, max_length=32)),
                ("source_ref", models.CharField(blank=True, max_length=128)),
                ("correlation_id", models.CharField(blank=True, db_index=True, max_length=160, null=True)),
                ("to", models.JSONField(default=list)),
                ("cc", models.JSONField(default=list)),
                ("reply_to", models.CharField(blank=True, max_length=254)),
                ("template_version", models.PositiveIntegerField(default=0)),
                ("locale", models.CharField(default="fr", max_length=8)),
                ("rendered_subject", models.CharField(blank=True, max_length=255)),
                ("rendered_text", models.TextField(blank=True)),
                ("rendered_html", models.TextField(blank=True)),
                ("context", models.JSONField(default=dict)),
                ("reviewed_by", models.CharField(blank=True, max_length=128)),
                ("reviewed_at", models.DateTimeField(blank=True, null=True)),
                ("reject_reason", models.TextField(blank=True)),
                ("template", models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name="messages",
                    to="outbound.emailtemplate",
                )),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="EmailSendLog",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("status", models.CharField(
                    choices=[
                        ("QUEUED", "En file"),
                        ("SENT", "Envoyé"),
                        ("FAILED", "Échec"),
                        ("BOUNCED", "Rejeté par le serveur"),
                    ],
                    default="QUEUED",
                    max_length=16,
                )),
                ("to", models.JSONField(default=list)),
                ("cc", models.JSONField(default=list)),
                ("attempts", models.PositiveIntegerField(default=0)),
                ("error", models.TextField(blank=True)),
                ("sent_at", models.DateTimeField(blank=True, null=True)),
                ("message", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="send_logs",
                    to="outbound.outboundmessage",
                )),
                ("resent_from", models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="resends",
                    to="outbound.emailsendlog",
                )),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddConstraint(
            model_name="emailtemplate",
            constraint=models.UniqueConstraint(
                fields=("key", "locale", "version"),
                name="uniq_mail_template_version",
            ),
        ),
        migrations.AddIndex(
            model_name="outboundmessage",
            index=models.Index(fields=["status", "-created_at"], name="outbound_ou_status_6a0b0d_idx"),
        ),
        migrations.AddIndex(
            model_name="outboundmessage",
            index=models.Index(fields=["kind", "status"], name="outbound_ou_kind_8f2c1a_idx"),
        ),
        migrations.AddIndex(
            model_name="outboundmessage",
            index=models.Index(fields=["source_app", "-created_at"], name="outbound_ou_source__9d4e2b_idx"),
        ),
        migrations.AddIndex(
            model_name="emailsendlog",
            index=models.Index(fields=["status", "-created_at"], name="outbound_em_status_1c3f5e_idx"),
        ),
    ]
