"""
Business logic services for risk management
"""
from django.db import transaction
from django.db.models import Count, Q, Avg, Max, Min
from decimal import Decimal
from .models import Risk, RiskAssessment, RiskMatrix, RiskEvent


class RiskCalculationService:
    """Service for risk calculations"""
    
    @staticmethod
    @transaction.atomic
    def assess_risk_with_control(risk, applied_control, effectiveness_rating, user=None):
        """
        Create a risk assessment for a risk-control pair
        
        Args:
            risk: Risk instance
            applied_control: AppliedControl instance
            effectiveness_rating: int (0-100) - control effectiveness
            user: User performing assessment
        
        Returns:
            RiskAssessment instance
        """
        from django.utils import timezone
        
        # Mark previous assessments for this risk as not current
        RiskAssessment.objects.filter(
            risk=risk,
            is_current=True
        ).update(is_current=False)
        
        # Calculate residual risk based on effectiveness
        # Higher effectiveness = lower residual risk
        effectiveness_factor = effectiveness_rating / 100.0
        
        # Reduce likelihood and/or impact based on effectiveness
        reduction = int(effectiveness_factor * 2)  # 0-2 point reduction
        
        residual_likelihood = max(1, risk.inherent_likelihood - reduction)
        residual_impact = max(1, risk.inherent_impact - reduction)
        
        # Determine control effectiveness category
        if effectiveness_rating >= 90:
            control_effectiveness = 'highly_effective'
        elif effectiveness_rating >= 70:
            control_effectiveness = 'effective'
        elif effectiveness_rating >= 40:
            control_effectiveness = 'partially_effective'
        else:
            control_effectiveness = 'not_effective'
        
        # Create assessment
        assessment = RiskAssessment.objects.create(
            company=risk.company,
            risk=risk,
            applied_control=applied_control,
            control_effectiveness=control_effectiveness,
            effectiveness_rating=effectiveness_rating,
            residual_likelihood=residual_likelihood,
            residual_impact=residual_impact,
            assessment_date=timezone.now().date(),
            assessed_by=user,
            is_current=True
        )
        
        return assessment
    
    @staticmethod
    def calculate_aggregate_residual_risk(risk):
        """
        Calculate aggregate residual risk considering all controls
        
        Args:
            risk: Risk instance
        
        Returns:
            dict with residual risk metrics
        """
        assessments = RiskAssessment.objects.filter(
            risk=risk,
            is_current=True,
            is_deleted=False
        )
        
        if not assessments.exists():
            return {
                'residual_score': risk.inherent_risk_score,
                'residual_level': risk.inherent_risk_level,
                'control_count': 0,
                'avg_effectiveness': 0,
                'risk_reduction': 0
            }
        
        # Get best (lowest) residual score
        best_assessment = min(assessments, key=lambda a: a.residual_score)
        
        # Calculate average effectiveness
        avg_effectiveness = assessments.aggregate(
            avg=Avg('effectiveness_rating')
        )['avg'] or 0
        
        # Calculate risk reduction
        inherent = risk.inherent_risk_score
        residual = best_assessment.residual_score
        risk_reduction = ((inherent - residual) / inherent * 100) if inherent > 0 else 0
        
        return {
            'residual_score': best_assessment.residual_score,
            'residual_level': best_assessment.residual_risk_level,
            'residual_likelihood': best_assessment.residual_likelihood,
            'residual_impact': best_assessment.residual_impact,
            'control_count': assessments.count(),
            'avg_effectiveness': round(avg_effectiveness, 2),
            'risk_reduction': round(risk_reduction, 2)
        }


class RiskAnalyticsService:
    """Service for risk analytics and reporting"""
    
    @staticmethod
    def get_risk_register_summary(company):
        """
        Get risk register summary for company
        
        Args:
            company: Company instance
        
        Returns:
            dict with summary metrics
        """
        risks = Risk.objects.filter(
            company=company,
            is_deleted=False
        )
        
        total_risks = risks.count()
        
        if total_risks == 0:
            return {
                'total_risks': 0,
                'by_level': {},
                'by_category': {},
                'by_status': {},
                'avg_inherent_score': 0,
                'avg_residual_score': 0,
            }
        
        # By risk level
        by_level = risks.values('inherent_risk_level').annotate(
            count=Count('id')
        )
        
        # By category
        by_category = risks.values('risk_category').annotate(
            count=Count('id')
        )
        
        # By status
        by_status = risks.values('status').annotate(
            count=Count('id')
        )
        
        # Average scores
        avg_inherent = risks.aggregate(avg=Avg('inherent_risk_score'))['avg'] or 0
        
        # Calculate average residual score
        residual_scores = []
        for risk in risks:
            residual_data = RiskCalculationService.calculate_aggregate_residual_risk(risk)
            residual_scores.append(residual_data['residual_score'])
        
        avg_residual = sum(residual_scores) / len(residual_scores) if residual_scores else 0
        
        return {
            'total_risks': total_risks,
            'by_level': list(by_level),
            'by_category': list(by_category),
            'by_status': list(by_status),
            'avg_inherent_score': round(avg_inherent, 2),
            'avg_residual_score': round(avg_residual, 2),
        }
    
    @staticmethod
    def get_risk_heat_map_data(company):
        """
        Get data for risk heat map visualization
        
        Args:
            company: Company instance
        
        Returns:
            dict with heat map data
        """
        risks = Risk.objects.filter(
            company=company,
            is_deleted=False,
            status__in=['identified', 'assessing', 'treating', 'monitoring']
        )
        
        # Get active risk matrix
        matrix = RiskMatrix.objects.filter(
            company=company,
            is_active=True,
            is_deleted=False
        ).first()
        
        if not matrix:
            return {'inherent': [], 'residual': []}
        
        # Inherent risk distribution
        inherent_data = []
        for risk in risks:
            inherent_data.append({
                'risk_id': str(risk.id),
                'title': risk.title,
                'likelihood': risk.inherent_likelihood,
                'impact': risk.inherent_impact,
                'score': risk.inherent_risk_score,
                'level': risk.inherent_risk_level
            })
        
        # Residual risk distribution
        residual_data = []
        for risk in risks:
            residual = RiskCalculationService.calculate_aggregate_residual_risk(risk)
            residual_data.append({
                'risk_id': str(risk.id),
                'title': risk.title,
                'likelihood': residual.get('residual_likelihood', risk.inherent_likelihood),
                'impact': residual.get('residual_impact', risk.inherent_impact),
                'score': residual['residual_score'],
                'level': residual['residual_level']
            })
        
        return {
            'inherent': inherent_data,
            'residual': residual_data,
            'matrix': {
                'likelihood_levels': matrix.likelihood_levels,
                'impact_levels': matrix.impact_levels,
                'low_threshold': matrix.low_risk_threshold,
                'medium_threshold': matrix.medium_risk_threshold,
                'high_threshold': matrix.high_risk_threshold,
            }
        }
    
    @staticmethod
    def get_top_risks(company, limit=10):
        """
        Get top risks by inherent score
        
        Args:
            company: Company instance
            limit: Number of risks to return
        
        Returns:
            list of risks with residual data
        """
        risks = Risk.objects.filter(
            company=company,
            is_deleted=False,
            status__in=['identified', 'assessing', 'treating', 'monitoring']
        ).order_by('-inherent_risk_score')[:limit]
        
        top_risks = []
        for risk in risks:
            residual = RiskCalculationService.calculate_aggregate_residual_risk(risk)
            top_risks.append({
                'risk_id': str(risk.id),
                'title': risk.title,
                'category': risk.risk_category,
                'inherent_score': risk.inherent_risk_score,
                'inherent_level': risk.inherent_risk_level,
                'residual_score': residual['residual_score'],
                'residual_level': residual['residual_level'],
                'risk_reduction': residual['risk_reduction'],
                'control_count': residual['control_count'],
                'owner': risk.risk_owner.email if risk.risk_owner else None
            })
        
        return top_risks
    
    @staticmethod
    def get_risk_trends(company, months=12):
        """
        Get risk trends over time
        
        Args:
            company: Company instance
            months: Number of months to look back
        
        Returns:
            list of trend data
        """
        from django.utils import timezone
        from datetime import timedelta
        from dateutil.relativedelta import relativedelta
        
        end_date = timezone.now().date()
        start_date = end_date - relativedelta(months=months)
        
        # Get risk assessments over time
        assessments = RiskAssessment.objects.filter(
            company=company,
            assessment_date__gte=start_date,
            assessment_date__lte=end_date,
            is_deleted=False
        ).order_by('assessment_date')
        
        # Group by month
        trends = {}
        for assessment in assessments:
            month_key = assessment.assessment_date.strftime('%Y-%m')
            
            if month_key not in trends:
                trends[month_key] = {
                    'month': month_key,
                    'residual_scores': [],
                    'assessment_count': 0
                }
            
            trends[month_key]['residual_scores'].append(assessment.residual_score)
            trends[month_key]['assessment_count'] += 1
        
        # Calculate averages
        trend_data = []
        for month_key in sorted(trends.keys()):
            scores = trends[month_key]['residual_scores']
            avg_score = sum(scores) / len(scores) if scores else 0
            
            trend_data.append({
                'month': month_key,
                'avg_residual_score': round(avg_score, 2),
                'assessment_count': trends[month_key]['assessment_count']
            })
        
        return trend_data


class RiskRecommendationService:
    """Service for risk treatment recommendations"""
    
    @staticmethod
    def get_risk_treatment_priorities(company):
        """
        Get prioritized list of risks needing treatment
        
        Args:
            company: Company instance
        
        Returns:
            list of prioritized risks
        """
        risks = Risk.objects.filter(
            company=company,
            is_deleted=False,
            status__in=['identified', 'assessing', 'treating']
        ).order_by('-inherent_risk_score')
        
        priorities = []
        
        for risk in risks:
            residual = RiskCalculationService.calculate_aggregate_residual_risk(risk)
            
            # Determine priority
            if residual['residual_level'] in ['critical', 'high']:
                priority = 'critical'
            elif residual['residual_level'] == 'medium' and residual['control_count'] < 2:
                priority = 'high'
            elif residual['control_count'] == 0:
                priority = 'high'
            else:
                priority = 'medium'
            
            # Generate recommendation
            if residual['control_count'] == 0:
                recommendation = "Implement controls to mitigate this risk"
            elif residual['residual_level'] in ['critical', 'high']:
                recommendation = "Additional controls needed to reduce residual risk"
            elif residual['avg_effectiveness'] < 70:
                recommendation = "Improve effectiveness of existing controls"
            else:
                recommendation = "Monitor and maintain current controls"
            
            priorities.append({
                'risk_id': str(risk.id),
                'title': risk.title,
                'priority': priority,
                'inherent_level': risk.inherent_risk_level,
                'residual_level': residual['residual_level'],
                'control_count': residual['control_count'],
                'avg_effectiveness': residual['avg_effectiveness'],
                'recommendation': recommendation
            })
        
        # Sort by priority
        priority_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
        priorities.sort(key=lambda x: priority_order.get(x['priority'], 99))
        
        return priorities[:20]  # Top 20