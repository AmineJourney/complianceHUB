from rest_framework import serializers
from .models import (
    ComplianceResult, ComplianceGap, FrameworkAdoption, ComplianceReport
)
from library.serializers import FrameworkSerializer
from django.utils import timezone
from .models import ComplianceResult
from drf_spectacular.utils import extend_schema_field

class ComplianceResultSerializer(serializers.ModelSerializer):
    """Serializer for ComplianceResult with computed fields."""

    # Direct model fields with nested sources
    framework_code = serializers.CharField(source='framework.code', read_only=True)
    framework_name = serializers.CharField(source='framework.name', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    calculated_by_email = serializers.CharField(source='calculated_by.email', read_only=True)

    # Computed fields from model methods
    compliance_grade = serializers.CharField(source='get_compliance_grade', read_only=True)
    compliance_status = serializers.CharField(source='get_compliance_status', read_only=True)

    # SerializerMethodField example
    gap_count = serializers.SerializerMethodField()
    is_certification_expired = serializers.SerializerMethodField()

    @extend_schema_field(serializers.IntegerField())
    def get_gap_count(self, obj):
        # Assumes `ComplianceResult` model has `get_gap_count()` method
        return obj.get_gap_count()

    @extend_schema_field(serializers.BooleanField())
    def get_is_certification_expired(self, obj):
        # Assumes model has a `certification_expiry_date` field
        if obj.certification_expiry_date:
            return obj.certification_expiry_date < timezone.now()
        return False

    class Meta:
        model = ComplianceResult
        fields = [
            'id', 'company', 'framework', 'framework_code', 'framework_name',
            'department', 'department_name', 'coverage_percentage', 'compliance_score',
            'compliance_grade', 'compliance_status', 'total_requirements',
            'requirements_addressed', 'requirements_compliant', 'requirements_partial',
            'requirements_non_compliant', 'total_controls', 'controls_operational',
            'controls_implemented', 'controls_in_progress', 'controls_not_started',
            'controls_with_evidence', 'total_evidence_count', 'high_risk_gaps',
            'medium_risk_gaps', 'low_risk_gaps', 'gap_count', 'requirement_details',
            'control_details', 'calculation_date', 'calculated_by', 'calculated_by_email',
            'status', 'error_message', 'is_current', 'created_at', 'updated_at',
            'is_certification_expired',
        ]
        read_only_fields = ['id', 'company', 'calculation_date', 'created_at', 'updated_at']



class ComplianceResultListSerializer(serializers.ModelSerializer):
    """Lightweight compliance result serializer"""
    
    framework_code = serializers.CharField(source='framework.code')
    framework_name = serializers.CharField(source='framework.name')
    compliance_grade = serializers.CharField(source='get_compliance_grade')
    gap_count = serializers.SerializerMethodField()
    
    class Meta:
        model = ComplianceResult
        fields = [
            'id', 'framework_code', 'framework_name', 'compliance_score',
            'compliance_grade', 'coverage_percentage', 'gap_count',
            'calculation_date', 'is_current'
        ]


class ComplianceGapSerializer(serializers.ModelSerializer):
    """Compliance gap serializer"""
    
    requirement_code = serializers.CharField(source='requirement.code', read_only=True)
    requirement_title = serializers.CharField(source='requirement.title', read_only=True)
    remediation_owner_email = serializers.CharField(
        source='remediation_owner.email',
        read_only=True
    )
    
    class Meta:
        model = ComplianceGap
        fields = [
            'id', 'company', 'compliance_result', 'requirement', 'requirement_code',
            'requirement_title', 'gap_type', 'severity', 'description',
            'affected_controls', 'remediation_plan', 'remediation_owner',
            'remediation_owner_email', 'remediation_due_date', 'status',
            'resolved_at', 'resolved_by', 'resolution_notes',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'company', 'resolved_at', 'created_at', 'updated_at']
    
    def validate(self, attrs):
        """Validate gap"""
        request = self.context.get('request')
        
        # Set company from request
        if hasattr(request, 'tenant'):
            attrs['company'] = request.tenant
        
        return attrs


class FrameworkAdoptionSerializer(serializers.ModelSerializer):
    """Framework adoption serializer"""
    
    framework_code = serializers.CharField(source='framework.code', read_only=True)
    framework_name = serializers.CharField(source='framework.name', read_only=True)
    program_owner_email = serializers.CharField(source='program_owner.email', read_only=True)
    is_certification_expired = serializers.BooleanField(read_only=True)
    is_audit_overdue = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = FrameworkAdoption
        fields = [
            'id', 'company', 'framework', 'framework_code', 'framework_name',
            'adoption_status', 'target_completion_date', 'actual_completion_date',
            'is_certified', 'certification_body', 'certification_date',
            'certification_expiry_date', 'certificate_number', 'scope_description',
            'scope_exclusions', 'program_owner', 'program_owner_email',
            'last_audit_date', 'next_audit_date', 'notes',
            'is_certification_expired', 'is_audit_overdue',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'company', 'created_at', 'updated_at']
    
    def validate(self, attrs):
        """Validate adoption"""
        request = self.context.get('request')
        
        # Set company from request
        if hasattr(request, 'tenant'):
            attrs['company'] = request.tenant
        
        return attrs


class ComplianceReportSerializer(serializers.ModelSerializer):
    """Compliance report serializer"""
    
    framework_code = serializers.CharField(source='framework.code', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    generated_by_email = serializers.CharField(source='generated_by.email', read_only=True)
    report_url = serializers.SerializerMethodField()
    
    class Meta:
        model = ComplianceReport
        fields = [
            'id', 'company', 'title', 'description', 'framework', 'framework_code',
            'department', 'department_name', 'report_type', 'period_start',
            'period_end', 'report_file', 'report_url', 'report_format',
            'generated_by', 'generated_by_email', 'generation_status',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'company', 'report_file', 'generation_status',
            'created_at', 'updated_at'
        ]
    
    def get_report_url(self, obj):
        """Get report file URL"""
        request = self.context.get('request')
        if obj.report_file and request:
            return request.build_absolute_uri(obj.report_file.url)
        return None
    
    def validate(self, attrs):
        """Validate report"""
        request = self.context.get('request')
        
        # Set company from request
        if hasattr(request, 'tenant'):
            attrs['company'] = request.tenant
        
        # Set generated_by
        if not self.instance and request:
            attrs['generated_by'] = request.user
        
        return attrs


class ComplianceOverviewSerializer(serializers.Serializer):
    """Serializer for compliance overview"""
    
    total_frameworks = serializers.IntegerField()
    avg_compliance_score = serializers.FloatField()
    avg_coverage = serializers.FloatField()
    frameworks = serializers.ListField()


class ComplianceTrendSerializer(serializers.Serializer):
    """Serializer for compliance trends"""
    
    date = serializers.DateField()
    compliance_score = serializers.FloatField()
    coverage_percentage = serializers.FloatField()
    grade = serializers.CharField()


class GapAnalysisSerializer(serializers.Serializer):
    """Serializer for gap analysis"""
    
    gaps = serializers.ListField()
    total = serializers.IntegerField()
    by_severity = serializers.DictField()


class RecommendationSerializer(serializers.Serializer):
    """Serializer for compliance recommendations"""
    
    priority = serializers.CharField()
    type = serializers.CharField()
    title = serializers.CharField()
    description = serializers.CharField()
    estimated_impact = serializers.CharField()