from rest_framework import serializers
from .models import Evidence, AppliedControlEvidence, EvidenceAccessLog, EvidenceComment
from .services import EvidenceValidationService, EvidenceService


class EvidenceSerializer(serializers.ModelSerializer):
    uploaded_by_email = serializers.SerializerMethodField()
    verified_by_email = serializers.SerializerMethodField()
    file_size_display = serializers.CharField(source='get_file_size_display', read_only=True)
    file_extension = serializers.CharField(source='get_file_extension', read_only=True)
    linked_controls_count = serializers.IntegerField(source='get_linked_controls_count', read_only=True)
    # is_expired is a regular method, not a @property — must use SerializerMethodField
    is_expired = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Evidence
        fields = [
            'id', 'company', 'name', 'description', 'file', 'file_url',
            'file_size', 'file_size_display', 'file_type', 'file_extension',
            'file_hash', 'evidence_type', 'is_valid', 'validity_start_date',
            'validity_end_date', 'uploaded_by', 'uploaded_by_email',
            'verification_status', 'verified_by', 'verified_by_email',
            'verified_at', 'verification_notes', 'is_confidential',
            'tags', 'version', 'previous_version', 'linked_controls_count',
            'is_expired', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'company', 'file_size', 'file_type', 'file_hash',
            'verified_at', 'created_at', 'updated_at',
        ]

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return None

    def get_is_expired(self, obj):
        return obj.is_expired()

    def get_uploaded_by_email(self, obj):
        return obj.uploaded_by.email if obj.uploaded_by else None

    def get_verified_by_email(self, obj):
        return obj.verified_by.email if obj.verified_by else None

    def validate_file(self, file):
        is_valid, error = EvidenceValidationService.validate_file(file, max_size_mb=100)
        if not is_valid:
            raise serializers.ValidationError(error)
        return file

    def validate_tags(self, value):
        """
        Tags arrive as a JSON string from multipart FormData.
        Frontend sends: data.append("tags", JSON.stringify(["a","b"]))
        Parse it back to a list here so the model always gets a list.
        """
        import json
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
                if not isinstance(parsed, list):
                    raise serializers.ValidationError("tags must be a JSON array")
                return parsed
            except (json.JSONDecodeError, ValueError):
                return [value] if value else []
        return value  # already a list (JSON body requests)

    def validate(self, attrs):
        request = self.context.get('request')
        if hasattr(request, 'tenant'):
            attrs['company'] = request.tenant
            if not self.instance:
                quota = EvidenceService.check_storage_quota(request.tenant)
                if quota['is_over_quota']:
                    raise serializers.ValidationError(
                        'Storage quota exceeded. Please upgrade your plan or delete old files.'
                    )
        if not self.instance and request:
            attrs['uploaded_by'] = request.user
        return attrs


class EvidenceListSerializer(serializers.ModelSerializer):
    uploaded_by_email = serializers.SerializerMethodField()
    file_size_display = serializers.CharField(source='get_file_size_display', read_only=True)
    file_extension = serializers.CharField(source='get_file_extension', read_only=True)

    class Meta:
        model = Evidence
        fields = [
            'id', 'name', 'evidence_type', 'file_extension', 'file_size_display',
            'verification_status', 'uploaded_by_email', 'is_valid',
            'validity_end_date', 'created_at',
        ]

    def get_uploaded_by_email(self, obj):
        return obj.uploaded_by.email if obj.uploaded_by else None


class AppliedControlEvidenceSerializer(serializers.ModelSerializer):
    control_code = serializers.CharField(
        source='applied_control.reference_control.code', read_only=True
    )
    control_name = serializers.CharField(
        source='applied_control.reference_control.name', read_only=True
    )
    evidence_name = serializers.CharField(source='evidence.name', read_only=True)
    linked_by_email = serializers.SerializerMethodField()

    # ── KEY FIELD ──────────────────────────────────────────────────────────────
    # Returns the distinct framework codes that this control satisfies.
    # Because AppliedControl is unique per (company, reference_control), a single
    # evidence link covers ALL frameworks that share the same reference control.
    # e.g. ISO 27001 A.9.1.1 and TISAX 1.1.2 both map to "ACC-001" →
    #      evidence linked to ACC-001 returns frameworks: ["ISO-27001", "TISAX"]
    frameworks = serializers.SerializerMethodField()

    class Meta:
        model = AppliedControlEvidence
        fields = [
            'id', 'company', 'applied_control', 'control_code', 'control_name',
            'evidence', 'evidence_name', 'link_type', 'notes', 'linked_by',
            'linked_by_email', 'relevance_score', 'frameworks',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'company', 'created_at', 'updated_at']

    def get_linked_by_email(self, obj):
        return obj.linked_by.email if obj.linked_by else None

    def get_frameworks(self, obj):
        """
        Walk: AppliedControlEvidence → AppliedControl → ReferenceControl
              → RequirementReferenceControl → Requirement → Framework.code

        The query is cheap: select_related is done at the viewset queryset level
        and the requirement_mappings are a small set per control.
        """
        return list(
            obj.applied_control.reference_control
            .requirement_mappings
            .filter(is_deleted=False)
            .select_related('requirement__framework')
            .values_list('requirement__framework__code', flat=True)
            .distinct()
        )

    def validate(self, attrs):
        request = self.context.get('request')
        if hasattr(request, 'tenant'):
            attrs['company'] = request.tenant
        applied_control = attrs.get('applied_control')
        evidence = attrs.get('evidence')
        if applied_control and evidence:
            if applied_control.company != evidence.company:
                raise serializers.ValidationError(
                    'Control and evidence must belong to the same company'
                )
            if hasattr(request, 'tenant') and applied_control.company != request.tenant:
                raise serializers.ValidationError('Control must belong to your company')
        if not self.instance and request:
            attrs['linked_by'] = request.user
        return attrs


class EvidenceAccessLogSerializer(serializers.ModelSerializer):
    accessed_by_email = serializers.SerializerMethodField()
    evidence_name = serializers.CharField(source='evidence.name', read_only=True)

    class Meta:
        model = EvidenceAccessLog
        fields = [
            'id', 'evidence', 'evidence_name', 'accessed_by', 'accessed_by_email',
            'access_type', 'ip_address', 'user_agent', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def get_accessed_by_email(self, obj):
        return obj.accessed_by.email if obj.accessed_by else None


class EvidenceCommentSerializer(serializers.ModelSerializer):
    author_email = serializers.SerializerMethodField()
    author_name = serializers.SerializerMethodField()
    replies = serializers.SerializerMethodField()

    class Meta:
        model = EvidenceComment
        fields = [
            'id', 'evidence', 'author', 'author_email', 'author_name',
            'comment', 'parent', 'replies', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_author_email(self, obj):
        return obj.author.email if obj.author else None

    def get_author_name(self, obj):
        if not obj.author:
            return 'Unknown'
        return f"{obj.author.first_name} {obj.author.last_name}".strip() or obj.author.email

    def get_replies(self, obj):
        replies = obj.replies.filter(is_deleted=False).order_by('created_at')
        return EvidenceCommentSerializer(replies, many=True).data


class EvidenceAnalyticsSerializer(serializers.Serializer):
    total_evidence = serializers.IntegerField()
    by_type = serializers.ListField()
    by_status = serializers.ListField()
    expired_count = serializers.IntegerField()
    unlinked_count = serializers.IntegerField()
    storage = serializers.DictField()