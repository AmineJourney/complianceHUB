import uuid
from django.db import models
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, MaxValueValidator
from core.models import TimeStampedModel, SoftDeleteModel
from core.mixins import TenantMixin


class ComplianceResult(TenantMixin, TimeStampedModel, SoftDeleteModel):
    """
    Stores compliance calculation results for a framework and department
    Represents compliance status at a point in time
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Scope
    framework = models.ForeignKey(
        'library.Framework',
        on_delete=models.CASCADE,
        related_name='compliance_results'
    )
    department = models.ForeignKey(
        'organizations.Department',
        on_delete=models.CASCADE,
        related_name='compliance_results',
        null=True,
        blank=True,
        help_text='Optional department scope (null = company-wide)'
    )
    
    # Compliance metrics
    coverage_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text='Overall compliance coverage (0-100%)'
    )
    
    compliance_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text='Weighted compliance score based on control effectiveness (0-100)'
    )
    
    # Requirement breakdown
    total_requirements = models.IntegerField(
        default=0,
        help_text='Total requirements in framework'
    )
    requirements_addressed = models.IntegerField(
        default=0,
        help_text='Requirements with at least one control'
    )
    requirements_compliant = models.IntegerField(
        default=0,
        help_text='Requirements fully compliant'
    )
    requirements_partial = models.IntegerField(
        default=0,
        help_text='Requirements partially compliant'
    )
    requirements_non_compliant = models.IntegerField(
        default=0,
        help_text='Requirements not compliant'
    )
    
    # Control breakdown
    total_controls = models.IntegerField(
        default=0,
        help_text='Total controls applied'
    )
    controls_operational = models.IntegerField(
        default=0,
        help_text='Controls in operational status'
    )
    controls_implemented = models.IntegerField(
        default=0,
        help_text='Controls implemented but not yet operational'
    )
    controls_in_progress = models.IntegerField(
        default=0,
        help_text='Controls in progress'
    )
    controls_not_started = models.IntegerField(
        default=0,
        help_text='Controls not started'
    )
    
    # Evidence metrics
    controls_with_evidence = models.IntegerField(
        default=0,
        help_text='Controls with at least one evidence'
    )
    total_evidence_count = models.IntegerField(
        default=0,
        help_text='Total evidence items linked'
    )
    
    # Risk metrics
    high_risk_gaps = models.IntegerField(
        default=0,
        help_text='Number of high-risk compliance gaps'
    )
    medium_risk_gaps = models.IntegerField(
        default=0,
        help_text='Number of medium-risk compliance gaps'
    )
    low_risk_gaps = models.IntegerField(
        default=0,
        help_text='Number of low-risk compliance gaps'
    )
    
    # Detailed breakdown (JSON)
    requirement_details = models.JSONField(
        default=dict,
        blank=True,
        help_text='Detailed breakdown by requirement'
    )
    control_details = models.JSONField(
        default=dict,
        blank=True,
        help_text='Detailed breakdown by control'
    )
    
    # Calculation metadata
    calculation_date = models.DateTimeField(
        auto_now_add=True,
        help_text='When this result was calculated'
    )
    calculated_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='calculated_compliance_results'
    )
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=[
            ('calculating', 'Calculating'),
            ('completed', 'Completed'),
            ('failed', 'Failed'),
        ],
        default='completed'
    )
    error_message = models.TextField(blank=True)
    
    # Result validity
    is_current = models.BooleanField(
        default=True,
        db_index=True,
        help_text='Whether this is the current/latest result'
    )
    
    class Meta:
        db_table = 'compliance_results'
        ordering = ['-calculation_date']
        indexes = [
            models.Index(fields=['company', 'framework', '-calculation_date']),
            models.Index(fields=['company', 'department', '-calculation_date']),
            models.Index(fields=['company', 'is_current']),
            models.Index(fields=['framework', 'is_current']),
        ]
    
    def __str__(self):
        dept_str = f" - {self.department.name}" if self.department else ""
        return f"{self.framework.code} Compliance ({self.company.name}{dept_str})"
    
    def clean(self):
        """Validate compliance result"""
        # Ensure department belongs to same company
        if self.department and self.department.company != self.company:
            raise ValidationError({
                'department': 'Department must belong to the same company'
            })
    
    def get_compliance_grade(self):
        """
        Get letter grade based on compliance score
        
        Returns:
            str: Letter grade (A+, A, B, C, D, F)
        """
        score = float(self.compliance_score)
        
        if score >= 95:
            return 'A+'
        elif score >= 90:
            return 'A'
        elif score >= 85:
            return 'A-'
        elif score >= 80:
            return 'B+'
        elif score >= 75:
            return 'B'
        elif score >= 70:
            return 'B-'
        elif score >= 65:
            return 'C+'
        elif score >= 60:
            return 'C'
        elif score >= 55:
            return 'C-'
        elif score >= 50:
            return 'D'
        else:
            return 'F'
    
    def get_compliance_status(self):
        """
        Get overall compliance status
        
        Returns:
            str: Status (compliant, mostly_compliant, partially_compliant, non_compliant)
        """
        score = float(self.compliance_score)
        
        if score >= 90:
            return 'compliant'
        elif score >= 75:
            return 'mostly_compliant'
        elif score >= 50:
            return 'partially_compliant'
        else:
            return 'non_compliant'
    
    def get_gap_count(self):
        """Get total gap count"""
        return self.high_risk_gaps + self.medium_risk_gaps + self.low_risk_gaps


class ComplianceGap(TenantMixin, TimeStampedModel, SoftDeleteModel):
    """
    Specific compliance gaps identified during assessment
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    compliance_result = models.ForeignKey(
        ComplianceResult,
        on_delete=models.CASCADE,
        related_name='gaps'
    )
    
    # Gap identification
    requirement = models.ForeignKey(
        'library.Requirement',
        on_delete=models.CASCADE,
        related_name='compliance_gaps'
    )
    
    # Gap details
    gap_type = models.CharField(
        max_length=50,
        choices=[
            ('missing_control', 'Missing Control'),
            ('incomplete_implementation', 'Incomplete Implementation'),
            ('insufficient_evidence', 'Insufficient Evidence'),
            ('control_ineffective', 'Control Ineffective'),
            ('outdated_evidence', 'Outdated Evidence'),
        ],
        default='missing_control'
    )
    
    severity = models.CharField(
        max_length=20,
        choices=[
            ('critical', 'Critical'),
            ('high', 'High'),
            ('medium', 'Medium'),
            ('low', 'Low'),
        ],
        default='medium'
    )
    
    description = models.TextField(
        help_text='Detailed gap description'
    )
    
    # Affected controls (if any)
    affected_controls = models.ManyToManyField(
        'controls.AppliedControl',
        related_name='compliance_gaps',
        blank=True
    )
    
    # Remediation
    remediation_plan = models.TextField(blank=True)
    remediation_owner = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='remediation_assignments'
    )
    remediation_due_date = models.DateField(null=True, blank=True)
    
    # Gap status
    status = models.CharField(
        max_length=20,
        choices=[
            ('open', 'Open'),
            ('in_progress', 'In Progress'),
            ('resolved', 'Resolved'),
            ('accepted', 'Risk Accepted'),
        ],
        default='open',
        db_index=True
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='resolved_gaps'
    )
    resolution_notes = models.TextField(blank=True)
    
    class Meta:
        db_table = 'compliance_gaps'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['company', 'status']),
            models.Index(fields=['compliance_result', 'severity']),
            models.Index(fields=['remediation_due_date']),
        ]
    
    def __str__(self):
        return f"{self.requirement.code} - {self.gap_type} ({self.severity})"
    
    def clean(self):
        """Validate compliance gap"""
        # Ensure requirement framework matches compliance result framework
        if self.compliance_result and self.requirement:
            if self.requirement.framework != self.compliance_result.framework:
                raise ValidationError({
                    'requirement': 'Requirement must belong to the compliance result framework'
                })


class FrameworkAdoption(TenantMixin, TimeStampedModel, SoftDeleteModel):
    """
    Track company's adoption of compliance frameworks
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    framework = models.ForeignKey(
        'library.Framework',
        on_delete=models.CASCADE,
        related_name='adoptions'
    )
    
    # Adoption details
    adoption_status = models.CharField(
        max_length=30,
        choices=[
            ('planning', 'Planning'),
            ('implementing', 'Implementing'),
            ('operational', 'Operational'),
            ('certified', 'Certified'),
            ('suspended', 'Suspended'),
        ],
        default='planning',
        db_index=True
    )
    
    target_completion_date = models.DateField(
        null=True,
        blank=True,
        help_text='Target date for full compliance'
    )
    actual_completion_date = models.DateField(
        null=True,
        blank=True,
        help_text='Actual date achieved'
    )
    
    # Certification tracking
    is_certified = models.BooleanField(
        default=False,
        help_text='Whether company is officially certified'
    )
    certification_body = models.CharField(
        max_length=255,
        blank=True,
        help_text='Certification authority'
    )
    certification_date = models.DateField(null=True, blank=True)
    certification_expiry_date = models.DateField(null=True, blank=True)
    certificate_number = models.CharField(max_length=255, blank=True)
    
    # Scope
    scope_description = models.TextField(
        blank=True,
        help_text='What is included in the scope'
    )
    scope_exclusions = models.TextField(
        blank=True,
        help_text='What is excluded from scope'
    )
    
    # Ownership
    program_owner = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='owned_framework_adoptions'
    )
    
    # Audit tracking
    last_audit_date = models.DateField(null=True, blank=True)
    next_audit_date = models.DateField(null=True, blank=True)
    
    # Notes
    notes = models.TextField(blank=True)
    
    class Meta:
        db_table = 'framework_adoptions'
        unique_together = [['company', 'framework']]
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['company', 'adoption_status']),
            models.Index(fields=['company', 'is_certified']),
            models.Index(fields=['certification_expiry_date']),
        ]
    
    def __str__(self):
        return f"{self.company.name} - {self.framework.code}"
    
    def is_certification_expired(self):
        """Check if certification has expired"""
        if not self.certification_expiry_date:
            return False
        
        from django.utils import timezone
        return timezone.now().date() > self.certification_expiry_date
    
    def is_audit_overdue(self):
        """Check if audit is overdue"""
        if not self.next_audit_date:
            return False
        
        from django.utils import timezone
        return timezone.now().date() > self.next_audit_date


class ComplianceReport(TenantMixin, TimeStampedModel, SoftDeleteModel):
    """
    Generated compliance reports for export and sharing
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Report metadata
    title = models.CharField(max_length=500)
    description = models.TextField(blank=True)
    
    # Report scope
    framework = models.ForeignKey(
        'library.Framework',
        on_delete=models.CASCADE,
        related_name='reports',
        null=True,
        blank=True
    )
    department = models.ForeignKey(
        'organizations.Department',
        on_delete=models.CASCADE,
        related_name='compliance_reports',
        null=True,
        blank=True
    )
    
    # Report type
    report_type = models.CharField(
        max_length=50,
        choices=[
            ('summary', 'Executive Summary'),
            ('detailed', 'Detailed Assessment'),
            ('gap_analysis', 'Gap Analysis'),
            ('evidence_matrix', 'Evidence Matrix'),
            ('control_matrix', 'Control Matrix'),
            ('audit_report', 'Audit Report'),
        ],
        default='summary'
    )
    
    # Report period
    period_start = models.DateField(null=True, blank=True)
    period_end = models.DateField(null=True, blank=True)
    
    # Report file
    report_file = models.FileField(
        upload_to='compliance_reports/%Y/%m/',
        null=True,
        blank=True
    )
    report_format = models.CharField(
        max_length=20,
        choices=[
            ('pdf', 'PDF'),
            ('excel', 'Excel'),
            ('csv', 'CSV'),
            ('json', 'JSON'),
        ],
        default='pdf'
    )
    
    # Generation details
    generated_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='generated_reports'
    )
    generation_status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending'),
            ('generating', 'Generating'),
            ('completed', 'Completed'),
            ('failed', 'Failed'),
        ],
        default='pending'
    )
    
    class Meta:
        db_table = 'compliance_reports'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['company', 'framework', '-created_at']),
            models.Index(fields=['company', 'generation_status']),
        ]
    
    def __str__(self):
        return f"{self.title} ({self.company.name})"