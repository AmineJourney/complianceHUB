import uuid
import secrets
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone
from datetime import timedelta


class TimeStampedModel(models.Model):
    """Abstract base model with timestamps"""
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class SoftDeleteModel(models.Model):
    """Abstract base model with soft delete"""
    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        abstract = True

    def delete(self, using=None, keep_parents=False, hard=False):
        if hard:
            super().delete(using=using, keep_parents=keep_parents)
        else:
            self.is_deleted = True
            self.deleted_at = timezone.now()
            self.save()


class Company(TimeStampedModel, SoftDeleteModel):
    PLAN_CHOICES = [
        ('free', 'Free'),
        ('starter', 'Starter'),
        ('professional', 'Professional'),
        ('enterprise', 'Enterprise'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)
    plan = models.CharField(max_length=20, choices=PLAN_CHOICES, default='free')
    is_active = models.BooleanField(default=True, db_index=True)
    max_users = models.IntegerField(default=5)
    max_storage_mb = models.IntegerField(default=1000)

    class Meta:
        db_table = 'companies'
        verbose_name_plural = 'Companies'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['is_active', '-created_at']),
        ]

    def __str__(self):
        return self.name

    def clean(self):
        if self.max_users < 1:
            raise ValidationError({'max_users': 'Must be at least 1'})


class User(AbstractUser, TimeStampedModel, SoftDeleteModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    username = models.CharField(max_length=150)
    phone_number = models.CharField(max_length=20, blank=True)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    email_verified = models.BooleanField(default=False)
    email_verification_token = models.CharField(max_length=255, blank=True)
    last_login_ip = models.GenericIPAddressField(null=True, blank=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    class Meta:
        db_table = 'users'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['is_active', '-created_at']),
        ]

    def __str__(self):
        return self.email


class Membership(TimeStampedModel, SoftDeleteModel):
    ROLE_CHOICES = [
        ('owner', 'Owner'),
        ('admin', 'Administrator'),
        ('manager', 'Manager'),
        ('analyst', 'Analyst'),
        ('auditor', 'Auditor'),
        ('viewer', 'Viewer'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='memberships')
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='memberships')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    is_active = models.BooleanField(default=True, db_index=True)
    invited_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sent_invitations'
    )
    invitation_accepted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'memberships'
        unique_together = [['user', 'company']]
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'company']),
            models.Index(fields=['company', 'role']),
        ]

    def __str__(self):
        return f"{self.user.email} - {self.company.name} ({self.role})"

    def clean(self):
        if self.user.is_deleted or self.company.is_deleted:
            raise ValidationError('Cannot create membership with deleted user or company')
        if not self.pk:
            active_memberships = Membership.objects.filter(
                company=self.company,
                is_deleted=False
            ).count()
            if active_memberships >= self.company.max_users:
                raise ValidationError(
                    f'Company has reached maximum user limit ({self.company.max_users})'
                )


def _default_invite_expiry():
    return timezone.now() + timedelta(days=7)


def _default_reset_expiry():
    return timezone.now() + timedelta(hours=1)


class Invitation(TimeStampedModel):
    """
    Token-based invitation to join a company.
    No email required — the inviter copies the link and shares it manually.
    """
    ROLE_CHOICES = Membership.ROLE_CHOICES

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='invitations'
    )
    invited_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='created_invitations'
    )

    # Optional: restrict which email can use this link
    email = models.EmailField(
        blank=True,
        help_text='If set, only this email can accept the invite'
    )

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='viewer')

    # The secret token embedded in the shareable link
    token = models.CharField(
        max_length=64,
        unique=True,
        default=secrets.token_urlsafe
    )

    expires_at = models.DateTimeField(default=_default_invite_expiry)

    accepted_at = models.DateTimeField(null=True, blank=True)
    accepted_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='accepted_invitations'
    )

    is_revoked = models.BooleanField(default=False, db_index=True)

    class Meta:
        db_table = 'invitations'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['token']),
            models.Index(fields=['company', '-created_at']),
        ]

    def __str__(self):
        return f"Invite to {self.company.name} ({self.role}) by {self.invited_by.email}"

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at

    @property
    def is_valid(self):
        return not self.is_revoked and not self.is_expired and self.accepted_at is None

    def accept(self, user):
        """Mark invitation as accepted and create/update membership."""
        if not self.is_valid:
            raise ValidationError('This invitation is no longer valid.')

        if self.email and self.email.lower() != user.email.lower():
            raise ValidationError('This invitation was issued for a different email address.')

        # Check if membership already exists
        membership, created = Membership.objects.get_or_create(
            user=user,
            company=self.company,
            defaults={
                'role': self.role,
                'invited_by': self.invited_by,
                'invitation_accepted_at': timezone.now(),
                'is_active': True,
                'is_deleted': False,
            }
        )

        if not created:
            if not membership.is_deleted:
                raise ValidationError('You are already a member of this company.')
            # Re-activate soft-deleted membership
            membership.is_deleted = False
            membership.deleted_at = None
            membership.role = self.role
            membership.invited_by = self.invited_by
            membership.invitation_accepted_at = timezone.now()
            membership.is_active = True
            membership.save()

        self.accepted_at = timezone.now()
        self.accepted_by = user
        self.save()

        return membership


class PasswordResetToken(TimeStampedModel):
    """
    Single-use token for password reset.
    Expires after 1 hour. used_at is stamped on successful reset (prevents reuse).

    Without SMTP: in DEBUG mode the API returns the reset link directly in the
                  response so you can paste it into the browser.
    With SMTP:    set EMAIL_BACKEND + credentials in settings.py and the link
                  will be emailed automatically instead.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='password_reset_tokens'
    )
    token = models.CharField(
        max_length=64,
        unique=True,
        default=secrets.token_urlsafe
    )
    expires_at = models.DateTimeField(default=_default_reset_expiry)
    used_at = models.DateTimeField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        db_table = 'password_reset_tokens'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['token']),
            models.Index(fields=['user', '-created_at']),
        ]

    def __str__(self):
        return f"Reset token for {self.user.email}"

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at

    @property
    def is_valid(self):
        return self.used_at is None and not self.is_expired

    def use(self):
        """Mark token as consumed so it cannot be reused."""
        self.used_at = timezone.now()
        self.save(update_fields=['used_at'])


# Permission matrix (kept for reference by permission classes)
ROLE_PERMISSIONS = {
    'owner': ['*'],
    'admin': [
        'view_any', 'create_any', 'update_any', 'delete_any',
        'manage_users', 'manage_settings'
    ],
    'manager': [
        'view_any', 'create_any', 'update_own', 'delete_own',
        'assign_controls', 'manage_risks'
    ],
    'analyst': [
        'view_any', 'create_evidence', 'update_own', 'assess_risks'
    ],
    'auditor': [
        'view_any', 'export_reports', 'view_evidence'
    ],
    'viewer': [
        'view_own', 'view_assigned'
    ],
}