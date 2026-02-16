"""
Business logic services for control management
"""
from django.db import transaction
from django.db.models import Count, Q, Avg
from django.utils import timezone
from .models import ReferenceControl, AppliedControl, RequirementReferenceControl


class ControlApplicationService:
    """Service for applying reference controls to companies"""
    
    @staticmethod
    @transaction.atomic
    def apply_control(company, reference_control, department=None, control_owner=None, **kwargs):
        """
        Apply a reference control to a company
        
        Args:
            company: Company instance
            reference_control: ReferenceControl instance
            department: Optional Department instance
            control_owner: Optional User instance
            **kwargs: Additional AppliedControl fields
        
        Returns:
            AppliedControl instance
        """
        # Check if already applied
        existing = AppliedControl.objects.filter(
            company=company,
            reference_control=reference_control,
            department=department,
            is_deleted=False
        ).first()
        
        if existing:
            return existing
        
        # Create applied control
        applied_control = AppliedControl.objects.create(
            company=company,
            reference_control=reference_control,
            department=department,
            control_owner=control_owner,
            status=kwargs.get('status', 'not_started'),
            implementation_notes=kwargs.get('implementation_notes', ''),
            custom_procedures=kwargs.get('custom_procedures', ''),
        )
        
        return applied_control
    
    @staticmethod
    @transaction.atomic
    def apply_controls_for_framework(company, framework, department=None):
        """
        Apply all controls mapped to a framework's requirements
        
        Args:
            company: Company instance
            framework: Framework instance
            department: Optional Department instance
        
        Returns:
            List of created AppliedControl instances
        """
        # Get all requirements for framework
        requirements = framework.requirements.filter(is_deleted=False)
        
        # Get all control mappings
        mappings = RequirementReferenceControl.objects.filter(
            requirement__in=requirements,
            is_primary=True,  # Only primary controls
            validation_status='validated',
            is_deleted=False
        ).select_related('reference_control')
        
        # Get unique controls
        controls = {mapping.reference_control for mapping in mappings}
        
        # Apply each control
        applied_controls = []
        for control in controls:
            applied = ControlApplicationService.apply_control(
                company=company,
                reference_control=control,
                department=department
            )
            applied_controls.append(applied)
        
        return applied_controls
    
    @staticmethod
    def get_control_coverage_for_requirement(company, requirement):
        """
        Calculate control coverage for a specific requirement
        
        Args:
            company: Company instance
            requirement: Requirement instance
        
        Returns:
            dict with coverage details
        """
        # Get control mappings for requirement
        mappings = RequirementReferenceControl.objects.filter(
            requirement=requirement,
            validation_status='validated',
            is_deleted=False
        ).select_related('reference_control')
        
        total_controls = mappings.count()
        if total_controls == 0:
            return {
                'total_controls': 0,
                'implemented_controls': 0,
                'coverage_percentage': 0,
                'status': 'no_controls'
            }
        
        # Get applied controls
        reference_control_ids = [m.reference_control.id for m in mappings]
        applied_controls = AppliedControl.objects.filter(
            company=company,
            reference_control_id__in=reference_control_ids,
            is_deleted=False
        )
        
        # Count by status
        operational_count = applied_controls.filter(
            status='operational'
        ).count()
        
        implemented_count = applied_controls.filter(
            status__in=['implemented', 'testing', 'operational']
        ).count()
        
        # Calculate coverage
        coverage_percentage = (implemented_count / total_controls) * 100
        
        # Determine overall status
        if operational_count == total_controls:
            status = 'fully_compliant'
        elif implemented_count > 0:
            status = 'partially_compliant'
        else:
            status = 'not_compliant'
        
        return {
            'total_controls': total_controls,
            'implemented_controls': implemented_count,
            'operational_controls': operational_count,
            'coverage_percentage': round(coverage_percentage, 2),
            'status': status
        }


class ControlAnalyticsService:
    """Service for control analytics and reporting"""
    
    @staticmethod
    def get_company_control_dashboard(company):
        """
        Get comprehensive control dashboard for a company
        
        Args:
            company: Company instance
        
        Returns:
            dict with dashboard metrics
        """
        applied_controls = AppliedControl.objects.filter(
            company=company,
            is_deleted=False
        )
        
        total_controls = applied_controls.count()
        
        # Status breakdown
        status_breakdown = applied_controls.values('status').annotate(
            count=Count('id')
        )
        
        # Calculate compliance score
        compliance_scores = [
            control.calculate_compliance_score() 
            for control in applied_controls
        ]
        avg_compliance_score = sum(compliance_scores) / len(compliance_scores) if compliance_scores else 0
        
        # Controls by family
        family_breakdown = applied_controls.values(
            'reference_control__control_family'
        ).annotate(count=Count('id'))
        
        # Overdue reviews
        overdue_reviews = applied_controls.filter(
            next_review_date__lt=timezone.now().date()
        ).count()
        
        # Deficiencies
        controls_with_deficiencies = applied_controls.filter(
            has_deficiencies=True
        ).count()
        
        # Evidence coverage
        controls_with_evidence = applied_controls.annotate(
            evidence_count=Count('evidence_links', filter=Q(evidence_links__is_deleted=False))
        ).filter(evidence_count__gt=0).count()
        
        return {
            'total_controls': total_controls,
            'status_breakdown': list(status_breakdown),
            'avg_compliance_score': round(avg_compliance_score, 2),
            'family_breakdown': list(family_breakdown),
            'overdue_reviews': overdue_reviews,
            'controls_with_deficiencies': controls_with_deficiencies,
            'evidence_coverage_percentage': round(
                (controls_with_evidence / total_controls * 100) if total_controls > 0 else 0,
                2
            )
        }
    
    @staticmethod
    def get_control_effectiveness_metrics(company):
        """
        Calculate control effectiveness metrics
        
        Args:
            company: Company instance
        
        Returns:
            dict with effectiveness metrics
        """
        applied_controls = AppliedControl.objects.filter(
            company=company,
            is_deleted=False,
            effectiveness_rating__isnull=False
        )
        
        if not applied_controls.exists():
            return {
                'avg_effectiveness': None,
                'tested_controls': 0,
                'untested_controls': AppliedControl.objects.filter(
                    company=company,
                    is_deleted=False
                ).count()
            }
        
        avg_effectiveness = applied_controls.aggregate(
            avg=Avg('effectiveness_rating')
        )['avg']
        
        tested_controls = AppliedControl.objects.filter(
            company=company,
            is_deleted=False,
            last_tested_date__isnull=False
        ).count()
        
        untested_controls = AppliedControl.objects.filter(
            company=company,
            is_deleted=False,
            last_tested_date__isnull=True
        ).count()
        
        return {
            'avg_effectiveness': round(avg_effectiveness, 2) if avg_effectiveness else None,
            'tested_controls': tested_controls,
            'untested_controls': untested_controls
        }