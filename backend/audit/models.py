"""
Audit Log — immutable, append-only record of every significant action.

Design principles:
  - Never updated or soft-deleted; rows are permanent.
  - Scoped per company (tenant) for multi-tenant isolation.
  - Actor/IP captured via thread-local set by AuditMiddleware.
  - object_repr gives a human-readable label even after the object is deleted.
  - changes stores {field: [old, new]} for field-level diffs on UPDATE.
"""
import uuid
from django.db import models
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType


class AuditLog(models.Model):
    # ── Identity ──────────────────────────────────────────────────────────────
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # ── Tenant scope ──────────────────────────────────────────────────────────
    company = models.ForeignKey(
        'core.Company',
        on_delete=models.CASCADE,
        related_name='audit_logs',
        db_index=True,
    )

    # ── Actor ─────────────────────────────────────────────────────────────────
    actor = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_actions',
    )
    actor_email = models.EmailField(
        blank=True,
        help_text='Snapshot of email at time of action (preserved if user deleted)',
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True)

    # ── Action ────────────────────────────────────────────────────────────────
    ACTION_CHOICES = [
        # Controls
        ('control_applied',        'Control Applied'),
        ('control_updated',        'Control Updated'),
        ('control_deleted',        'Control Deleted'),
        ('control_status_changed', 'Control Status Changed'),
        # Evidence
        ('evidence_uploaded',      'Evidence Uploaded'),
        ('evidence_updated',       'Evidence Updated'),
        ('evidence_deleted',       'Evidence Deleted'),
        ('evidence_approved',      'Evidence Approved'),
        ('evidence_rejected',      'Evidence Rejected'),
        ('evidence_downloaded',    'Evidence Downloaded'),
        ('evidence_linked',        'Evidence Linked to Control'),
        ('evidence_unlinked',      'Evidence Unlinked from Control'),
        # Risk
        ('risk_created',           'Risk Created'),
        ('risk_updated',           'Risk Updated'),
        ('risk_deleted',           'Risk Deleted'),
        ('risk_status_changed',    'Risk Status Changed'),
        ('risk_assessed',          'Risk Assessed'),
        # Compliance
        ('compliance_calculated',  'Compliance Calculated'),
        ('framework_adopted',      'Framework Adopted'),
        ('framework_certified',    'Framework Certified'),
        # Members
        ('member_invited',         'Member Invited'),
        ('member_joined',          'Member Joined'),
        ('member_role_changed',    'Member Role Changed'),
        ('member_removed',         'Member Removed'),
        # Generic fallback
        ('created',                'Created'),
        ('updated',                'Updated'),
        ('deleted',                'Deleted'),
    ]
    action = models.CharField(max_length=60, choices=ACTION_CHOICES, db_index=True)

    # ── Target object (generic FK) ────────────────────────────────────────────
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    object_id = models.CharField(max_length=36, blank=True, db_index=True)
    content_object = GenericForeignKey('content_type', 'object_id')

    # Human-readable snapshot (survives object deletion)
    object_repr = models.CharField(
        max_length=500,
        blank=True,
        help_text='str() of the object at time of action',
    )
    resource_type = models.CharField(
        max_length=100,
        blank=True,
        db_index=True,
        help_text='e.g. "AppliedControl", "Evidence", "Risk"',
    )

    # ── Payload ───────────────────────────────────────────────────────────────
    changes = models.JSONField(
        default=dict,
        blank=True,
        help_text='{"field": ["old_value", "new_value"]} for updates; full data for creates',
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text='Extra context: framework codes, link types, etc.',
    )

    # ── Timestamp ─────────────────────────────────────────────────────────────
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'audit_logs'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['company', '-timestamp']),
            models.Index(fields=['company', 'action']),
            models.Index(fields=['company', 'resource_type']),
            models.Index(fields=['actor', '-timestamp']),
        ]

    def __str__(self):
        actor = self.actor_email or 'system'
        return f"[{self.timestamp:%Y-%m-%d %H:%M}] {actor} → {self.action} {self.object_repr}"

    # Prevent any update/delete on AuditLog rows
    def save(self, *args, **kwargs):
        if self.pk and AuditLog.objects.filter(pk=self.pk).exists():
            raise ValueError('AuditLog entries are immutable.')
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError('AuditLog entries cannot be deleted.')
