# backend/compliance/services/compliance_engine.py

from django.db.models import Count, Q, Avg, F
from django.utils import timezone
from controls.models import AppliedControl, UnifiedControl, UnifiedControlMapping
from library.models import Framework, Requirement


class ComplianceCalculationEngine:
    """
    Advanced compliance calculation engine using unified control model
    
    Resolves the chain:
    Framework → Requirement → ReferenceControl → UnifiedControl → AppliedControl → Evidence
    """
    
    def __init__(self, company):
        self.company = company
    
    def calculate_framework_compliance(self, framework, include_details=False):
        """
        Calculate compliance for a specific framework
        
        Returns:
            dict with compliance metrics
        """
        # Step 1: Get all requirements for framework
        requirements = Requirement.objects.filter(
            framework=framework,
            is_deleted=False
        )
        
        # Step 2: Get all reference controls mapped to these requirements
        from controls.models import RequirementReferenceControl
        ref_control_mappings = RequirementReferenceControl.objects.filter(
            requirement__in=requirements,
            is_deleted=False
        ).select_related('reference_control')
        
        # Step 3: Get unified controls mapped to these reference controls
        unified_mappings = UnifiedControlMapping.objects.filter(
            reference_control__in=[m.reference_control for m in ref_control_mappings]
        ).select_related('unified_control')
        
        # Step 4: Get company's implementations of these unified controls
        unified_control_ids = [m.unified_control.id for m in unified_mappings]
        implementations = AppliedControl.objects.filter(
            company=self.company,
            unified_control_id__in=unified_control_ids,
            is_deleted=False
        ).select_related('unified_control')
        
        # Step 5: Calculate metrics
        total_controls = len(unified_control_ids)
        implemented = implementations.filter(
            status__in=['implemented', 'operational']
        ).count()
        
        in_progress = implementations.filter(
            status='in_progress'
        ).count()
        
        not_started = total_controls - implementations.count()
        
        # Calculate compliance percentage
        compliance_percentage = (implemented / total_controls * 100) if total_controls > 0 else 0
        
        # Calculate average maturity
        avg_maturity = implementations.aggregate(
            avg=Avg('maturity_level')
        )['avg'] or 0
        
        # Count evidence
        from evidence.models import AppliedControlEvidence
        evidence_count = AppliedControlEvidence.objects.filter(
            applied_control__in=implementations,
            is_deleted=False
        ).count()
        
        result = {
            'framework_id': str(framework.id),
            'framework_code': framework.code,
            'framework_name': framework.name,
            'total_unified_controls': total_controls,
            'implemented_controls': implemented,
            'in_progress_controls': in_progress,
            'not_started_controls': not_started,
            'compliance_percentage': round(compliance_percentage, 2),
            'average_maturity_level': round(avg_maturity, 2),
            'total_evidence': evidence_count,
            'calculated_at': timezone.now().isoformat(),
        }
        
        if include_details:
            result['gaps'] = self._identify_gaps(
                requirements,
                ref_control_mappings,
                unified_mappings,
                implementations
            )
        
        return result
    
    def _identify_gaps(self, requirements, ref_mappings, unified_mappings, implementations):
        """Identify compliance gaps"""
        gaps = []
        
        # Build lookup dictionaries
        impl_by_unified = {impl.unified_control_id: impl for impl in implementations}
        unified_by_ref = {}
        for um in unified_mappings:
            if um.reference_control_id not in unified_by_ref:
                unified_by_ref[um.reference_control_id] = []
            unified_by_ref[um.reference_control_id].append(um)
        
        # Check each requirement
        for ref_mapping in ref_mappings:
            ref_control = ref_mapping.reference_control
            requirement = ref_mapping.requirement
            
            # Get unified controls for this reference control
            unified_maps = unified_by_ref.get(ref_control.id, [])
            
            if not unified_maps:
                # Gap: No unified control mapped
                gaps.append({
                    'requirement_code': requirement.code,
                    'requirement_title': requirement.name,
                    'reference_control_code': ref_control.code,
                    'gap_type': 'no_mapping',
                    'severity': 'high',
                    'recommendation': f'Map reference control {ref_control.code} to a unified control'
                })
                continue
            
            for unified_map in unified_maps:
                impl = impl_by_unified.get(unified_map.unified_control_id)
                
                if not impl:
                    # Gap: Not implemented
                    gaps.append({
                        'requirement_code': requirement.code,
                        'requirement_title': requirement.name,
                        'reference_control_code': ref_control.code,
                        'unified_control_code': unified_map.unified_control.control_code,
                        'gap_type': 'not_implemented',
                        'severity': 'critical',
                        'recommendation': f'Implement unified control {unified_map.unified_control.control_code}'
                    })
                elif impl.status in ['not_started', 'in_progress']:
                    # Gap: Partially implemented
                    gaps.append({
                        'requirement_code': requirement.code,
                        'requirement_title': requirement.name,
                        'unified_control_code': unified_map.unified_control.control_code,
                        'current_status': impl.status,
                        'gap_type': 'partial_implementation',
                        'severity': 'medium',
                        'recommendation': f'Complete implementation of {unified_map.unified_control.control_code}'
                    })
        
        return gaps