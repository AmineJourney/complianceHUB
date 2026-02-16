"""
Business logic services for compliance calculation and analysis
"""
from django.db import transaction
from django.db.models import Count, Q, Avg
from decimal import Decimal
from .models import ComplianceResult, ComplianceGap, FrameworkAdoption


class ComplianceCalculationService:
    """Service for calculating compliance metrics"""
    
    @staticmethod
    @transaction.atomic
    def calculate_framework_compliance(company, framework, department=None, user=None):
        """
        Calculate compliance coverage for a framework
        
        Args:
            company: Company instance
            framework: Framework instance
            department: Optional Department instance
            user: Optional User who triggered calculation
        
        Returns:
            ComplianceResult instance
        """
        from library.models import Requirement
        from controls.models import AppliedControl, RequirementReferenceControl
        from evidence.models import AppliedControlEvidence
        
        # Mark previous results as not current
        ComplianceResult.objects.filter(
            company=company,
            framework=framework,
            department=department,
            is_current=True
        ).update(is_current=False)
        
        # Get all requirements for framework
        requirements = Requirement.objects.filter(
            framework=framework,
            is_deleted=False,
            is_mandatory=True  # Only mandatory requirements
        )
        
        total_requirements = requirements.count()
        
        if total_requirements == 0:
            # No requirements, return empty result
            return ComplianceResult.objects.create(
                company=company,
                framework=framework,
                department=department,
                coverage_percentage=0,
                compliance_score=0,
                total_requirements=0,
                calculated_by=user
            )
        
        # Initialize counters
        requirements_addressed = 0
        requirements_compliant = 0
        requirements_partial = 0
        requirements_non_compliant = 0
        
        requirement_details = {}
        control_summary = {
            'total': 0,
            'operational': 0,
            'implemented': 0,
            'in_progress': 0,
            'not_started': 0,
        }
        
        evidence_summary = {
            'controls_with_evidence': 0,
            'total_evidence': 0,
        }
        
        total_compliance_points = 0
        max_compliance_points = 0
        
        # Analyze each requirement
        for requirement in requirements:
            # Get control mappings for this requirement
            mappings = RequirementReferenceControl.objects.filter(
                requirement=requirement,
                validation_status='validated',
                is_deleted=False
            ).select_related('reference_control')
            
            mapped_controls = [m.reference_control for m in mappings]
            
            if not mapped_controls:
                requirements_non_compliant += 1
                requirement_details[str(requirement.id)] = {
                    'code': requirement.code,
                    'title': requirement.title,
                    'status': 'no_controls',
                    'controls': [],
                    'score': 0
                }
                continue
            
            # Get applied controls for this requirement
            applied_controls = AppliedControl.objects.filter(
                company=company,
                reference_control__in=mapped_controls,
                is_deleted=False
            )
            
            if department:
                applied_controls = applied_controls.filter(
                    Q(department=department) | Q(department__isnull=True)
                )
            
            if not applied_controls.exists():
                requirements_non_compliant += 1
                requirement_details[str(requirement.id)] = {
                    'code': requirement.code,
                    'title': requirement.title,
                    'status': 'not_implemented',
                    'controls': [],
                    'score': 0
                }
                continue
            
            requirements_addressed += 1
            
            # Calculate requirement compliance score
            control_scores = []
            control_info = []
            
            for control in applied_controls:
                control_score = control.calculate_compliance_score()
                control_scores.append(control_score)
                
                # Track control status
                control_summary['total'] += 1
                if control.status == 'operational':
                    control_summary['operational'] += 1
                elif control.status in ['implemented', 'testing']:
                    control_summary['implemented'] += 1
                elif control.status == 'in_progress':
                    control_summary['in_progress'] += 1
                else:
                    control_summary['not_started'] += 1
                
                # Check evidence
                evidence_count = AppliedControlEvidence.objects.filter(
                    applied_control=control,
                    is_deleted=False
                ).count()
                
                if evidence_count > 0:
                    evidence_summary['controls_with_evidence'] += 1
                    evidence_summary['total_evidence'] += evidence_count
                
                control_info.append({
                    'id': str(control.id),
                    'code': control.reference_control.code,
                    'name': control.reference_control.name,
                    'status': control.status,
                    'score': control_score,
                    'evidence_count': evidence_count
                })
            
            # Average score across all controls
            avg_score = sum(control_scores) / len(control_scores)
            
            # Classify requirement
            if avg_score >= 85:
                requirements_compliant += 1
                req_status = 'compliant'
            elif avg_score >= 50:
                requirements_partial += 1
                req_status = 'partial'
            else:
                requirements_non_compliant += 1
                req_status = 'non_compliant'
            
            requirement_details[str(requirement.id)] = {
                'code': requirement.code,
                'title': requirement.title,
                'status': req_status,
                'score': round(avg_score, 2),
                'controls': control_info
            }
            
            # Accumulate points
            total_compliance_points += avg_score
            max_compliance_points += 100
        
        # Calculate overall metrics
        coverage_percentage = (requirements_addressed / total_requirements) * 100
        compliance_score = (total_compliance_points / max_compliance_points) * 100 if max_compliance_points > 0 else 0
        
        # Identify gaps
        gap_counts = ComplianceCalculationService._identify_gaps(
            company, framework, department, requirement_details
        )
        
        # Create compliance result
        result = ComplianceResult.objects.create(
            company=company,
            framework=framework,
            department=department,
            coverage_percentage=round(Decimal(coverage_percentage), 2),
            compliance_score=round(Decimal(compliance_score), 2),
            total_requirements=total_requirements,
            requirements_addressed=requirements_addressed,
            requirements_compliant=requirements_compliant,
            requirements_partial=requirements_partial,
            requirements_non_compliant=requirements_non_compliant,
            total_controls=control_summary['total'],
            controls_operational=control_summary['operational'],
            controls_implemented=control_summary['implemented'],
            controls_in_progress=control_summary['in_progress'],
            controls_not_started=control_summary['not_started'],
            controls_with_evidence=evidence_summary['controls_with_evidence'],
            total_evidence_count=evidence_summary['total_evidence'],
            high_risk_gaps=gap_counts['high'],
            medium_risk_gaps=gap_counts['medium'],
            low_risk_gaps=gap_counts['low'],
            requirement_details=requirement_details,
            control_details=control_summary,
            calculated_by=user,
            status='completed',
            is_current=True
        )
        
        return result
    
    @staticmethod
    def _identify_gaps(company, framework, department, requirement_details):
        """
        Identify compliance gaps and classify by risk
        
        Returns:
            dict with gap counts by severity
        """
        gap_counts = {'high': 0, 'medium': 0, 'low': 0}
        
        for req_id, req_data in requirement_details.items():
            if req_data['status'] in ['no_controls', 'not_implemented']:
                gap_counts['high'] += 1
            elif req_data['status'] == 'non_compliant':
                gap_counts['high'] += 1
            elif req_data['status'] == 'partial':
                gap_counts['medium'] += 1
        
        return gap_counts
    
    @staticmethod
    def calculate_all_frameworks(company):
        """
        Calculate compliance for all adopted frameworks
        
        Args:
            company: Company instance
        
        Returns:
            list of ComplianceResult instances
        """
        adoptions = FrameworkAdoption.objects.filter(
            company=company,
            is_deleted=False
        ).select_related('framework')
        
        results = []
        for adoption in adoptions:
            result = ComplianceCalculationService.calculate_framework_compliance(
                company=company,
                framework=adoption.framework
            )
            results.append(result)
        
        return results


class ComplianceAnalyticsService:
    """Service for compliance analytics and reporting"""
    
    @staticmethod
    def get_company_compliance_overview(company):
        """
        Get comprehensive compliance overview for company
        
        Args:
            company: Company instance
        
        Returns:
            dict with overview metrics
        """
        # Get current results
        current_results = ComplianceResult.objects.filter(
            company=company,
            is_current=True,
            is_deleted=False
        ).select_related('framework')
        
        if not current_results.exists():
            return {
                'total_frameworks': 0,
                'avg_compliance_score': 0,
                'frameworks': []
            }
        
        # Calculate averages
        avg_score = current_results.aggregate(
            avg=Avg('compliance_score')
        )['avg']
        
        avg_coverage = current_results.aggregate(
            avg=Avg('coverage_percentage')
        )['avg']
        
        # Framework breakdown
        frameworks = []
        for result in current_results:
            frameworks.append({
                'framework_id': str(result.framework.id),
                'framework_code': result.framework.code,
                'framework_name': result.framework.name,
                'compliance_score': float(result.compliance_score),
                'coverage_percentage': float(result.coverage_percentage),
                'grade': result.get_compliance_grade(),
                'status': result.get_compliance_status(),
                'gap_count': result.get_gap_count()
            })
        
        return {
            'total_frameworks': current_results.count(),
            'avg_compliance_score': round(float(avg_score), 2) if avg_score else 0,
            'avg_coverage': round(float(avg_coverage), 2) if avg_coverage else 0,
            'frameworks': frameworks
        }
    
    @staticmethod
    def get_compliance_trends(company, framework, months=12):
        """
        Get compliance trend over time
        
        Args:
            company: Company instance
            framework: Framework instance
            months: Number of months to look back
        
        Returns:
            list of trend data points
        """
        from django.utils import timezone
        from datetime import timedelta
        
        start_date = timezone.now() - timedelta(days=months*30)
        
        results = ComplianceResult.objects.filter(
            company=company,
            framework=framework,
            calculation_date__gte=start_date,
            status='completed',
            is_deleted=False
        ).order_by('calculation_date')
        
        trends = []
        for result in results:
            trends.append({
                'date': result.calculation_date.date().isoformat(),
                'compliance_score': float(result.compliance_score),
                'coverage_percentage': float(result.coverage_percentage),
                'grade': result.get_compliance_grade()
            })
        
        return trends
    
    @staticmethod
    def get_gap_analysis(company, framework):
        """
        Get detailed gap analysis
        
        Args:
            company: Company instance
            framework: Framework instance
        
        Returns:
            dict with gap analysis
        """
        # Get current result
        result = ComplianceResult.objects.filter(
            company=company,
            framework=framework,
            is_current=True,
            is_deleted=False
        ).first()
        
        if not result:
            return {'gaps': [], 'total': 0}
        
        gaps = []
        
        # Parse requirement details to identify gaps
        for req_id, req_data in result.requirement_details.items():
            if req_data['status'] in ['no_controls', 'not_implemented', 'non_compliant', 'partial']:
                gap = {
                    'requirement_code': req_data['code'],
                    'requirement_title': req_data['title'],
                    'status': req_data['status'],
                    'score': req_data.get('score', 0),
                    'controls': req_data.get('controls', [])
                }
                
                # Determine severity
                if req_data['status'] in ['no_controls', 'not_implemented']:
                    gap['severity'] = 'high'
                elif req_data['status'] == 'non_compliant':
                    gap['severity'] = 'high'
                elif req_data['status'] == 'partial':
                    gap['severity'] = 'medium'
                
                gaps.append(gap)
        
        return {
            'gaps': gaps,
            'total': len(gaps),
            'by_severity': {
                'high': len([g for g in gaps if g['severity'] == 'high']),
                'medium': len([g for g in gaps if g['severity'] == 'medium']),
                'low': len([g for g in gaps if g['severity'] == 'low']),
            }
        }


class ComplianceRecommendationService:
    """Service for compliance recommendations"""
    
    @staticmethod
    def get_prioritized_actions(company, framework):
        """
        Get prioritized list of actions to improve compliance
        
        Args:
            company: Company instance
            framework: Framework instance
        
        Returns:
            list of recommended actions
        """
        from controls.models import AppliedControl
        
        # Get current compliance result
        result = ComplianceResult.objects.filter(
            company=company,
            framework=framework,
            is_current=True,
            is_deleted=False
        ).first()
        
        if not result:
            return []
        
        actions = []
        
        # 1. Address missing controls (highest priority)
        for req_id, req_data in result.requirement_details.items():
            if req_data['status'] in ['no_controls', 'not_implemented']:
                actions.append({
                    'priority': 'critical',
                    'type': 'implement_controls',
                    'requirement': req_data['code'],
                    'title': f"Implement controls for {req_data['code']}",
                    'description': f"Requirement '{req_data['title']}' has no controls implemented",
                    'estimated_impact': 'high'
                })
        
        # 2. Address controls without evidence
        controls_no_evidence = AppliedControl.objects.filter(
            company=company,
            is_deleted=False
        ).annotate(
            evidence_count=Count('evidence_links', filter=Q(evidence_links__is_deleted=False))
        ).filter(evidence_count=0)[:10]
        
        for control in controls_no_evidence:
            actions.append({
                'priority': 'high',
                'type': 'add_evidence',
                'control': control.reference_control.code,
                'title': f"Add evidence for {control.reference_control.code}",
                'description': f"Control '{control.reference_control.name}' has no evidence",
                'estimated_impact': 'medium'
            })
        
        # 3. Address overdue reviews
        overdue_controls = AppliedControl.objects.filter(
            company=company,
            is_deleted=False
        ).filter(
            next_review_date__lt=timezone.now().date()
        )[:10]
        
        for control in overdue_controls:
            actions.append({
                'priority': 'medium',
                'type': 'review_control',
                'control': control.reference_control.code,
                'title': f"Review {control.reference_control.code}",
                'description': f"Control review is overdue since {control.next_review_date}",
                'estimated_impact': 'low'
            })
        
        # Sort by priority
        priority_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
        actions.sort(key=lambda x: priority_order.get(x['priority'], 99))
        
        return actions[:20]  # Return top 20