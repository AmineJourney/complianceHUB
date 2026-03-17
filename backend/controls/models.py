import uuid
from django.db import models
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, MaxValueValidator
from core.models import TimeStampedModel, SoftDeleteModel
from core.mixins import TenantMixin
from library.models import ReferenceControl,RequirementReferenceControl ,Requirement





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
        related_name='applied_controls'
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
    # Link to unified control (optional during migration)
    unified_control = models.ForeignKey(
        'UnifiedControl',
        on_delete=models.PROTECT,
        null=True,  # Nullable for backward compatibility
        blank=True,
        related_name='applied_instances',
        help_text='Link to unified control (new unified model)'
    )
    
    # Maturity tracking
    maturity_level = models.IntegerField(
        default=1,
        choices=[
            (1, 'Level 1 - Initial/Ad-hoc'),
            (2, 'Level 2 - Managed'),
            (3, 'Level 3 - Defined'),
            (4, 'Level 4 - Quantitatively Managed'),
            (5, 'Level 5 - Optimizing'),
        ],
        db_index=True
    )
    maturity_target_level = models.IntegerField(
        default=3,
        choices=[(i, f'Level {i}') for i in range(1, 6)]
    )
    maturity_assessment_date = models.DateField(null=True, blank=True)
    maturity_notes = models.TextField(blank=True)

    
    
    class Meta:
        db_table = 'applied_controls'
        unique_together = [['company', 'reference_control', 'department']]
        ordering = ['reference_control__control_id']
        indexes = [
            models.Index(fields=['company', 'status'], name='applied_company_status_idx'),
            models.Index(fields=['company', 'department'], name='applied_company_dept_idx'),
            models.Index(fields=['control_owner', 'status'], name='applied_owner_status_idx'),
            models.Index(fields=['next_review_date'], name='applied_review_idx'),
            models.Index(fields=['has_deficiencies'], name='applied_def_idx'),
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

    def get_maturity_criteria(self):
        """Get criteria for current and next maturity level"""
        if not self.unified_control:
            return None
        
        current_criteria = getattr(
            self.unified_control,
            f'maturity_level_{self.maturity_level}_criteria',
            ''
        )
        
        next_level = min(self.maturity_level + 1, 5)
        next_criteria = getattr(
            self.unified_control,
            f'maturity_level_{next_level}_criteria',
            ''
        )
        
        return {
            'current_level': self.maturity_level,
            'current_criteria': current_criteria,
            'next_level': next_level,
            'next_criteria': next_criteria,
            'target_level': self.maturity_target_level
        }



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
            models.Index(fields=['requirement', 'coverage_level'], name='reqctrl_req_cov_idx'),
            models.Index(fields=['reference_control', 'is_primary'], name='reqctrl_ctrl_primary_idx'),
            models.Index(fields=['validation_status'], name='reqctrl_validation_idx'),
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
            models.Index(fields=['company', 'is_active'], name='exception_company_active_idx'),
            models.Index(fields=['applied_control', 'is_active'], name='exception_control_active_idx'),
            models.Index(fields=['expiration_date'], name='exception_expiration_idx'),
        ]
    
    def __str__(self):
        return f"Exception: {self.applied_control.reference_control.code}"
    
    def is_expired(self):
        """Check if exception has expired"""
        if not self.expiration_date:
            return False
        
        from django.utils import timezone
        return timezone.now().date() > self.expiration_date
    

class UnifiedControl(TimeStampedModel):
    """
    Unified Control - Internal control library
    
    Key innovation: One unified control can satisfy multiple framework controls.
    Example:
        UC-001 "Security Governance" satisfies:
        - ISO 27001 A.5.1
        - SOC 2 CC1.1
        - TISAX 1.1
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Identification
    control_code = models.CharField(
        max_length=100,
        unique=True,
        help_text='Unique code like UC-001, UC-002'
    )
    control_name = models.CharField(max_length=500)
    short_name = models.CharField(max_length=200, blank=True)
    
    # Classification
    domain = models.CharField(
        max_length=200,
        db_index=True,
        help_text='e.g., Security Governance, Asset Management'
    )
    category = models.CharField(max_length=200, blank=True)
    control_family = models.CharField(max_length=200, blank=True)
    
    # Core content
    description = models.TextField()
    control_objective = models.TextField(blank=True)
    implementation_guidance = models.TextField()
    
    # Implementation properties
    control_type = models.CharField(
        max_length=50,
        choices=[
            ('preventive', 'Preventive'),
            ('detective', 'Detective'),
            ('corrective', 'Corrective'),
            ('directive', 'Directive'),
        ],
        blank=True
    )
    automation_level = models.CharField(
        max_length=50,
        choices=[
            ('manual', 'Manual'),
            ('semi_automated', 'Semi-Automated'),
            ('automated', 'Automated'),
        ],
        blank=True
    )
    implementation_complexity = models.CharField(
        max_length=50,
        choices=[
            ('low', 'Low'),
            ('medium', 'Medium'),
            ('high', 'High'),
        ],
        blank=True
    )
    estimated_effort_hours = models.IntegerField(null=True, blank=True)
    
    # Maturity Model (5 levels - CMMI-based)
    maturity_level_1_criteria = models.TextField(
        blank=True,
        help_text='Level 1 - Initial/Ad-hoc'
    )
    maturity_level_2_criteria = models.TextField(
        blank=True,
        help_text='Level 2 - Managed'
    )
    maturity_level_3_criteria = models.TextField(
        blank=True,
        help_text='Level 3 - Defined'
    )
    maturity_level_4_criteria = models.TextField(
        blank=True,
        help_text='Level 4 - Quantitatively Managed'
    )
    maturity_level_5_criteria = models.TextField(
        blank=True,
        help_text='Level 5 - Optimizing'
    )
    
    # Testing
    testing_procedures = models.TextField(blank=True)
    testing_frequency = models.CharField(
        max_length=50,
        choices=[
            ('continuous', 'Continuous'),
            ('daily', 'Daily'),
            ('weekly', 'Weekly'),
            ('monthly', 'Monthly'),
            ('quarterly', 'Quarterly'),
            ('annual', 'Annual'),
        ],
        blank=True
    )
    
    # Relationships (stored as JSON arrays)
    prerequisites = models.JSONField(
        default=list,
        blank=True,
        help_text='Array of prerequisite control codes'
    )
    related_controls = models.JSONField(
        default=list,
        blank=True,
        help_text='Array of related unified control IDs'
    )
    
    # Categorization
    tags = models.JSONField(default=list, blank=True)
    
    # Metadata
    metadata = models.JSONField(default=dict, blank=True)
    
    # Status
    is_active = models.BooleanField(default=True, db_index=True)
    version = models.IntegerField(default=1)
    
    # Audit fields
    created_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_unified_controls'
    )
    updated_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_unified_controls'
    )
    
    class Meta:
        db_table = 'unified_controls'
        ordering = ['control_code']
        indexes = [
        models.Index(fields=['control_code'], name='unified_code_idx'),
        models.Index(fields=['domain'], name='unified_domain_idx'),
        models.Index(fields=['is_active'], name='unified_active_idx'),
        ]
    
    def __str__(self):
        return f"{self.control_code} - {self.control_name}"
    
    def get_framework_coverage(self):
        """
        Get all frameworks this unified control satisfies
        Returns dict with framework codes and coverage types
        """
        mappings = self.reference_mappings.select_related(
            'reference_control__requirement_mappings__requirement__framework'
        )
        
        coverage = {}
        for mapping in mappings:
            for req_mapping in mapping.reference_control.requirement_mappings.all():
                fw_code = req_mapping.requirement.framework.code
                if fw_code not in coverage:
                    coverage[fw_code] = []
                coverage[fw_code].append({
                    'requirement': req_mapping.requirement.code,
                    'coverage_type': mapping.coverage_type,
                    'coverage_percentage': mapping.coverage_percentage
                })
        
        return coverage
    
    def get_implementation_count(self):
        """Count how many companies have implemented this"""
        return self.applied_instances.filter(
            is_deleted=False
        ).values('company').distinct().count()


class UnifiedControlMapping(TimeStampedModel):
    """
    Maps ReferenceControls (framework-specific) to UnifiedControls (internal library)
    
    Key feature: Supports full/partial/supplemental coverage
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    reference_control = models.ForeignKey(
        'ReferenceControl',
        on_delete=models.CASCADE,
        related_name='unified_mappings'
    )
    unified_control = models.ForeignKey(
        'UnifiedControl',
        on_delete=models.CASCADE,
        related_name='reference_mappings'
    )
    
    # Coverage type
    coverage_type = models.CharField(
        max_length=50,
        choices=[
            ('full', 'Full Coverage'),
            ('partial', 'Partial Coverage'),
            ('supplemental', 'Supplemental'),
        ],
        default='full'
    )
    coverage_percentage = models.IntegerField(
        default=100,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text='0-100 percentage'
    )
    
    # Mapping details
    mapping_rationale = models.TextField(blank=True)
    gap_description = models.TextField(blank=True)
    supplemental_actions = models.TextField(blank=True)
    
    # Validation
    confidence_score = models.IntegerField(
        default=100,
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    verified_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_mappings'
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    
    # Metadata
    metadata = models.JSONField(default=dict, blank=True)
    
    class Meta:
        db_table = 'unified_control_mappings'
        unique_together = [['reference_control', 'unified_control']]
        indexes = [
            models.Index(fields=['coverage_type'], name='ucmap_covtype_idx'),
        ]
    
    def __str__(self):
        return f"{self.reference_control.code} → {self.unified_control.control_code} ({self.coverage_type})"