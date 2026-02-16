from rest_framework import serializers
from .models import (
    ReferenceControl, AppliedControl, 
    RequirementReferenceControl, ControlException
)
from library.serializers import RequirementListSerializer


class ReferenceControlSerializer(serializers.ModelSerializer):
    """Reference control serializer"""
    
    mapped_requirements_count = serializers.IntegerField(
        source='get_mapped_requirements_count',
        read_only=True
    )
    applied_count = serializers.IntegerField(
        source='get_applied_count',
        read_only=True
    )
    
    class Meta:
        model = ReferenceControl
        fields = [
            'id', 'code', 'name', 'description', 'control_family', 'control_type',
            'implementation_guidance', 'testing_procedures', 'automation_level',
            'frequency', 'maturity_level', 'priority', 'implementation_complexity',
            'estimated_effort_hours', 'is_published', 'tags',
            'mapped_requirements_count', 'applied_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ReferenceControlListSerializer(serializers.ModelSerializer):
    """Lightweight reference control serializer for lists"""
    
    class Meta:
        model = ReferenceControl
        fields = [
            'id', 'code', 'name', 'control_family', 'control_type',
            'priority', 'automation_level', 'is_published'
        ]


class AppliedControlSerializer(serializers.ModelSerializer):
    """Applied control serializer"""
    
    reference_control_code = serializers.CharField(
        source='reference_control.code',
        read_only=True
    )
    reference_control_name = serializers.CharField(
        source='reference_control.name',
        read_only=True
    )
    department_name = serializers.CharField(
        source='department.name',
        read_only=True
    )
    control_owner_email = serializers.CharField(
        source='control_owner.email',
        read_only=True
    )
    evidence_count = serializers.IntegerField(
        source='get_evidence_count',
        read_only=True
    )
    compliance_score = serializers.SerializerMethodField()
    is_overdue = serializers.BooleanField(
        source='is_overdue_for_review',
        read_only=True
    )
    
    class Meta:
        model = AppliedControl
        fields = [
            'id', 'company', 'reference_control', 'reference_control_code',
            'reference_control_name', 'department', 'department_name',
            'status', 'control_owner', 'control_owner_email',
            'implementation_notes', 'custom_procedures', 'custom_frequency',
            'effectiveness_rating', 'last_tested_date', 'last_tested_by',
            'test_results', 'next_review_date', 'last_review_date',
            'reviewed_by', 'has_deficiencies', 'deficiency_notes',
            'remediation_plan', 'remediation_due_date',
            'implementation_cost', 'annual_maintenance_cost',
            'evidence_count', 'compliance_score', 'is_overdue',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'company', 'created_at', 'updated_at']
    
    def get_compliance_score(self, obj):
        return obj.calculate_compliance_score()
    
    def validate(self, attrs):
        """Validate applied control"""
        request = self.context.get('request')
        
        # Set company from request
        if hasattr(request, 'tenant'):
            attrs['company'] = request.tenant
        
        # Validate department belongs to same company
        department = attrs.get('department')
        if department and department.company != attrs['company']:
            raise serializers.ValidationError({
                'department': 'Department must belong to the same company'
            })
        
        # Validate control owner is member of company
        control_owner = attrs.get('control_owner')
        if control_owner:
            from core.models import Membership
            is_member = Membership.objects.filter(
                user=control_owner,
                company=attrs['company'],
                is_deleted=False
            ).exists()
            
            if not is_member:
                raise serializers.ValidationError({
                    'control_owner': 'Control owner must be a member of the company'
                })
        
        return attrs


class AppliedControlListSerializer(serializers.ModelSerializer):
    """Lightweight applied control serializer for lists"""
    
    reference_control_code = serializers.CharField(source='reference_control.code')
    reference_control_name = serializers.CharField(source='reference_control.name')
    department_name = serializers.CharField(source='department.name', allow_null=True)
    
    class Meta:
        model = AppliedControl
        fields = [
            'id', 'reference_control_code', 'reference_control_name',
            'department_name', 'status', 'effectiveness_rating',
            'has_deficiencies', 'next_review_date'
        ]


class RequirementReferenceControlSerializer(serializers.ModelSerializer):
    """Requirement-control mapping serializer"""
    
    requirement_code = serializers.CharField(source='requirement.code', read_only=True)
    requirement_title = serializers.CharField(source='requirement.title', read_only=True)
    control_code = serializers.CharField(source='reference_control.code', read_only=True)
    control_name = serializers.CharField(source='reference_control.name', read_only=True)
    
    class Meta:
        model = RequirementReferenceControl
        fields = [
            'id', 'requirement', 'requirement_code', 'requirement_title',
            'reference_control', 'control_code', 'control_name',
            'mapping_rationale', 'coverage_level', 'is_primary',
            'validation_status', 'validated_by', 'validated_at',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'validated_at', 'created_at', 'updated_at']


class ControlExceptionSerializer(serializers.ModelSerializer):
    """Control exception serializer"""
    
    applied_control_code = serializers.CharField(
        source='applied_control.reference_control.code',
        read_only=True
    )
    accepted_by_email = serializers.CharField(
        source='accepted_by.email',
        read_only=True
    )
    is_expired = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = ControlException
        fields = [
            'id', 'company', 'applied_control', 'applied_control_code',
            'exception_type', 'reason', 'compensating_controls',
            'risk_acceptance', 'accepted_by', 'accepted_by_email',
            'accepted_at', 'expiration_date', 'is_active', 'is_expired',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'company', 'accepted_at', 'created_at', 'updated_at']
    
    def validate(self, attrs):
        """Validate exception"""
        request = self.context.get('request')
        
        # Set company from request
        if hasattr(request, 'tenant'):
            attrs['company'] = request.tenant
        
        # Validate applied control belongs to company
        applied_control = attrs.get('applied_control')
        if applied_control and applied_control.company != attrs['company']:
            raise serializers.ValidationError({
                'applied_control': 'Control must belong to the same company'
            })
        
        return attrs


class ControlCoverageSerializer(serializers.Serializer):
    """Serializer for control coverage calculations"""
    
    total_controls = serializers.IntegerField()
    implemented_controls = serializers.IntegerField()
    operational_controls = serializers.IntegerField()
    coverage_percentage = serializers.FloatField()
    status = serializers.CharField()


class ControlDashboardSerializer(serializers.Serializer):
    """Serializer for control dashboard metrics"""
    
    total_controls = serializers.IntegerField()
    status_breakdown = serializers.ListField()
    avg_compliance_score = serializers.FloatField()
    family_breakdown = serializers.ListField()
    overdue_reviews = serializers.IntegerField()
    controls_with_deficiencies = serializers.IntegerField()
    evidence_coverage_percentage = serializers.FloatField()