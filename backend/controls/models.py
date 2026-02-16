import uuid
from django.db import models
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, MaxValueValidator
from core.models import TimeStampedModel, SoftDeleteModel
from core.mixins import TenantMixin


class ReferenceControl(TimeStampedModel, SoftDeleteModel):
    """
    Global reference control catalog
    Template controls that can be applied by companies
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Control identification
    name = models.CharField(max_length=500)
    code = models.CharField(
        max_length=100,
        unique=True,
        help_text='Unique control identifier (e.g., "AC-001", "IAM-002")'
    )
    description = models.TextField(
        help_text='Detailed control description'
    )
    
    # Control categorization
    control_family = models.CharField(
        max_length=100,
        choices=[
            ('access_control', 'Access Control'),
            ('asset_management', 'Asset Management'),
            ('cryptography', 'Cryptography'),
            ('physical_security', 'Physical Security'),
            ('operations_security', 'Operations Security'),
            ('communications_security', 'Communications Security'),
            ('system_acquisition', 'System Acquisition & Development'),
            ('supplier_relationships', 'Supplier Relationships'),
            ('incident_management', 'Incident Management'),
            ('business_continuity', 'Business Continuity'),
            ('compliance', 'Compliance'),
            ('risk_management', 'Risk Management'),
            ('human_resources', 'Human Resources Security'),
            ('information_security', 'Information Security'),
        ],
        default='access_control'
    )
    
    # Control metadata
    control_type = models.CharField(
        max_length=50,
        choices=[
            ('preventive', 'Preventive'),
            ('detective', 'Detective'),
            ('corrective', 'Corrective'),
            ('deterrent', 'Deterrent'),
            ('compensating', 'Compensating'),
        ],
        default='preventive'
    )
    
    # Implementation guidance
    implementation_guidance = models.TextField(
        blank=True,
        help_text='How to implement this control'
    )
    testing_procedures = models.TextField(
        blank=True,
        help_text='How to test control effectiveness'
    )
    
    # Control attributes
    automation_level = models.CharField(
        max_length=20,
        choices=[
            ('manual', 'Manual'),
            ('semi_automated', 'Semi-Automated'),
            ('automated', 'Fully Automated'),
        ],
        default='manual'
    )
    
    frequency = models.CharField(
        max_length=50,
        choices=[
            ('continuous', 'Continuous'),
            ('daily', 'Daily'),
            ('weekly', 'Weekly'),
            ('monthly', 'Monthly'),
            ('quarterly', 'Quarterly'),
            ('annually', 'Annually'),
            ('ad_hoc', 'Ad-Hoc'),
        ],
        default='monthly',
        help_text='Recommended testing/review frequency'
    )
    
    # Maturity and priority
    maturity_level = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        default=1,
        help_text='1=Initial, 2=Managed, 3=Defined, 4=Quantitatively Managed, 5=Optimizing'
    )
    
    priority = models.CharField(
        max_length=20,
        choices=[
            ('critical', 'Critical'),
            ('high', 'High'),
            ('medium', 'Medium'),
            ('low', 'Low'),
        ],
        default='medium'
    )
    
    # Cost and effort estimation
    implementation_complexity = models.CharField(
        max_length=20,
        choices=[
            ('low', 'Low'),
            ('medium', 'Medium'),
            ('high', 'High'),
        ],
        default='medium'
    )
    estimated_effort_hours = models.IntegerField(
        null=True,
        blank=True,
        help_text='Estimated hours to implement'
    )
    
    # Publication status
    is_published = models.BooleanField(
        default=True,
        help_text='Whether this control is available to companies'
    )
    
    # Tags for categorization
    tags = models.JSONField(
        default=list,
        blank=True,
        help_text='Tags for categorization (e.g., ["cloud", "AWS", "encryption"])'
    )
    
    class Meta:
        db_table = 'reference_controls'
        ordering = ['code']
        indexes = [
            models.Index(fields=['code']),
            models.Index(fields=['control_family', 'is_published']),
            models.Index(fields=['priority', 'control_type']),
        ]
    
    def __str__(self):
        return f"{self.code}: {self.name}"
    
    def get_mapped_requirements_count(self):
        """Count requirements mapped to this control"""
        return self.requirement_mappings.filter(is_deleted=False).count()
    
    def get_applied_count(self):
        """Count how many companies have applied this control"""
        return AppliedControl.objects.filter(
            reference_control=self,
            is_deleted=False
        ).values('company').distinct().count()


class AppliedControl(TenantMixin, TimeStampedModel, SoftDeleteModel):
    """
    Company-specific implementation of a ReferenceControl
    Scoped to company and optionally to department
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Link to reference control
    reference_control = models.ForeignKey(
        ReferenceControl,
        on_delete=models.PROTECT,
        related_name='applied_instances'
    )
    
    # Organizational scope
    department = models.ForeignKey(
        'organizations.Department',
        on_delete=models.CASCADE,
        related_name='applied_controls',
        null=True,
        blank=True,
        help_text='Department responsible for this control (optional)'
    )
    
    # Implementation status
    status = models.CharField(
        max_length=30,
        choices=[
            ('not_started', 'Not Started'),
            ('in_progress', 'In Progress'),
            ('implemented', 'Implemented'),
            ('testing', 'Testing'),
            ('operational', 'Operational'),
            ('needs_improvement', 'Needs Improvement'),
            ('non_compliant', 'Non-Compliant'),
        ],
        default='not_started',
        db_index=True
    )
    
    # Ownership and accountability
    control_owner = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='owned_controls',
        help_text='Person responsible for this control'
    )
    
    # Implementation details
    implementation_notes = models.TextField(
        blank=True,
        help_text='Company-specific implementation details'
    )
    
    # Custom fields for company-specific customization
    custom_procedures = models.TextField(
        blank=True,
        help_text='Company-specific procedures'
    )
    custom_frequency = models.CharField(
        max_length=50,
        blank=True,
        help_text='Override default frequency'
    )
    
    # Effectiveness tracking
    effectiveness_rating = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        null=True,
        blank=True,
        help_text='1=Ineffective, 5=Highly Effective'
    )
    last_tested_date = models.DateField(null=True, blank=True)
    last_tested_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tested_controls'
    )
    test_results = models.TextField(blank=True)
    
    # Compliance tracking
    next_review_date = models.DateField(null=True, blank=True)
    last_review_date = models.DateField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_controls'
    )
    
    # Deficiency tracking
    has_deficiencies = models.BooleanField(default=False)
    deficiency_notes = models.TextField(blank=True)
    remediation_plan = models.TextField(blank=True)
    remediation_due_date = models.DateField(null=True, blank=True)
    
    # Cost tracking
    implementation_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Cost in company currency'
    )
    annual_maintenance_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True
    )
    
    class Meta:
        db_table = 'applied_controls'
        unique_together = [['company', 'reference_control', 'department']]
        ordering = ['reference_control__code']
        indexes = [
            models.Index(fields=['company', 'status']),
            models.Index(fields=['company', 'department']),
            models.Index(fields=['control_owner', 'status']),
            models.Index(fields=['next_review_date']),
            models.Index(fields=['has_deficiencies']),
        ]
    
    def __str__(self):
        dept_str = f" - {self.department.name}" if self.department else ""
        return f"{self.reference_control.code} ({self.company.name}{dept_str})"
    
    def clean(self):
        """Validate applied control"""
        # Ensure department belongs to same company
        if self.department and self.department.company != self.company:
            raise ValidationError({
                'department': 'Department must belong to the same company'
            })
        
        # Validate control owner is member of company
        if self.control_owner:
            from core.models import Membership
            is_member = Membership.objects.filter(
                user=self.control_owner,
                company=self.company,
                is_deleted=False
            ).exists()
            
            if not is_member:
                raise ValidationError({
                    'control_owner': 'Control owner must be a member of the company'
                })
    
    def get_evidence_count(self):
        """Count evidence items linked to this control"""
        return self.evidence_links.filter(is_deleted=False).count()
    
    def get_risk_assessments_count(self):
        """Count risk assessments linked to this control"""
        return self.risk_assessments.filter(is_deleted=False).count()
    
    def is_overdue_for_review(self):
        """Check if control review is overdue"""
        if not self.next_review_date:
            return False
        
        from django.utils import timezone
        return timezone.now().date() > self.next_review_date
    
    def calculate_compliance_score(self):
        """
        Calculate compliance score based on status and evidence
        Returns: 0-100 score
        """
        score = 0
        
        # Base score from status
        status_scores = {
            'not_started': 0,
            'in_progress': 25,
            'implemented': 50,
            'testing': 60,
            'operational': 85,
            'needs_improvement': 40,
            'non_compliant': 0,
        }
        score = status_scores.get(self.status, 0)
        
        # Bonus for evidence
        evidence_count = self.get_evidence_count()
        if evidence_count > 0:
            score = min(score + (evidence_count * 5), 100)
        
        # Penalty for deficiencies
        if self.has_deficiencies:
            score = max(score - 20, 0)
        
        # Penalty for overdue review
        if self.is_overdue_for_review():
            score = max(score - 10, 0)
        
        return score


class RequirementReferenceControl(TimeStampedModel, SoftDeleteModel):
    """
    Many-to-many mapping between Requirements and ReferenceControls
    Global mapping that defines which controls satisfy which requirements
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    requirement = models.ForeignKey(
        'library.Requirement',
        on_delete=models.CASCADE,
        related_name='control_mappings'
    )
    reference_control = models.ForeignKey(
        ReferenceControl,
        on_delete=models.CASCADE,
        related_name='requirement_mappings'
    )
    
    # Mapping metadata
    mapping_rationale = models.TextField(
        blank=True,
        help_text='Why this control satisfies this requirement'
    )
    
    coverage_level = models.CharField(
        max_length=20,
        choices=[
            ('full', 'Full Coverage'),
            ('partial', 'Partial Coverage'),
            ('supporting', 'Supporting Control'),
        ],
        default='full',
        help_text='How well this control satisfies the requirement'
    )
    
    is_primary = models.BooleanField(
        default=True,
        help_text='Whether this is a primary control for the requirement'
    )
    
    # Validation status
    validation_status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending Review'),
            ('validated', 'Validated'),
            ('rejected', 'Rejected'),
        ],
        default='pending'
    )
    validated_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='validated_mappings'
    )
    validated_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'requirement_reference_controls'
        unique_together = [['requirement', 'reference_control']]
        ordering = ['requirement__code', 'reference_control__code']
        indexes = [
            models.Index(fields=['requirement', 'coverage_level']),
            models.Index(fields=['reference_control', 'is_primary']),
            models.Index(fields=['validation_status']),
        ]
    
    def __str__(self):
        return f"{self.requirement.code} → {self.reference_control.code}"
    
    def clean(self):
        """Validate mapping"""
        # Ensure both requirement and control are from active/published sources
        if not self.requirement.framework.is_published:
            raise ValidationError({
                'requirement': 'Requirement must be from a published framework'
            })
        
        if not self.reference_control.is_published:
            raise ValidationError({
                'reference_control': 'Control must be published'
            })


class ControlException(TenantMixin, TimeStampedModel, SoftDeleteModel):
    """
    Track exceptions to control implementation
    When a control cannot be fully implemented
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    applied_control = models.ForeignKey(
        AppliedControl,
        on_delete=models.CASCADE,
        related_name='exceptions'
    )
    
    # Exception details
    exception_type = models.CharField(
        max_length=50,
        choices=[
            ('technical', 'Technical Limitation'),
            ('business', 'Business Decision'),
            ('cost', 'Cost Constraint'),
            ('resource', 'Resource Limitation'),
            ('temporary', 'Temporary Exception'),
            ('compensating', 'Compensating Control in Place'),
        ],
        default='business'
    )
    
    reason = models.TextField(
        help_text='Why this exception is necessary'
    )
    compensating_controls = models.TextField(
        blank=True,
        help_text='Alternative controls in place'
    )
    
    # Risk acceptance
    risk_acceptance = models.TextField(
        blank=True,
        help_text='Documented risk acceptance'
    )
    accepted_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='accepted_exceptions'
    )
    accepted_at = models.DateTimeField(null=True, blank=True)
    
    # Exception lifecycle
    expiration_date = models.DateField(
        null=True,
        blank=True,
        help_text='When this exception expires'
    )
    is_active = models.BooleanField(default=True)
    
    class Meta:
        db_table = 'control_exceptions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['company', 'is_active']),
            models.Index(fields=['applied_control', 'is_active']),
            models.Index(fields=['expiration_date']),
        ]
    
    def __str__(self):
        return f"Exception: {self.applied_control.reference_control.code}"
    
    def is_expired(self):
        """Check if exception has expired"""
        if not self.expiration_date:
            return False
        
        from django.utils import timezone
        return timezone.now().date() > self.expiration_date