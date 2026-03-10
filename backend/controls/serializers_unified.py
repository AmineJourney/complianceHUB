# backend/controls/serializers_unified.py

from rest_framework import serializers
from .models import UnifiedControl, UnifiedControlMapping, AppliedControl


class UnifiedControlSerializer(serializers.ModelSerializer):
    """Serializer for UnifiedControl"""
    
    framework_coverage = serializers.SerializerMethodField()
    implementation_count = serializers.SerializerMethodField()
    
    class Meta:
        model = UnifiedControl
        fields = [
            'id', 'control_code', 'control_name', 'short_name',
            'domain', 'category', 'control_family',
            'description', 'control_objective', 'implementation_guidance',
            'control_type', 'automation_level', 'implementation_complexity',
            'estimated_effort_hours',
            'maturity_level_1_criteria', 'maturity_level_2_criteria',
            'maturity_level_3_criteria', 'maturity_level_4_criteria',
            'maturity_level_5_criteria',
            'testing_procedures', 'testing_frequency',
            'prerequisites', 'related_controls', 'tags',
            'is_active', 'framework_coverage', 'implementation_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_framework_coverage(self, obj):
        """Get frameworks this control satisfies"""
        mappings = obj.reference_mappings.select_related(
            'reference_control'
        ).prefetch_related(
            'reference_control__requirement_mappings__requirement__framework'
        )
        
        frameworks = set()
        for mapping in mappings:
            for req_mapping in mapping.reference_control.requirement_mappings.all():
                frameworks.add(req_mapping.requirement.framework.code)
        
        return list(frameworks)
    
    def get_implementation_count(self, obj):
        return obj.get_implementation_count()


class UnifiedControlMappingSerializer(serializers.ModelSerializer):
    """Serializer for control mappings"""
    
    reference_control_code = serializers.CharField(source='reference_control.code', read_only=True)
    unified_control_code = serializers.CharField(source='unified_control.control_code', read_only=True)
    
    class Meta:
        model = UnifiedControlMapping
        fields = [
            'id', 'reference_control', 'reference_control_code',
            'unified_control', 'unified_control_code',
            'coverage_type', 'coverage_percentage',
            'mapping_rationale', 'gap_description', 'supplemental_actions',
            'confidence_score', 'verified_by', 'verified_at',
            'created_at', 'updated_at'
        ]


class AppliedControlEnhancedSerializer(serializers.ModelSerializer):
    """Enhanced AppliedControl serializer with maturity info"""
    
    unified_control_code = serializers.CharField(
        source='unified_control.control_code',
        read_only=True
    )
    unified_control_name = serializers.CharField(
        source='unified_control.control_name',
        read_only=True
    )
    maturity_criteria = serializers.SerializerMethodField()
    frameworks_satisfied = serializers.SerializerMethodField()
    
    class Meta:
        model = AppliedControl
        fields = [
            'id', 'unified_control', 'unified_control_code', 'unified_control_name',
            'reference_control',  # Keep for backward compatibility
            'status', 'maturity_level', 'maturity_target_level',
            'maturity_assessment_date', 'maturity_notes', 'maturity_criteria',
            'control_owner', 'department',
            'implementation_notes', 'effectiveness_rating',
            'last_tested_date', 'next_review_date',
            'frameworks_satisfied',
            'created_at', 'updated_at'
        ]
    
    def get_maturity_criteria(self, obj):
        return obj.get_maturity_criteria()
    
    def get_frameworks_satisfied(self, obj):
        """Get all frameworks this implementation satisfies"""
        if obj.unified_control:
            return obj.unified_control.get_framework_coverage()
        return {}