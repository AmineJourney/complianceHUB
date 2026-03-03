from rest_framework import serializers
from .models import ReferenceControl, AppliedControl, RequirementReferenceControl, ControlException


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