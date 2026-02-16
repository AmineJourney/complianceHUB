import uuid
import os
from django.db import models
from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator
from core.models import TimeStampedModel, SoftDeleteModel
from core.mixins import TenantMixin
from django.core.validators import MinValueValidator, MaxValueValidator



def evidence_upload_path(instance, filename):
    """
    Generate upload path for evidence files
    Format: evidence/{company_id}/{year}/{month}/{uuid}_{filename}
    """
    import datetime
    now = datetime.datetime.now()
    
    # Clean filename
    name, ext = os.path.splitext(filename)
    clean_name = "".join(c for c in name if c.isalnum() or c in (' ', '-', '_')).strip()
    clean_name = clean_name[:100]  # Limit length
    
    return f'evidence/{instance.company.id}/{now.year}/{now.month:02d}/{uuid.uuid4().hex}_{clean_name}{ext}'


class Evidence(TenantMixin, TimeStampedModel, SoftDeleteModel):
    """
    Evidence/artifact storage for compliance documentation
    Company-scoped file storage with metadata
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Evidence identification
    name = models.CharField(
        max_length=500,
        help_text='Evidence name/title'
    )
    description = models.TextField(
        blank=True,
        help_text='Evidence description'
    )
    
    # File storage
    file = models.FileField(
        upload_to=evidence_upload_path,
        max_length=500,
        validators=[
            FileExtensionValidator(
                allowed_extensions=[
                    # Documents
                    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv',
                    # Images
                    'jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg',
                    # Archives
                    'zip', '7z', 'tar', 'gz',
                    # Other
                    'json', 'xml', 'yaml', 'log', 'md'
                ]
            )
        ]
    )
    
    # File metadata
    file_size = models.BigIntegerField(
        help_text='File size in bytes',
        null=True,
        blank=True
    )
    file_type = models.CharField(
        max_length=100,
        blank=True,
        help_text='MIME type'
    )
    file_hash = models.CharField(
        max_length=64,
        blank=True,
        help_text='SHA-256 hash for integrity verification'
    )
    
    # Evidence categorization
    evidence_type = models.CharField(
        max_length=50,
        choices=[
            ('policy', 'Policy Document'),
            ('procedure', 'Procedure'),
            ('screenshot', 'Screenshot'),
            ('report', 'Report'),
            ('log', 'Log File'),
            ('certificate', 'Certificate'),
            ('configuration', 'Configuration File'),
            ('scan_result', 'Scan Result'),
            ('audit_report', 'Audit Report'),
            ('training_record', 'Training Record'),
            ('other', 'Other'),
        ],
        default='other'
    )
    
    # Evidence validity
    is_valid = models.BooleanField(
        default=True,
        help_text='Whether this evidence is still valid'
    )
    validity_start_date = models.DateField(
        null=True,
        blank=True,
        help_text='When this evidence becomes valid'
    )
    validity_end_date = models.DateField(
        null=True,
        blank=True,
        help_text='When this evidence expires'
    )
    
    # Ownership and access
    uploaded_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='uploaded_evidence'
    )
    
    # Verification status
    verification_status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending Review'),
            ('approved', 'Approved'),
            ('rejected', 'Rejected'),
            ('needs_update', 'Needs Update'),
        ],
        default='pending',
        db_index=True
    )
    verified_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_evidence'
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    verification_notes = models.TextField(blank=True)
    
    # Access control
    is_confidential = models.BooleanField(
        default=False,
        help_text='Restrict access to specific roles'
    )
    
    # Tags for organization
    tags = models.JSONField(
        default=list,
        blank=True,
        help_text='Tags for categorization and search'
    )
    
    # Version control
    version = models.CharField(
        max_length=50,
        default='1.0',
        help_text='Evidence version'
    )
    previous_version = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='newer_versions'
    )
    
    class Meta:
        db_table = 'evidence'
        verbose_name_plural = 'Evidence'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['company', 'evidence_type']),
            models.Index(fields=['company', 'verification_status']),
            models.Index(fields=['company', 'uploaded_by']),
            models.Index(fields=['validity_end_date']),
            models.Index(fields=['is_valid', 'verification_status']),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.company.name})"
    
    def clean(self):
        """Validate evidence"""
        # Validate uploaded_by is member of company
        if self.uploaded_by:
            from core.models import Membership
            is_member = Membership.objects.filter(
                user=self.uploaded_by,
                company=self.company,
                is_deleted=False
            ).exists()
            
            if not is_member:
                raise ValidationError({
                    'uploaded_by': 'User must be a member of the company'
                })
        
        # Validate dates
        if self.validity_start_date and self.validity_end_date:
            if self.validity_start_date > self.validity_end_date:
                raise ValidationError({
                    'validity_end_date': 'End date must be after start date'
                })
    
    def save(self, *args, **kwargs):
        """Override save to calculate file metadata"""
        if self.file:
            # Set file size
            if not self.file_size:
                self.file_size = self.file.size
            
            # Set file type from MIME
            if not self.file_type and hasattr(self.file, 'content_type'):
                self.file_type = self.file.content_type
            
            # Calculate hash if not set
            if not self.file_hash:
                self.file_hash = self.calculate_file_hash()
        
        super().save(*args, **kwargs)
    
    def calculate_file_hash(self):
        """Calculate SHA-256 hash of file"""
        import hashlib
        
        if not self.file:
            return ''
        
        sha256 = hashlib.sha256()
        
        # Read file in chunks to handle large files
        for chunk in self.file.chunks():
            sha256.update(chunk)
        
        # Reset file pointer
        self.file.seek(0)
        
        return sha256.hexdigest()
    
    def is_expired(self):
        """Check if evidence has expired"""
        if not self.validity_end_date:
            return False
        
        from django.utils import timezone
        return timezone.now().date() > self.validity_end_date
    
    def get_file_extension(self):
        """Get file extension"""
        if self.file:
            return os.path.splitext(self.file.name)[1].lower()
        return ''
    
    def get_file_size_display(self):
        """Get human-readable file size"""
        if not self.file_size:
            return 'Unknown'
        
        size = self.file_size
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024.0:
                return f"{size:.1f} {unit}"
            size /= 1024.0
        return f"{size:.1f} TB"
    
    def get_linked_controls_count(self):
        """Count controls linked to this evidence"""
        return self.control_links.filter(is_deleted=False).count()
    
    def delete_file(self):
        """Delete the physical file"""
        if self.file:
            storage = self.file.storage
            if storage.exists(self.file.name):
                storage.delete(self.file.name)


class AppliedControlEvidence(TenantMixin, TimeStampedModel, SoftDeleteModel):
    """
    Link between AppliedControl and Evidence
    Tracks which evidence supports which controls
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    applied_control = models.ForeignKey(
        'controls.AppliedControl',
        on_delete=models.CASCADE,
        related_name='evidence_links'
    )
    evidence = models.ForeignKey(
        Evidence,
        on_delete=models.CASCADE,
        related_name='control_links'
    )
    
    # Link metadata
    link_type = models.CharField(
        max_length=50,
        choices=[
            ('implementation', 'Implementation Evidence'),
            ('testing', 'Testing Evidence'),
            ('monitoring', 'Monitoring Evidence'),
            ('documentation', 'Documentation'),
            ('audit', 'Audit Evidence'),
        ],
        default='implementation'
    )
    
    notes = models.TextField(
        blank=True,
        help_text='Notes about how this evidence supports the control'
    )
    
    # Link ownership
    linked_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='evidence_links_created'
    )
    
    relevance_score = models.IntegerField(
        default=5,
        validators=[
            MinValueValidator(1),
            MaxValueValidator(10)
        ],
        help_text='How relevant this evidence is (1-10)'
    )
    
    class Meta:
        db_table = 'applied_control_evidence'
        unique_together = [['applied_control', 'evidence']]
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['company', 'applied_control']),
            models.Index(fields=['company', 'evidence']),
            models.Index(fields=['link_type']),
        ]
    
    def __str__(self):
        return f"{self.applied_control.reference_control.code} → {self.evidence.name}"
    
    def clean(self):
        """Validate evidence link"""
        # Ensure both belong to same company
        if self.applied_control.company != self.evidence.company:
            raise ValidationError('Control and evidence must belong to the same company')
        
        # Set company from applied control
        self.company = self.applied_control.company


class EvidenceAccessLog(TenantMixin, TimeStampedModel):
    """
    Audit log for evidence file access
    Track who accessed which evidence and when
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    evidence = models.ForeignKey(
        Evidence,
        on_delete=models.CASCADE,
        related_name='access_logs'
    )
    
    accessed_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='evidence_accesses'
    )
    
    access_type = models.CharField(
        max_length=20,
        choices=[
            ('view', 'Viewed'),
            ('download', 'Downloaded'),
            ('preview', 'Previewed'),
        ],
        default='view'
    )
    
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True)
    
    class Meta:
        db_table = 'evidence_access_logs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['evidence', '-created_at']),
            models.Index(fields=['accessed_by', '-created_at']),
            models.Index(fields=['company', '-created_at']),
        ]
    
    def __str__(self):
        return f"{self.accessed_by.email if self.accessed_by else 'Unknown'} accessed {self.evidence.name}"


class EvidenceComment(TenantMixin, TimeStampedModel, SoftDeleteModel):
    """
    Comments on evidence for collaboration
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    evidence = models.ForeignKey(
        Evidence,
        on_delete=models.CASCADE,
        related_name='comments'
    )
    
    author = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='evidence_comments'
    )
    
    comment = models.TextField()
    
    # Threading support
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='replies'
    )
    
    class Meta:
        db_table = 'evidence_comments'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['evidence', '-created_at']),
            models.Index(fields=['company', '-created_at']),
        ]
    
    def __str__(self):
        return f"Comment on {self.evidence.name} by {self.author.email if self.author else 'Unknown'}"