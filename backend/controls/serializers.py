from rest_framework import serializers
from .models import ReferenceControl, AppliedControl, RequirementReferenceControl, ControlException


class ReferenceControlListSerializer(serializers.ModelSerializer):
    """List serializer — includes framework codes and description for the Apply dialog."""

    frameworks = serializers.SerializerMethodField()

    class Meta:
        model = ReferenceControl
        fields = [
            "id", "code", "name", "description",
            "control_family", "control_type", "priority",
            "automation_level", "is_published", "frameworks",
        ]

    def get_frameworks(self, obj):
        return list(
            obj.requirement_mappings
            .filter(is_deleted=False)
            .select_related("requirement__framework")
            .values_list("requirement__framework__code", flat=True)
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

    class Meta:
        model = ReferenceControl
        fields = [
            "id", "code", "name", "description",
            "control_family", "control_type",
            "implementation_guidance", "testing_procedures",
            "automation_level", "frequency", "maturity_level",
            "priority", "implementation_complexity", "estimated_effort_hours",
            "is_published", "tags",
            "mapped_requirements_count", "applied_count", "frameworks",
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
    # Use the correct model method names
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
        request = self.context.get("request")
        if not request or not hasattr(request, "tenant"):
            return attrs
        control_owner = attrs.get("control_owner")
        if control_owner:
            from core.models import Membership
            if not Membership.objects.filter(
                user=control_owner, company=request.tenant, is_deleted=False
            ).exists():
                raise serializers.ValidationError(
                    {"control_owner": "Control owner must be a member of the company"}
                )
        return attrs


class AppliedControlListSerializer(serializers.ModelSerializer):
    reference_control_code = serializers.CharField(source="reference_control.code")
    reference_control_name = serializers.CharField(source="reference_control.name")
    department_name = serializers.CharField(
        source="department.name", allow_null=True, default=None
    )
    compliance_score = serializers.SerializerMethodField()

    class Meta:
        model = AppliedControl
        fields = [
            "id", "reference_control_code", "reference_control_name",
            "department_name", "status", "effectiveness_rating",
            "has_deficiencies", "next_review_date", "compliance_score",
        ]

    def get_compliance_score(self, obj):
        return obj.calculate_compliance_score()


class RequirementReferenceControlSerializer(serializers.ModelSerializer):
    requirement_code = serializers.CharField(source="requirement.code", read_only=True)
    requirement_title = serializers.CharField(source="requirement.title", read_only=True)
    control_code = serializers.CharField(source="reference_control.code", read_only=True)
    control_name = serializers.CharField(source="reference_control.name", read_only=True)

    class Meta:
        model = RequirementReferenceControl
        fields = [
            "id", "requirement", "requirement_code", "requirement_title",
            "reference_control", "control_code", "control_name",
            "mapping_rationale", "coverage_level", "is_primary",
            "validation_status", "validated_by", "validated_at",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "validated_at", "created_at", "updated_at"]


class ControlExceptionSerializer(serializers.ModelSerializer):
    applied_control_code = serializers.CharField(
        source="applied_control.reference_control.code", read_only=True
    )

    class Meta:
        model = ControlException
        fields = [
            "id", "applied_control", "applied_control_code",
            "exception_type", "justification", "risk_acceptance_level",
            "approved_by", "approval_date", "expiry_date", "is_expired",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ControlCoverageSerializer(serializers.Serializer):
    framework_id = serializers.UUIDField()
    framework_code = serializers.CharField()
    framework_name = serializers.CharField()
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