import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.core.exceptions import ValidationError


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
        """Override delete to implement soft delete"""
        if hard:
            super().delete(using=using, keep_parents=keep_parents)
        else:
            from django.utils import timezone
            self.is_deleted = True
            self.deleted_at = timezone.now()
            self.save()


class Company(TimeStampedModel, SoftDeleteModel):
    """
    Company/Tenant model - root of multi-tenancy isolation
    """
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
    
    # Subscription info
    max_users = models.IntegerField(default=5)
    max_storage_mb = models.IntegerField(default=1000)  # 1GB
    
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
        """Validate company data"""
        if self.max_users < 1:
            raise ValidationError({'max_users': 'Must be at least 1'})


class User(AbstractUser, TimeStampedModel, SoftDeleteModel):
    """
    Extended user model with UUID primary key
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    
    # Override username to make it non-unique (unique per company via Membership)
    username = models.CharField(max_length=150)
    
    # Profile fields
    phone_number = models.CharField(max_length=20, blank=True)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    
    # Email verification
    email_verified = models.BooleanField(default=False)
    email_verification_token = models.CharField(max_length=255, blank=True)
    
    # Last activity tracking
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
    """
    User-Company-Role association for multi-tenancy and RBAC
    """
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
    
    # Invitation tracking
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
        """Validate membership"""
        if self.user.is_deleted or self.company.is_deleted:
            raise ValidationError('Cannot create membership with deleted user or company')
        
        # Check company user limit
        if not self.pk:  # New membership
            active_memberships = Membership.objects.filter(
                company=self.company,
                is_deleted=False
            ).count()
            if active_memberships >= self.company.max_users:
                raise ValidationError(
                    f'Company has reached maximum user limit ({self.company.max_users})'
                )


# Permission matrix
ROLE_PERMISSIONS = {
    'owner': ['*'],  # Full access
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