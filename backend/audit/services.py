"""
audit/services.py — AuditService + signal handlers.

Usage (explicit logging in views):
    AuditService.log(
        action='evidence_approved',
        instance=evidence,
        company=evidence.company,
        changes={'verification_status': ['pending', 'approved']},
        metadata={'notes': notes},
    )
"""
from django.db.models.signals import post_save, post_delete, pre_save
from django.dispatch import receiver
from django.contrib.contenttypes.models import ContentType

from .middleware import get_current_user, get_current_request, get_current_company


# ─── Core service ──────────────────────────────────────────────────────────

class AuditService:
    @staticmethod
    def log(
        action: str,
        instance,
        company=None,
        changes: dict = None,
        metadata: dict = None,
        actor=None,
    ):
        """
        Write one immutable AuditLog row.

        company is resolved in priority order:
          1. Explicit `company` argument
          2. instance.company (if TenantMixin)
          3. Thread-local from AuditMiddleware
        """
        # Lazy import avoids circular imports at module load time
        from .models import AuditLog

        resolved_company = (
            company
            or getattr(instance, 'company', None)
            or get_current_company()
        )
        if resolved_company is None:
            # Nothing we can attach this to — skip silently
            return None

        resolved_actor = actor or get_current_user()
        # If the actor is anonymous or None, leave it null
        if resolved_actor and not getattr(resolved_actor, 'pk', None):
            resolved_actor = None

        actor_email = ''
        if resolved_actor:
            actor_email = resolved_actor.email or ''

        # IP / user-agent from thread-local request
        request = get_current_request()
        ip = None
        ua = ''
        if request:
            ip = _get_client_ip(request)
            ua = request.META.get('HTTP_USER_AGENT', '')[:500]

        ct = ContentType.objects.get_for_model(instance.__class__)
        obj_id = str(instance.pk) if instance.pk else ''
        obj_repr = str(instance)[:500]

        try:
            return AuditLog.objects.create(
                company=resolved_company,
                actor=resolved_actor,
                actor_email=actor_email,
                ip_address=ip,
                user_agent=ua,
                action=action,
                content_type=ct,
                object_id=obj_id,
                object_repr=obj_repr,
                resource_type=instance.__class__.__name__,
                changes=changes or {},
                metadata=metadata or {},
            )
        except Exception:
            # Never let audit logging break the main operation
            import logging
            logging.getLogger('audit').exception('Failed to write audit log')
            return None


def _get_client_ip(request):
    x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded:
        return x_forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


# ─── Signal helpers ────────────────────────────────────────────────────────

def _diff(old_instance, new_instance, fields_to_watch):
    """Return {field: [old, new]} for fields that changed."""
    changes = {}
    for field in fields_to_watch:
        old_val = getattr(old_instance, field, None)
        new_val = getattr(new_instance, field, None)
        if str(old_val) != str(new_val):
            # Cast to str so JSONField can serialize anything
            changes[field] = [str(old_val) if old_val is not None else None,
                               str(new_val) if new_val is not None else None]
    return changes


# ─── AppliedControl signals ────────────────────────────────────────────────

@receiver(pre_save, sender='controls.AppliedControl')
def _applied_control_pre_save(sender, instance, **kwargs):
    """Stash the pre-save snapshot so post_save can diff it."""
    if instance.pk:
        try:
            instance._pre_save_snapshot = sender.objects.get(pk=instance.pk)
        except sender.DoesNotExist:
            instance._pre_save_snapshot = None
    else:
        instance._pre_save_snapshot = None


@receiver(post_save, sender='controls.AppliedControl')
def _applied_control_post_save(sender, instance, created, **kwargs):
    if created:
        AuditService.log(
            action='control_applied',
            instance=instance,
            metadata={
                'reference_control': instance.reference_control.code,
                'status': instance.status,
            },
        )
    else:
        old = getattr(instance, '_pre_save_snapshot', None)
        if old:
            watched = ['status', 'effectiveness_rating', 'implementation_notes',
                       'has_deficiencies', 'next_review_date']
            changes = _diff(old, instance, watched)
            if not changes:
                return
            action = ('control_status_changed'
                      if 'status' in changes else 'control_updated')
            AuditService.log(
                action=action,
                instance=instance,
                changes=changes,
                metadata={'reference_control': instance.reference_control.code},
            )


@receiver(post_delete, sender='controls.AppliedControl')
def _applied_control_deleted(sender, instance, **kwargs):
    AuditService.log(
        action='control_deleted',
        instance=instance,
        metadata={'reference_control': instance.reference_control.code},
    )


# ─── Evidence signals ──────────────────────────────────────────────────────

@receiver(pre_save, sender='evidence.Evidence')
def _evidence_pre_save(sender, instance, **kwargs):
    if instance.pk:
        try:
            instance._pre_save_snapshot = sender.objects.get(pk=instance.pk)
        except sender.DoesNotExist:
            instance._pre_save_snapshot = None
    else:
        instance._pre_save_snapshot = None


@receiver(post_save, sender='evidence.Evidence')
def _evidence_post_save(sender, instance, created, **kwargs):
    if created:
        AuditService.log(
            action='evidence_uploaded',
            instance=instance,
            metadata={
                'evidence_type': instance.evidence_type,
                'file_size': instance.file_size,
            },
        )
    else:
        old = getattr(instance, '_pre_save_snapshot', None)
        if old:
            watched = ['verification_status', 'is_valid', 'name',
                       'evidence_type', 'is_confidential']
            changes = _diff(old, instance, watched)
            if not changes:
                return
            # Choose a semantic action when possible
            if 'verification_status' in changes:
                new_status = changes['verification_status'][1]
                action_map = {
                    'approved': 'evidence_approved',
                    'rejected': 'evidence_rejected',
                }
                action = action_map.get(new_status, 'evidence_updated')
            else:
                action = 'evidence_updated'
            AuditService.log(action=action, instance=instance, changes=changes)


@receiver(post_delete, sender='evidence.Evidence')
def _evidence_deleted(sender, instance, **kwargs):
    AuditService.log(action='evidence_deleted', instance=instance)


# ─── AppliedControlEvidence (link/unlink) signals ─────────────────────────

@receiver(post_save, sender='evidence.AppliedControlEvidence')
def _evidence_linked(sender, instance, created, **kwargs):
    if created:
        AuditService.log(
            action='evidence_linked',
            instance=instance,
            metadata={
                'evidence_name': instance.evidence.name,
                'control_code': instance.applied_control.reference_control.code,
                'link_type': instance.link_type,
            },
        )


@receiver(post_delete, sender='evidence.AppliedControlEvidence')
def _evidence_unlinked(sender, instance, **kwargs):
    AuditService.log(
        action='evidence_unlinked',
        instance=instance,
        metadata={
            'evidence_name': instance.evidence.name,
            'control_code': instance.applied_control.reference_control.code,
        },
    )


# ─── Risk signals ──────────────────────────────────────────────────────────

@receiver(pre_save, sender='risk.Risk')
def _risk_pre_save(sender, instance, **kwargs):
    if instance.pk:
        try:
            instance._pre_save_snapshot = sender.objects.get(pk=instance.pk)
        except sender.DoesNotExist:
            instance._pre_save_snapshot = None
    else:
        instance._pre_save_snapshot = None


@receiver(post_save, sender='risk.Risk')
def _risk_post_save(sender, instance, created, **kwargs):
    if created:
        AuditService.log(
            action='risk_created',
            instance=instance,
            metadata={
                'risk_id': instance.risk_id,
                'inherent_risk_level': instance.inherent_risk_level,
                'treatment_strategy': instance.treatment_strategy,
            },
        )
    else:
        old = getattr(instance, '_pre_save_snapshot', None)
        if old:
            watched = ['status', 'treatment_strategy', 'inherent_likelihood',
                       'inherent_impact', 'risk_category']
            changes = _diff(old, instance, watched)
            if not changes:
                return
            action = ('risk_status_changed'
                      if 'status' in changes else 'risk_updated')
            AuditService.log(action=action, instance=instance, changes=changes)


@receiver(post_delete, sender='risk.Risk')
def _risk_deleted(sender, instance, **kwargs):
    AuditService.log(action='risk_deleted', instance=instance)


# ─── Compliance signals ────────────────────────────────────────────────────

@receiver(post_save, sender='compliance.ComplianceResult')
def _compliance_calculated(sender, instance, created, **kwargs):
    if created:
        AuditService.log(
            action='compliance_calculated',
            instance=instance,
            metadata={
                'framework': instance.framework.code,
                'compliance_score': str(instance.compliance_score),
                'coverage_percentage': str(instance.coverage_percentage),
                'grade': instance.compliance_grade() if hasattr(instance, 'compliance_grade') else '',
            },
        )


@receiver(post_save, sender='compliance.FrameworkAdoption')
def _framework_adopted(sender, instance, created, **kwargs):
    if created:
        AuditService.log(
            action='framework_adopted',
            instance=instance,
            metadata={'framework': instance.framework.code},
        )
    elif getattr(instance, '_pre_save_snapshot', None):
        old = instance._pre_save_snapshot
        if old.is_certified != instance.is_certified and instance.is_certified:
            AuditService.log(
                action='framework_certified',
                instance=instance,
                metadata={
                    'framework': instance.framework.code,
                    'certification_date': str(instance.certification_date),
                },
            )


@receiver(pre_save, sender='compliance.FrameworkAdoption')
def _framework_adoption_pre_save(sender, instance, **kwargs):
    if instance.pk:
        try:
            instance._pre_save_snapshot = sender.objects.get(pk=instance.pk)
        except sender.DoesNotExist:
            instance._pre_save_snapshot = None
    else:
        instance._pre_save_snapshot = None


# ─── Membership signals ────────────────────────────────────────────────────

@receiver(post_save, sender='core.Membership')
def _membership_changed(sender, instance, created, **kwargs):
    if created:
        AuditService.log(
            action='member_joined',
            instance=instance,
            company=instance.company,
            metadata={
                'email': instance.user.email,
                'role': instance.role,
            },
        )
    # Role changes handled explicitly in views (richer context)
