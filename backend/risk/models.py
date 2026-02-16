import uuid
from django.db import models
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, MaxValueValidator
from core.models import TimeStampedModel, SoftDeleteModel
from core.mixins import TenantMixin


class RiskMatrix(TenantMixin, TimeStampedModel, SoftDeleteModel):
    """
    Risk scoring matrix for a company
    Defines likelihood and impact scales and their mappings
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    name = models.CharField(
        max_length=255,
        help_text='Matrix name (e.g., "5x5 Standard Risk Matrix")'
    )
    description = models.TextField(blank=True)
    
    # Matrix dimensions
    likelihood_levels = models.IntegerField(
        default=5,
        validators=[MinValueValidator(3), MaxValueValidator(10)],
        help_text='Number of likelihood levels (3-10)'
    )
    impact_levels = models.IntegerField(
        default=5,
        validators=[MinValueValidator(3), MaxValueValidator(10)],
        help_text='Number of impact levels (3-10)'
    )
    
    # Matrix configuration (JSON)
    likelihood_definitions = models.JSONField(
        default=dict,
        help_text='Likelihood level definitions: {1: {"label": "Rare", "description": "...", "probability": "0-10%"}, ...}'
    )
    impact_definitions = models.JSONField(
        default=dict,
        help_text='Impact level definitions: {1: {"label": "Negligible", "description": "...", "financial_impact": "$0-$10k"}, ...}'
    )
    
    # Risk score mapping
    risk_score_matrix = models.JSONField(
        default=dict,
        help_text='Risk scores: {"1,1": 1, "1,2": 2, ...} where key is "likelihood,impact"'
    )
    
    # Risk level thresholds
    low_risk_threshold = models.IntegerField(
        default=5,
        help_text='Scores below this are low risk'
    )
    medium_risk_threshold = models.IntegerField(
        default=10,
        help_text='Scores below this are medium risk'
    )
    high_risk_threshold = models.IntegerField(
        default=15,
        help_text='Scores below this are high risk (above is critical)'
    )
    
    # Status
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        help_text='Only one matrix should be active per company'
    )
    
    class Meta:
        db_table = 'risk_matrices'
        verbose_name_plural = 'Risk Matrices'
        ordering = ['-is_active', '-created_at']
        indexes = [
            models.Index(fields=['company', 'is_active']),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.company.name})"
    
    def clean(self):
        """Validate risk matrix"""
        # Only one active matrix per company
        if self.is_active:
            existing_active = RiskMatrix.objects.filter(
                company=self.company,
                is_active=True,
                is_deleted=False
            ).exclude(pk=self.pk).exists()
            
            if existing_active:
                raise ValidationError({
                    'is_active': 'Another risk matrix is already active for this company'
                })
    
    def calculate_risk_score(self, likelihood, impact):
        """
        Calculate risk score based on likelihood and impact
        
        Args:
            likelihood: int (1 to likelihood_levels)
            impact: int (1 to impact_levels)
        
        Returns:
            int: Risk score
        """
        # Validate inputs
        if likelihood < 1 or likelihood > self.likelihood_levels:
            raise ValueError(f'Likelihood must be between 1 and {self.likelihood_levels}')
        if impact < 1 or impact > self.impact_levels:
            raise ValueError(f'Impact must be between 1 and {self.impact_levels}')
        
        # Get score from matrix
        key = f"{likelihood},{impact}"
        
        if key in self.risk_score_matrix:
            return self.risk_score_matrix[key]
        
        # Default calculation if not in matrix
        return likelihood * impact
    
    def get_risk_level(self, score):
        """
        Get risk level based on score
        
        Returns:
            str: 'low', 'medium', 'high', or 'critical'
        """
        if score < self.low_risk_threshold:
            return 'low'
        elif score < self.medium_risk_threshold:
            return 'medium'
        elif score < self.high_risk_threshold:
            return 'high'
        else:
            return 'critical'
    
    def activate(self):
        """Activate this matrix and deactivate others"""
        RiskMatrix.objects.filter(
            company=self.company,
            is_deleted=False
        ).exclude(pk=self.pk).update(is_active=False)
        
        self.is_active = True
        self.save()
    
    @staticmethod
    def create_default_5x5_matrix(company):
        """
        Create a standard 5x5 risk matrix
        
        Args:
            company: Company instance
        
        Returns:
            RiskMatrix instance
        """
        likelihood_definitions = {
            "1": {
                "label": "Rare",
                "description": "May occur only in exceptional circumstances",
                "probability": "< 10%"
            },
            "2": {
                "label": "Unlikely",
                "description": "Could occur at some time",
                "probability": "10-30%"
            },
            "3": {
                "label": "Possible",
                "description": "Might occur at some time",
                "probability": "30-50%"
            },
            "4": {
                "label": "Likely",
                "description": "Will probably occur",
                "probability": "50-75%"
            },
            "5": {
                "label": "Almost Certain",
                "description": "Expected to occur in most circumstances",
                "probability": "> 75%"
            }
        }
        
        impact_definitions = {
            "1": {
                "label": "Negligible",
                "description": "Minimal impact",
                "financial": "< $10,000"
            },
            "2": {
                "label": "Minor",
                "description": "Small impact",
                "financial": "$10,000 - $50,000"
            },
            "3": {
                "label": "Moderate",
                "description": "Noticeable impact",
                "financial": "$50,000 - $250,000"
            },
            "4": {
                "label": "Major",
                "description": "Significant impact",
                "financial": "$250,000 - $1,000,000"
            },
            "5": {
                "label": "Catastrophic",
                "description": "Severe impact",
                "financial": "> $1,000,000"
            }
        }
        
        # Generate risk score matrix
        risk_score_matrix = {}
        for likelihood in range(1, 6):
            for impact in range(1, 6):
                risk_score_matrix[f"{likelihood},{impact}"] = likelihood * impact
        
        matrix = RiskMatrix.objects.create(
            company=company,
            name="5x5 Standard Risk Matrix",
            description="Standard 5x5 likelihood-impact risk matrix",
            likelihood_levels=5,
            impact_levels=5,
            likelihood_definitions=likelihood_definitions,
            impact_definitions=impact_definitions,
            risk_score_matrix=risk_score_matrix,
            low_risk_threshold=6,
            medium_risk_threshold=12,
            high_risk_threshold=20,
            is_active=True
        )
        
        return matrix


class Risk(TenantMixin, TimeStampedModel, SoftDeleteModel):
    """
    Individual risk item in the risk register
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Risk matrix
    risk_matrix = models.ForeignKey(
        RiskMatrix,
        on_delete=models.PROTECT,
        related_name='risks'
    )
    
    # Risk identification
    title = models.CharField(
        max_length=500,
        help_text='Risk title/name'
    )
    description = models.TextField(
        help_text='Detailed risk description'
    )
    risk_id = models.CharField(
        max_length=50,
        blank=True,
        help_text='Custom risk identifier (e.g., "R-001")'
    )
    
    # Risk categorization
    risk_category = models.CharField(
        max_length=100,
        choices=[
            ('strategic', 'Strategic Risk'),
            ('operational', 'Operational Risk'),
            ('financial', 'Financial Risk'),
            ('compliance', 'Compliance/Regulatory Risk'),
            ('reputational', 'Reputational Risk'),
            ('technology', 'Technology Risk'),
            ('security', 'Security Risk'),
            ('environmental', 'Environmental Risk'),
            ('legal', 'Legal Risk'),
            ('other', 'Other'),
        ],
        default='operational'
    )
    
    risk_source = models.CharField(
        max_length=100,
        choices=[
            ('internal', 'Internal'),
            ('external', 'External'),
            ('both', 'Both'),
        ],
        default='internal'
    )
    
    # Inherent risk (before controls)
    inherent_likelihood = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(10)],
        help_text='Likelihood without controls (1-10)'
    )
    inherent_impact = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(10)],
        help_text='Impact without controls (1-10)'
    )
    inherent_risk_score = models.IntegerField(
        default=0,
        help_text='Calculated inherent risk score'
    )
    inherent_risk_level = models.CharField(
        max_length=20,
        choices=[
            ('low', 'Low'),
            ('medium', 'Medium'),
            ('high', 'High'),
            ('critical', 'Critical'),
        ],
        default='medium'
    )
    
    # Risk ownership
    risk_owner = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='owned_risks',
        help_text='Person accountable for managing this risk'
    )
    
    # Organizational scope
    department = models.ForeignKey(
        'organizations.Department',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='risks',
        help_text='Affected department'
    )
    
    # Risk context
    potential_causes = models.TextField(
        blank=True,
        help_text='What could cause this risk to materialize'
    )
    potential_consequences = models.TextField(
        blank=True,
        help_text='What would happen if this risk occurs'
    )
    
    # Risk treatment
    treatment_strategy = models.CharField(
        max_length=20,
        choices=[
            ('mitigate', 'Mitigate/Reduce'),
            ('transfer', 'Transfer'),
            ('accept', 'Accept'),
            ('avoid', 'Avoid/Eliminate'),
        ],
        default='mitigate'
    )
    
    treatment_plan = models.TextField(
        blank=True,
        help_text='How the risk will be treated'
    )
    
    # Risk status
    status = models.CharField(
        max_length=20,
        choices=[
            ('identified', 'Identified'),
            ('assessing', 'Assessing'),
            ('treating', 'Treating'),
            ('monitoring', 'Monitoring'),
            ('closed', 'Closed'),
        ],
        default='identified',
        db_index=True
    )
    
    # Target risk (desired state after treatment)
    target_likelihood = models.IntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(10)],
        help_text='Target likelihood after treatment'
    )
    target_impact = models.IntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(10)],
        help_text='Target impact after treatment'
    )
    
    # Review tracking
    last_review_date = models.DateField(null=True, blank=True)
    next_review_date = models.DateField(null=True, blank=True)
    review_frequency_days = models.IntegerField(
        default=90,
        help_text='Review frequency in days'
    )
    
    # Tags and metadata
    tags = models.JSONField(
        default=list,
        blank=True,
        help_text='Tags for categorization'
    )
    
    class Meta:
        db_table = 'risks'
        ordering = ['-inherent_risk_score', 'title']
        indexes = [
            models.Index(fields=['company', 'status']),
            models.Index(fields=['company', 'risk_category']),
            models.Index(fields=['company', 'inherent_risk_level']),
            models.Index(fields=['risk_owner', 'status']),
            models.Index(fields=['next_review_date']),
        ]
    
    def __str__(self):
        return f"{self.risk_id or self.id}: {self.title}"
    
    def clean(self):
        """Validate risk"""
        # Ensure risk matrix belongs to same company
        if self.risk_matrix.company != self.company:
            raise ValidationError({
                'risk_matrix': 'Risk matrix must belong to the same company'
            })
        
        # Validate likelihood and impact against matrix
        if self.inherent_likelihood > self.risk_matrix.likelihood_levels:
            raise ValidationError({
                'inherent_likelihood': f'Must be between 1 and {self.risk_matrix.likelihood_levels}'
            })
        
        if self.inherent_impact > self.risk_matrix.impact_levels:
            raise ValidationError({
                'inherent_impact': f'Must be between 1 and {self.risk_matrix.impact_levels}'
            })
    
    def save(self, *args, **kwargs):
        """Override save to calculate inherent risk score"""
        # Calculate inherent risk score
        self.inherent_risk_score = self.risk_matrix.calculate_risk_score(
            self.inherent_likelihood,
            self.inherent_impact
        )
        
        # Determine inherent risk level
        self.inherent_risk_level = self.risk_matrix.get_risk_level(
            self.inherent_risk_score
        )
        
        super().save(*args, **kwargs)
    
    def get_current_residual_risk(self):
        """
        Get the most recent residual risk assessment
        
        Returns:
            RiskAssessment instance or None
        """
        return self.assessments.filter(
            is_current=True,
            is_deleted=False
        ).first()
    
    def is_overdue_for_review(self):
        """Check if risk review is overdue"""
        if not self.next_review_date:
            return False
        
        from django.utils import timezone
        return timezone.now().date() > self.next_review_date


class RiskAssessment(TenantMixin, TimeStampedModel, SoftDeleteModel):
    """
    Risk assessment linking risks to controls
    Calculates residual risk after controls are applied
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    risk = models.ForeignKey(
        Risk,
        on_delete=models.CASCADE,
        related_name='assessments'
    )
    
    # Applied controls for this risk
    applied_control = models.ForeignKey(
        'controls.AppliedControl',
        on_delete=models.CASCADE,
        related_name='risk_assessments'
    )
    
    # Control effectiveness assessment
    control_effectiveness = models.CharField(
        max_length=20,
        choices=[
            ('not_effective', 'Not Effective'),
            ('partially_effective', 'Partially Effective'),
            ('effective', 'Effective'),
            ('highly_effective', 'Highly Effective'),
        ],
        default='effective',
        help_text='How effective is this control at reducing the risk'
    )
    
    effectiveness_rating = models.IntegerField(
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        default=50,
        help_text='Effectiveness percentage (0-100%)'
    )
    
    # Residual risk (after controls)
    residual_likelihood = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(10)],
        help_text='Likelihood after control is applied'
    )
    residual_impact = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(10)],
        help_text='Impact after control is applied'
    )
    residual_score = models.IntegerField(
        default=0,
        help_text='Calculated residual risk score'
    )
    residual_risk_level = models.CharField(
        max_length=20,
        choices=[
            ('low', 'Low'),
            ('medium', 'Medium'),
            ('high', 'High'),
            ('critical', 'Critical'),
        ],
        default='medium'
    )
    
    # Assessment details
    assessment_date = models.DateField(
        help_text='When this assessment was performed'
    )
    assessed_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='risk_assessments'
    )
    
    assessment_notes = models.TextField(
        blank=True,
        help_text='Notes on the assessment'
    )
    
    # Assessment validity
    is_current = models.BooleanField(
        default=True,
        db_index=True,
        help_text='Whether this is the current assessment'
    )
    
    class Meta:
        db_table = 'risk_assessments'
        ordering = ['-assessment_date']
        indexes = [
            models.Index(fields=['company', 'risk']),
            models.Index(fields=['company', 'applied_control']),
            models.Index(fields=['risk', 'is_current']),
            models.Index(fields=['assessment_date']),
        ]
    
    def __str__(self):
        return f"Assessment: {self.risk.title} - {self.applied_control.reference_control.code}"
    
    def clean(self):
        """Validate risk assessment"""
        # Ensure risk and control belong to same company
        if self.risk.company != self.applied_control.company:
            raise ValidationError(
                'Risk and control must belong to the same company'
            )
        
        # Set company
        self.company = self.risk.company
    
    def save(self, *args, **kwargs):
        """Override save to calculate residual risk score"""
        # Calculate residual risk score
        risk_matrix = self.risk.risk_matrix
        
        self.residual_score = risk_matrix.calculate_risk_score(
            self.residual_likelihood,
            self.residual_impact
        )
        
        # Determine residual risk level
        self.residual_risk_level = risk_matrix.get_risk_level(
            self.residual_score
        )
        
        super().save(*args, **kwargs)
    
    def get_risk_reduction(self):
        """
        Calculate risk reduction percentage
        
        Returns:
            float: Percentage reduction (0-100)
        """
        inherent = self.risk.inherent_risk_score
        if inherent == 0:
            return 0
        
        reduction = ((inherent - self.residual_score) / inherent) * 100
        return max(0, min(100, reduction))


class RiskEvent(TenantMixin, TimeStampedModel, SoftDeleteModel):
    """
    Track when risks actually materialize (incidents)
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    risk = models.ForeignKey(
        Risk,
        on_delete=models.CASCADE,
        related_name='events'
    )
    
    # Event details
    event_date = models.DateField(
        help_text='When the risk event occurred'
    )
    title = models.CharField(max_length=500)
    description = models.TextField(
        help_text='What happened'
    )
    
    # Actual impact
    actual_likelihood = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(10)],
        help_text='How likely was it (realized as 100%)'
    )
    actual_impact = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(10)],
        help_text='Actual impact level'
    )
    
    # Financial impact
    financial_impact = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Actual financial cost'
    )
    
    # Response
    response_actions = models.TextField(
        blank=True,
        help_text='Actions taken in response'
    )
    lessons_learned = models.TextField(
        blank=True,
        help_text='What was learned from this event'
    )
    
    # Status
    is_resolved = models.BooleanField(default=False)
    resolution_date = models.DateField(null=True, blank=True)
    
    class Meta:
        db_table = 'risk_events'
        ordering = ['-event_date']
        indexes = [
            models.Index(fields=['company', 'risk']),
            models.Index(fields=['event_date']),
            models.Index(fields=['is_resolved']),
        ]
    
    def __str__(self):
        return f"{self.title} ({self.event_date})"


class RiskTreatmentAction(TenantMixin, TimeStampedModel, SoftDeleteModel):
    """
    Specific actions planned to treat/mitigate risks
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    risk = models.ForeignKey(
        Risk,
        on_delete=models.CASCADE,
        related_name='treatment_actions'
    )
    
    # Action details
    action_title = models.CharField(max_length=500)
    action_description = models.TextField()
    
    action_type = models.CharField(
        max_length=50,
        choices=[
            ('implement_control', 'Implement Control'),
            ('improve_control', 'Improve Existing Control'),
            ('transfer_risk', 'Transfer Risk'),
            ('policy_change', 'Policy Change'),
            ('training', 'Training/Awareness'),
            ('technology', 'Technology Implementation'),
            ('other', 'Other'),
        ],
        default='implement_control'
    )
    
    # Ownership and timeline
    action_owner = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='risk_actions'
    )
    
    due_date = models.DateField()
    completion_date = models.DateField(null=True, blank=True)
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=[
            ('planned', 'Planned'),
            ('in_progress', 'In Progress'),
            ('completed', 'Completed'),
            ('cancelled', 'Cancelled'),
        ],
        default='planned',
        db_index=True
    )
    
    # Progress tracking
    progress_percentage = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    progress_notes = models.TextField(blank=True)
    
    # Resource requirements
    estimated_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True
    )
    actual_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True
    )
    
    class Meta:
        db_table = 'risk_treatment_actions'
        ordering = ['due_date']
        indexes = [
            models.Index(fields=['company', 'risk']),
            models.Index(fields=['company', 'status']),
            models.Index(fields=['action_owner', 'status']),
            models.Index(fields=['due_date']),
        ]
    
    def __str__(self):
        return f"{self.action_title} ({self.status})"
    
    def is_overdue(self):
        """Check if action is overdue"""
        if self.status in ['completed', 'cancelled']:
            return False
        
        if not self.due_date:
            return False
        
        from django.utils import timezone
        return timezone.now().date() > self.due_date