"""Maintient `User.scope_paths` cohérent automatiquement à chaque changement d'affectation."""
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import RoleAssignment, User


def _recompute(user_id):
    user = User.objects.filter(pk=user_id).first()
    if user:  # None si l'utilisateur est lui-même en cours de suppression (cascade)
        user.recompute_scope_paths()


@receiver(post_save, sender=RoleAssignment)
def _on_assignment_saved(sender, instance, **kwargs):
    _recompute(instance.user_id)


@receiver(post_delete, sender=RoleAssignment)
def _on_assignment_deleted(sender, instance, **kwargs):
    _recompute(instance.user_id)
