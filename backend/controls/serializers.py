from rest_framework import serializers
from .models import ReferenceControl, AppliedControl, RequirementReferenceControl, ControlException,UnifiedControl, UnifiedControlMapping


class ReferenceControlListSerializer(serializers.ModelSerializer):
    """
    List serializer — includes framework codes, library names, and description
    for the Apply dialog and the Reference Control Library page.
    """

    frameworks = serializers.SerializerMethodField()
    library_names = serializers.SerializerMethodField()

    class Meta:
        model = ReferenceControl
        fields = [
            "id", "code", "name", "description",
            "control_family", "control_type", "priority",
            "automation_level", "is_published",
            "frameworks",
            "library_names",
        ]

    def get_frameworks(self, obj):
        return list(
            obj.requirement_mappings
            .filter(is_deleted=False)
            .select_related("requirement__framework")
            .values_list("requirement__framework__code", flat=True)
            .distinct()
        )

    def get_library_names(self, obj):
        """
        Walk the FK chain:
          RequirementReferenceControl
            → Requirement → Framework → LoadedLibrary → StoredLibrary.name
        Returns a deduplicated list of all library names this control belongs to.
        """
        return list(
            obj.requirement_mappings
            .filter(is_deleted=False)
            .select_related(
                "requirement__framework__loaded_library__stored_library"
            )
            .values_list(
                "requirement__framework__loaded_library__stored_library__name",
                flat=True,
            )
            .distinct()
        )


class ReferenceControlSerializer(serializers.ModelSerializer):
    """Full detail serializer."""

    mapped_requirements_count = serializers.IntegerField(
        source="get_mapped_requirements_count", read_only=True
    )
    applied_count = serializers.IntegerField(
        source="get_applied_count", read_only=True
    )
    frameworks = serializers.SerializerMethodField()
    library_names = serializers.SerializerMethodField()

    class Meta:
        model = ReferenceControl
        fields = [
            "id", "code", "name", "description",
            "control_family", "control_type",
            "implementation_guidance", "testing_procedures",
            "automation_level", "frequency", "maturity_level",
            "priority", "implementation_complexity", "estimated_effort_hours",
            "is_published", "tags",
            "mapped_requirements_count", "applied_count",
            "frameworks",
            "library_names",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_frameworks(self, obj):
        return list(
            obj.requirement_mappings
            .filter(is_deleted=False)
            .select_related("requirement__framework")
            .values_list("requirement__framework__code", flat=True)
            .distinct()
        )

    def get_library_names(self, obj):
        return list(
            obj.requirement_mappings
            .filter(is_deleted=False)
            .select_related(
                "requirement__framework__loaded_library__stored_library"
            )
            .values_list(
                "requirement__framework__loaded_library__stored_library__name",
                flat=True,
            )
            .distinct()
        )

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


class AppliedControlSerializer(serializers.ModelSerializer):
    reference_control_code = serializers.CharField(
        source="reference_control.code", read_only=True
    )
    reference_control_name = serializers.CharField(
        source="reference_control.name", read_only=True
    )
    reference_control_description = serializers.CharField(
        source="reference_control.description", read_only=True
    )
    reference_control_family = serializers.CharField(
        source="reference_control.control_family", read_only=True
    )
    reference_control_type = serializers.CharField(
        source="reference_control.control_type", read_only=True
    )
    department_name = serializers.CharField(
        source="department.name", read_only=True
    )
    control_owner_email = serializers.CharField(
        source="control_owner.email", read_only=True
    )
    evidence_count = serializers.SerializerMethodField()
    compliance_score = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()
    frameworks = serializers.SerializerMethodField()

    class Meta:
        model = AppliedControl
        fields = [
            "id", "reference_control",
            "reference_control_code", "reference_control_name",
            "reference_control_description", "reference_control_family",
            "reference_control_type",
            "department", "department_name",
            "status", "control_owner", "control_owner_email",
            "implementation_notes", "custom_procedures", "custom_frequency",
            "effectiveness_rating", "last_tested_date", "next_review_date",
            "has_deficiencies", "evidence_count", "compliance_score", "is_overdue",
            "frameworks", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_evidence_count(self, obj):
        return obj.get_evidence_count()

    def get_compliance_score(self, obj):
        return obj.calculate_compliance_score()

    def get_is_overdue(self, obj):
        return obj.is_overdue_for_review()

    def get_frameworks(self, obj):
        return list(
            obj.reference_control.requirement_mappings
            .filter(is_deleted=False)
            .select_related("requirement__framework")
            .values_list("requirement__framework__code", flat=True)
            .distinct()
        )

    def validate(self, attrs):
        return attrs


class AppliedControlListSerializer(serializers.ModelSerializer):
    """Lighter serializer for list views."""

    reference_control_code = serializers.CharField(
        source="reference_control.code", read_only=True
    )
    reference_control_name = serializers.CharField(
        source="reference_control.name", read_only=True
    )
    reference_control_family = serializers.CharField(
        source="reference_control.control_family", read_only=True
    )
    reference_control_type = serializers.CharField(
        source="reference_control.control_type", read_only=True
    )
    department_name = serializers.CharField(
        source="department.name", read_only=True
    )
    control_owner_email = serializers.CharField(
        source="control_owner.email", read_only=True
    )
    evidence_count = serializers.SerializerMethodField()
    compliance_score = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()
    frameworks = serializers.SerializerMethodField()

    class Meta:
        model = AppliedControl
        fields = [
            "id", "reference_control",
            "reference_control_code", "reference_control_name",
            "reference_control_family", "reference_control_type",
            "department", "department_name",
            "status", "control_owner", "control_owner_email",
            "effectiveness_rating", "last_tested_date", "next_review_date",
            "has_deficiencies", "evidence_count", "compliance_score", "is_overdue",
            "frameworks", "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_evidence_count(self, obj):
        return obj.get_evidence_count()

    def get_compliance_score(self, obj):
        return obj.calculate_compliance_score()

    def get_is_overdue(self, obj):
        return obj.is_overdue_for_review()

    def get_frameworks(self, obj):
        return list(
            obj.reference_control.requirement_mappings
            .filter(is_deleted=False)
            .select_related("requirement__framework")
            .values_list("requirement__framework__code", flat=True)
            .distinct()
        )


class RequirementReferenceControlSerializer(serializers.ModelSerializer):
    reference_control_code = serializers.CharField(
        source="reference_control.code", read_only=True
    )
    reference_control_name = serializers.CharField(
        source="reference_control.name", read_only=True
    )

    class Meta:
        model = RequirementReferenceControl
        fields = [
            "id", "requirement", "reference_control",
            "reference_control_code", "reference_control_name",
            "coverage_level", "is_primary", "validation_status",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class ControlExceptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ControlException
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]


class ControlCoverageSerializer(serializers.Serializer):
    framework_code = serializers.CharField()
    total_requirements = serializers.IntegerField()
    covered_requirements = serializers.IntegerField()
    coverage_percentage = serializers.FloatField()


class ControlDashboardSerializer(serializers.Serializer):
    total_controls = serializers.IntegerField()
    status_breakdown = serializers.ListField()
    avg_compliance_score = serializers.FloatField()
    family_breakdown = serializers.ListField()
    overdue_reviews = serializers.IntegerField()
    controls_with_deficiencies = serializers.IntegerField()
    evidence_coverage_percentage = serializers.FloatField()