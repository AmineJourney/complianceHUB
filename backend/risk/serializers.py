from rest_framework import serializers
from .models import (
    RiskMatrix, Risk, RiskAssessment, RiskEvent, RiskTreatmentAction
)
from .services import RiskCalculationService


class RiskMatrixSerializer(serializers.ModelSerializer):
    """Risk matrix serializer"""
    
    is_certification_expired = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = RiskMatrix
        fields = [
            'id', 'company', 'name', 'description', 'likelihood_levels',
            'impact_levels', 'likelihood_definitions', 'impact_definitions',
            'risk_score_matrix', 'low_risk_threshold', 'medium_risk_threshold',
            'high_risk_threshold', 'is_active', 'created_at', 'updated_at','is_certification_expired',
        ]
        read_only_fields = ['id', 'company', 'created_at', 'updated_at']
    
    def validate(self, attrs):
        """Validate risk matrix"""
        request = self.context.get('request')
        
        # Set company from request
        if hasattr(request, 'tenant'):
            attrs['company'] = request.tenant
        
        return attrs


class RiskSerializer(serializers.ModelSerializer):
    """Risk serializer"""
    
    risk_owner_email = serializers.CharField(
        source='risk_owner.email',
        read_only=True
    )
    department_name = serializers.CharField(
        source='department.name',
        read_only=True
    )
    residual_risk_data = serializers.SerializerMethodField()
    is_overdue = serializers.BooleanField(
        source='is_overdue_for_review',
        read_only=True
    )
    
    class Meta:
        model = Risk
        fields = [
            'id', 'company', 'risk_matrix', 'title', 'description', 'risk_id',
            'risk_category', 'risk_source', 'inherent_likelihood', 'inherent_impact',
            'inherent_risk_score', 'inherent_risk_level', 'risk_owner',
            'risk_owner_email', 'department', 'department_name',
            'potential_causes', 'potential_consequences', 'treatment_strategy',
            'treatment_plan', 'status', 'target_likelihood', 'target_impact',
            'last_review_date', 'next_review_date', 'review_frequency_days',
            'tags', 'residual_risk_data', 'is_overdue',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'company', 'inherent_risk_score', 'inherent_risk_level',
            'created_at', 'updated_at'
        ]
    
    def get_residual_risk_data(self, obj):
        """Get current residual risk data"""
        return RiskCalculationService.calculate_aggregate_residual_risk(obj)
    
    def validate(self, attrs):
        """Validate risk"""
        request = self.context.get('request')
        
        # Set company from request
        if hasattr(request, 'tenant'):
            attrs['company'] = request.tenant
        
        # Validate risk matrix belongs to company
        risk_matrix = attrs.get('risk_matrix', getattr(self.instance, 'risk_matrix', None))
        if risk_matrix and risk_matrix.company != attrs['company']:
            raise serializers.ValidationError({
                'risk_matrix': 'Risk matrix must belong to your company'
            })
        
        # Validate department belongs to company
        department = attrs.get('department')
        if department and department.company != attrs['company']:
            raise serializers.ValidationError({
                'department': 'Department must belong to your company'
            })
        
        # Validate owner is member of company
        risk_owner = attrs.get('risk_owner')
        if risk_owner:
            from core.models import Membership
            is_member = Membership.objects.filter(
                user=risk_owner,
                company=attrs['company'],
                is_deleted=False
            ).exists()
            
            if not is_member:
                raise serializers.ValidationError({
                    'risk_owner': 'Risk owner must be a member of the company'
                })
        
        return attrs


class RiskListSerializer(serializers.ModelSerializer):
    """Lightweight risk serializer for lists"""
    
    risk_owner_email = serializers.CharField(source='risk_owner.email')
    residual_level = serializers.SerializerMethodField()
    
    class Meta:
        model = Risk
        fields = [
            'id', 'risk_id', 'title', 'risk_category', 'inherent_risk_score',
            'inherent_risk_level', 'residual_level', 'status', 'risk_owner_email',
            'next_review_date'
        ]
    
    def get_residual_level(self, obj):
        """Get current residual risk level"""
        residual = RiskCalculationService.calculate_aggregate_residual_risk(obj)
        return residual['residual_level']


class RiskAssessmentSerializer(serializers.ModelSerializer):
    """Risk assessment serializer"""
    
    risk_title = serializers.CharField(source='risk.title', read_only=True)
    control_code = serializers.CharField(
        source='applied_control.reference_control.code',
        read_only=True
    )
    control_name = serializers.CharField(
        source='applied_control.reference_control.name',
        read_only=True
    )
    assessed_by_email = serializers.CharField(
        source='assessed_by.email',
        read_only=True
    )
    risk_reduction = serializers.SerializerMethodField()
    
    class Meta:
        model = RiskAssessment
        fields = [
            'id', 'company', 'risk', 'risk_title', 'applied_control',
            'control_code', 'control_name', 'control_effectiveness',
            'effectiveness_rating', 'residual_likelihood', 'residual_impact',
            'residual_score', 'residual_risk_level', 'assessment_date',
            'assessed_by', 'assessed_by_email', 'assessment_notes',
            'is_current', 'risk_reduction', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'company', 'residual_score', 'residual_risk_level',
            'created_at', 'updated_at'
        ]
    
    def get_risk_reduction(self, obj):
        """Get risk reduction percentage"""
        return obj.get_risk_reduction()
    
    def validate(self, attrs):
        """Validate assessment"""
        request = self.context.get('request')
        
        # Set company from request
        if hasattr(request, 'tenant'):
            attrs['company'] = request.tenant
        
        # Validate risk and control belong to company
        risk = attrs.get('risk', getattr(self.instance, 'risk', None))
        applied_control = attrs.get('applied_control', getattr(self.instance, 'applied_control', None))
        
        if risk and risk.company != attrs['company']:
            raise serializers.ValidationError({
                'risk': 'Risk must belong to your company'
            })
        
        if applied_control and applied_control.company != attrs['company']:
            raise serializers.ValidationError({
                'applied_control': 'Control must belong to your company'
            })
        
        # Set assessed_by
        if not self.instance and request:
            attrs['assessed_by'] = request.user
        
        return attrs


class RiskEventSerializer(serializers.ModelSerializer):
    """Risk event serializer"""
    
    risk_title = serializers.CharField(source='risk.title', read_only=True)
    
    class Meta:
        model = RiskEvent
        fields = [
            'id', 'company', 'risk', 'risk_title', 'event_date', 'title',
            'description', 'actual_likelihood', 'actual_impact',
            'financial_impact', 'response_actions', 'lessons_learned',
            'is_resolved', 'resolution_date', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'company', 'created_at', 'updated_at']
    
    def validate(self, attrs):
        """Validate event"""
        request = self.context.get('request')
        
        # Set company from request
        if hasattr(request, 'tenant'):
            attrs['company'] = request.tenant
        
        # Validate risk belongs to company
        risk = attrs.get('risk', getattr(self.instance, 'risk', None))
        if risk and risk.company != attrs['company']:
            raise serializers.ValidationError({
                'risk': 'Risk must belong to your company'
            })
        
        return attrs


class RiskTreatmentActionSerializer(serializers.ModelSerializer):
    """Risk treatment action serializer"""
    
    risk_title = serializers.CharField(source='risk.title', read_only=True)
    action_owner_email = serializers.CharField(
        source='action_owner.email',
        read_only=True
    )
    is_overdue = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = RiskTreatmentAction
        fields = [
            'id', 'company', 'risk', 'risk_title', 'action_title',
            'action_description', 'action_type', 'action_owner',
            'action_owner_email', 'due_date', 'completion_date', 'status',
            'progress_percentage', 'progress_notes', 'estimated_cost',
            'actual_cost', 'is_overdue', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'company', 'created_at', 'updated_at']
    
    def validate(self, attrs):
        """Validate treatment action"""
        request = self.context.get('request')
        
        # Set company from request
        if hasattr(request, 'tenant'):
            attrs['company'] = request.tenant
        
        # Validate risk belongs to company
        risk = attrs.get('risk', getattr(self.instance, 'risk', None))
        if risk and risk.company != attrs['company']:
            raise serializers.ValidationError({
                'risk': 'Risk must belong to your company'
            })
        
        return attrs


class RiskRegisterSummarySerializer(serializers.Serializer):
    """Serializer for risk register summary"""
    
    total_risks = serializers.IntegerField()
    by_level = serializers.ListField()
    by_category = serializers.ListField()
    by_status = serializers.ListField()
    avg_inherent_score = serializers.FloatField()
    avg_residual_score = serializers.FloatField()


class RiskHeatMapSerializer(serializers.Serializer):
    """Serializer for risk heat map data"""
    
    inherent = serializers.ListField()
    residual = serializers.ListField()
    matrix = serializers.DictField()


class TopRisksSerializer(serializers.Serializer):
    """Serializer for top risks"""
    
    risk_id = serializers.UUIDField()
    title = serializers.CharField()
    category = serializers.CharField()
    inherent_score = serializers.IntegerField()
    inherent_level = serializers.CharField()
    residual_score = serializers.IntegerField()
    residual_level = serializers.CharField()
    risk_reduction = serializers.FloatField()
    control_count = serializers.IntegerField()
    owner = serializers.CharField(allow_null=True)


class RiskTrendSerializer(serializers.Serializer):
    """Serializer for risk trends"""
    
    month = serializers.CharField()
    avg_residual_score = serializers.FloatField()
    assessment_count = serializers.IntegerField()


class RiskTreatmentPrioritySerializer(serializers.Serializer):
    """Serializer for risk treatment priorities"""
    
    risk_id = serializers.UUIDField()
    title = serializers.CharField()
    priority = serializers.CharField()
    inherent_level = serializers.CharField()
    residual_level = serializers.CharField()
    control_count = serializers.IntegerField()
    avg_effectiveness = serializers.FloatField()
    recommendation = serializers.CharField()